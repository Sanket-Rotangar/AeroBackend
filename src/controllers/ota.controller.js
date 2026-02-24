const dbService    = require('../services/database.service');
const mqttService  = require('../services/mqtt.service');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/ota/firmware
exports.getAllFirmware = asyncHandler(async (req, res) => {
  const firmware = await dbService.getAllFirmware();
  res.json({ success: true, count: firmware.length, data: firmware });
});

// GET /api/ota/latest  — public endpoint, IoT devices poll this
exports.getLatest = asyncHandler(async (req, res) => {
  const { device_id, device_type } = req.query;

  const firmware = await dbService.getLatestFirmware(device_type);
  if (!firmware) {
    return res.status(404).json({ success: false, message: 'No firmware available' });
  }

  // Log the firmware check if a device_id was provided
  if (device_id) {
    await dbService.insertLog('ota', `Firmware check for device ${device_id}: ${firmware.version}`, null, device_id);
  }

  res.json({ success: true, data: firmware });
});

// POST /api/ota/firmware
exports.create = asyncHandler(async (req, res) => {
  const firmwareId = await dbService.createFirmware(req.body);

  await dbService.insertLog(
    'ota',
    `New firmware uploaded: ${req.body.version}`,
    JSON.stringify(req.body),
    null,
  );

  res.status(201).json({ success: true, message: 'Firmware uploaded successfully', firmwareId });
});

// POST /api/ota/update
exports.triggerUpdate = asyncHandler(async (req, res) => {
  const { device_id, firmware_version, firmware_url } = req.body;
  const result = await mqttService.sendOTAUpdate(device_id, firmware_version, firmware_url);
  res.json({ success: true, message: 'OTA update command sent', ...result });
});

// GET /api/ota/history/:device_id
exports.getHistory = asyncHandler(async (req, res) => {
  const history = await dbService.getOTAHistory(req.params.device_id);
  res.json({ success: true, count: history.length, data: history });
});
