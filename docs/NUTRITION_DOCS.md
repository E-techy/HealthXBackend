# 🍏 HealthX Advanced Nutrition & AI Tracking API

This module powers the HealthX cinematic nutrition experience.

It handles raw manual inputs, AI-powered food image analysis (computer vision), temporal graphing, and bidirectional data synchronization between the Android client and the Node.js backend.

---

# 📚 Table of Contents

* [System Architecture & File Paths](#-system-architecture--file-paths)
* [Data Models (Database Schema)](#️-1-data-models-database-schema)

  * [MealEntry Model](#mealentry-model-srcmodelsmealentryjs)
  * [NutritionLog Model](#nutritionlog-model-srcmodelsnutritionlogjs)
* [API Routes Documentation](#-2-api-routes-documentation)

  * [2.1 Get Today's Dashboard](#21-get-todays-dashboard)
  * [2.2 Add Manual Entry](#22-add-manual-entry)
  * [2.3 Analyze Food Image (AI Vision - PRO ONLY)](#23-analyze-food-image-ai-vision---pro-only)
  * [2.4 Save Analyzed Meal](#24-save-analyzed-meal)
  * [2.5 Get Nutrition Graph Data](#25-get-nutrition-graph-data)
  * [2.6 Sync Data (Bidirectional)](#26-sync-data-bidirectional)

---

# 📁 System Architecture & File Paths

## Models

* `src/models/MealEntry.js` - Tracks individual food/water intakes.
* `src/models/NutritionLog.js` - Aggregated daily ledger for rapid graph querying.

---

## Controllers

* `src/controllers/nutritionController.js` - The brain for calculating scores and processing AI logic.

---

## Routes

* `src/routes/nutritionRoutes.js` - Express router configuration.

---

# 🗄️ 1. Data Models (Database Schema)

## MealEntry Model (`src/models/MealEntry.js`)

Stores granular data for every item consumed.

Contains contextual data for AI scans.

| Field        | Type     | Required | Description                                                        |
| ------------ | -------- | -------- | ------------------------------------------------------------------ |
| userId       | ObjectId | Yes      | Reference to UserAuth.                                             |
| date         | String   | Yes      | Format: `YYYY-MM-DD`. Used for fast chronological querying.        |
| timestamp    | Number   | No       | Epoch timestamp of consumption. Default: `Date.now()`.             |
| entryType    | String   | Yes      | Enum: `MANUAL` or `AI_SCAN`.                                       |
| mealCategory | String   | No       | Enum: `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK`, `HYDRATION`.        |
| foodName     | String   | Yes      | E.g., `"Apple"` or `"Grilled Chicken Salad"`.                      |
| imageUrl     | String   | No       | URL of the image if scanned via AI.                                |
| calories     | Number   | No       | Total calories for this specific entry. Default: `0`.              |
| protein      | Number   | No       | Protein in grams. Default: `0`.                                    |
| carbs        | Number   | No       | Carbs in grams. Default: `0`.                                      |
| fat          | Number   | No       | Fat in grams. Default: `0`.                                        |
| waterVolume  | Number   | No       | Hydration in Liters or ML. Default: `0`.                           |
| foodScore    | Number   | No       | AI-generated health score (`1-100`) for this food.                 |
| aiInsights   | String   | No       | AI dietary insights string.                                        |
| portionEaten | Number   | No       | Percentage of the scanned food consumed (`0-100`). Default: `100`. |

---

## NutritionLog Model (`src/models/NutritionLog.js`)

Aggregates the total macros and calculates the Daily Health Score.

Optimized for the 7-day Health Score Graph.

| Field            | Type     | Required | Description                                          |
| ---------------- | -------- | -------- | ---------------------------------------------------- |
| userId           | ObjectId | Yes      | Reference to UserAuth.                               |
| date             | String   | Yes      | Format: `YYYY-MM-DD`. (Unique per user).             |
| totalCalories    | Number   | No       | Sum of all meals for the day. Default: `0`.          |
| totalProtein     | Number   | No       | Sum of protein. Default: `0`.                        |
| totalCarbs       | Number   | No       | Sum of carbs. Default: `0`.                          |
| totalFat         | Number   | No       | Sum of fat. Default: `0`.                            |
| totalWater       | Number   | No       | Sum of water. Default: `0`.                          |
| targetCalories   | Number   | No       | Daily goal. Default: `2400`.                         |
| targetProtein    | Number   | No       | Daily goal. Default: `140`.                          |
| dailyHealthScore | Number   | No       | Calculated score (`0-100`) based on macro adherence. |

---

# 🚀 2. API Routes Documentation

**Base URL**

```text id="4a9mk1"
http://your-server-url/api/nutrition
```

**Authentication**

All routes require a valid JWT passed in the Header.

```text id="wbf5yo"
Authorization: Bearer <token>
```

---

## 2.1 Get Today's Dashboard

Retrieves the high-level daily summary and the chronological timeline of meals for the Detailed Nutrition UI.

**Endpoint**

```http id="1sn31w"
GET /api/nutrition/today
```

**Input**

None.

### Success Response (200 OK)

```json id="yz6m6l"
{
  "success": true,
  "summary": {
    "totalCalories": 1560,
    "totalProtein": 112,
    "dailyHealthScore": 91
  },
  "meals": [
    {
      "foodName": "Grilled Chicken Salad",
      "calories": 450,
      "timestamp": 1700000000000
    }
  ]
}
```

---

## 2.2 Add Manual Entry

Allows the user to manually input food macros or water volume without AI assistance.

**Endpoint**

```http id="n4cbib"
POST /api/nutrition/manual
```

**Input Body**

```json id="1bh88w"
{
  "mealCategory": "HYDRATION",
  "foodName": "Water",
  "waterVolume": 1.5
}
```

### Success Response (201 Created)

Returns the saved entry and the updated `dailyLog`.

---

## 2.3 Analyze Food Image (AI Vision - PRO ONLY)

Takes an uploaded image URL, verifies the user is a PRO subscriber, and uses AI to estimate macros and food quality.

Does not save to DB yet.

**Endpoint**

```http id="snzn17"
POST /api/nutrition/ai/analyze
```

**Input Body**

```json id="1cv8zv"
{
  "imageUrl": "https://bucket-url.com/uploads/user-salad.jpg"
}
```

### Success Response (200 OK)

```json id="vh83cn"
{
  "success": true,
  "data": {
    "foodDetected": "Grilled Chicken Salad with Avocado",
    "foodScore": 92,
    "aiInsights": "Excellent source of lean protein and healthy fats.",
    "estimatedMacrosPer100g": {
      "calories": 120,
      "protein": 15,
      "carbs": 4,
      "fat": 6
    }
  }
}
```

### Error Response (403 Forbidden)

```json id="zc1plr"
{
  "success": false,
  "requiresPro": true,
  "message": "Subscribe to HealthX PRO to access AI Food Analysis."
}
```

---

## 2.4 Save Analyzed Meal

Called after the user confirms the AI analysis and inputs how much of the food they actually ate (`portionPercentage`).

Calculates final macros and updates the daily score.

**Endpoint**

```http id="2vdgri"
POST /api/nutrition/ai/save
```

**Input Body**

```json id="jlwm3t"
{
  "mealCategory": "LUNCH",
  "foodName": "Grilled Chicken Salad",
  "imageUrl": "https://bucket-url.com/uploads/user-salad.jpg",
  "foodScore": 92,
  "aiInsights": "Excellent source of lean protein...",
  "portionPercentage": 100,
  "baseMacros": {
    "calories": 400,
    "protein": 45,
    "carbs": 12,
    "fat": 15
  }
}
```

### Success Response (201 Created)

Returns the final calculated `MealEntry` and the updated `NutritionLog`.

---

## 2.5 Get Nutrition Graph Data

Fetches the historical `NutritionLog` records to populate the cinematic bezier curve graph on Android.

**Endpoint**

```http id="0qf0ho"
GET /api/nutrition/graph?range=week
```

**Query Params**

* `range` (Options: `week`, `month`, `year`)

### Success Response (200 OK)

```json id="08afqj"
{
  "success": true,
  "data": [
    {
      "date": "2026-07-01",
      "dailyHealthScore": 85,
      "totalCalories": 2200
    },
    {
      "date": "2026-07-02",
      "dailyHealthScore": 91,
      "totalCalories": 2350
    }
  ]
}
```

---

## 2.6 Sync Data (Bidirectional)

Handles offline-first architecture.

Android sends any cached meals logged while offline, the server saves them, recalculates the historical days, and returns the absolute truth for today.

**Endpoint**

```http id="l3v7cl"
POST /api/nutrition/sync
```

**Input Body**

```json id="jbrij5"
{
  "localEntries": [
    {
      "date": "2026-07-05",
      "entryType": "MANUAL",
      "foodName": "Offline Snack",
      "calories": 200
    }
  ]
}
```

### Success Response (200 OK)

```json id="f4zyj9"
{
  "success": true,
  "message": "Sync complete.",
  "serverSummary": {
    "totalCalories": 2550,
    "dailyHealthScore": 88
  }
}
```
