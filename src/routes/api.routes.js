/**
 * BlazeIoT Solutions - API Routes
 * REST API endpoints for the platform
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/database.service');
const mqttService = require('../services/mqtt.service');
const authService = require('../services/auth.service');
const logger = require('../utils/logger');
const {
  validateDevice,
  validateGateway,
  validateLogin,
  validateOTA,
  validatePagination,
  validateDateRange,
  validateId,
} = require('../utils/validators');

// ==================== Authentication Routes ====================

/**
 * @route   POST /api/auth/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/auth/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.authenticate(username, password);

    if (result.success) {
      res.json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } else {
      res.status(401).json({
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/auth/me', authService.protect, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// ==================== Device Routes ====================

/**
 * @route   GET /api/devices
 * @desc    Get all devices
 * @access  Private
 */
router.get('/devices', authService.protect, async (req, res) => {
  try {
    const devices = await dbService.getAllDevices();
    res.json({
      success: true,
      count: devices.length,
      data: devices,
    });
  } catch (error) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices',
    });
  }
});

/**
 * @route   GET /api/devices/:device_id
 * @desc    Get device by ID
 * @access  Private
 */
router.get('/devices/:device_id', authService.protect, validateId('device_id'), async (req, res) => {
  try {
    const device = await dbService.getDeviceById(req.params.device_id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    logger.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device',
    });
  }
});

/**
 * @route   GET /api/devices/:device_id/data
 * @desc    Get sensor data for a device
 * @access  Private
 */
router.get('/devices/:device_id/data', 
  authService.protect, 
  validateId('device_id'),
  validatePagination,
  validateDateRange,
  async (req, res) => {
    try {
      const { device_id } = req.params;
      const { limit = 100, offset = 0, start_date, end_date } = req.query;

      let data;
      if (start_date && end_date) {
        data = await dbService.getSensorDataByTimeRange(device_id, start_date, end_date);
      } else {
        data = await dbService.getSensorData(device_id, parseInt(limit), parseInt(offset));
      }

      res.json({
        success: true,
        count: data.length,
        data,
      });
    } catch (error) {
      logger.error('Error fetching device data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch device data',
      });
    }
  }
);

/**
 * @route   GET /api/devices/:device_id/latest
 * @desc    Get latest sensor reading for a device
 * @access  Private
 */
router.get('/devices/:device_id/latest', authService.protect, validateId('device_id'), async (req, res) => {
  try {
    const { device_id } = req.params;
    const { type } = req.query;

    const data = await dbService.getLatestSensorData(device_id, type);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'No data found',
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error fetching latest device data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest data',
    });
  }
});

/**
 * @route   POST /api/devices
 * @desc    Register a new device
 * @access  Private (Admin)
 */
router.post('/devices', authService.protect, authService.requireAdmin, validateDevice, async (req, res) => {
  try {
    const result = await dbService.insertDevice(
      req.body.device_id,
      req.body.device_name || req.body.device_id,
      req.body.status || 'active'
    );
    
    await dbService.insertLog(
      'device',
      `Device registered by ${req.user.username}`,
      null,
      req.body.device_id
    );

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      deviceId: result._id,
    });
  } catch (error) {
    logger.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register device',
    });
  }
});

/**
 * @route   PUT /api/devices/:device_id
 * @desc    Update device
 * @access  Private (Admin)
 */
router.put('/devices/:device_id', authService.protect, authService.requireAdmin, validateId('device_id'), async (req, res) => {
  try {
    await dbService.updateDevice(req.params.device_id, req.body);
    
    res.json({
      success: true,
      message: 'Device updated successfully',
    });
  } catch (error) {
    logger.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update device',
    });
  }
});

// ==================== Gateway Routes ====================

/**
 * @route   GET /api/gateways
 * @desc    Get all gateways
 * @access  Private
 */
router.get('/gateways', authService.protect, async (req, res) => {
  try {
    const gateways = await dbService.getAllGateways();
    res.json({
      success: true,
      count: gateways.length,
      data: gateways,
    });
  } catch (error) {
    logger.error('Error fetching gateways:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gateways',
    });
  }
});

/**
 * @route   GET /api/gateways/:gateway_id
 * @desc    Get gateway by ID
 * @access  Private
 */
