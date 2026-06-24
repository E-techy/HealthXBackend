# HealthX Backend: Reminders & Voice API Documentation

---

# 1. Global Requirements

### Base URL

```text
http://<YOUR_LOCAL_IP>:5001/api
```

### Authentication

All routes below require **JWT authorization**.

### Headers

```http
Authorization: Bearer <YOUR_JWT_TOKEN>
Content-Type: application/json
```

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

---

### MEDICATION

```text
medicineName
genericName
medicineForm
mealTiming
dosageAmount
dosageUnit
specificInstructions
sideEffectsToWatch
contraindications
prescriptionId
prescribingDoctorName
associatedMedicineIds
pharmacyDetails
prescriptionDocument
```

### SUPPLEMENT

```text
supplementName
brandName
medicineForm
purpose
dosageAmount
dosageUnit
isWithFood
cycleDurationDays
breakDurationDays
```

### REFILL

```text
medicineName
rxNumber
totalPillsInBottle
currentPillCount
warningThreshold
dailyConsumptionRate
pharmacyDetails
autoReorderWebUrl
lastRefillDate
```

### CONSULTATION

```text
doctorName
specialty
doctorRegistrationId
isTelehealth
meetingWebUrl
meetingPassword
facilityDetails
symptomsToDiscuss
questionsForDoctor
attachedDocuments
```

### CHECKUP

```text
checkupPackageName
facilityDetails
fastingRequiredHours
preCheckupInstructions
checkupReports
```

### LAB_TEST

```text
testName
isHomeCollection
homeCollectionAddress
phlebotomistName
facilityDetails
preparationNotes
expectedReportDate
labReportDocuments
```

### THERAPY

```text
therapistName
sessionType
isTelehealth
meetingWebUrl
facilityDetails
preSessionHomeworkNotes
postSessionActionItems
moodBeforeSession
moodAfterSession
```

### VACCINATION

```text
vaccineName
targetDisease
manufacturerName
batchNumber
doseNumber
totalDosesRequired
nextDoseExpectedDate
administeredByDoctorName
facilityDetails
vaccinationCertificate
```

### HYDRATION

```text
targetVolumeMl
currentVolumeMl
containerSizeMl
beverageType
isAutoLogOnAcknowledge
```

### NUTRITION

```text
mealType
targetCalories
targetProteinGrams
targetCarbsGrams
targetFatsGrams
dietaryRestriction
promptFoodLog
```

### SLEEP

```text
windDownTimeStart
targetWakeTime
targetSleepDurationMinutes
ambientAudioUrl
promptDreamLogOnWake
promptSleepQualityLog
```

### FITNESS

```text
workoutType
targetDurationMinutes
intensityLevel
location
targetCaloriesBurn
referenceVideoUrl
attachedRoutineDocument
```

### MINDFULNESS

```text
practiceType
targetDurationMinutes
guidedAudioUrl
promptPrePracticeMood
promptPostPracticeMood
```

### HABIT

```text
habitName
currentStreakDays
longestStreakDays
cueContext
rewardContext
accountabilityPartnerEmail
```

### VITALS

```text
vitalType
measurementUnit
requiresEquipment
preparationInstructions
targetNormalRangeMin
targetNormalRangeMax
promptLogToDatabase
```

### SYMPTOM

```text
targetSymptom
severityScaleRequired
promptTriggerLog
promptReliefActionLog
associatedRemedies
```

### CYCLE

```text
phasePrompt
expectedPeriodStartDate
isFertilityWindowWarning
promptFlowLog
promptMoodLog
promptPhysicalSymptomLog
```

### MATERNITY

```text
currentTrimester
pregnancyWeek
taskType
babyDevelopmentNotes
promptContractionTimer
doctorOrMidwifeDetails
```

### ELDER_CARE

```text
elderName
careTaskType
caregiverInstructions
emergencyContactPhone
promptMoodAndComfortLog
attachedCarePlanDocument
```

### RECOVERY

```text
conditionOrSurgeryName
daysPostOp
taskType
movementRestrictions
promptPainLevelLog
promptWoundPhotoUpload
treatingPhysicianDetails
```

### CUSTOM

```text
customIconHexColor
customIconName
actionWebUrl
customTags
attachedDocuments
```

---

# 3. Endpoints

---

## A. Offline Auto-Sync (Primary Data Engine)

Syncs local changes up to the server, and pulls down any server changes made since the last sync.

### URL

```text
/reminders/sync
```

### Method

```http
POST
```

### Request Body

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

### Success Response (200 OK)

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

## B. Create Reminders (Batch)

### URL

```text
/reminders
```

### Method

```http
POST
```

### Request Body

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

### Success Response (201 Created)

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

## C. Update Single Reminder

### URL

```text
/reminders/:id
```

### Method

```http
PUT
```

### Request Body

```json
{
  "isActive": false,
  "currentVolumeMl": 250
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Reminder updated successfully.",
  "data": {}
}
```

---

## D. Get All Reminders

### URL

```text
/reminders
```

### Method

```http
GET
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": []
}
```

---

## E. Generate AI Voice (Pro Feature)

Generates an MP3 for custom reminder alarms.

Fails with `403` if user lacks a **PRO subscription**.

### URL

```text
/voice/generate
```

### Method

```http
POST
```

### Request Body

```json
{
  "reminderText": "Time to drink water, Ashutosh!",
  "reminderTime": 1719340000000,
  "tone": "motivational",
  "prompt": "Speak in a calm, encouraging cinematic AI assistant voice."
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Voice generated successfully.",
  "audioUrl": "http://<YOUR_LOCAL_IP>:5001/public/audio/voice_16234.mp3",
  "durationSeconds": 4.5
}
```
