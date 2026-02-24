/**
 * BlazeIoT Solutions - Configuration
 * All settings are read from environment variables via .env file.
 * No behavioural differences between environments — the code runs the same way everywhere.
 */

require('dotenv').config();

const config = {
  // Server
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
    // env is kept for display purposes in logs only (no code branches on this value)
    env: process.env.NODE_ENV || 'development',
  },

  // MQTT
  mqtt: {
    host: process.env.MQTT_HOST || 'ebe4b101faa541f9b868d0cc309edab3.s1.eu.hivemq.cloud',
    port: parseInt(process.env.MQTT_PORT, 10) || 8883,
    protocol: process.env.MQTT_PROTOCOL || 'mqtts',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    // Use a stable client ID from env, or generate one tied to process start time
    clientId: process.env.MQTT_CLIENT_ID || `blazeiot-${Date.now()}`,
    topics: {
      sensorData: 'SensorData/#',
      gatewayData: 'BLEGatewayData/#',
      loraGatewayData: 'LoRaGatewayData/#',
      commandRequest: 'CommandRequest',
      otaUpdate: 'OTA/+/update',
      otaResponse: 'OTA/+/response',
    },
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  },

  // Database (MongoDB only)
  database: {
    type: 'mongodb',
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/blazeiot',
      options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
      },
    },
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,           // required — validated below
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Default admin account (override via .env)
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    email: process.env.ADMIN_EMAIL || 'admin@blazeiot.com',
  },

  // File uploads
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads/firmware',
    maxSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800, // 50 MB
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  // Security
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 min
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 1000,
    corsOrigin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000', 'http://localhost:5173'],
  },

  // [PHASE 3 — WebSocket config, uncomment when building real-time frontend]
  websocket: {
    port: parseInt(process.env.WS_PORT, 10) || 3001,
  },
};

// ==================== Validation ====================
// Crash immediately if critical variables are absent.
// Better to fail loudly at startup than to run with broken security.
function validateConfig() {
  if (!config.jwt.secret) {
    throw new Error(
      '[Config] JWT_SECRET is not set in your .env file.\n' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
    );
  }
}

validateConfig();

module.exports = config;
