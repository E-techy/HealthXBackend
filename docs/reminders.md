# HealthX Backend: Reminders, Notifications & Voice API Documentation

---

# 1. Global Requirements

## Base URL

```text
http://<YOUR_LOCAL_IP>:5001/api
```

---

## Authentication

All routes below require JWT authorization.

### Headers

```http
Authorization: Bearer <YOUR_JWT_TOKEN>
Content-Type: application/json
```

---

## Notification System Architecture

The backend automatically handles push notifications.

### Device Registration

Android apps must register their FCM tokens via the `/devices/register` endpoint upon login or token refresh.

### Scheduling

Creating or updating a Reminder automatically creates a ScheduledNotification in the database.

### Delivery

A background worker polls the database every minute and sends data-only FCM messages to all active devices associated with the user when the `triggerDateTime` is reached.

---

# 2. Polymorphic Data Dictionary

The Android Reminder entity must be polymorphic.

The `category` string is the **Discriminator Key** that dictates which fields are required.

All timestamps must be sent as **Epoch Numbers**.

---

## Reusable Sub-Schemas

### DocumentAttachment

```json
{
  "id": "String",
  "documentType": "String",
  "fileName": "String",
  "remoteCloudUrl": "String",
  "localDeviceUri": "String",
  "fileSizeKb": "Number",
  "downloadedAt": "Number"
}
```

---

### FacilityDetails

```json
{
  "facilityId": "String",
  "facilityName": "String",
  "websiteUrl": "String",
  "primaryPhone": "String",
  "emergencyPhone": "String",
  "physicalAddress": "String",
  "googleMapsUrl": "String"
}
```

---

### PharmacyDetails

```json
{
  "pharmacyId": "String",
  "storeName": "String",
  "websiteUrl": "String",
  "contactPhone": "String",
  "physicalAddress": "String",
  "is24Hours": "Boolean"
}
```

---

## Base Reminder Fields (Required for ALL Reminders)

```json
{
  "userId": "String (Injected by Server)",
  "category": "String (e.g., 'MEDICATION', 'HYDRATION') - REQUIRED",
  "title": "String",
  "description": "String (Optional)",
  "triggerDateTime": "Number (Epoch timestamp)",
  "isActive": "Boolean",
  "alarmConfig": {
    "audioType": "String",
    "localAudioUri": "String",
    "cloudAudioUrl": "String",
    "isVibrationEnabled": "Boolean",
    "volumeLevel": "Number"
  },
  "repeatRule": {
    "repeatType": "String",
    "specificDays": ["Number"],
    "rangeStartDay": "Number",
    "rangeEndDay": "Number",
    "intervalStep": "Number"
  },
  "createdAt": "Number (Epoch)",
  "updatedAt": "Number (Epoch)"
}
```

---

## Supported Categories (Discriminators)

The server strictly validates payloads against these **21 categories**.

Android must map its data classes to these specific fields.

(See previous documentation for specific discriminator fields:
MEDICATION, SUPPLEMENT, REFILL, CONSULTATION, CHECKUP, LAB_TEST, THERAPY, VACCINATION, HYDRATION, NUTRITION, SLEEP, FITNESS, MINDFULNESS, HABIT, VITALS, SYMPTOM, CYCLE, MATERNITY, ELDER_CARE, RECOVERY, CUSTOM).

---

# 3. Endpoints

---

# A. Register Device for Push Notifications (NEW)

Registers or updates the FCM token for the user's current device.

Call this on app launch, login, or when Firebase issues a new token.

## URL

```text
/devices/register
```

## Method

```http
POST
```

## Request Body

```json
{
  "deviceId": "android_9774d56d682e549c",
  "deviceName": "Google Pixel 7 Pro",
  "fcmToken": "f4Y8....ABCD_YOUR_REAL_FCM_TOKEN"
}
```

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Device FCM token registered successfully.",
  "data": {
    "deviceId": "android_9774d56d682e549c",
    "isActive": true
  }
}
```

---

# B. Offline Auto-Sync (Primary Data Engine)

Syncs local changes up to the server, and pulls down any server changes made since the last sync.

## URL

```text
/reminders/sync
```

## Method

```http
POST
```

## Request Body

```json
{
  "lastClientSyncTime": 1719244800000,
  "clientPendingUploads": [
    {
      "_id": "60d5ec...",
      "category": "HYDRATION",
      "title": "Morning Water",
      "triggerDateTime": 1719300000000,
      "targetVolumeMl": 500,
      "currentVolumeMl": 0
    }
  ]
}
```

## Success Response (200 OK)

```json
{
  "success": true,
  "serverCurrentTime": 1719250000000,
  "updatedReminders": [
    {
      "_id": "60d5ec...",
      "category": "MEDICATION",
      "title": "Vitamin D",
      "triggerDateTime": 1719310000000,
      "dosageAmount": 1,
      "dosageUnit": "tablet",
      "updatedAt": 1719245000000
    }
  ]
}
```

---

# C. Create Reminders (Batch)

> Note: Creating a reminder automatically schedules a push notification to be sent to all active devices for this user.

## URL

```text
/reminders
```

## Method

```http
POST
```

## Request Body

```json
{
  "reminders": [
    {
      "category": "MEDICATION",
      "title": "Evening Meds",
      "triggerDateTime": 1719340000000,
      "medicineName": "Amoxicillin"
    }
  ]
}
```

## Success Response (201 Created)

```json
{
  "success": true,
  "message": "1 reminders created successfully.",
  "insertedIds": [
    "64e7c3a..."
  ]
}
```

---

# D. Update Single Reminder

## URL

```text
/reminders/:id
```

## Method

```http
PUT
```

## Request Body

```json
{
  "isActive": false,
  "currentVolumeMl": 250
}
```

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Reminder updated successfully.",
  "data": {}
}
```

---

# E. Get All Reminders

## URL

```text
/reminders
```

## Method

```http
GET
```

## Success Response (200 OK)

```json
{
  "success": true,
  "data": []
}
```

---

# F. Generate AI Voice (Pro Feature)

Generates an MP3 for custom reminder alarms.

Fails with `403` if user lacks a PRO subscription.

## URL

```text
/voice/generate
```

## Method

```http
POST
```

## Request Body

```json
{
  "reminderText": "Time to drink water, Ashutosh!",
  "reminderTime": 1719340000000,
  "tone": "motivational",
  "prompt": "Speak in a calm, encouraging cinematic AI assistant voice."
}
```

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Voice generated successfully.",
  "audioUrl": "http://<YOUR_LOCAL_IP>:5001/public/audio/voice_16234.mp3",
  "durationSeconds": 4.5
}
```
