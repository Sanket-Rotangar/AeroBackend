/**
 * Alert Service — Threshold-based alert engine
 *
 * Responsibilities:
 *   1. Load alert profiles from DB into in-memory cache on startup
 *   2. Evaluate incoming sensor data against cached thresholds
 *   3. Emit WebSocket alerts when thresholds are breached
 *   4. Persist alerts to the alerts collection
 *   5. Enforce cooldown to prevent alert spam
 *
 * Cache invalidation: call reloadProfiles() after any profile CRUD via REST API.
 */

const logger = require('../utils/logger');
const dbService = require('./database.service');

class AlertService {
    constructor() {
        // profile_type → profile document
        this.profileCache = new Map();
        // "mac_parameter" → last alert timestamp (ms)
        this.cooldownMap = new Map();
        // Reference to WebSocket service (set by server.js)
        this.wsService = null;
    }

    /**
     * Inject WebSocket service for broadcasting alerts
     */
    setWebSocketService(wsService) {
        this.wsService = wsService;
    }

    /**
     * Load all alert profiles into memory. Called once at startup.
     */
    async loadProfiles() {
        try {
            const profiles = await dbService.collections.alertProfiles.find({}).toArray();
            this.profileCache.clear();
            for (const profile of profiles) {
                this.profileCache.set(profile.profile_type, profile);
            }
            logger.info(`[AlertService] Loaded ${profiles.length} alert profile(s) into cache`);
        } catch (error) {
            logger.error('[AlertService] Failed to load profiles:', error);
        }
    }

    /**
     * Reload profiles (call after CRUD operations on alert_profiles)
     */
    async reloadProfiles() {
        await this.loadProfiles();
    }

    /**
     * Evaluate sensor data against threshold rules.
     * Called from MQTT handlers after parsing the payload.
     *
     * @param {string} mac - Node MAC address (source_id)
     * @param {string} gatewayId - Gateway that relayed the data
     * @param {object} sensorData - The parsed sensor data object
     */
    async evaluateData(mac, gatewayId, sensorData) {
        try {
            // Determine profile type from data shape
            const profileType = this.detectProfileType(sensorData);
            if (!profileType) return; // Unknown data shape — skip

            const profile = this.profileCache.get(profileType);
            if (!profile || !profile.enabled || !profile.rules || profile.rules.length === 0) {
                return; // No profile or disabled
            }

            const cooldownMs = (profile.cooldown_seconds || 300) * 1000;
            const now = Date.now();

            for (const rule of profile.rules) {
                const value = sensorData[rule.parameter];

                // Skip if the parameter is not present in this payload
                if (value === undefined || value === null) continue;

                // Check threshold
                if (!this.checkThreshold(value, rule.operator, rule.threshold)) continue;

                // Check cooldown — prevent spamming the same alert
                const cooldownKey = `${mac}_${rule.parameter}`;
                const lastAlertTime = this.cooldownMap.get(cooldownKey);
                if (lastAlertTime && (now - lastAlertTime) < cooldownMs) continue;

                // === THRESHOLD BREACHED ===
                this.cooldownMap.set(cooldownKey, now);

                // Get node name for the alert message
                let nodeName = mac;
                try {
                    const node = await dbService.getNodeByMac(mac);
                    if (node) nodeName = node.node_name || node.mac;
                } catch (_) { /* non-critical */ }

                const alert = {
                    source_id: mac,
                    source_name: nodeName,
                    gateway_id: gatewayId,
                    profile_type: profileType,
                    parameter: rule.parameter,
                    value: value,
                    threshold: rule.threshold,
                    operator: rule.operator,
                    severity: rule.severity || 'warning',
                    message: rule.message || `${rule.parameter} exceeded threshold`,
                    acknowledged: false,
                    timestamp: new Date(),
                };

                // Persist to DB
                await dbService.collections.alerts.insertOne({ ...alert });

                // Broadcast via WebSocket
                if (this.wsService) {
                    this.wsService.broadcast({
                        type: 'alert',
                        ...alert,
                        timestamp: alert.timestamp.toISOString(),
                    }, 'alerts');
                }

                logger.warn(`[Alert] ${rule.severity.toUpperCase()}: ${nodeName} — ${rule.parameter}=${value} (threshold: ${rule.operator} ${rule.threshold})`);
            }
        } catch (error) {
            logger.error('[AlertService] Error evaluating data:', error);
        }
    }

    /**
     * Detect profile type from sensor data fields
     */
    detectProfileType(sensorData) {
        if (sensorData.type === 'aqi') return 'aqi';
        if (sensorData.elephant !== undefined || sensorData.gunshot !== undefined) return 'wildlife';
        return null;
    }

    /**
     * Compare a value against a threshold using the given operator
     */
    checkThreshold(value, operator, threshold) {
        switch (operator) {
            case 'gte': return value >= threshold;
            case 'gt': return value > threshold;
            case 'lte': return value <= threshold;
            case 'lt': return value < threshold;
            case 'eq': return value === threshold;
            default: return value >= threshold; // Default to gte
        }
    }
}

// Singleton
const alertService = new AlertService();
module.exports = alertService;
