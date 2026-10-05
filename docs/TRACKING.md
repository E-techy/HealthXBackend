# High-Speed Live Tracking & Time-Series API

This module is the core engine for vehicle geolocation. To guarantee extreme performance and prevent database IO bottlenecking, the tracking system uses a **Dual-Database Architecture**:

1. **Fast-Path (Redis):** Handles instantaneous, high-frequency (1-3 second intervals) single-point GPS updates. It only stores the *absolute latest* coordinate for each vehicle.
2. **Audit-Path (MongoDB Time-Series):** Handles historical paths. Clients locally buffer their GPS pings (e.g., 60 seconds worth of data) and perform a bulk upload to MongoDB to form a continuous historical trail.

---

## Authentication & RBAC Security

Every endpoint in this module requires a valid **User JWT** (`Authorization: Bearer <token>`).

Furthermore, the backend verifies that the requesting user has the right to access the specified `emergencyTrackingId` (must be the Owner or an Invited Responder via the ACL).

---

# Part 1: Live Tracking (Redis Fast-Path)

## 1.1 Push Live Location

Pushes a single, instantaneous location update to the Redis memory bank. This overwrites the vehicle's previous location.

- **Method:** `POST`
- **Path:** `/api/tracking/live`
- **Headers:** `Authorization: Bearer <user_jwt>`

### Request Payload

```json
{
  "emergencyTrackingId": "EM-TRACK-2026",
  "vehicleId": "TRK-AMB-01",
  "locationData": {
    "longitude": 77.2,
    "latitude": 28.6,
    "speed": 60,
    "heading": 90,
    "timestamp": 1791224410324
  }
}
```

### Success Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "success": true,
    "timestamp": 1791224410324
  }
}
```

---

## 1.2 Fetch Batch Live Locations (Specific Vehicles)

Fetches the instant location of a specific list of vehicles. Uses a Redis Pipeline to grab all coordinates in a single network roundtrip for ultra-low latency.

- **Method:** `POST`
- **Path:** `/api/tracking/live/batch`
- **Headers:** `Authorization: Bearer <user_jwt>`

### Request Payload

```json
{
  "emergencyTrackingId": "EM-TRACK-2026",
  "vehicleIds": [
    "TRK-AMB-01",
    "TRK-FIR-01"
  ]
}
```

### Success Response (`200 OK`)

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "vehicleId": "TRK-AMB-01",
      "longitude": 77.2,
      "latitude": 28.6,
      "altitude": 0,
      "speed": 60,
      "heading": 90,
      "timestamp": 1791224410324
    },
    {
      "vehicleId": "TRK-FIR-01",
      "longitude": 77.22,
      "latitude": 28.62,
      "altitude": 0,
      "speed": 70,
      "heading": 90,
      "timestamp": 1791224410778
    }
  ]
}
```

---

## 1.3 Fetch ALL Live Locations for an Emergency

Automatically finds all vehicles that are currently attached and `CONNECTED` to the specified emergency, then fetches their live locations from Redis.

- **Method:** `GET`
- **Path:** `/api/tracking/live/emergency/:emergencyTrackingId`
- **Headers:** `Authorization: Bearer <user_jwt>`

### Success Response (`200 OK`)

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "vehicleId": "TRK-AMB-01",
      "longitude": 77.2,
      "latitude": 28.6,
      "altitude": 0,
      "speed": 60,
      "heading": 90,
      "timestamp": 1791224410324
    }
    // ... includes all attached vehicles
  ]
}
```

---

# Part 2: Historical Trails (MongoDB Time-Series)

## 2.1 Bulk Save Trail Data (Local Buffer Sync)

Client devices (e.g., the ambulance's mobile app) should record their GPS locally and send an array of points in bulk (e.g., every 15 to 60 seconds). This avoids overwhelming the MongoDB disk.

- **Method:** `POST`
- **Path:** `/api/tracking/trail/bulk`
- **Headers:** `Authorization: Bearer <user_jwt>`

### Request Payload

```json
{
  "emergencyTrackingId": "EM-TRACK-2026",
  "vehicleId": "TRK-AMB-01",
  "breadcrumbs": [
    {
      "longitude": 77.203,
      "latitude": 28.603,
      "speed": 65,
      "heading": 95,
      "timestamp": 1791224409377
    },
    {
      "longitude": 77.20400000000001,
      "latitude": 28.604000000000003,
      "speed": 65,
      "heading": 95,
      "timestamp": 1791224410377
    }
  ]
}
```

### Success Response (`201 Created`)

```json
{
  "success": true,
  "message": "Saved 5 trailing points."
}
```

---

## 2.2 Fetch Historical Trail

Retrieves a chronologically sorted array of a vehicle's past locations. Ideal for drawing a polyline ("trailing line") behind a vehicle on the client-side map.

- **Method:** `GET`
- **Path:** `/api/tracking/trail/:emergencyTrackingId/:vehicleId`
- **Headers:** `Authorization: Bearer <user_jwt>`

### Query Parameters

- `hours` (Optional): Number of past hours to fetch. Defaults to `1`.
- `startTime` & `endTime` (Optional): Exact millisecond timestamps to bound the query. Overrides `hours`.

### Example Usage

```text
/api/tracking/trail/EM-TRACK-2026/TRK-AMB-01?hours=1
```

### Success Response (`200 OK`)

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "longitude": 77.2,
      "latitude": 28.6,
      "altitude": 0,
      "speed": 65,
      "heading": 95,
      "timestamp": "2026-10-05T18:20:06.377Z"
    },
    {
      "longitude": 77.20100000000001,
      "latitude": 28.601000000000003,
      "altitude": 0,
      "speed": 65,
      "heading": 95,
      "timestamp": "2026-10-05T18:20:07.377Z"
    }
    // ... sorted oldest to newest
  ]
}
```