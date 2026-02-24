/**
 * BlazeIoT Solutions - WebSocket Service
 * Real-time data streaming to dashboard clients
 */

const WebSocket = require('ws');
const url = require('url');
const config = require('../config/config');
const authService = require('./auth.service');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map of authenticated clients
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.ws(`WebSocket server initialized on port ${config.websocket.port}`);
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();

    // Parse query parameters for authentication
    const query = url.parse(req.url, true).query;
    const token = query.token;

    logger.ws(`New WebSocket connection attempt: ${clientId}`);

    // Authenticate client
    if (!token) {
      ws.close(1008, 'Authentication required');
      logger.ws(`WebSocket connection rejected: No token provided`);
      return;
    }

    try {
      const user = authService.verifyToken(token);

      // Store authenticated client
      this.clients.set(clientId, {
        ws,
        user,
        connectedAt: new Date(),
      });

      logger.ws(`WebSocket client authenticated: ${clientId} (${user.username})`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        message: 'Connected to BlazeIoT real-time stream',
        clientId,
        timestamp: new Date().toISOString(),
      });

      // Handle messages from client
      ws.on('message', (message) => {
        this.handleMessage(clientId, message);
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
      });

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

    } catch (error) {
      ws.close(1008, 'Invalid token');
      logger.ws(`WebSocket connection rejected: Invalid token`);
    }
  }

  /**
   * Handle messages from clients
   */
  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message.toString());
      logger.ws(`Message from client ${clientId}:`, data);

      // Handle different message types
      switch (data.type) {
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'subscribe':
          // Client can subscribe to specific data streams
          this.handleSubscribe(clientId, data.channel);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, data.channel);
          break;

        default:
          logger.ws(`Unknown message type from ${clientId}: ${data.type}`);
      }
    } catch (error) {
      logger.error(`Error handling WebSocket message from ${clientId}:`, error);
    }
  }

  /**
   * Handle client subscription to channels
   */
  handleSubscribe(clientId, channel) {
    const client = this.clients.get(clientId);
    if (client) {
      if (!client.subscriptions) {
        client.subscriptions = new Set();
      }
      client.subscriptions.add(channel);
      logger.ws(`Client ${clientId} subscribed to ${channel}`);

      this.sendToClient(clientId, {
        type: 'subscribed',
        channel,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle client unsubscription from channels
   */
  handleUnsubscribe(clientId, channel) {
    const client = this.clients.get(clientId);
    if (client && client.subscriptions) {
      client.subscriptions.delete(channel);
      logger.ws(`Client ${clientId} unsubscribed from ${channel}`);

      this.sendToClient(clientId, {
        type: 'unsubscribed',
        channel,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      logger.ws(`Client disconnected: ${clientId} (${client.user.username})`);
      this.clients.delete(clientId);
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error(`Failed to send message to client ${clientId}:`, error);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(data, channel = null) {
    const message = JSON.stringify(data);
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        // If channel is specified, only send to subscribed clients
        if (channel && client.subscriptions && !client.subscriptions.has(channel)) {
          return;
        }

        try {
          client.ws.send(message);
          sentCount++;
        } catch (error) {
          logger.error(`Failed to broadcast to client ${clientId}:`, error);
        }
      }
    });

    if (sentCount > 0) {
      logger.ws(`Broadcast sent to ${sentCount} clients`, { type: data.type, channel });
    }
  }

  /**
   * Broadcast to specific channel subscribers
   */
  broadcastToChannel(channel, data) {
    this.broadcast({ ...data, channel }, channel);
  }

  /**
   * Send node status update
   */
  broadcastNodeStatus(mac, status, data = {}) {
    this.broadcast({
      type: 'node_status',
      mac,
      status,
      data,
      timestamp: new Date().toISOString(),
    }, 'nodes');
  }

  /**
   * Send gateway status update
   */
  broadcastGatewayStatus(gateway_id, status, data = {}) {
    this.broadcast({
      type: 'gateway_status',
      gateway_id,
      status,
      data,
      timestamp: new Date().toISOString(),
    }, 'gateways');
  }

  /**
   * Send sensor data update
   */
  broadcastSensorData(source_type, source_id, data) {
    this.broadcast({
      type: 'sensor_data',
      source_type,
      source_id,
      data,
      timestamp: new Date().toISOString(),
    }, 'sensor_data');
  }

  /**
   * Send OTA update notification
   */
  broadcastOTAUpdate(device_id, status, data = {}) {
    this.broadcast({
      type: 'ota_update',
      device_id,
      status,
      data,
      timestamp: new Date().toISOString(),
    }, 'ota');
  }

  /**
   * Send system log notification
   */
  broadcastLog(log) {
    this.broadcast({
      type: 'system_log',
      log,
      timestamp: new Date().toISOString(),
    }, 'logs');
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      clients: Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        username: client.user.username,
        connectedAt: client.connectedAt,
        subscriptions: client.subscriptions ? Array.from(client.subscriptions) : [],
      })),
    };
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close all connections
   */
  close() {
    if (this.wss) {
      this.clients.forEach((client, clientId) => {
        client.ws.close(1000, 'Server shutting down');
      });
      this.clients.clear();

      this.wss.close(() => {
        logger.ws('WebSocket server closed');
      });
    }
  }
}

// Create singleton instance
const wsService = new WebSocketService();

module.exports = wsService;
