# User Settings API Documentation

## Overview

The **Settings API** allows authenticated users to retrieve and update their personal configuration, physical metrics, UI preferences, and external API integrations.

**Base URL:** `/api/settings`

**Authentication:**
All routes are protected and require a valid JWT token in the request headers.

---

# Endpoints

## 1. Get User Settings

Retrieves the settings profile for the authenticated user.

If a profile does not exist yet, the server will automatically generate and return a default profile.

### Request

**Method:** `GET`
**URL:** `/api/settings`

### Headers

```http
Authorization: Bearer <your_jwt_token>
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "64a7c9f8e4b0d1a2c3f4e5d6",
    "userId": "64a7c9f8e4b0d1a2c3f4e123",
    "name": "Alex",
    "weight": "70kg",
    "height": "175cm",
    "allergies": ["Peanuts", "Dust"],
    "apiKeys": [],
    "theme": "dark",
    "notificationToneUrl": null,
    "profileIcon": null,
    "ethnicity": null,
    "country": "US",
    "state": "CA",
    "preferredLanguage": "en",
    "createdAt": "2023-10-25T10:00:00.000Z",
    "updatedAt": "2023-10-25T10:05:00.000Z"
  }
}
```

---

## 2. Update User Settings

Updates specific fields in the user's settings profile.

Only include the fields you want to modify. Any omitted fields will remain unchanged.

### Request

**Method:** `PUT`
**URL:** `/api/settings`

### Headers

```http
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### Request Body Example

```json
{
  "theme": "dark",
  "allergies": ["Pollen"],
  "apiKeys": [
    {
      "companyName": "OpenAI",
      "modelName": "GPT-4",
      "apiKeyValue": "sk-1234567890abcdef"
    }
  ]
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Settings updated successfully.",
  "data": {
    // Updated settings object
  }
}
```

### Security Note

The backend controller automatically removes the following fields from incoming requests:

* `userId`
* `_id`

This prevents users from reassigning or modifying another user's settings document.

---

# Data Model (UserSettings.js)

This API uses the **Mongoose UserSettings model** to store and manage user preferences and profile-related configuration.

---

## Schema Definition

### API Key Subdocument Schema

```javascript
const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema(
{
    companyName: {
        type: String,
        required: true
    },
    modelName: {
        type: String,
        required: true
    },
    apiKeyValue: {
        type: String,
        required: true
    }
},
{
    _id: false
});
```

### User Settings Schema

```javascript
const userSettingsSchema = new mongoose.Schema(
{
    // Fields described below
},
{
    timestamps: true
});
```

---

# Field Reference

| Field Name            | Data Type | Default Value | Description                                                                                                     |
| --------------------- | --------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `userId`              | ObjectId  | Required      | Unique reference to the UserAuth collection. Used internally to associate settings with the authenticated user. |
| `name`                | String    | `null`        | User's preferred display name.                                                                                  |
| `weight`              | String    | `null`        | Physical weight including units (e.g., `"75 kg"`, `"165 lbs"`).                                                 |
| `height`              | String    | `null`        | Physical height including units (e.g., `"180 cm"`, `"5'11"`).                                                   |
| `allergies`           | String[]  | `[]`          | List of user allergies used for health and nutrition recommendations.                                           |
| `apiKeys`             | Object[]  | `[]`          | Collection of external service API keys following the `apiKeySchema`.                                           |
| `theme`               | String    | `"system"`    | User interface theme preference. Allowed values: `"light"`, `"dark"`, `"system"`.                               |
| `notificationToneUrl` | String    | `null`        | URL or file path for a custom notification sound.                                                               |
| `profileIcon`         | String    | `null`        | URL or file path for a custom avatar or profile icon.                                                           |
| `ethnicity`           | String    | `null`        | Demographic information used for personalized health baselines.                                                 |
| `country`             | String    | `null`        | User's country of residence.                                                                                    |
| `state`               | String    | `null`        | User's state, province, or region.                                                                              |
| `preferredLanguage`   | String    | `null`        | Preferred locale identifier (e.g., `"en-US"`, `"hi-IN"`). Used for localization and AI responses.               |

---

# Automatic Timestamps

The schema uses Mongoose's built-in timestamp support:

| Field       | Description                                                          |
| ----------- | -------------------------------------------------------------------- |
| `createdAt` | Automatically generated when the settings document is first created. |
| `updatedAt` | Automatically updated whenever the document is modified.             |

---

# Theme Values

The `theme` field accepts only the following values:

| Value    | Description                                  |
| -------- | -------------------------------------------- |
| `light`  | Always use light mode.                       |
| `dark`   | Always use dark mode.                        |
| `system` | Follow the device or operating system theme. |

---

# API Key Structure

Each entry inside the `apiKeys` array must follow the structure below:

```json
{
  "companyName": "OpenAI",
  "modelName": "GPT-4",
  "apiKeyValue": "sk-xxxxxxxxxxxxxxxx"
}
```

### Field Definitions

| Field         | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `companyName` | String | Yes      | Service provider name.                      |
| `modelName`   | String | Yes      | AI model or service name.                   |
| `apiKeyValue` | String | Yes      | Secret API key associated with the service. |

---

# Summary

The User Settings API provides a centralized location for managing:

* User profile information
* Physical metrics
* Health-related preferences
* Allergies and dietary considerations
* UI customization options
* Localization settings
* Third-party AI/service integrations

All endpoints are authenticated and scoped to the currently logged-in user, ensuring data isolation and security.
