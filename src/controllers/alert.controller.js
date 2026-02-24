/**
 * Alert Controller — REST endpoints for alert profiles and alert history
 */

const { ObjectId } = require('mongodb');
const dbService = require('../services/database.service');
const alertService = require('../services/alert.service');
const asyncHandler = require('../middleware/asyncHandler');

// ==================== ALERT PROFILES ====================

// GET /api/alert-profiles
exports.getProfiles = asyncHandler(async (req, res) => {
    const profiles = await dbService.collections.alertProfiles.find({}).toArray();
    res.json({ success: true, count: profiles.length, data: profiles });
});

// GET /api/alert-profiles/:id
exports.getProfile = asyncHandler(async (req, res) => {
    const profile = await dbService.collections.alertProfiles.findOne({ _id: new ObjectId(req.params.id) });
    if (!profile) {
        return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.json({ success: true, data: profile });
});

// POST /api/alert-profiles
exports.createProfile = asyncHandler(async (req, res) => {
    const { profile_type, name, enabled = true, rules = [], cooldown_seconds = 300 } = req.body;

    if (!profile_type || !name) {
        return res.status(400).json({ success: false, message: 'profile_type and name are required' });
    }

    // Check if profile_type already exists
    const existing = await dbService.collections.alertProfiles.findOne({ profile_type });
    if (existing) {
        return res.status(409).json({ success: false, message: `Profile for '${profile_type}' already exists. Use PUT to update.` });
    }

    const doc = {
        profile_type,
        name,
        enabled,
        rules,
        cooldown_seconds,
        created_at: new Date(),
        updated_at: new Date(),
    };

    const result = await dbService.collections.alertProfiles.insertOne(doc);

    // Reload cache
    await alertService.reloadProfiles();

    res.status(201).json({ success: true, data: { ...doc, _id: result.insertedId } });
});

// PUT /api/alert-profiles/:id
exports.updateProfile = asyncHandler(async (req, res) => {
    const { name, enabled, rules, cooldown_seconds } = req.body;
    const update = { updated_at: new Date() };

    if (name !== undefined) update.name = name;
    if (enabled !== undefined) update.enabled = enabled;
    if (rules !== undefined) update.rules = rules;
    if (cooldown_seconds !== undefined) update.cooldown_seconds = cooldown_seconds;

    const result = await dbService.collections.alertProfiles.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: update }
    );

    if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Reload cache
    await alertService.reloadProfiles();

    const updated = await dbService.collections.alertProfiles.findOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true, data: updated });
});

// DELETE /api/alert-profiles/:id
exports.deleteProfile = asyncHandler(async (req, res) => {
    const result = await dbService.collections.alertProfiles.deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Reload cache
    await alertService.reloadProfiles();

    res.json({ success: true, message: 'Profile deleted' });
});

// ==================== ALERTS (HISTORY) ====================

// GET /api/alerts
exports.getAlerts = asyncHandler(async (req, res) => {
    const { limit = 100, offset = 0, severity, source_id, acknowledged } = req.query;
    const query = {};

    if (severity) query.severity = severity;
    if (source_id) query.source_id = source_id;
    if (acknowledged !== undefined) query.acknowledged = acknowledged === 'true';

    const data = await dbService.collections.alerts
        .find(query)
        .sort({ timestamp: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .toArray();

    const totalCount = await dbService.collections.alerts.countDocuments(query);

    res.json({ success: true, count: data.length, totalCount, data });
});

// PUT /api/alerts/:id/acknowledge
exports.acknowledgeAlert = asyncHandler(async (req, res) => {
    const result = await dbService.collections.alerts.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { acknowledged: true, acknowledged_at: new Date() } }
    );

    if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    res.json({ success: true, message: 'Alert acknowledged' });
});

// DELETE /api/alerts (clear all alerts)
exports.clearAlerts = asyncHandler(async (req, res) => {
    const result = await dbService.collections.alerts.deleteMany({});
    res.json({ success: true, message: `Deleted ${result.deletedCount} alert(s)` });
});
