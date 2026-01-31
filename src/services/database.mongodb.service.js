/**
 * BlazeIoT Solutions - MongoDB Database Service
 * MongoDB Atlas implementation for IoT Platform
 */

const { MongoClient, ObjectId } = require('mongodb');
const config = require('../config/config');
const logger = require('../utils/logger');

class MongoDBService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collections = {};
  }

  /**
   * Initialize MongoDB connection
   */
  async connect() {
    try {
      this.client = new MongoClient(config.database.mongodb.uri, config.database.mongodb.options);
      await this.client.connect();
      
      // Get database name from URI or use default
      const dbName = new URL(config.database.mongodb.uri).pathname.slice(1) || 'blazeiot';
      this.db = this.client.db(dbName);
      
      // Initialize collections
      this.collections = {
        users: this.db.collection('users'),
        devices: this.db.collection('devices'),
        gateways: this.db.collection('gateways'),
        nodes: this.db.collection('nodes'),
        sensorData: this.db.collection('sensor_data'),
        commands: this.db.collection('commands'),
        otaUpdates: this.db.collection('ota_updates'),
        systemLogs: this.db.collection('system_logs'),
        logs: this.db.collection('system_logs'), // Alias for systemLogs
      };

      await this.createIndexes();
      logger.db(`MongoDB connected: ${dbName}`);
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  /**
   * Create indexes for better query performance
   */
  async createIndexes() {
    try {
      // Users indexes
      await this.collections.users.createIndex({ username: 1 }, { unique: true });
      await this.collections.users.createIndex({ email: 1 }, { unique: true, sparse: true });

      // Devices indexes
      await this.collections.devices.createIndex({ device_id: 1 }, { unique: true });
      await this.collections.devices.createIndex({ status: 1 });
      await this.collections.devices.createIndex({ last_seen: -1 });

      // Gateways indexes
      await this.collections.gateways.createIndex({ gateway_id: 1 }, { unique: true });
      await this.collections.gateways.createIndex({ status: 1 });
      await this.collections.gateways.createIndex({ last_seen: -1 });

      // Nodes indexes
      await this.collections.nodes.createIndex({ mac: 1, gateway_id: 1 }, { unique: true });
      await this.collections.nodes.createIndex({ gateway_id: 1 });
      await this.collections.nodes.createIndex({ last_seen: -1 });

      // Sensor data indexes (compound indexes for common queries)
      await this.collections.sensorData.createIndex({ source_id: 1, timestamp: -1 });
      await this.collections.sensorData.createIndex({ source_type: 1, timestamp: -1 });
      await this.collections.sensorData.createIndex({ timestamp: -1 });
      await this.collections.sensorData.createIndex({ gateway_id: 1, timestamp: -1 });

      // Commands indexes
      await this.collections.commands.createIndex({ device_id: 1, created_at: -1 });
      await this.collections.commands.createIndex({ status: 1 });

      // OTA updates indexes
      await this.collections.otaUpdates.createIndex({ device_id: 1, created_at: -1 });
      await this.collections.otaUpdates.createIndex({ status: 1 });

      // System logs indexes
      await this.collections.systemLogs.createIndex({ timestamp: -1 });
      await this.collections.systemLogs.createIndex({ category: 1, timestamp: -1 });
      await this.collections.systemLogs.createIndex({ source_id: 1, timestamp: -1 });

      logger.db('MongoDB indexes created successfully');
    } catch (error) {
      logger.error('Error creating indexes:', error);
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      logger.db('MongoDB connection closed');
    }
  }

  // ==================== USER METHODS ====================

  async createUser(username, passwordHash, email, role = 'user') {
    const result = await this.collections.users.insertOne({
      username,
      password_hash: passwordHash,
      email,
      role,
      created_at: new Date(),
    });
    return result.insertedId;
  }

  async getUserByUsername(username) {
    return await this.collections.users.findOne({ username });
  }

  async getUserById(id) {
    return await this.collections.users.findOne({ _id: new ObjectId(id) });
  }

  async updateUserPassword(username, passwordHash) {
    const result = await this.collections.users.updateOne(
      { username },
      { $set: { password_hash: passwordHash, updated_at: new Date() } }
    );
    return result.modifiedCount;
  }

  async updateLastLogin(username) {
    const result = await this.collections.users.updateOne(
      { username },
      { $set: { last_login: new Date() } }
    );
    return result.modifiedCount;
  }

  async getAllUsers() {
    return await this.collections.users.find({}).toArray();
  }

  // ==================== DEVICE METHODS ====================

  async insertDevice(device_id, device_name = null, status = 'active') {
    const existing = await this.collections.devices.findOne({ device_id });
    if (existing) {
      return { already_exists: true, _id: existing._id };
    }

    const result = await this.collections.devices.insertOne({
      device_id,
      device_name: device_name || device_id,
      status,
      last_seen: new Date(),
      created_at: new Date(),
    });
    return { _id: result.insertedId };
  }

  async updateDeviceStatus(device_id, status, last_seen = new Date()) {
    const result = await this.collections.devices.updateOne(
      { device_id },
      { 
        $set: { status, last_seen },
        $setOnInsert: { created_at: new Date(), device_name: device_id }
      },
      { upsert: true }
    );
    return result.modifiedCount || result.upsertedCount;
  }

  async getAllDevices(limit = 100, offset = 0) {
    return await this.collections.devices
      .find({})
      .sort({ last_seen: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getDeviceById(device_id) {
    return await this.collections.devices.findOne({ device_id });
  }

  // ==================== GATEWAY METHODS ====================

  async insertGateway(gateway_id, gateway_name = null, status = 'active') {
    const existing = await this.collections.gateways.findOne({ gateway_id });
    if (existing) {
      return { already_exists: true, _id: existing._id };
    }

    const result = await this.collections.gateways.insertOne({
      gateway_id,
      gateway_name: gateway_name || gateway_id,
      status,
      last_seen: new Date(),
      created_at: new Date(),
    });
    return { _id: result.insertedId };
  }

  async updateGatewayStatus(gateway_id, status, last_seen = new Date()) {
    const result = await this.collections.gateways.updateOne(
      { gateway_id },
      { 
        $set: { status, last_seen },
        $setOnInsert: { created_at: new Date(), gateway_name: gateway_id }
      },
      { upsert: true }
    );
    return result.modifiedCount || result.upsertedCount;
  }

  async getAllGateways(limit = 100, offset = 0) {
    const gateways = await this.collections.gateways
      .find({})
      .sort({ last_seen: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Add node count
    for (let gateway of gateways) {
      gateway.node_count = await this.collections.nodes.countDocuments({ gateway_id: gateway.gateway_id });
    }

    return gateways;
  }

  async getGatewayById(gateway_id) {
    const gateway = await this.collections.gateways.findOne({ gateway_id });
    if (gateway) {
      gateway.node_count = await this.collections.nodes.countDocuments({ gateway_id });
    }
    return gateway;
  }

  // ==================== NODE METHODS ====================

  async insertNode(gateway_id, mac, node_name = null, rssi = null) {
    const result = await this.collections.nodes.updateOne(
      { mac, gateway_id },
      { 
        $set: { 
          node_name: node_name || mac,
          rssi,
          last_seen: new Date()
        },
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true }
    );
    return result.upsertedId || result.modifiedCount;
  }

  async updateNodeStatus(mac, gateway_id, rssi = null) {
    const result = await this.collections.nodes.updateOne(
      { mac, gateway_id },
      { 
        $set: { rssi, last_seen: new Date() },
        $setOnInsert: { created_at: new Date(), node_name: mac }
      },
      { upsert: true }
    );
    return result.modifiedCount || result.upsertedCount;
  }

  async getNodesByGateway(gateway_id, limit = 100, offset = 0) {
    return await this.collections.nodes
      .find({ gateway_id })
      .sort({ last_seen: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getNodeByMac(mac) {
    return await this.collections.nodes.findOne({ mac });
  }

  async getAllNodes(limit = 100, offset = 0) {
    return await this.collections.nodes
      .find({})
      .sort({ last_seen: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  // ==================== SENSOR DATA METHODS ====================

  async insertSensorData(source_id, source_type, gateway_id, data, timestamp = new Date()) {
    const result = await this.collections.sensorData.insertOne({
      source_id,
      source_type,
      gateway_id: gateway_id || null,
      data,
      timestamp,
      created_at: new Date(),
    });
    return result.insertedId;
  }

  async getSensorDataBySource(source_id, limit = 100, offset = 0) {
    return await this.collections.sensorData
      .find({ source_id })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getAllSensorData(limit = 100, offset = 0) {
    const query = this.collections.sensorData
      .find({})
      .sort({ timestamp: -1 })
      .skip(offset);
    
    // If limit is null or 0, don't apply limit (fetch all)
    if (limit && limit > 0) {
      query.limit(limit);
    }
    
    return await query.toArray();
  }

  async getRecentSensorData(minutes = 60, limit = 100) {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return await this.collections.sensorData
      .find({ timestamp: { $gte: cutoffTime } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // ==================== COMMAND METHODS ====================

  async insertCommand(device_id, command, parameters = null) {
    const result = await this.collections.commands.insertOne({
      device_id,
      command,
      parameters,
      status: 'pending',
      created_at: new Date(),
    });
    return result.insertedId;
  }

  async updateCommandStatus(id, status, response = null) {
    const result = await this.collections.commands.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status, 
          response,
          updated_at: new Date()
        } 
      }
    );
    return result.modifiedCount;
  }

  async getCommandsByDevice(device_id, limit = 100, offset = 0) {
    return await this.collections.commands
      .find({ device_id })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getAllCommands(limit = 100, offset = 0) {
    return await this.collections.commands
      .find({})
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getPendingCommands(device_id) {
    return await this.collections.commands
      .find({ device_id, status: 'pending' })
      .sort({ created_at: 1 })
      .toArray();
  }

  // ==================== OTA UPDATE METHODS ====================

  async insertOtaUpdate(device_id, firmware_version, firmware_url, file_size = null) {
    const result = await this.collections.otaUpdates.insertOne({
      device_id,
      firmware_version,
      firmware_url,
      file_size,
      status: 'pending',
      progress: 0,
      created_at: new Date(),
    });
    return result.insertedId;
  }

  async updateOtaStatus(id, status, progress = null, error = null) {
    const updateData = { status, updated_at: new Date() };
    if (progress !== null) updateData.progress = progress;
    if (error !== null) updateData.error = error;

    const result = await this.collections.otaUpdates.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    return result.modifiedCount;
  }

  async getOtaUpdatesByDevice(device_id, limit = 100, offset = 0) {
    return await this.collections.otaUpdates
      .find({ device_id })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async getAllOtaUpdates(limit = 100, offset = 0) {
    return await this.collections.otaUpdates
      .find({})
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  // ==================== SYSTEM LOGS METHODS ====================

  async insertLog(category, message, details = null, source_id = null) {
    const result = await this.collections.systemLogs.insertOne({
      category,
      message,
      details,
      source_id,
      timestamp: new Date(),
    });
    return result.insertedId;
  }

  async getLogsByCategory(category, limit = 100, offset = 0) {
    const query = this.collections.logs
      .find({ category })
      .sort({ timestamp: -1 })
      .skip(offset);
    
    // If limit is null or 0, don't apply limit (fetch all)
    if (limit && limit > 0) {
      query.limit(limit);
    }
    
    return await query.toArray();
  }

  async getAllLogs(limit = 100, offset = 0) {
    // Always enforce a limit to prevent memory issues
    const safeLimit = Math.min(Math.max(limit || 100, 1), 10000);
    
    return await this.collections.logs
      .find({})
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(safeLimit)
      .toArray();
  }

  async getRecentLogs(minutes = 60, limit = 100) {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return await this.collections.logs
      .find({ timestamp: { $gte: cutoffTime } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // ==================== STATISTICS METHODS ====================

  async getDashboardStats() {
    const [
      totalDevices,
      activeDevices,
      totalGateways,
      activeGateways,
      totalNodes,
      activeNodes,
      totalSensorData
    ] = await Promise.all([
      this.collections.devices.countDocuments({}),
      this.collections.devices.countDocuments({ status: 'active' }),
      this.collections.gateways.countDocuments({}),
      this.collections.gateways.countDocuments({ status: 'active' }),
      this.collections.nodes.countDocuments({}),
      this.collections.nodes.countDocuments({ 
        last_seen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } 
      }),
      this.collections.sensorData.countDocuments({})
    ]);

    return {
      total_devices: totalDevices,
      active_devices: activeDevices,
      total_gateways: totalGateways,
      active_gateways: activeGateways,
      total_nodes: totalNodes,
      active_nodes: activeNodes,
      total_sensor_data: totalSensorData,
    };
  }
}

// Singleton instance
const mongoDBService = new MongoDBService();

module.exports = mongoDBService;
