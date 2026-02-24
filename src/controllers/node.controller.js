const dbService = require('../services/database.service');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/nodes/:mac/data
exports.getData = asyncHandler(async (req, res) => {
  const { mac } = req.params;
  const { limit = 100, offset = 0, start_date, end_date } = req.query;

  const data = (start_date && end_date)
    ? await dbService.getSensorDataByTimeRange(mac, start_date, end_date)
    : await dbService.getSensorData(mac, parseInt(limit), parseInt(offset));

  res.json({ success: true, count: data.length, data });
});

// GET /api/nodes
exports.getAll = asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const data = await dbService.getAllNodes(parseInt(limit), parseInt(offset));
  res.json({ success: true, count: data.length, data });
});

// PUT /api/nodes/:mac
exports.update = asyncHandler(async (req, res) => {
  const { mac } = req.params;
  const updateData = req.body;
  const result = await dbService.updateNode(mac, updateData);
  res.json({ success: true, message: 'Node updated' });
});
