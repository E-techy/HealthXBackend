# Emergency Session Management API

This module manages real-time emergency tracking sessions, enforcing **Role-Based Access Control (RBAC)** and **Access Control Lists (ACL)**. It also supports **Global Public Discovery** for crowdsourced disaster relief, and **Live Event Broadcasting** via WebSockets.

---

## Authentication Note

- **Owner/Admin Routes:** Require a standard user JWT (`Authorization: Bearer <token>`).
- **Participant/Join Routes:** Require a standard user JWT **only if** the emergency has invited users (ACL enabled). If the ACL is empty, the link/password is public to anyone.
- **Search & Info Routes:** Fully public (No Auth Required).

---

# 1. Owner / Admin Routes

## Create Emergency

Creates a session. The user making the request becomes the Owner. You can optionally make the emergency public and attach geospatial/victim metadata.

- **URL:** `POST /api/emergency/create`
- **Headers:** `Authorization: Bearer <user_jwt>`

### Body

```json
{
  "title": "Missing Person Search - Sector 4",
  "description": "Search party coordination for a missing hiker.",
  "password": "securePass123",
  "isPublicVisibility": true,
  "location": {
    "lng": 77.2090,
    "lat": 28.6139
  },
  "address": {
    "city": "New Delhi",
    "state": "Delhi",
    "country": "India"
  },
  "victimMetadata": {
    "isPublic": true,
    "name": "Jane Doe",
    "imageUri": "https://example.com/images/janedoe.jpg",
    "rewardAmount": 5000,
    "rewardCurrency": "USD",
    "extraDetails": "Last seen wearing a red hiking jacket."
  }
}
```

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Emergency session created.",
  "data": {
    "emergencyTrackingId": "EM-XXXX-YYYY",
    "title": "Missing Person Search - Sector 4",
    "status": "ACTIVE",
    "isPasswordProtected": true,
    "authKey": "4f9d21c...",
    "shareableLink": "http://localhost:5001/emergency/join?trackingId=EM-XXXX-YYYY&authKey=4f9d21c...",
    "sessionToken": "eyJhbG..."
  }
}
```

---

## Update Emergency Details

Updates text details, visibility, address, location, or victim metadata.

- **URL:** `PUT /api/emergency/:emergencyTrackingId`
- **Headers:** `Authorization: Bearer <owner_jwt>`
- **Body:** *(Any combination of the fields used in Create Emergency)*

```json
{
  "title": "Missing Person Search - Sector 4 (Expanded)",
  "victimMetadata": {
    "rewardAmount": 10000
  }
}
```

### Success Response (200 OK)

Returns the fully updated emergency object.

---

## Update Emergency Status

- **URL:** `PATCH /api/emergency/:emergencyTrackingId/status`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Body

```json
{
  "status": "PAUSED"
}
```

> **Allowed values:** `ACTIVE`, `PAUSED`, `RESOLVED`

### Success Response (200 OK)

Returns the updated emergency object.

---

## Invite Users (ACL & Emails)

Restricts the emergency. Automatically emails the magic link and details to the users.

- **URL:** `POST /api/emergency/:emergencyTrackingId/invite`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Body

```json
{
  "userIds": [
    "60d5ec...",
    "60d5ed..."
  ]
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Successfully invited and emailed 2 responders.",
  "data": {
    "invitedCount": 2,
    "updatedAllowedUsers": [
      "60d5ec...",
      "60d5ed..."
    ]
  }
}
```

---

## Delete Emergency

Permanently removes the incident from the database.

- **URL:** `DELETE /api/emergency/:emergencyTrackingId`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Emergency session permanently deleted."
}
```

---

# 2. Public Discovery Routes (NEW)

## Search Public Emergencies

Allows users to find active, public emergencies based on text filters or geospatial radius (e.g., "Find all emergencies within 50km of my location in Delhi"). Secure data (like allowedUsers and authKeys) is omitted. Victim data is hidden if `victimMetadata.isPublic` is false.

- **URL:** `GET /api/emergency/search`
- **Auth:** Public

### Query Parameters (All Optional)

- `lng`: Center longitude.
- `lat`: Center latitude.
- `radius`: Search radius in kilometers (requires `lng` & `lat`).
- `state`, `city`, `country`: Text-based regional filters.
- `startDate`: Find incidents created after this timestamp.
- `limit`: Max results (default 50).

