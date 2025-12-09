/**
 * BlazeIoT Solutions - Configuration Management
 * Centralizes all environment configuration
 */

require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
  },

  // MQTT Configuration
  mqtt: {
    host: process.env.MQTT_HOST || 'ebe4b101faa541f9b868d0cc309edab3.s1.eu.hivemq.cloud',
    port: parseInt(process.env.MQTT_PORT, 10) || 8883,
    protocol: process.env.MQTT_PROTOCOL || 'mqtts',
    username: process.env.MQTT_USERNAME || 'Shivam',
    password: process.env.MQTT_PASSWORD || 'Shivam',
    clientId: process.env.MQTT_CLIENT_ID || `blazeiot-backend-${Math.random().toString(16).substr(2, 8)}`,
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

  // Database Configuration
  database: {
    type: process.env.DB_TYPE || 'mongodb',
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

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Admin Account
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    email: process.env.ADMIN_EMAIL || 'admin@blazeiot.com',
  },

  // WebSocket Configuration
  websocket: {
    port: parseInt(process.env.WS_PORT, 10) || 3001,
  },

  // File Upload Configuration
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads/firmware',
    maxSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800, // 50MB
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  // Security Configuration
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 1000, // Increased for real-time IoT dashboard
    corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  },

  // Company Information
  company: {
    name: 'BlazeIoT Solutions',
    website: 'https://blazeiot.com',
  },
};

// Validate required configuration
function validateConfig() {
  const required = [
    'JWT_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 && config.server.env === 'production') {
    console.warn(`⚠️  Warning: Missing environment variables: ${missing.join(', ')}`);
    console.warn('Please set these in production for security!');
  }
}

validateConfig();

module.exports = config;
