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

Uploads up to **10 images**, contextualizes the user's data, analyzes the meal via **Gemini**, and automatically saves the resulting **Meal** record to the database if successful.

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

The Android client must send this request as `multipart/form-data`.

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| images | File(s) | Yes | The image(s) to analyze. Multiple images can be uploaded by appending the field multiple times. Maximum: **10 images**. |
| apiKey | String | No | Custom Gemini API Key. If omitted, the backend checks whether the user has an active **PRO** subscription. |
| modelName | String | No | Custom Gemini model name (e.g. `gemini-2.5-flash`). |
| userInputAmount | String | No | User-provided serving information (e.g. `"I ate half the plate and drank the whole coke"`). |
| userProfile | String (JSON) | No | Stringified JSON containing the user's profile so the backend doesn't need to fetch it again. Example: `{"age":21,"allergies":["Peanuts"]}` |

### Success Response (200 OK)

Returns the newly created **Meal ID**, uploaded image URLs, and the complete AI analysis mapped directly to the **Meal** schema using the latest **analyzeMeal** Gemini prompt.

```json
{
  "success": true,
  "mealId": "65b4c9e8f1a2b3c4d5e6f7a8",
  "imageUrls": [
    "/public/uploads/nutrition/1700000000000-food1.jpg"
  ],
  "data": {
    "mealType": "LUNCH",
    "foodItems": [
      {
        "foodName": "Paneer Spinach Curry",
        "amountTaken": "150 grams",
        "totalQuantity": "150 grams",
        "aiRecommendedQuantity": "100 grams",
        "mealCategory": "VEG",
        "physicalState": "MIX",
        "isOrganic": false,
        "ingredients": [
          "Paneer",
          "Spinach",
          "Salt",
          "Spices",
          "Oil"
        ],
        "allergens": [
          "Dairy"
        ],
        "chemicalsOrPreservatives": [],
        "totalCalories": "220 kcal",
        "totalProtein": "12 grams",
        "totalCarbs": "10 grams",
        "totalFat": "15 grams",
        "saturatedFat": "6 grams",
        "unsaturatedFat": "8 grams",
        "totalWater": "40 ml",
        "otherNutrients": [
          {
            "name": "Sodium",
            "amount": "320 mg"
          },
          {
            "name": "Iron",
            "amount": "2.5 mg"
          }
        ],
        "nutritionValuePerUnit": "per 100 grams",
        "brandName": null,
        "manufacturerInfo": null,
        "manufactureDate": null,
        "expiryDate": null,
        "countryOfOrigin": null,
        "foodScore": 4,
        "foodScoreReason": "Because you are targeting HIGH_PROTEIN, the paneer is highly beneficial. However, docked 1 point due to the saturated fat content given your daily limits.",
        "aiInsights": {
          "whyGood": [
            "Excellent source of vegetarian protein.",
            "Spinach provides essential iron."
          ],
          "whyNot": [
            "Slightly high in saturated fats."
          ]
        }
      }
    ]
  }
}
```

---

# ⚠️ 3. Error Handling Guide

The Android client should be prepared to catch and handle the following HTTP status codes.

---

## 400 - Bad Request (Client Error)

Occurs when the request is missing required image files or the upload is interrupted.

```json
{
  "success": false,
  "message": "At least one image is required."
}
```

---

## 403 - Forbidden (Subscription Error)

Occurs when the user does **not** provide their own `apiKey` **and** does **not** have an active **PRO** subscription.

**Android UI Action**

Trigger a **Paywall** bottom sheet or prompt the user to add their personal Gemini API key in **Settings**.

```json
{
  "success": false,
  "requiresPro": true,
  "message": "Subscribe to PRO or provide your own Gemini API key and model name to use this feature."
}
```

---

## 500 - Internal Server Error (AI Failure)

Occurs if the Gemini API fails, times out, or returns an invalid/non-JSON response.

**Android UI Action**

Show a snackbar prompting the user to try taking the photo again.

```json
{
  "success": false,
  "message": "AI response could not be parsed into valid JSON."
}
```