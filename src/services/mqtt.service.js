/**
 * BlazeIoT Solutions - MQTT Service
 * Manages connection to HiveMQ Cloud broker and message processing
 */

const mqtt = require('mqtt');
const config = require('../config/config');
const dbService = require('./database.service');
const logger = require('../utils/logger');
const { isValidJSON, sanitizeString } = require('../utils/validators');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.wsServer = null; // WebSocket server reference for real-time updates
  }

  /**
   * Connect to MQTT broker
   */
  connect() {
    return new Promise((resolve, reject) => {
      const connectUrl = `${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`;
      
      const options = {
        username: config.mqtt.username,
        password: config.mqtt.password,
        clientId: config.mqtt.clientId,
        protocol: config.mqtt.protocol,
        reconnectPeriod: config.mqtt.reconnectPeriod,
        connectTimeout: config.mqtt.connectTimeout,
        clean: true,
        rejectUnauthorized: true,
      };

      logger.mqtt(`Connecting to ${connectUrl} with clientId: ${config.mqtt.clientId}`);

      this.client = mqtt.connect(connectUrl, options);

      // Connection success
      this.client.on('connect', (connack) => {
        this.isConnected = true;
        logger.mqtt('Connected to HiveMQ Cloud broker', connack);
        
        // Subscribe to topics
        this.subscribeToTopics();
        
        resolve();
      });

      // Connection error
      this.client.on('error', (error) => {
        logger.error('MQTT connection error:', error);
        
        // Log to database
        dbService.insertLog({
          level: 'error',
          category: 'mqtt',
          message: `MQTT connection error: ${error.message}`,
          metadata: { error: error.toString() },
        }).catch(err => logger.error('Failed to log MQTT error:', err));

        if (!this.isConnected) {
          reject(error);
        }
      });

      // Reconnection
      this.client.on('reconnect', () => {
        logger.mqtt('Reconnecting to broker...');
      });

      // Connection closed
      this.client.on('close', () => {
        this.isConnected = false;
        logger.mqtt('Connection to broker closed');
      });

      // Offline
      this.client.on('offline', () => {
        this.isConnected = false;
        logger.mqtt('Client went offline');
      });

      // Message received
      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });
    });
  }

  /**
   * Subscribe to MQTT topics
   */
  subscribeToTopics() {
    const topics = [
      config.mqtt.topics.sensorData,
      config.mqtt.topics.gatewayData,
      config.mqtt.topics.loraGatewayData,
      config.mqtt.topics.otaResponse,
    ];

    topics.forEach(topic => {
      this.client.subscribe(topic, { qos: 1 }, (err, granted) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          logger.mqtt(`Subscribed to topic: ${topic}`, granted);
        }
      });
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  async handleMessage(topic, message) {
    try {
      const messageStr = message.toString();
      logger.mqtt(`Message received on ${topic}`, { preview: messageStr.substring(0, 100) });

      // Parse message
      if (!isValidJSON(messageStr)) {
        logger.warn(`Invalid JSON message on ${topic}: ${messageStr}`);
        return;
      }

      const payload = JSON.parse(messageStr);

      // Route message based on topic
      if (topic.startsWith('SensorData')) {
        await this.handleSensorData(payload);
      } else if (topic.startsWith('BLEGatewayData')) {
        await this.handleGatewayData(payload);
      } else if (topic.startsWith('LoRaGatewayData')) {
        await this.handleLoRaGatewayData(payload);
      } else if (topic.startsWith('OTA')) {
        await this.handleOTAResponse(payload);
      }

      // Broadcast to WebSocket clients for real-time updates
      this.broadcastToWebSocket({
        type: 'mqtt_message',
        topic,
        payload,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error(`Error handling message on ${topic}:`, error);
      
      await dbService.insertLog({
        level: 'error',
        category: 'mqtt',
        message: `Message processing error on ${topic}: ${error.message}`,
        metadata: { topic, error: error.toString() },
      });
    }
  }

  /**
   * Handle direct IoT device sensor data
   */
  async handleSensorData(payload) {
    const { device_id, type, value } = payload;

    if (!device_id) {
      logger.warn('Sensor data missing device_id:', payload);
      return;
    }

    try {
      // Check if device exists, create if not (auto-registration)
      let device = await dbService.getDeviceById(device_id);
      
      if (!device) {
        logger.mqtt(`Auto-registering new device: ${device_id}`);
        await dbService.insertDevice(device_id, device_id, 'active');
        
        await dbService.insertLog(
          'device',
          `New device auto-registered: ${device_id}`,
          null,
          device_id
        );
      } else {
        // Update device status to online
        await dbService.updateDeviceStatus(device_id, 'active');
      }

      // Prepare sensor data object
      const sensorData = {};
      if (type) sensorData.type = type;
      if (value !== undefined) sensorData.value = value;
      // Include any other fields from payload
      Object.keys(payload).forEach(key => {
        if (!['device_id', 'type', 'value'].includes(key)) {
          sensorData[key] = payload[key];
        }
      });

      // Insert sensor data (no gateway_id for direct devices)
      await dbService.insertSensorData(
        device_id,       // source_id
        'device',        // source_type
        null,            // gateway_id (Direct device, not via gateway)
        sensorData,      // data object
        new Date()       // timestamp
      );

      // Create log entry for device sensor data
      await dbService.insertLog(
        'device',
        `Sensor data received from ${device_id}`,
        JSON.stringify(payload),
        device_id
      );

      logger.mqtt(`Sensor data stored for device ${device_id}`);

    } catch (error) {
      logger.error(`Error handling sensor data for ${device_id}:`, error);
      throw error;
    }
  }

  /**
   * Handle LoRa gateway data (uses node_id as mac)
   * Supports Air Quality, Wildlife Detection, and Environmental Monitoring
   */
  async handleLoRaGatewayData(payload) {
    const { type, gateway_id, node_id } = payload;

    if (!gateway_id || !node_id) {
      logger.warn('LoRa gateway data missing gateway_id or node_id:', payload);
      return;
    }

    // Use node_id as the MAC address for LoRa nodes
    const mac = node_id;
    const dataType = type || 'sensor'; // Default to 'sensor' if type not specified

    try {
      // Check if gateway exists, create if not (auto-registration)
      let gateway = await dbService.getGatewayById(gateway_id);
      
      if (!gateway) {
        logger.mqtt(`Auto-registering new LoRa gateway: ${gateway_id}`);
        await dbService.insertGateway(gateway_id, gateway_id, 'active');
        
        await dbService.insertLog(
          'gateway',
          `New LoRa gateway auto-registered: ${gateway_id}`,
          null,
          gateway_id
        );
      } else {
        // Update gateway status to online
        await dbService.updateGatewayStatus(gateway_id, 'active');
      }

      // Check if node exists, create or update
      let node = await dbService.getNodeByMac(mac);
      
      if (!node) {
        const nodeName = `LoRa_${node_id}`;
        logger.mqtt(`Auto-registering new LoRa node: ${nodeName}`);
        await dbService.insertNode(gateway_id, mac, nodeName, payload.rssi_wifi || 0);
      } else {
        // Update node with latest RSSI
        await dbService.updateNodeStatus(mac, gateway_id, payload.rssi_wifi || node.rssi);
      }

      // Prepare sensor data object - store ALL fields from payload
      const sensorData = { ...payload };
      
      // Remove gateway_id and node_id as they're stored separately
      delete sensorData.gateway_id;
      delete sensorData.node_id;

      // Prepare sensor data object - store ALL fields from payload
      const sensorData = { ...payload };
      
      // Remove gateway_id and node_id as they're stored separately
      delete sensorData.gateway_id;
      delete sensorData.node_id;

      // Insert sensor data
      if (Object.keys(sensorData).length > 0) {
        await dbService.insertSensorData(
          mac,           // source_id (node_id)
          'node',        // source_type
          gateway_id,    // gateway_id
          sensorData,    // data object (all fields preserved)
          new Date()     // timestamp
        );
      }

      // Log sensor data received
      await dbService.insertLog(
        'mqtt',
        `LoRa sensor data from node ${node_id} via ${gateway_id}`,
        JSON.stringify(sensorData),
        mac
      );

      logger.mqtt(`LoRa data stored: ${gateway_id} -> ${node_id} (${Object.keys(sensorData).length} fields)`);

    } catch (error) {
      logger.error(`Error handling LoRa gateway data for ${gateway_id}:`, error);
      throw error;
    }
  }

  /**
   * Handle gateway-node-based device data
   */
  async handleGatewayData(payload) {
    const { gateway_id, beacon_name, mac, temperature, humidity, rssi } = payload;

    if (!gateway_id || !mac) {
      logger.warn('Gateway data missing gateway_id or mac:', payload);
      return;
    }

    try {
      // Check if gateway exists, create if not (auto-registration)
      let gateway = await dbService.getGatewayById(gateway_id);
      
      if (!gateway) {
        logger.mqtt(`Auto-registering new gateway: ${gateway_id}`);
        await dbService.insertGateway(gateway_id, gateway_id, 'active');
        
        await dbService.insertLog(
          'gateway',
          `New gateway auto-registered: ${gateway_id}`,
          null,
          gateway_id
        );
      } else {
        // Update gateway status to online
        await dbService.updateGatewayStatus(gateway_id, 'active');
      }

      // Check if node exists, create or update
      let node = await dbService.getNodeByMac(mac);
      
      if (!node) {
        // Use MAC address as fallback name if beacon_name is empty
        const nodeName = (beacon_name && beacon_name.trim() !== '') ? beacon_name.trim() : mac;
        
        logger.mqtt(`Auto-registering new node: ${nodeName} (${mac})`);
        await dbService.insertNode(gateway_id, mac, nodeName, rssi || 0);
      } else {
        // Update node with latest RSSI
        await dbService.updateNodeStatus(mac, gateway_id, rssi || node.rssi);
      }

      // Prepare sensor data object
      const sensorData = {};
      if (temperature !== undefined) sensorData.temperature = temperature;
      if (humidity !== undefined) sensorData.humidity = humidity;
      if (rssi !== undefined) sensorData.rssi = rssi;

      // Insert sensor data
      if (Object.keys(sensorData).length > 0) {
        await dbService.insertSensorData(
          mac,           // source_id
          'node',        // source_type
          gateway_id,    // gateway_id
          sensorData,    // data object
          new Date()     // timestamp
        );
      }

      // Log sensor data received
      await dbService.insertLog(
        'mqtt',
        `Sensor data received from ${beacon_name || mac} via ${gateway_id}`,
        JSON.stringify({ temperature, humidity, rssi }),
        mac
      );

      logger.mqtt(`Gateway data stored: ${gateway_id} -> ${beacon_name} (${mac})`);

    } catch (error) {
      logger.error(`Error handling gateway data for ${gateway_id}:`, error);
      throw error;
    }
  }

  /**
   * Handle OTA response from devices
   */
  async handleOTAResponse(payload) {
    const { device_id, status, firmware_version, error } = payload;

    if (!device_id) {
      logger.warn('OTA response missing device_id:', payload);
      return;
    }

    try {
      // Log OTA response
      await dbService.insertLog({
        level: status === 'success' ? 'info' : 'error',
        category: 'ota',
        source_id: device_id,
        message: `OTA update ${status} for device ${device_id}`,
        metadata: payload,
      });

      // Update device firmware version if successful
      if (status === 'success' && firmware_version) {
        await dbService.updateDevice(device_id, {
          firmware_version,
        });
      }

      logger.ota(`OTA response from ${device_id}: ${status}`);

    } catch (error) {
      logger.error(`Error handling OTA response for ${device_id}:`, error);
      throw error;
    }
  }

  /**
   * Publish message to MQTT topic
   */
  publish(topic, message, options = { qos: 1 }) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

      this.client.publish(topic, messageStr, options, (err) => {
        if (err) {
          logger.error(`Failed to publish to ${topic}:`, err);
          reject(err);
        } else {
          logger.mqtt(`Published to ${topic}: ${messageStr.substring(0, 100)}`);
          resolve();
        }
      });
    });
  }

  /**
   * Send OTA update command to device
   */
  async sendOTAUpdate(device_id, firmware_version, firmware_url) {
    try {
      const topic = `OTA/${device_id}/update`;
      const message = {
        device_id,
        firmware_version,
        firmware_url,
        timestamp: new Date().toISOString(),
      };

      await this.publish(topic, message);

      // Log OTA command
      await dbService.insertLog({
        level: 'info',
        category: 'ota',
        source_id: device_id,
        message: `OTA update command sent to ${device_id}`,
        metadata: message,
      });

      // Create OTA history record
      await dbService.createOTAHistory(device_id, firmware_version);

      logger.ota(`OTA update command sent to ${device_id}: ${firmware_version}`);

      return { success: true };
    } catch (error) {
      logger.error(`Failed to send OTA update to ${device_id}:`, error);
      throw error;
    }
  }

  /**
   * Send command to device
   */
  async sendCommand(device_id, command, params = {}) {
    try {
      const topic = `${config.mqtt.topics.commandRequest}/${device_id}`;
      const message = {
        device_id,
        command,
        params,
        timestamp: new Date().toISOString(),
      };

      await this.publish(topic, message);

      // Log command
      await dbService.insertLog({
        level: 'info',
        category: 'command',
        source_id: device_id,
        message: `Command sent to ${device_id}: ${command}`,
        metadata: message,
      });

      logger.mqtt(`Command sent to ${device_id}: ${command}`);

      return { success: true };
    } catch (error) {
      logger.error(`Failed to send command to ${device_id}:`, error);
      throw error;
    }
  }

  /**
   * Set WebSocket server for real-time broadcasting
   */
  setWebSocketServer(wsServer) {
    this.wsServer = wsServer;
    logger.ws('WebSocket server attached to MQTT service');
  }

  /**
   * Broadcast data to WebSocket clients
   */
  broadcastToWebSocket(data) {
    if (this.wsServer) {
      this.wsServer.broadcast(data);
    }
  }

  /**
   * Check connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      broker: `${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`,
      clientId: config.mqtt.clientId,
    };
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, {}, () => {
          this.isConnected = false;
          logger.mqtt('Disconnected from broker');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create singleton instance
const mqttService = new MQTTService();

module.exports = mqttService;