router.get('/gateways/:gateway_id', authService.protect, validateId('gateway_id'), async (req, res) => {
  try {
    const gateway = await dbService.getGatewayById(req.params.gateway_id);
    
    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Gateway not found',
      });
    }

    res.json({
      success: true,
      data: gateway,
    });
  } catch (error) {
    logger.error('Error fetching gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch gateway',
    });
  }
});

/**
 * @route   GET /api/gateways/:gateway_id/nodes
 * @desc    Get all nodes under a gateway
 * @access  Private
 */
router.get('/gateways/:gateway_id/nodes', authService.protect, validateId('gateway_id'), async (req, res) => {
  try {
    const nodes = await dbService.getNodesByGateway(req.params.gateway_id);
    
    // Transform node data to match frontend expectations
    const transformedNodes = nodes.map(node => ({
      ...node,
      mac_address: node.mac, // Transform mac to mac_address
      node_name: node.beacon_name || node.mac, // Use beacon_name or fallback to MAC
      node_type: 'BLE Beacon', // Default type for BLE nodes
    }));
    
    res.json({
      success: true,
      count: transformedNodes.length,
      data: transformedNodes,
    });
  } catch (error) {
    logger.error('Error fetching gateway nodes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nodes',
    });
  }
});

/**
 * @route   POST /api/gateways
 * @desc    Register a new gateway
 * @access  Private (Admin)
 */
router.post('/gateways', authService.protect, authService.requireAdmin, validateGateway, async (req, res) => {
  try {
    const result = await dbService.insertGateway(
      req.body.gateway_id,
      req.body.gateway_name || req.body.gateway_id,
      req.body.status || 'active'
    );
    
    await dbService.insertLog(
      'gateway',
      `Gateway registered by ${req.user.username}`,
      null,
      req.body.gateway_id
    );

    res.status(201).json({
      success: true,
      message: 'Gateway registered successfully',
      gatewayId: result._id,
    });
  } catch (error) {
    logger.error('Error creating gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register gateway',
    });
  }
});

// ==================== Node Routes ====================

/**
 * @route   GET /api/nodes/:mac/data
 * @desc    Get sensor data for a node
 * @access  Private
 */
router.get('/nodes/:mac/data', 
  authService.protect, 
  validateId('mac'),
  validatePagination,
  validateDateRange,
  async (req, res) => {
    try {
      const { mac } = req.params;
      const { limit = 100, offset = 0, start_date, end_date } = req.query;

      let data;
      if (start_date && end_date) {
        data = await dbService.getSensorDataByTimeRange(mac, start_date, end_date);
      } else {
        data = await dbService.getSensorData(mac, parseInt(limit), parseInt(offset));
      }

      res.json({
        success: true,
        count: data.length,
        data,
      });
    } catch (error) {
      logger.error('Error fetching node data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch node data',
      });
    }
  }
);

// ==================== Sensor Data Routes ====================

/**
 * @route   GET /api/sensor-data
 * @desc    Get recent sensor data from all sources
 * @access  Private
 */
router.get('/sensor-data', authService.protect, async (req, res) => {
  try {
    // Allow unlimited data export for admin users
    const { limit = 0, offset = 0 } = req.query;
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);
    
    const data = await dbService.getAllSensorData(
      parsedLimit === 0 ? null : parsedLimit, 
      parsedOffset
    );
    
    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    logger.error('Error fetching sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sensor data',
    });
  }
});

// ==================== OTA Routes ====================

/**
 * @route   GET /api/ota/firmware
 * @desc    Get all firmware versions
 * @access  Private
 */
router.get('/ota/firmware', authService.protect, async (req, res) => {
  try {
    const firmware = await dbService.getAllFirmware();
    res.json({
      success: true,
      count: firmware.length,
      data: firmware,
    });
  } catch (error) {
    logger.error('Error fetching firmware:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch firmware',
    });
  }
});

/**
 * @route   GET /api/ota/latest
 * @desc    Get latest firmware version
 * @access  Public (for devices)
 */
router.get('/ota/latest', async (req, res) => {
  try {
    const { device_id, device_type } = req.query;
    
    const firmware = await dbService.getLatestFirmware(device_type);
    
    if (!firmware) {
      return res.status(404).json({
        success: false,
        message: 'No firmware available',
      });
    }

    // Log firmware check
    if (device_id) {
      await dbService.insertLog(
        'ota',
        `Firmware check: ${firmware.version}`,
        null,
        device_id
      );
    }

    res.json({
      success: true,
      data: firmware,
    });
  } catch (error) {
    logger.error('Error fetching latest firmware:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch firmware',
    });
  }
});

