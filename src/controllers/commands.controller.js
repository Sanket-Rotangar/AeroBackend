const mqttService  = require('../services/mqtt.service');
const asyncHandler = require('../middleware/asyncHandler');

// POST /api/commands/send
exports.send = asyncHandler(async (req, res) => {
  const { device_id, command, params } = req.body;

  if (!device_id || !command) {
    return res.status(400).json({
      success: false,
      message: 'device_id and command are required',
    });
  }

  const result = await mqttService.sendCommand(device_id, command, params);
  res.json({ success: true, message: 'Command sent successfully', ...result });
});
