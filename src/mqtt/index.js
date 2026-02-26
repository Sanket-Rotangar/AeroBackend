/**
 * MQTT Message Handlers (all topics in one file)
 *
 * Topics handled:
 *   SensorData/#        → handleSensorData
 *   BLEGatewayData/#    → handleBLEGateway
 *   LoRaGatewayData/#   → handleLoRaGateway
 *   OTA/+/response      → handleOTAResponse
 *
 * Each handler auto-registers unknown devices/gateways/nodes and persists
 * all payload fields that are not routing keys.
 */

const dbService = require('../services/database.service');
const alertService = require('../services/alert.service');
const wsService = require('../services/websocket.service');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// SensorData/# — direct IoT device
// Payload: { device_id, ...sensorFields }
// ─────────────────────────────────────────────────────────────
async function handleSensorData(payload) {
  const { device_id, ...sensorData } = payload;

  if (!device_id) {
    logger.warn('[MQTT:SensorData] Payload missing device_id — dropped', payload);
    return;
  }

  const existing = await dbService.getDeviceById(device_id);
  if (!existing) {
    await dbService.insertDevice(device_id, device_id, 'active');
    await dbService.insertLog('device', `New device auto-registered: ${device_id}`, null, device_id);
    logger.mqtt(`[SensorData] Auto-registered new device: ${device_id}`);
  } else {
    await dbService.updateDeviceStatus(device_id, 'active');
  }

  if (Object.keys(sensorData).length > 0) {
    await dbService.insertSensorData(device_id, 'device', null, sensorData, new Date());
    // Broadcast to WebSocket clients so dashboards update live
    wsService.broadcastSensorData('device', device_id, sensorData);
  }

  logger.mqtt(`[SensorData] Stored ${Object.keys(sensorData).length} fields from device: ${device_id}`);
}

// ─────────────────────────────────────────────────────────────
// BLEGatewayData/# — BLE gateway + beacon nodes
// Payload: { gateway_id, mac, beacon_name?, ...sensorFields }
// ─────────────────────────────────────────────────────────────
async function handleBLEGateway(payload) {
  const { gateway_id, mac, beacon_name, ...rest } = payload;

  if (!gateway_id || !mac) {
    logger.warn('[MQTT:BLEGateway] Payload missing gateway_id or mac — dropped', payload);
    return;
  }

  // Gateway
  const existingGateway = await dbService.getGatewayById(gateway_id);
  if (!existingGateway) {
    await dbService.insertGateway(gateway_id, gateway_id, 'active');
    await dbService.insertLog('gateway', `New BLE gateway auto-registered: ${gateway_id}`, null, gateway_id);
    logger.mqtt(`[BLEGateway] Auto-registered new gateway: ${gateway_id}`);
  } else {
    await dbService.updateGatewayStatus(gateway_id, 'active');
  }

  // Node
  const nodeName = (beacon_name && beacon_name.trim()) ? beacon_name.trim() : mac;
  const rssi = rest.rssi;
  const existingNode = await dbService.getNodeByMac(mac);
  if (!existingNode) {
    await dbService.insertNode(gateway_id, mac, nodeName, rssi || 0);
    logger.mqtt(`[BLEGateway] Auto-registered new node: ${nodeName} (${mac})`);
  } else {
    await dbService.updateNodeStatus(mac, gateway_id, rssi || existingNode.rssi);
  }

  // Sensor data — all fields + keep beacon_name for reference
  const sensorData = { ...rest };
  if (beacon_name) sensorData.beacon_name = beacon_name;

  if (Object.keys(sensorData).length > 0) {
    await dbService.insertSensorData(mac, 'node', gateway_id, sensorData, new Date());
    // Broadcast to WebSocket clients so dashboards update live
    wsService.broadcastSensorData('node', mac, sensorData);
    // Evaluate against alert thresholds
    await alertService.evaluateData(mac, gateway_id, sensorData);
  }

  logger.mqtt(`[BLEGateway] Stored ${Object.keys(sensorData).length} fields — ${gateway_id} → ${nodeName} (${mac})`);
}

// ─────────────────────────────────────────────────────────────
// LoRaGatewayData/# — LoRa gateway + remote nodes
// Payload: { gateway_id, node_id, ...sensorFields }
// ─────────────────────────────────────────────────────────────
async function handleLoRaGateway(payload) {
  const { gateway_id, node_id, ...rest } = payload;

  if (!gateway_id || !node_id) {
    logger.warn('[MQTT:LoRaGateway] Payload missing gateway_id or node_id — dropped', payload);
    return;
  }

  const mac = node_id; // LoRa nodes use node_id as unique MAC

  // Gateway
  const existingGateway = await dbService.getGatewayById(gateway_id);
  if (!existingGateway) {
    await dbService.insertGateway(gateway_id, gateway_id, 'active');
    await dbService.insertLog('gateway', `New LoRa gateway auto-registered: ${gateway_id}`, null, gateway_id);
    logger.mqtt(`[LoRaGateway] Auto-registered new gateway: ${gateway_id}`);
  } else {
    await dbService.updateGatewayStatus(gateway_id, 'active');
  }

  // Node
  const nodeName = `LoRa_${node_id}`;
  const existingNode = await dbService.getNodeByMac(mac);
  if (!existingNode) {
    await dbService.insertNode(gateway_id, mac, nodeName, rest.rssi_wifi || 0);
    logger.mqtt(`[LoRaGateway] Auto-registered new node: ${nodeName}`);
  } else {
    await dbService.updateNodeStatus(mac, gateway_id, rest.rssi_wifi || existingNode.rssi);
  }

  const sensorData = { ...rest };
  if (Object.keys(sensorData).length > 0) {
    await dbService.insertSensorData(mac, 'node', gateway_id, sensorData, new Date());
    // Broadcast to WebSocket clients so dashboards update live
    wsService.broadcastSensorData('node', mac, sensorData);
    // Evaluate against alert thresholds
    await alertService.evaluateData(mac, gateway_id, sensorData);
  }

  logger.mqtt(`[LoRaGateway] Stored ${Object.keys(sensorData).length} fields — ${gateway_id} → ${node_id}`);
}

// ─────────────────────────────────────────────────────────────
// OTA/+/response — firmware update outcome from device
// Payload: { device_id, status, firmware_version?, error? }
// ─────────────────────────────────────────────────────────────
async function handleOTAResponse(payload) {
  const { device_id, status, firmware_version, error: errorMsg } = payload;

  if (!device_id) {
    logger.warn('[MQTT:OTA] OTA response missing device_id — dropped', payload);
    return;
  }

  await dbService.insertLog(
    'ota',
    `OTA update ${status} for device ${device_id}${errorMsg ? `: ${errorMsg}` : ''}`,
    payload,
    device_id,
  );

  if (status === 'success' && firmware_version) {
    await dbService.updateDevice(device_id, { firmware_version });
  }

  logger.ota(`[OTA] Response from ${device_id}: ${status}`);
}

module.exports = { handleSensorData, handleBLEGateway, handleLoRaGateway, handleOTAResponse };
