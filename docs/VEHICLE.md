# Vehicle Fleet & Geospatial Discovery API

This module manages independent vehicle entities (Ambulances, Police, Fire Trucks, Private Responder Vehicles). Vehicles operate as standalone profiles that can broadcast their public location via GPS and dynamically attach or detach from active Emergency Sessions.

---

## Core Features

1. **SSN Privacy & Encryption:** Any sensitive data (like `ssn`) sent during registration is immediately AES-256 encrypted before hitting the database. Only `ssnMasked` (e.g., `***-**-6789`) is exposed in API outputs.

2. **Geospatial Indexing (`2dsphere`):** Global location updates are indexed, allowing dispatchers to draw a radius around an incident and instantly find all `isPublic: true` responders nearby.

3. **Multi-Emergency Support:** Vehicles maintain an array of `activeEmergencies`, allowing them to respond to multiple incidents simultaneously.

---

# 1. Global Registration & Telemetry

## 1.1 Register / Update Vehicle Profile

Registers a new vehicle or updates an existing one. If the vehicle is marked as `isPublic: false`, it will remain completely invisible to the global radius search (useful for victim relatives or undercover vehicles).

- **Method:** `POST`
- **Path:** `/api/vehicles/register`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Request Payload

```json
{
  "vehicleId": "AMB-001",
  "vehicleName": "City Hospital Amb 1",
  "vehicleType": "AMBULANCE",
  "isPublic": true,
  "driverName": "Driver AMB-001",
  "teamMembers": [
    {
      "fullName": "Medic AMB-001",
      "role": "Support",
      "ssn": "123456789"
    }
  ]
}
```

### Response (`200 OK`)

```json
{
  "success": true,
  "message": "Vehicle registered/updated.",
  "data": {
    "vehicleId": "AMB-001",
    "isPublic": true,
    "identity": {
      "vehicleName": "City Hospital Amb 1",
      "vehicleType": "AMBULANCE"
    },
    "crew": {
      "driverName": "Driver AMB-001",
      "members": [
        {
          "fullName": "Medic AMB-001",
          "role": "Support",
          "ssnEncrypted": "1adee69b3624...:5612b4faf767...",
          "ssnMasked": "***-**-6789"
        }
      ]
    },
    "lastKnownLocation": {
      "type": "Point",
      "coordinates": [0, 0]
    },
    "activeEmergencies": [],
    "connectionStatus": "DISCONNECTED"
  }
}
```

---

## 1.2 Update Telemetry (Location & Status)

Updates the vehicle's GPS coordinates, fuel, and battery. Updating coordinates here automatically updates the vehicle's position on the global spatial map.

- **Method:** `PATCH`
- **Path:** `/api/vehicles/:vehicleId/telemetry`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Request Payload

```json
{
  "longitude": 77.21,
  "latitude": 28.614,
  "fuelPercentage": 85
}
```

### Response (`200 OK`)

Returns the updated vehicle object with the new `lastKnownLocation.coordinates` and `telemetry.fuelPercentage`.

---

# 2. Geospatial Discovery

## 2.1 Find Nearby Public Vehicles

Searches for all public vehicles (`isPublic: true`) within a specified radius (in kilometers) from a central GPS point.

- **Method:** `GET`
- **Path:** `/api/vehicles/nearby?lng=77.2090&lat=28.6139&radius=10`
- **Headers:** Public (No Auth Required)

### Query Parameters

| Parameter | Required | Description |
|---|---|---|
| `lng` | Yes | Central Longitude |
| `lat` | Yes | Central Latitude |
| `radius` | No | Search radius in kilometers (Defaults to 10km) |

### Response (`200 OK`)

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "vehicleId": "AMB-001",
      "identity": {
        "vehicleName": "City Hospital Amb 1",
        "vehicleType": "AMBULANCE"
      },
      "lastKnownLocation": {
        "type": "Point",
        "coordinates": [77.21, 28.614]
      },
      "telemetry": {
        "fuelPercentage": 85
      },
      "crew": {
        "driverName": "Driver AMB-001",
        "members": [
          {
            "fullName": "Medic AMB-001",
            "role": "Support",
            "ssnMasked": "***-**-6789"
          }
        ]
      }
    }
    // ... up to 5 nearby vehicles
  ]
}
```

> **Note:** Private vehicles and vehicles outside the 10km radius are automatically excluded from this payload. Encrypted SSNs are also strictly omitted.

---

# 3. Emergency Incident Integration

## 3.1 Attach Vehicle to Emergency

Connects the vehicle to an active emergency session. This changes `connectionStatus` to `CONNECTED`.

- **Method:** `POST`
- **Path:** `/api/vehicles/:vehicleId/attach`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Request Payload

```json
{
  "emergencyTrackingId": "EM-TEST-9999"
}
```

### Response (`200 OK`)

Returns the vehicle object.

> **Note:** `"EM-TEST-9999"` will now appear in the `activeEmergencies` array.

---

## 3.2 Get Emergency Session Snapshot

Retrieves all vehicles currently attached to a specific emergency incident.

- **Method:** `GET`
- **Path:** `/api/vehicles/emergency/:emergencyTrackingId`
- **Headers:** Public (or Auth depending on frontend implementation)

### Response (`200 OK`)

```json
{
  "success": true,
  "data": {
    "emergencyTrackingId": "EM-TEST-9999",
    "activeVehiclesCount": 3,
    "vehicles": [
      {
        "vehicleId": "AMB-001",
        "identity": {
          "vehicleName": "City Hospital Amb 1"
        },
        "connectionStatus": "CONNECTED"
      }
      // ... list of attached vehicles
    ]
  }
}
```

---

## 3.3 Detach Vehicle from Emergency

Removes the vehicle from the incident. If it was the last emergency the vehicle was attached to, its status reverts to `DISCONNECTED`.

- **Method:** `POST`
- **Path:** `/api/vehicles/:vehicleId/detach`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Request Payload

```json
{
  "emergencyTrackingId": "EM-TEST-9999"
}
```

### Response (`200 OK`)

Returns the vehicle object.

> The `activeEmergencies` array will now be empty.