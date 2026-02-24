const dbService    = require('../services/database.service');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/logs
exports.getAll = asyncHandler(async (req, res) => {
  const { category, limit = 100, offset = 0 } = req.query;
  const parsedLimit  = parseInt(limit);
  const parsedOffset = parseInt(offset);

  // Hard cap — prevents large log dumps from blocking the process
  const finalLimit = Math.min(Math.max(parsedLimit, 1), 1000);

  const logs = category
    ? await dbService.getLogsByCategory(category, finalLimit, parsedOffset)
    : await dbService.getAllLogs(finalLimit, parsedOffset);

  res.json({
    success: true,
    count: logs.length,
    limit: finalLimit,
    offset: parsedOffset,
    data: logs,
  });
});
