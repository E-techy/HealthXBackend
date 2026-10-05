# Emergency Session Management API

This module manages real-time emergency tracking sessions, enforcing **Role-Based Access Control (RBAC)** and **Access Control Lists (ACL)**. Only the Owner (Creator) can modify the incident, and they can optionally restrict access to specific `userId`s via email invites.

---

## Authentication Note

- **Owner/Admin Routes:** Require a standard user JWT (`Authorization: Bearer <token>`).
- **Participant/Join Routes:** Require a standard user JWT **only if** the emergency has invited users (ACL enabled). If the ACL is empty, the link/password is public to anyone.

---

# 1. Owner / Admin Routes

## Create Emergency

Creates a session. The user making the request becomes the Owner.

- **URL:** `POST /api/emergency/create`
- **Headers:** `Authorization: Bearer <user_jwt>`
- **Body:**

```json
{
  "title": "Highway Collision",
  "description": "Multi-vehicle pileup on I-95",
  "password": "securePass123"
}
```

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Emergency session created.",
  "data": {
    "emergencyTrackingId": "EM-XXXX-YYYY",
    "title": "Highway Collision",
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

- **URL:** `PUT /api/emergency/:emergencyTrackingId`
- **Headers:** `Authorization: Bearer <owner_jwt>`
- **Body:**

```json
{
  "title": "Highway Collision - Sector 4",
  "description": "Updated situation report."
}
```

### Success Response (200 OK)

Returns the updated emergency object.

---

## Update Emergency Status

- **URL:** `PATCH /api/emergency/:emergencyTrackingId/status`
- **Headers:** `Authorization: Bearer <owner_jwt>`
- **Body:**

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
- **Body:**

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

# 2. Participant (Join) Routes

Participants receive a **Session Token** upon successful join. This token must be used for WebSocket connections and subsequent GPS/telemetry updates.

---

## Join via Magic Link (`authKey`)

Bypasses manual password entry.

- **URL:** `POST /api/emergency/join/magic`
- **Headers:** `Authorization: Bearer <user_jwt>` *(Required if incident is ACL-restricted)*
- **Body:**

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
    "title": "Highway Collision",
    "token": "eyJhbG..."
  }
}
```

### Error Response (401 Unauthorized)

```text
Access denied. You are not on the permitted responder list.
```

> This response occurs if the user is blocked by the ACL.

---

## Join via Credentials

Manual entry via Tracking ID + Password.

- **URL:** `POST /api/emergency/join/credentials`
- **Headers:** `Authorization: Bearer <user_jwt>` *(Required if incident is ACL-restricted)*
- **Body:**

```json
{
  "emergencyTrackingId": "EM-XXXX-YYYY",
  "password": "securePass123"
}
```

### Success Response (200 OK)

Returns the session token.

### Error Response (401 Unauthorized)

```text
Invalid passcode.
```

---

## Get Public Info

Fetches metadata for UI rendering (e.g., to check if a password field should be shown).

- **URL:** `GET /api/emergency/:emergencyTrackingId/info`
- **Auth:** Public

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "67011d...",
    "emergencyTrackingId": "EM-XXXX-YYYY",
    "title": "Highway Collision",
    "status": "ACTIVE",
    "isPasswordProtected": true,
    "createdBy": "60d5eb...",
    "allowedUsers": [
      "60d5ec..."
    ],
    "createdAt": "2026-10-05T06:38:03.112Z"
  }
}
```