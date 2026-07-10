# 🍏 HealthX Advanced Nutrition & AI Tracking API

This module powers the HealthX cinematic nutrition experience.

It handles AI-powered computer vision (Gemini 2.5 architecture) and data processing. The API has been streamlined to process image analysis, contextualize it with the user's profile and daily goals, and automatically save the resulting Meal record in a single, atomic transaction.

---

# 📑 Table of Contents

- [📁 System Architecture & File Paths](#-system-architecture--file-paths)
- [🗄️ Data Models (Database Schema)](#️-1-data-models-database-schema)
  - [Meal & Food Items Model](#meal--food-items-model-srcmodelsmealjs)
  - [Daily Nutrition Log Model](#daily-nutrition-log-model-srcmodelsdailynutritionlogjs)
  - [Nutrition Goal Model](#nutrition-goal-model-srcmodelsnutritiongoaljs)
- [🚀 API Routes Documentation](#-2-api-routes-documentation)
  - [2.1 Analyze Food Images (AI Vision)](#21-analyze-food-images-ai-vision)
- [⚠️ Error Handling Guide](#️-3-error-handling-guide)

---

# 📁 System Architecture & File Paths

## Models

- `src/models/Meal.js` — Tracks specific eating events, associated media, and nested arrays of individual food items consumed.
- `src/models/DailyNutritionLog.js` — The aggregated daily ledger containing strictly typed number macros for mathematical operations and graphing.
- `src/models/NutritionGoal.js` — Tracks user-defined nutrient targets (e.g., muscle gain, weight loss) and historical daily completions.

## Controllers & Routes

- `src/controllers/nutritionController.js` — The centralized controller handling multipart form parsing, API key validation, DB queries, and AI service invocation.
- `src/routes/nutritionRoutes.js` — Express router configuration utilizing multer for multi-image uploads.

---

# 🗄️ 1. Data Models (Database Schema)

## Meal & Food Items Model (`src/models/Meal.js`)

This schema represents a single eating event (the parent) and an array of individual items detected (the children).

> **Note:** Core nutrients here are stored as **Strings** (e.g., `"15g"`) to maintain raw AI extraction fidelity.

### Parent Schema

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| userId | ObjectId | Yes | Reference to UserAuth |
| date | Date | Yes | Default: `Date.now` |
| mealType | String | No | e.g., `"LUNCH"`, `"DINNER"`, `"SNACK"` |
| isFullyEaten | Boolean | No | Default: `true` |
| foodItems | Array | Yes | Array of child `foodItemSchema` objects |
| location | Object | No | Contains `name`, `lat`, `lng` |
| imageUrls | Array | No | Array of strings linking to uploaded images |

### foodItemSchema (Child Object inside `foodItems` array)

| Field | Type | Description |
|--------|------|-------------|
| foodName | String | Name of detected item (e.g., `"Grilled Salmon"`) |
| amountTaken | String | e.g., `"1 portion"`, `"200ml"` |
| mealCategory | String | Enum: `VEG`, `NON_VEG`, `VEGAN`, `UNKNOWN` |
| physicalState | String | Enum: `SOLID`, `LIQUID`, `MIX` |
| ingredients / allergens | Array | Arrays of strings detected by AI |
| totalCalories / totalProtein etc. | String | Core macros stored as strings (e.g., `"450kcal"`, `"30g"`) |
| otherNutrients | Array | Array of objects: `[{ name: "Vitamin C", amount: "15mg" }]` |
| foodScore | Number | AI-generated health score (0–5) |
| aiInsights | Object | Contains arrays: `whyGood` and `whyNot` |

---

## Daily Nutrition Log Model (`src/models/DailyNutritionLog.js`)

The daily aggregation.

> **Note:** Macros here are strict **Numbers** to prevent database calculation crashes (`CastErrors`).

| Field | Type | Description |
|--------|------|-------------|
| userId / date | ObjectId / String | `date` must be `"YYYY-MM-DD"` format. Unique per user per day. |
| basicNutrients | Array | Array of objects: `[{ name: "Protein", amount: "50grams" }]` |
| totalCalories | Number | Sum of calories (e.g., `2400`) |
| totalProtein / totalCarbs etc. | Number | Sum of respective macros |
| mealsAttached | Array | Array of ObjectIds referencing Meal documents |

---

## Nutrition Goal Model (`src/models/NutritionGoal.js`)

Tracks the user's active goals and charting data.

| Field | Type | Description |
|--------|------|-------------|
| goalType | String | e.g., `"WEIGHT_LOSS"`, `"MUSCLE_GAIN"` |
| targets | Array | Specific nutrient targets: `[{ nutrientName: "Protein", targetAmount: 160 }]` |
| goalStartDate / EndDate | Date | Active timeframe for the goal |
| progressChart | Array | Array of daily completions for the charting UI |

---

# 🚀 2. API Routes Documentation

**Base Server URL**

```text
http://<YOUR_SERVER_IP_OR_DOMAIN>
```

## Authentication

Every request requires a valid JWT.

```http
Authorization: Bearer <token>
```

---

## 2.1 Analyze Food Images (AI Vision)

Uploads up to 10 images, contextualizes the user's data, analyzes the meal via Gemini, and automatically saves the resulting Meal record to the database if successful.

### Endpoint

```http
POST /api/nutrition/ai/analyze
```

### Headers

| Header | Value |
|---------|-------|
| Content-Type | multipart/form-data |
| Authorization | Bearer `<jwt_token>` |

### Form Data (Body)

The Android client must send this as `multipart/form-data`.

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| images | File(s) | Yes | The image(s) to analyze. Can append multiple times for array upload (Max 10). |
| apiKey | String | No | Custom Gemini API Key. If absent, backend checks for PRO sub. |
| modelName | String | No | Custom Model Name (e.g., `gemini-2.5-flash`). |
| userInputAmount | String | No | User text input (e.g., `"I ate half the plate and drank the whole coke"`). |
| userProfile | String (JSON) | No | Stringified JSON object of the user profile so the backend doesn't have to query it. Example: `{"age":21,"allergies":["Peanuts"]}` |

### Success Response (200 OK)

Returns the created `mealId`, the URLs of the saved images, and the fully parsed AI data mapped to match the Meal schema.

```json
{
  "success": true,
  "mealId": "65b4c9e8f1a2b3c4d5e6f7a8",
  "imageUrls": [
    "/public/uploads/nutrition/1700000000000-food1.jpg",
    "/public/uploads/nutrition/1700000000005-food2.jpg"
  ],
  "data": {
    "foodItems": [
      {
        "foodName": "Grilled Chicken Salad",
        "amountTaken": "1 full bowl",
        "mealCategory": "NON_VEG",
        "physicalState": "MIX",
        "isOrganic": false,
        "ingredients": [
          "Chicken Breast",
          "Lettuce",
          "Olive Oil",
          "Tomatoes"
        ],
        "allergens": [],
        "chemicalsOrPreservatives": [],
        "totalCalories": "450",
        "totalProtein": "45g",
        "totalCarbs": "12g",
        "totalFat": "22g",
        "otherNutrients": [
          {
            "name": "Vitamin C",
            "amount": "15mg"
          },
          {
            "name": "Sodium",
            "amount": "320mg"
          }
        ],
        "foodScore": 4.5,
        "foodScoreReason": "High lean protein and healthy fats, low in complex carbs.",
        "aiInsights": {
          "whyGood": [
            "Excellent source of protein for muscle recovery.",
            "Provides healthy fats from olive oil."
          ],
          "whyNot": [
            "Slightly high in sodium depending on the dressing used."
          ]
        }
      }
    ]
  }
}
```

---

# ⚠️ 3. Error Handling Guide

The Android client should be prepared to catch and display the following HTTP status codes and standard JSON error payloads.

---

## 400 - Bad Request (Client Error)

Occurs when the client request is malformed or missing required files.

```json
{
  "success": false,
  "message": "At least one image is required."
}
```

or if the upload is aborted by the client:

```json
{
  "success": false,
  "message": "Image upload failed, interrupted, or exceeded limits."
}
```

---

## 403 - Forbidden (Subscription/Payment Error)

Occurs when the user does not provide their own `apiKey` **AND** their `UserSubscription` status is not **PRO**.

**Android UI Action**

Trigger a **Paywall** bottom sheet or prompt the user to go to **Settings** to add their personal API key.

```json
{
  "success": false,
  "requiresPro": true,
  "message": "Subscribe to PRO or provide your own Gemini API key and model name to use this feature."
}
```

---

## 500 - Internal Server Error (AI or Server Failure)

Occurs if the Gemini API fails, times out, or returns a response that cannot be parsed into JSON.

The backend handles deleting the uploaded images automatically in this case so server storage isn't wasted.

**Android UI Action**

Show a snackbar or retry prompt.

```json
{
  "success": false,
  "message": "AI response could not be parsed into valid JSON."
}
```

or

```json
{
  "success": false,
  "message": "An unexpected error occurred during meal analysis.",
  "error": "Timeout or backend crash details..."
}
```