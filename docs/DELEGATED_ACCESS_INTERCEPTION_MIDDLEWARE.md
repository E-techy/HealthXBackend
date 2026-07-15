# 🩺 HealthX Backend: Delegated Access Interception Middleware

## Overview

The `requireDelegatedAccess` middleware is the central security and access-routing engine for the HealthX shared data ecosystem.

It allows a user (**User B / The Viewer**) to safely request and interact with another user's data (**User A / The Owner**) via standard, pre-existing API endpoints without altering underlying controller business logic.

By intercepting incoming requests directly after JWT validation, the middleware dynamically checks access privileges against MongoDB, validates specific permission scopes, and shifts the query execution context on the fly.

---

# Under the Hood Architecture

When a request reaches an endpoint protected by `requireDelegatedAccess(requiredAction)`, the system executes a multi-step verification and context-swapping process.

```text
                 [ Incoming Request ]
                          │
                ( requireJWT Pass-through )
                          │
                          ▼
            Is 'X-Target-User-Id' present?
             ├── NO ──> [ Execute Normal Flow (Own Data) ]
             └── YES ─> [ Initiate Delegated Flow ]
                          │
                          ▼
            Check Blocklist & Friendship DB
             ├── Blocked / No Record ──> [ Return 403 Forbidden ]
             └── Active Record Found ────> Continue
                          │
                          ▼
         Verify Route Action (e.g., 'SEE_NUTRITION')
             ├── Action Missing/Disabled ──> [ Return 403 Forbidden ]
             └── Action Allowed / 'ALL' ───> Continue
                                                │
                                                ▼
                                       [ The Context Swap ]
                                   req.viewerId = req.user.id
                                   req.user.id  = X-Target-User-Id
                                                │
                                                ▼
                                    [ Pass to Controller ]
```

---

# 1. Intent Detection

The middleware reads the custom HTTP header tracking array.

If the `X-Target-User-Id` header is omitted, or if it matches the ID present inside the validated JWT token (`req.user.id`), the middleware concludes that the user is making a standard request for their own account data.

It calls `next()` immediately, adding zero overhead to baseline operations.

---

# 2. Guardrail Validation

If `X-Target-User-Id` specifies a different account, the delegation loop is triggered.

The middleware looks up the active relationship state inside the **Friendships** collection using the composite index:

```text
{ ownerId: 1, viewerId: 1 }
```

---

# 3. Cryptographic Scope Enforcement

Instead of trusting client-side authorization parameters, the required action string is explicitly bound at the router declaration level on the backend.

The middleware evaluates the user's permissions array.

It performs the following checks:

- Looks for an entry exactly matching the `requiredAction` string where `isActive === true`.
- Alternatively checks whether the wildcard `"ALL"` permission exists and is enabled.

---

# 4. Downstream Context Swapping

If authorization checks pass, the middleware executes a shallow mutation on the `req` lifecycle object.

The original viewer's authenticated ID is preserved in a backup variable:

```javascript
req.viewerId = req.user.id;
```

The authenticated request context is then rewritten:

```javascript
req.user.id = targetUserId;
```

When execution reaches the final controller, every database query using `req.user.id` automatically operates against the target owner's records without requiring any controller modifications.

---

# Input Specification

To activate delegated access, client applications must include specific HTTP headers.

## HTTP Headers

| Header | Expected Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <token>` | ✅ Yes | JWT identifying the authenticated physical device owner (User B). |
| `X-Target-User-Id` | MongoDB ObjectId | Optional | The owner (User A) whose data is requested. Omit this header to access the authenticated user's own data. |

---

# Output & Matrix Responses

## 1. Verification Success Matrix

When authorization succeeds, the middleware rewrites the request context and forwards execution to the requested controller.

The response payload depends on the controller but always follows the standardized HealthX response model.

### Example Response

```json
{
  "success": true,
  "data": {
    "_id": "64b1c2d3e4f5a6b7c8d9e0f2",
    "userId": "TARGET_USER_A_ID_HERE",
    "waterIntakeMl": 2500,
    "caloriesConsumed": 1850,
    "meals": [
      {
        "name": "Breakfast Smoothie",
        "calories": 450
      }
    ],
    "updatedAt": "2026-07-16T00:15:30.000Z"
  }
}
```

---

# 2. Error Matrix (Middleware-Level Rejections)

If any verification step fails, execution immediately stops before reaching the controller or database operations.

---

## A. Missing Active Connection

**HTTP Status:** `403 Forbidden`

Returned when no active Friendship exists between the viewer and the requested user.

```json
{
  "success": false,
  "message": "Access denied. No active connection found with this user."
}
```

---

## B. Permission Disabled or Out of Scope

**HTTP Status:** `403 Forbidden`

Returned when a Friendship exists but the required permission has been disabled by User A.

```json
{
  "success": false,
  "message": "Access denied. You do not have permission to view or manage SEE_NUTRITION for this user."
}
```

---

## C. Internal Server Error

**HTTP Status:** `500 Internal Server Error`

Returned when database synchronization fails or unexpected server exceptions occur.

```json
{
  "success": false,
  "message": "Server error verifying access."
}
```

---

# Router Implementation Reference

```javascript
const express = require('express');
const router = express.Router();

const nutritionController = require('../controllers/nutritionController');

const { requireJWT } = require('../middlewares/authMiddleware');
const { requireDelegatedAccess } = require('../middlewares/delegatedAccessMiddleware');

// Step 1: Force standard token authentication across the entity domain
router.use(requireJWT);

// Step 2: Bind precise access scopes right at the route boundaries
router.get(
    '/',
    requireDelegatedAccess('SEE_NUTRITION'),
    nutritionController.getNutrition
);

router.post(
    '/log',
    requireDelegatedAccess('EDIT_NUTRITION'),
    nutritionController.logNutrition
);

module.exports = router;
```