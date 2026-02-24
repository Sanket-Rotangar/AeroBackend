const dbService    = require('../services/database.service');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/devices
exports.getAll = asyncHandler(async (req, res) => {
  const devices = await dbService.getAllDevices();
  res.json({ success: true, count: devices.length, data: devices });
});

// GET /api/devices/:device_id
exports.getById = asyncHandler(async (req, res) => {
  const device = await dbService.getDeviceById(req.params.device_id);
  if (!device) {
    return res.status(404).json({ success: false, message: 'Device not found' });
  }
  res.json({ success: true, data: device });
});

// GET /api/devices/:device_id/data
exports.getData = asyncHandler(async (req, res) => {
  const { device_id } = req.params;
  const { limit = 100, offset = 0, start_date, end_date } = req.query;

  const data = (start_date && end_date)
    ? await dbService.getSensorDataByTimeRange(device_id, start_date, end_date)
    : await dbService.getSensorData(device_id, parseInt(limit), parseInt(offset));

  res.json({ success: true, count: data.length, data });
});

// GET /api/devices/:device_id/latest
exports.getLatest = asyncHandler(async (req, res) => {
  const { device_id } = req.params;
  const { type } = req.query;

  const data = await dbService.getLatestSensorData(device_id, type);
  if (!data) {
    return res.status(404).json({ success: false, message: 'No data found for this device' });
  }

  res.json({ success: true, data });
});

// POST /api/devices
exports.create = asyncHandler(async (req, res) => {
  const result = await dbService.insertDevice(
    req.body.device_id,
    req.body.device_name || req.body.device_id,
    req.body.status || 'active',
  );

  await dbService.insertLog(
    'device',
    `Device registered by ${req.user.username}`,
    null,
    req.body.device_id,
  );

  res.status(201).json({
    success: true,
    message: 'Device registered successfully',
    deviceId: result._id,
  });
});

// PUT /api/devices/:device_id
exports.update = asyncHandler(async (req, res) => {
  await dbService.updateDevice(req.params.device_id, req.body);
  res.json({ success: true, message: 'Device updated successfully' });
});