### Example Request

```text
GET /api/emergency/search?lng=77.2090&lat=28.6139&radius=50&state=Delhi
```

### Success Response (200 OK)

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "67011d...",
      "emergencyTrackingId": "EM-XXXX-YYYY",
      "title": "Missing Person Search - Sector 4",
      "description": "Search party coordination for a missing hiker.",
      "status": "ACTIVE",
      "isPasswordProtected": true,
      "location": {
        "type": "Point",
        "coordinates": [77.2090, 28.6139]
      },
      "address": {
        "city": "New Delhi",
        "state": "Delhi",
        "country": "India"
      },
      "victimMetadata": {
        "isPublic": true,
        "name": "Jane Doe",
        "imageUri": "https://example.com/images/janedoe.jpg",
        "rewardAmount": 5000,
        "rewardCurrency": "USD",
        "extraDetails": "Last seen wearing a red hiking jacket."
      },
      "createdAt": "2026-10-06T06:38:03.112Z"
    }
  ]
}
```

---

# 3. Participant (Join) Routes

Participants receive a Session Token upon successful join. This token must be used for WebSocket connections and subsequent GPS/telemetry updates.

## Join via Magic Link (`authKey`)

Bypasses manual password entry.

- **URL:** `POST /api/emergency/join/magic`
- **Headers:** `Authorization: Bearer <user_jwt>` *(Required if incident is ACL-restricted)*

### Body

```json
{
  "emergencyTrackingId": "EM-XXXX-YYYY",
  "authKey": "4f9d21c..."
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Authenticated via link successfully.",
  "data": {
    "emergencyTrackingId": "EM-XXXX-YYYY",
    "title": "Missing Person Search - Sector 4",
    "token": "eyJhbG..."
  }
}
```

---

## Join via Credentials

Manual entry via Tracking ID + Password.

- **URL:** `POST /api/emergency/join/credentials`
- **Headers:** `Authorization: Bearer <user_jwt>` *(Required if incident is ACL-restricted)*

### Body

```json
{
  "emergencyTrackingId": "EM-XXXX-YYYY",
  "password": "securePass123"
}
```

### Success Response (200 OK)

Returns the session token.

---

## Get Public Info

Fetches metadata for UI rendering before a user joins. Victim data is dynamically hidden if marked private.

- **URL:** `GET /api/emergency/:emergencyTrackingId/info`
- **Auth:** Public

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "67011d...",
    "emergencyTrackingId": "EM-XXXX-YYYY",
    "title": "Missing Person Search - Sector 4",
    "description": "Search party coordination...",
    "status": "ACTIVE",
    "isPasswordProtected": true,
    "isPublicVisibility": true,
    "address": {
      "city": "New Delhi"
    },
    "location": {
      "coordinates": [77.2090, 28.6139]
    },
    "createdAt": "2026-10-06T06:38:03.112Z"
  }
}
```

---

# 4. Live Broadcast Routes (WebSockets)

These HTTP routes trigger Socket.io events. Connected UI clients listening to these socket events will instantly receive the payloads.

### Valid Levels

`normal`, `alert`, `event`, `crash`

---

## Send Global Broadcast

Sends a message to EVERY client connected to the WebSocket server, regardless of the room they are in.

- **URL:** `POST /api/emergency/broadcast/global`
- **Headers:** `Authorization: Bearer <admin_jwt>`

### Body

```json
{
  "message": "System-wide maintenance in 5 minutes.",
  "level": "alert"
}
```

---

## Send Room Custom Message

Broadcasts a standard message to all participants currently joined to a specific emergency room.

- **URL:** `POST /api/emergency/:emergencyTrackingId/broadcast/custom`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Body

```json
{
  "message": "Rescue team Alpha has spotted the target.",
  "level": "event"
}
```

---

## Send Room Pinned Message

Sends a high-priority message designed to be "pinned" or "stickied" to the top of the UI for all participants in the emergency room.

- **URL:** `POST /api/emergency/:emergencyTrackingId/broadcast/pin`
- **Headers:** `Authorization: Bearer <owner_jwt>`

### Body

```json
{
  "message": "Rendezvous point changed to Base Camp 2. Proceed immediately."
}
```