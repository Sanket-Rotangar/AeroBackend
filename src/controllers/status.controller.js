const dbService    = require('../services/database.service');
const mqttService  = require('../services/mqtt.service');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/status
exports.getStatus = asyncHandler(async (req, res) => {
  const [devices, gateways] = await Promise.all([
    dbService.getAllDevices(),
    dbService.getAllGateways(),
  ]);

  res.json({
    success: true,
    data: {
      system:  'BlazeIoT Solutions Platform',
      version: '1.0.0',
      status:  'operational',
      mqtt:    mqttService.getStatus(),
      stats: {
        devices:  devices.length,
        gateways: gateways.length,
      },
      timestamp: new Date().toISOString(),
    },
  });
});
