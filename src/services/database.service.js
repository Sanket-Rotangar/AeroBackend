/**
 * BlazeIoT Solutions - Database Service
 * Single source of truth for all DB operations — MongoDB only.
 * This file exists as an import alias so routes and services always import
 * from 'database.service' rather than the concrete implementation directly.
 */

module.exports = require('./database.mongodb.service');
