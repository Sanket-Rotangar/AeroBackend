const dbService    = require('../services/database.service');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/gateways
exports.getAll = asyncHandler(async (req, res) => {
  const gateways = await dbService.getAllGateways();
  res.json({ success: true, count: gateways.length, data: gateways });
});

// GET /api/gateways/:gateway_id
exports.getById = asyncHandler(async (req, res) => {
  const gateway = await dbService.getGatewayById(req.params.gateway_id);
  if (!gateway) {
    return res.status(404).json({ success: false, message: 'Gateway not found' });
  }
  res.json({ success: true, data: gateway });
});

// GET /api/gateways/:gateway_id/nodes
exports.getNodes = asyncHandler(async (req, res) => {
  const nodes = await dbService.getNodesByGateway(req.params.gateway_id);

  // Normalise field names for consistent API responses
  const data = nodes.map((node) => ({
    ...node,
    mac_address: node.mac,
    node_name:   node.beacon_name || node.mac,
    node_type:   'BLE Beacon',
  }));

  res.json({ success: true, count: data.length, data });
});

// POST /api/gateways
exports.create = asyncHandler(async (req, res) => {
  const result = await dbService.insertGateway(
    req.body.gateway_id,
    req.body.gateway_name || req.body.gateway_id,
    req.body.status || 'active',
  );

  await dbService.insertLog(
    'gateway',
    `Gateway registered by ${req.user.username}`,
    null,
    req.body.gateway_id,
  );

  res.status(201).json({
    success: true,
    message: 'Gateway registered successfully',
    gatewayId: result._id,
  });
});
