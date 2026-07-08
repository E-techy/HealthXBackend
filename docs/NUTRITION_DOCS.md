# 🍏 HealthX Advanced Nutrition & AI Tracking API

This module powers the **HealthX** cinematic nutrition experience.

It handles raw manual inputs, AI-powered computer vision (Gemini two-step architecture), temporal graphing, and bidirectional data synchronization between the Android client and the Node.js backend.

---

## 📑 Table of Contents

- [📁 System Architecture & File Paths](#-system-architecture--file-paths)
- [🗄️ Data Models (Database Schema)](#️-1-data-models-database-schema)
  - [MealEntry Model](#mealentry-model-srcmodelsmealentryjs)
  - [NutritionLog Model](#nutritionlog-model-srcmodelsnutritionlogjs)
- [🚀 API Routes Documentation](#-2-api-routes-documentation)
  - [2.1 Get Today's Dashboard](#21-get-todays-dashboard)
  - [2.2 Add Manual Entry](#22-add-manual-entry)
  - [2.3 Analyze Food Image (AI Vision - PRO ONLY)](#23-analyze-food-image-ai-vision---pro-only)
  - [2.4 Save Analyzed Meal](#24-save-analyzed-meal)
  - [2.5 Get Nutrition Graph Data](#25-get-nutrition-graph-data)
  - [2.6 Sync Data (Bidirectional)](#26-sync-data-bidirectional)

---

# 📁 System Architecture & File Paths

## Models

```
src/models/MealEntry.js
```

Tracks individual food/water intakes with dynamic nutrient maps.

```
src/models/NutritionLog.js
```

Aggregated daily ledger for rapid graph querying.

---

## Controllers

```
src/controllers/nutritionController.js
```

The brain for calculating scores and processing API requests.

---

## Services & Utilities

```
src/services/aiService.js
```

Handles direct communication with the Gemini API (Vision and Text models).

```
src/utils/nutrientMapper.js
```

Normalizes and categorizes raw AI nutrient data into specific database buckets.

---

## Routes

```
src/routes/nutritionRoutes.js
```

Express router configuration featuring Multer for image parsing.

---

# 🗄️ 1. Data Models (Database Schema)

## MealEntry Model (`src/models/MealEntry.js`)

Stores highly detailed, granular data for every consumed item.

Core macros and trace elements are split into specific Map objects to maintain clean, scalable documents.

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| userId | ObjectId | Yes | Reference to UserAuth |
| date | String | Yes | Format: YYYY-MM-DD. Used for fast chronological querying. |
| timestamp | Number | No | Epoch timestamp of consumption. Default: Date.now(). |
| entryType | String | Yes | Enum: MANUAL or AI_SCAN. |
| mealCategory | String | No | Enum: BREAKFAST, LUNCH, DINNER, SNACK, HYDRATION. |
| foodName | String | Yes | e.g., "Apple" or "Grilled Chicken Salad". |
| imageUrl | String | No | Local or cloud URL of the image if scanned via AI. |
| nutrientsMap | Map | No | Bucket for primary macros (calories, protein, carbs, fat, sugar, sodium). |
| otherNutrientsMap | Map | No | Bucket for trace minerals, vitamins, amino acids. |
| foodSourceCategory | String | No | Enum: BRANDED, LOCAL, TREE_BASED, FARM_FRESH, RESTAURANT, UNKNOWN. |
| brandName | String | No | Extracted brand name from packaging. |
| manufactureDate | Date | No | Extracted manufacture date. |
| expiryDate | Date | No | Extracted expiration date. |
| ingredients | Array | No | List of extracted ingredients. |
| dietaryFlags | Booleans | No | Includes isVegetarian, isVegan, isGlutenFree, isOrganic. |
| foodScore | Number | No | AI-generated health score (0-5). |
| aiInsights | String | No | AI personalized dietary insights. |
| portionEaten | Number | No | Amount consumed in grams or ml. Default: 100. |

---

## NutritionLog Model (`src/models/NutritionLog.js`)

Aggregates the total macros and calculates the Daily Health Score.

Optimized for the 7-day Health Score Graph.

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| userId | ObjectId | Yes | Reference to UserAuth |
| date | String | Yes | Format: YYYY-MM-DD (Unique per user per day). |
| totalCalories | Number | No | Sum of calories for the day. Default: 0. |
| totalProtein | Number | No | Sum of protein. Default: 0. |
| totalCarbs | Number | No | Sum of carbs. Default: 0. |
| totalFat | Number | No | Sum of fat. Default: 0. |
| totalWater | Number | No | Sum of water. Default: 0. |
| targetCalories | Number | No | Daily goal. Default: 2400. |
| targetProtein | Number | No | Daily goal. Default: 140. |
| dailyHealthScore | Number | No | Calculated score (0–100). |

---

# 🚀 2. API Routes Documentation

**Base URL**

```
http://your-server-url/api/nutrition
```

### Authentication

All routes require a valid JWT.

```
Authorization: Bearer <token>
```

---

## 2.1 Get Today's Dashboard

Retrieves the high-level daily summary and chronological meal timeline.

### Endpoint

```http
GET /api/nutrition/today
```

### Input

None.

### Success Response (200 OK)

```json
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
      "nutrients": {
        "calories": 450,
        "protein": 35
      },
      "timestamp": 1700000000000
    }
  ]
}
```

---

## 2.2 Add Manual Entry

Allows users to manually enter food macros or hydration.

### Endpoint

```http
POST /api/nutrition/manual
```

### Request Body

```json
{
  "mealCategory": "HYDRATION",
  "foodName": "Water",
  "waterVolume": 1.5
}
```

### Success Response

Returns the saved entry and the dynamically updated `NutritionLog`.

---

## 2.3 Analyze Food Image (AI Vision - PRO ONLY)

Processes an uploaded food image using the Gemini Vision pipeline.

Verifies PRO status or accepts a personal Gemini API key.

### Endpoint

```http
POST /api/nutrition/ai/analyze
```

### Headers

```
Content-Type: multipart/form-data
```

```
x-gemini-api-key: <optional>
```

### Form Data

| Field | Type | Description |
|--------|------|-------------|
| image | File | Captured food or label photo |
| portionSize | Number | Amount in grams or ml (Default: 100) |

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "foodDetected": "Coca-Cola",
    "foodCategory": "BEVERAGE",
    "isLiquid": true,
    "portionAnalyzed": 330,
    "rawNutrientsExtracted": {
      "calories": 138.6,
      "carbs": 34.98,
      "sugar": 34.98,
      "sodium": 13.2
    },
    "scores": {
      "foodQualityScore": 1,
      "eatRecommendationScore": 1
    },
    "aiInsights": "This 330ml portion contains nearly 35g of sugar. Consider a zero-sugar alternative.",
    "imageUrl": "/uploads/nutrition/1700000000000-coke.jpg"
  }
}
```

### Error Response (403 Forbidden)

```json
{
  "success": false,
  "requiresPro": true,
  "message": "Subscribe to HealthX PRO or provide your API key to access AI Food Analysis."
}
```

---

## 2.4 Save Analyzed Meal

Maps the raw nutrient JSON into categorized Mongoose Maps and saves the final MealEntry.

### Endpoint

```http
POST /api/nutrition/ai/save
```

### Request Body

```json
{
  "mealCategory": "LUNCH",
  "foodName": "Hyderabadi Chicken Biryani",
  "imageUrl": "/uploads/nutrition/1700000000000-biryani.jpg",
  "foodQualityScore": 3,
  "aiInsights": "High in protein but very calorie dense. Watch your portion.",
  "portionAnalyzed": 1000,
  "foodSourceCategory": "RESTAURANT",
  "rawNutrients": {
    "calories": 1800,
    "protein": 90,
    "carbs": 120,
    "fat": 65,
    "sodium": 1200,
    "vitaminC": 4
  }
}
```

### Success Response

Returns the mapped `MealEntry` and the updated `NutritionLog`.

---

## 2.5 Get Nutrition Graph Data

Returns historical nutrition records for graph visualization.

### Endpoint

```http
GET /api/nutrition/graph?range=week
```

### Query Parameters

| Parameter | Values |
|-----------|--------|
| range | week, month, year |

### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-07-07",
      "dailyHealthScore": 85,
      "totalCalories": 2200
    },
    {
      "date": "2026-07-08",
      "dailyHealthScore": 91,
      "totalCalories": 2350
    }
  ]
}
```

---

## 2.6 Sync Data (Bidirectional)

Handles the offline-first synchronization process.

Android uploads locally cached entries while offline.

The server validates, categorizes, recalculates historical data, and returns the authoritative daily summary.

### Endpoint

```http
POST /api/nutrition/sync
```

### Request Body

```json
{
  "localEntries": [
    {
      "date": "2026-07-08",
      "entryType": "MANUAL",
      "foodName": "Offline Snack",
      "nutrients": {
        "calories": 200,
        "protein": 5
      }
    }
  ]
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Sync complete.",
  "serverSummary": {
    "totalCalories": 2550,
    "dailyHealthScore": 88
  }
}
```