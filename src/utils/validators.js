/**
 * BlazeIoT Solutions - Validation Utilities
 * Input validation helpers
 */

const { body, param, query, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Device validation rules
const validateDevice = [
  body('device_id').trim().notEmpty().withMessage('Device ID is required'),
  body('name').optional().trim(),
  body('type').optional().trim(),
  body('firmware_version').optional().trim(),
  handleValidationErrors,
];

// Gateway validation rules
const validateGateway = [
  body('gateway_id').trim().notEmpty().withMessage('Gateway ID is required'),
  body('name').optional().trim(),
  body('location').optional().trim(),
  handleValidationErrors,
];

// Node validation rules
const validateNode = [
  body('gateway_id').trim().notEmpty().withMessage('Gateway ID is required'),
  body('beacon_name').trim().notEmpty().withMessage('Beacon name is required'),
  body('mac').trim().notEmpty().withMessage('MAC address is required')
    .matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).withMessage('Invalid MAC address format'),
  handleValidationErrors,
];

// Login validation rules
const validateLogin = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

// OTA update validation rules
const validateOTA = [
  body('device_id').trim().notEmpty().withMessage('Device ID is required'),
  body('firmware_version').trim().notEmpty().withMessage('Firmware version is required'),
  body('firmware_url').trim().notEmpty().withMessage('Firmware URL is required')
    .isURL().withMessage('Invalid firmware URL'),
  handleValidationErrors,
];

// Query parameter validation
const validatePagination = [
  query('limit').optional().isInt({ min: 0, max: 10000 }).withMessage('Limit must be between 0 and 10000 (0 = unlimited)'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  handleValidationErrors,
];

const validateDateRange = [
  query('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date format'),
  handleValidationErrors,
];

// ID parameter validation
const validateId = (paramName = 'id') => [
  param(paramName).trim().notEmpty().withMessage(`${paramName} is required`),
  handleValidationErrors,
];

// Utility functions
const isValidJSON = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

const isValidMACAddress = (mac) => {
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac);
};

const sanitizeString = (str, maxLength = 255) => {
  if (!str) return '';
  return String(str).trim().substring(0, maxLength);
};

module.exports = {
  handleValidationErrors,
  validateDevice,
  validateGateway,
  validateNode,
  validateLogin,
  validateOTA,
  validatePagination,
  validateDateRange,
  validateId,
  isValidJSON,
  isValidMACAddress,
  sanitizeString,
};
