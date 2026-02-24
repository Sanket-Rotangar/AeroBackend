/**
 * BlazeIoT Solutions — MQTT Service
 *
 * Responsibilities:
 *   1. Manage connection lifecycle with the HiveMQ Cloud broker
 *   2. Subscribe to topics on connect
 *   3. Route incoming messages to the correct handler
 *   4. Publish outbound messages (commands, OTA triggers)
 *
 * Each message type is handled by a dedicated file in src/mqtt/handlers/.
 * This keeps this file focused on infrastructure, not business logic.
 */

const mqtt = require('mqtt');
const config = require('../config/config');
const dbService = require('./database.service');
const logger = require('../utils/logger');
const { isValidJSON } = require('../utils/validators');

// All message handlers live in a single file — src/mqtt/handlers/index.js
const { handleSensorData, handleBLEGateway, handleLoRaGateway, handleOTAResponse } = require('../mqtt');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    // [PHASE 3 — WebSocket] uncomment when building the real-time frontend layer
    this.wsServer = null;
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
   * Route an incoming MQTT message to the correct handler.
   * Each handler file owns one payload type — connection/routing stays here.
   */
  async handleMessage(topic, message) {
    const messageStr = message.toString();

    if (!isValidJSON(messageStr)) {
      logger.warn(`[MQTT] Non-JSON message on ${topic} — dropped: ${messageStr.substring(0, 100)}`);
      return;
    }

    const payload = JSON.parse(messageStr);
    logger.mqtt(`Message on ${topic}`, { fields: Object.keys(payload) });

    try {
      if (topic.startsWith('SensorData')) await handleSensorData(payload);
      else if (topic.startsWith('BLEGatewayData')) await handleBLEGateway(payload);
      else if (topic.startsWith('LoRaGatewayData')) await handleLoRaGateway(payload);
      else if (topic.startsWith('OTA')) await handleOTAResponse(payload);
      else logger.warn(`[MQTT] No handler for topic: ${topic}`);
    } catch (error) {
      logger.error(`[MQTT] Handler error on topic ${topic}:`, error);
      await dbService.insertLog({
        level: 'error',
        category: 'mqtt',
        message: `Handler error on ${topic}: ${error.message}`,
        metadata: { topic, error: error.toString() },
      });
    }

    // [PHASE 3 — broadcast to WebSocket clients]
    this.broadcastToWebSocket({ type: 'mqtt_message', topic, payload, timestamp: new Date().toISOString() });
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

  // [PHASE 3 — WebSocket broadcasting]
  setWebSocketServer(wsServer) {
    this.wsServer = wsServer;
  }
  broadcastToWebSocket(data) {
    if (this.wsServer) this.wsServer.broadcast(data);
  }

  /**
   * Current MQTT connection info (used by GET /api/status)
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
