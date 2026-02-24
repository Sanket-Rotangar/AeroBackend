const dbService = require('../services/database.service');
const asyncHandler = require('../middleware/asyncHandler');

// Maximum rows returned in a single call — protects against accidental full-table fetch.
// Use pagination (offset) for larger exports.
const MAX_LIMIT = 1000;

// GET /api/sensor-data
exports.getAll = asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0, startDate, endDate, deviceId, gatewayId } = req.query;
  const parsed = parseInt(limit);

  // 0 is treated as "default cap" rather than "unlimited"
  const finalLimit = Math.min(parsed === 0 ? MAX_LIMIT : parsed, MAX_LIMIT);

  const data = await dbService.getAllSensorData(finalLimit, parseInt(offset), startDate, endDate, deviceId, gatewayId);

  res.json({ success: true, count: data.length, limit: finalLimit, data });
});
