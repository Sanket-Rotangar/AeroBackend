# IoT Backend Platform

Node.js + Express backend for BLE/LoRa IoT gateways.
Devices publish sensor data via MQTT → backend stores to MongoDB → REST API exposes it.

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js + Express |
| Database | MongoDB (native driver) |
| Messaging | MQTT via HiveMQ Cloud (`mqtts`, port 8883) |
| Auth | JWT + bcrypt |
| Logging | Winston |

---

## Structure

```
src/
  config/         — env-based config (throws on missing required vars)
  controllers/    — HTTP handlers (one file per resource)
  middleware/     — asyncHandler (no try/catch in controllers)
  mqtt/
    handlers/     — index.js  (SensorData, BLEGateway, LoRaGateway, OTA)
  routes/         — api.routes.js  (single thin routing file)
  services/
    auth.service.js              — JWT sign/verify, protect + requireAdmin middleware
    database.service.js          — alias → database.mongodb.service.js
    database.mongodb.service.js  — all raw MongoDB queries
    mqtt.service.js              — connection lifecycle, publish, OTA/command helpers
  utils/
    logger.js     — Winston (console + file, always on)
    validators.js — express-validator schemas
scripts/
  seedAdmin.js    — create initial admin user
  initDatabase.js — create collections and indexes
  test-api.js     — run all API tests against a live server
```

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Edit .env (MONGODB_URI, JWT_SECRET, MQTT credentials)

# 3. Seed admin user
npm run seed-admin

# 4. Start server
npm start          # production
npm run dev        # nodemon watch
```

---

## API

All routes are prefixed `/api/`.
Protected routes require `Authorization: Bearer <token>`.
Admin routes additionally require `role: admin`.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Get JWT token |
| GET | `/auth/me` | user | Current user info |
| GET | `/status` | user | System health + MQTT status |
| GET | `/devices` | user | List all devices |
| GET | `/devices/:id` | user | Device by ID |
| GET | `/devices/:id/data` | user | Sensor history (paginated, optional date range) |
| GET | `/devices/:id/latest` | user | Most recent reading |
| POST | `/devices` | admin | Register device |
| PUT | `/devices/:id` | admin | Update device fields |
| GET | `/gateways` | user | List all gateways |
| GET | `/gateways/:id` | user | Gateway + node count |
| GET | `/gateways/:id/nodes` | user | Nodes under gateway |
| POST | `/gateways` | admin | Register gateway |
| GET | `/nodes/:mac/data` | user | Sensor history for a node |
| GET | `/sensor-data` | user | All sensor data (max 1000 rows) |
| GET | `/ota/firmware` | user | Firmware catalogue |
| GET | `/ota/latest` | — | Latest firmware (public, devices poll this) |
| POST | `/ota/firmware` | admin | Upload firmware entry |
| POST | `/ota/update` | admin | Push OTA update to device |
| GET | `/ota/history/:id` | user | OTA history for device |
| GET | `/logs` | admin | System logs (max 1000 rows) |
| POST | `/commands/send` | admin | Send MQTT command to device |

---

## MQTT Topics

| Topic | Direction | Handler |
|---|---|---|
| `SensorData/#` | device → backend | Direct sensor readings |
| `BLEGatewayData/#` | gateway → backend | BLE beacon data |
| `LoRaGatewayData/#` | gateway → backend | LoRa node data |
| `OTA/+/response` | device → backend | Firmware update result |
| `OTA/<id>/update` | backend → device | OTA push command |
| `CommandRequest/<id>` | backend → device | Device commands |

Devices and gateways are **auto-registered** on first message — no pre-provisioning needed.

---

## Test

Start the server, then:

```bash
npm test
# or
node scripts/test-api.js
```
