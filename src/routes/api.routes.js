/**
 * BlazeIoT Solutions — API Routes
 *
 * This file only declares routes and wires them to middleware + controllers.
 * All business logic lives in src/controllers/.
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const {
  validateDevice,
  validateGateway,
  validateLogin,
  validateOTA,
  validatePagination,
  validateDateRange,
  validateId,
} = require('../utils/validators');

const authController = require('../controllers/auth.controller');
const deviceController = require('../controllers/device.controller');
const gatewayController = require('../controllers/gateway.controller');
const nodeController = require('../controllers/node.controller');
const sensorDataController = require('../controllers/sensor-data.controller');
const otaController = require('../controllers/ota.controller');
const logsController = require('../controllers/logs.controller');
const commandsController = require('../controllers/commands.controller');
const statusController = require('../controllers/status.controller');
const alertController = require('../controllers/alert.controller');

// Shorthand aliases so route declarations stay on one readable line
const auth = authService.protect;
const admin = authService.requireAdmin;

// ==================== Auth ====================
router.post('/auth/login', validateLogin, authController.login);
router.get('/auth/me', auth, authController.me);

// ==================== Devices ====================
router.get('/devices', auth, deviceController.getAll);
router.get('/devices/:device_id', auth, validateId('device_id'), deviceController.getById);
router.get('/devices/:device_id/data', auth, validateId('device_id'), validatePagination, validateDateRange, deviceController.getData);
router.get('/devices/:device_id/latest', auth, validateId('device_id'), deviceController.getLatest);
router.post('/devices', auth, admin, validateDevice, deviceController.create);
router.put('/devices/:device_id', auth, admin, validateId('device_id'), deviceController.update);

// ==================== Gateways ====================
router.get('/gateways', auth, gatewayController.getAll);
router.get('/gateways/:gateway_id', auth, validateId('gateway_id'), gatewayController.getById);
router.get('/gateways/:gateway_id/nodes', auth, validateId('gateway_id'), gatewayController.getNodes);
router.post('/gateways', auth, admin, validateGateway, gatewayController.create);

// ==================== Nodes ====================
router.get('/nodes', auth, nodeController.getAll);
router.put('/nodes/:mac', auth, admin, validateId('mac'), nodeController.update);
router.get('/nodes/:mac/data', auth, validateId('mac'), validatePagination, validateDateRange, nodeController.getData);

// ==================== Sensor Data ====================
router.get('/sensor-data', auth, validatePagination, sensorDataController.getAll);

// ==================== OTA ====================
router.get('/ota/firmware', auth, otaController.getAllFirmware);
router.get('/ota/latest', otaController.getLatest);      // Public — IoT devices poll this
router.post('/ota/firmware', auth, admin, otaController.create);
router.post('/ota/update', auth, admin, validateOTA, otaController.triggerUpdate);
router.get('/ota/history/:device_id', auth, validateId('device_id'), otaController.getHistory);

// ==================== Logs ====================
router.get('/logs', auth, admin, validatePagination, validateDateRange, logsController.getAll);

// ==================== Commands ====================
router.post('/commands/send', auth, admin, commandsController.send);

// ==================== Status ====================
router.get('/status', auth, statusController.getStatus);

// ==================== Alert Profiles ====================
router.get('/alert-profiles', auth, alertController.getProfiles);
router.get('/alert-profiles/:id', auth, alertController.getProfile);
router.post('/alert-profiles', auth, admin, alertController.createProfile);
router.put('/alert-profiles/:id', auth, admin, alertController.updateProfile);
router.delete('/alert-profiles/:id', auth, admin, alertController.deleteProfile);

// ==================== Alerts (History) ====================
router.get('/alerts', auth, alertController.getAlerts);
router.put('/alerts/:id/acknowledge', auth, alertController.acknowledgeAlert);
router.delete('/alerts', auth, admin, alertController.clearAlerts);

// ==================== 404 ====================
router.use((req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

module.exports = router;