/**
 * @route   POST /api/ota/firmware
 * @desc    Upload new firmware
 * @access  Private (Admin)
 */
router.post('/ota/firmware', authService.protect, authService.requireAdmin, async (req, res) => {
  try {
    const firmwareId = await dbService.createFirmware(req.body);
    
    await dbService.insertLog(
      'ota',
      `New firmware uploaded: ${req.body.version}`,
      JSON.stringify(req.body),
      null
    );

    res.status(201).json({
      success: true,
      message: 'Firmware uploaded successfully',
      firmwareId,
    });
  } catch (error) {
    logger.error('Error creating firmware:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload firmware',
    });
  }
});

/**
 * @route   POST /api/ota/update
 * @desc    Trigger OTA update for a device
 * @access  Private (Admin)
 */
router.post('/ota/update', authService.protect, authService.requireAdmin, validateOTA, async (req, res) => {
  try {
    const { device_id, firmware_version, firmware_url } = req.body;
    
    const result = await mqttService.sendOTAUpdate(device_id, firmware_version, firmware_url);
    
    res.json({
      success: true,
      message: 'OTA update command sent',
      ...result,
    });
  } catch (error) {
    logger.error('Error triggering OTA update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger OTA update',
    });
  }
});

/**
 * @route   GET /api/ota/history/:device_id
 * @desc    Get OTA history for a device
 * @access  Private
 */
router.get('/ota/history/:device_id', authService.protect, validateId('device_id'), async (req, res) => {
  try {
    const history = await dbService.getOTAHistory(req.params.device_id);
    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    logger.error('Error fetching OTA history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch OTA history',
    });
  }
});

// ==================== Log Routes ====================

/**
 * @route   GET /api/logs
 * @desc    Get system logs
 * @access  Private (Admin)
 */
router.get('/logs', 
  authService.protect, 
  authService.requireAdmin,
  validatePagination,
  validateDateRange,
  async (req, res) => {
    try {
      const { category, limit = 0, offset = 0, start_date, end_date } = req.query;
      const parsedLimit = parseInt(limit);
      const parsedOffset = parseInt(offset);
      
      // Allow unlimited data export when limit is 0
      const finalLimit = parsedLimit === 0 ? null : parsedLimit;

      let logs;
      if (category) {
        logs = await dbService.getLogsByCategory(category, finalLimit, parsedOffset);
      } else {
        logs = await dbService.getAllLogs(finalLimit, parsedOffset);
      }

      res.json({
        success: true,
        count: logs.length,
        data: logs,
      });
    } catch (error) {
      logger.error('Error fetching logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch logs',
      });
    }
  }
);

// ==================== Command Routes ====================

/**
 * @route   POST /api/commands/send
 * @desc    Send command to device
 * @access  Private (Admin)
 */
router.post('/commands/send', authService.protect, authService.requireAdmin, async (req, res) => {
  try {
    const { device_id, command, params } = req.body;
    
    if (!device_id || !command) {
      return res.status(400).json({
        success: false,
        message: 'device_id and command are required',
      });
    }

    const result = await mqttService.sendCommand(device_id, command, params);
    
    res.json({
      success: true,
      message: 'Command sent successfully',
      ...result,
    });
  } catch (error) {
    logger.error('Error sending command:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send command',
    });
  }
});

// ==================== System Status Routes ====================

/**
 * @route   GET /api/status
 * @desc    Get system status
 * @access  Private
 */
router.get('/status', authService.protect, async (req, res) => {
  try {
    const mqttStatus = mqttService.getStatus();
    const deviceCount = (await dbService.getAllDevices()).length;
    const gatewayCount = (await dbService.getAllGateways()).length;

    res.json({
      success: true,
      data: {
        system: 'BlazeIoT Solutions Platform',
        version: '1.0.0',
        status: 'operational',
        mqtt: mqttStatus,
        stats: {
          devices: deviceCount,
          gateways: gatewayCount,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system status',
    });
  }
});

// 404 handler for API routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
  });
});

module.exports = router;
