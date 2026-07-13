# 🩺 HealthX Delegated Access System

**Author:** Ashutosh Kumar Singh

---

# 1. System Overview

This module enables a secure, QR-based delegated access system for HealthX.

Users can generate signed, public hashes containing specific permission scopes (e.g., `["SET_GOALS", "SEE_NUTRITION"]`).

When another user scans this hash, a bidirectional friendship is created, granting granular, easily revocable access to the initiator's health data.

Access control is enforced via a middleware layer that intercepts requests, verifies permissions against a dynamic MongoDB collection, and swaps the request context to reuse existing controllers seamlessly.

---

# 2. MongoDB Schema Design

## ShareableHashes Collection

Stores the generated public links.

Indexed on both **hashId** (for public scanning) and **userId** (for the owner's dashboard).

| Field | Type | Description |
|--------|------|-------------|
| `_id` | ObjectId | MongoDB default ID. |
| `hashId` | String | Unique, secure random string (the public key). |
| `userId` | ObjectId | The creator of the hash. |
| `actions` | Array of Strings | E.g., `["ALL"]` or `["SET_GOALS", "SEE_NUTRITION"]`. |
| `status` | String | `ACTIVE`, `UNACTIVE`, or `DELETED`. |
| `createdAt` | Date | Timestamp of generation. |

---

## Friendships Collection

Handles the bidirectional relationship and granular action toggles.

| Field | Type | Description |
|--------|------|-------------|
| `_id` | ObjectId | MongoDB default ID. |
| `ownerId` | ObjectId | The user granting access (User A). |
| `viewerId` | ObjectId | The user receiving access (User B). |
| `permissions` | Array of Objects | E.g., `[{ action: "SET_GOALS", isActive: true }]`. |
| `createdAt` | Date | Timestamp of connection. |

---

## Blocklist Collection

Checked before any new friendship is created to prevent banned users from regaining access via new hashes.

| Field | Type | Description |
|--------|------|-------------|
| `_id` | ObjectId | MongoDB default ID. |
| `userId` | ObjectId | The user who initiated the block (User A). |
| `blockedUserId` | ObjectId | The user who is blocked (User B). |

---

# 3. API Routing Architecture

## Phase 1: Hash Generation & Management (User A)

### **POST** `/api/access/hash`

**Input**

- JWT Auth Header
- Body:

```json
{
  "actions": ["SET_GOALS"]
}
```

**Logic**

- Generates a secure random `hashId`.
- Saves to `ShareableHashes` with `status: "ACTIVE"`.
- Returns the public link/hash string to encode into the QR.

---

### **GET** `/api/access/hash`

**Logic**

Queries `ShareableHashes` using the logged-in user's ID so they can view all their generated links.

---

### **PATCH** `/api/access/hash/:hashId`

**Logic**

Toggles the status between `ACTIVE` and `UNACTIVE`, or flags it as `DELETED`.

---

## Phase 2: Scanning & Connection (User B)

### **POST** `/api/access/connect/:hashId`

**Input**

- JWT Auth Header (User B identity)

**Logic**

1. Queries `ShareableHashes` by `hashId`.
2. Verifies the status is `ACTIVE`.
3. Checks the `Blocklist` to ensure User A has not blocked User B.
4. Creates a document in `Friendships` where:
   - `ownerId = User A`
   - `viewerId = User B`
   - Populates the `permissions` array based on the hash's actions, setting them all to `isActive: true`.
5. Returns success to User B's Android app so it can update the local UI.

---

## Phase 3: Access Management (User A)

### **PATCH** `/api/friends/:friendId/permissions`

**Logic**

Updates the `isActive` boolean for specific actions within the `Friendships` collection.

---

### **DELETE** `/api/friends/:friendId`

**Logic**

Removes the document entirely from the `Friendships` collection, severing the connection instantly.

---

### **POST** `/api/friends/:friendId/block`

**Logic**

Deletes the friendship document **AND** creates a new record in the `Blocklist` collection.

---

# 4. The Request Interception Middleware (The Core Engine)

To allow User B to see User A's data without rewriting existing controllers, a specific middleware function is applied to the standard health routes.

## Flow

1. User B's app requests:

   ```
   GET /api/health/nutrition?targetUserId=<User A's ID>&action=SEE_NUTRITION
   ```

2. The middleware extracts User B's ID from the JWT.

3. The middleware queries `Friendships` where:

   - `ownerId = User A`
   - `viewerId = User B`

4. It checks the `permissions` array to ensure `SEE_NUTRITION` (or `ALL`) exists and `isActive` is `true`.

5. **The Swap:** If authorized, the middleware overrides the request object:

   ```javascript
   req.user.id = targetUserId;
   ```

6. The request is passed to the next controller using:

   ```javascript
   next();
   ```

7. The original controller fetches and returns User A's data exactly as it normally would.

---