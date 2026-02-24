/**
 * BlazeIoT Solutions - Main Server Entry Point
 * Industrial IoT Backend Platform
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

// Configuration & utilities
const config = require('./src/config/config');
const logger = require('./src/utils/logger');
const apiRoutes = require('./src/routes/api.routes');

// Services — Phase 1 & 2 (MQTT ingestion + DB)
const dbService = require('./src/services/database.service');
const mqttService = require('./src/services/mqtt.service');
const authService = require('./src/services/auth.service');

// [PHASE 3 — enable when building the real-time frontend layer]
const wsService = require('./src/services/websocket.service');

// ==================== App Setup ====================

const app = express();
const server = http.createServer(app);

// ==================== Middleware ====================

// Security headers (helmet defaults are safe for an API server)
app.use(helmet());

// CORS
app.use(cors({
  origin: config.security.corsOrigin,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging — piped into Winston so all logs go to one place
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ==================== Routes ====================

app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Firmware binary files (served from uploads directory)
const uploadsDir = config.upload.dir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/firmware', express.static(uploadsDir));

// [PHASE 3 — serve compiled frontend build once the new dashboard is ready]
// const path = require('path');
// const dashboardPath = path.join(__dirname, 'admin-dashboard', 'dist');
// if (fs.existsSync(dashboardPath)) {
//   app.use(express.static(dashboardPath));
//   app.get('*', (req, res) => res.sendFile(path.join(dashboardPath, 'index.html')));
// }

// ==================== Error Handling ====================

// Global error handler — always expose stack since we are in active development
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    stack: err.stack,
  });
});

// 404 — no frontend catch-all; every unknown path returns JSON
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ==================== Server Initialization ====================

async function startServer() {
  try {
    logger.info('='.repeat(50));
    logger.info('BlazeIoT Solutions Platform - Starting...');
    logger.info('='.repeat(50));

    // Database
    logger.info('Connecting to database...');
    await dbService.connect();
    logger.info('Database connected');

    // Seed default admin if first run
    const adminExists = await dbService.getUserByUsername(config.admin.username);
    if (!adminExists) {
      await authService.createAdminUser(
        config.admin.username,
        config.admin.password,
        config.admin.email,
      );
      logger.info(`Admin user created: ${config.admin.username}`);
    }

    // MQTT — non-fatal if broker is unreachable (API still works)
    logger.info('Connecting to MQTT broker...');
    try {
      await mqttService.connect();
      logger.info('MQTT broker connected');
    } catch (error) {
      logger.error('MQTT connection failed — running in API-only mode:', error.message);
    }

    // [PHASE 3 — WebSocket]
    wsService.initialize(server);
    mqttService.setWebSocketServer(wsService);
    logger.info('WebSocket server initialized');

    // Alert System — load profiles into memory and wire up WS broadcasting
    const alertService = require('./src/services/alert.service');
    alertService.setWebSocketService(wsService);
    await alertService.loadProfiles();
    logger.info('Alert service initialized');

    // Start HTTP server
    server.listen(config.server.port, config.server.host, () => {
      logger.info('='.repeat(50));
      logger.info(`Server   : http://${config.server.host}:${config.server.port}`);
      logger.info(`MQTT     : ${config.mqtt.protocol}://${config.mqtt.host}:${config.mqtt.port}`);
      logger.info(`Database : ${config.database.type.toUpperCase()}`);
      logger.info('='.repeat(50));
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ==================== Graceful Shutdown ====================

async function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);
  try {
    server.close();
    wsService.close();
    await mqttService.disconnect();
    await dbService.close();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { promise, reason });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// ==================== Start ====================

startServer();

module.exports = { app, server };
