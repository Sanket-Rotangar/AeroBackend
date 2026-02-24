const authService  = require('../services/auth.service');
const asyncHandler = require('../middleware/asyncHandler');

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await authService.authenticate(username, password);

  if (result.success) {
    return res.json({ success: true, token: result.token, user: result.user });
  }

  res.status(401).json({ success: false, message: result.message });
});

// GET /api/auth/me
exports.me = (req, res) => {
  res.json({ success: true, user: req.user });
};
