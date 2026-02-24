/**
 * BlazeIoT Solutions - Logger Utility
 * Winston-based logging system
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure log directory exists
const logDir = config.logging.dir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Always log to console — visibility during development and useful in any deployment
logger.add(
  new winston.transports.Console({
    format: consoleFormat,
  }),
);

// Helper methods for different log types
logger.mqtt = (message, meta = {}) => {
  logger.info(`[MQTT] ${message}`, meta);
};

logger.api = (message, meta = {}) => {
  logger.info(`[API] ${message}`, meta);
};

logger.db = (message, meta = {}) => {
  logger.info(`[DB] ${message}`, meta);
};

logger.ota = (message, meta = {}) => {
  logger.info(`[OTA] ${message}`, meta);
};

logger.ws = (message, meta = {}) => {
  logger.info(`[WebSocket] ${message}`, meta);
};

module.exports = logger;
