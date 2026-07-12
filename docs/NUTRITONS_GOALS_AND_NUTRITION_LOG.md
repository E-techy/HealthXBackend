# 🍏 HealthX Nutrition API Documentation

This module handles **meal tracking**, **AI-powered daily nutrition logging**, and **user nutrition goal management**.

---

# 📑 Table of Contents

- [🔐 Authentication](#-authentication)
- [📌 1. Save Meal to Daily Log](#-1-save-meal-to-daily-log)
- [📌 2. Retrieve Scanned Meals](#-2-retrieve-scanned-meals)
- [📌 3. Create a Nutrition Goal](#-3-create-a-nutrition-goal)
- [📌 4. Retrieve Nutrition Goals](#-4-retrieve-nutrition-goals)
- [⚠️ Common Error Codes](#️-common-error-codes)

---

# 🔐 Authentication

All routes in this module require a valid **JSON Web Token (JWT)**.

Include the token in the `Authorization` header of every request.

### Header Format

```http
Authorization: Bearer <YOUR_JWT_TOKEN>
```

---

# 📌 1. Save Meal to Daily Log

Calculates the nutritional impact of a scanned meal and adds it to the user's daily log.

This route triggers the AI service to update macros and the user's health score based on their active nutrition goals.

### Endpoint

```http
POST /api/nutrition/log/save
```

### Authentication

Required ✅

### Request Body (`application/json`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mealId | String | Yes | MongoDB ObjectId of the previously analyzed meal. |
| amountEaten | String | Yes | Quantity the user actually consumed (e.g. `"1 bowl"`, `"250g"`). |
| discard | Boolean | No | Set to `true` if the user decides not to eat/log the meal. Defaults to `false`. |

### Example Request

```json
{
  "mealId": "65ab1c23d4e5f67890123456",
  "amountEaten": "1.5 servings",
  "discard": false
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "healthScore": 85,
  "dailyLog": {
    "_id": "65ab1d...",
    "userId": "65ab1a...",
    "date": "2026-07-12",
    "totalCalories": "1450 kcal",
    "totalProtein": "85g",
    "totalCarbs": "120g",
    "totalFat": "45g",
    "basicNutrients": [
      {
        "name": "Vitamin C",
        "amount": "40mg"
      }
    ],
    "healthScore": 85,
    "mealsAttached": [
      {
        "mealId": "65ab1c23d4e5f67890123456",
        "amountEaten": "1.5 servings",
        "timeTaken": "2026-07-12T14:30:00.000Z"
      }
    ]
  }
}
```

---

# 📌 2. Retrieve Scanned Meals

Fetches the user's scanned meal history.

Supports pagination and filtering by date or discard status.

### Endpoint

```http
GET /api/nutrition/meals
```

### Authentication

Required ✅

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| skip | Number | `0` | Number of records to skip for pagination. |
| limit | Number | `5` | Maximum number of records returned. |
| date | String | `null` | Filter by date (`YYYY-MM-DD`). |
| mealId | String | `null` | Fetch a specific meal by its ObjectId. |
| show | String | `null` | `all` (active + discarded), `discarded` (discarded only). If omitted, returns only active meals. |

### Example Request

```http
GET /api/nutrition/meals?date=2026-07-12&skip=5&limit=5
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "_id": "65ab1c23d4e5f67890123456",
      "userId": "65ab1a...",
      "date": "2026-07-12T14:25:00.000Z",
      "mealType": "UNKNOWN",
      "discarded": false,
      "foodItems": [
        {
          "foodName": "Grilled Chicken Salad",
          "amountTaken": "1 bowl",
          "totalCalories": "350 kcal"
        }
      ],
      "imageUrls": [
        "/public/uploads/nutrition/1690000000-123.jpg"
      ]
    }
  ]
}
```

---

# 📌 3. Create a Nutrition Goal

Allows the user to set specific dietary targets such as **Weight Loss**, **Muscle Gain**, or **Bulking**, along with a timeframe.

### Endpoint

```http
POST /api/nutrition/goals
```

### Authentication

Required ✅

### Request Body (`application/json`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| goalType | String | Yes | Goal identifier (e.g. `"WEIGHT_LOSS"`, `"BULK"`). |
| targets | Array | Yes | Array of nutrient target objects. |
| goalStartDate | Date | Yes | ISO string representing the goal start date. |
| goalEndDate | Date | Yes | ISO string representing the goal end date. |

### Example Request

```json
{
  "goalType": "MUSCLE_GAIN",
  "targets": [
    {
      "nutrientName": "Protein",
      "targetAmount": "160g"
    },
    {
      "nutrientName": "Calories",
      "targetAmount": "2800 kcal"
    }
  ],
  "goalStartDate": "2026-07-01T00:00:00.000Z",
  "goalEndDate": "2026-08-01T00:00:00.000Z"
}
```

### Success Response (201 Created)

```json
{
  "success": true,
  "data": {
    "_id": "65ab1d99...",
    "userId": "65ab1a...",
    "goalType": "MUSCLE_GAIN",
    "isActive": true,
    "targets": [
      {
        "nutrientName": "Protein",
        "targetAmount": "160g",
        "_id": "..."
      }
    ],
    "progressChart": []
  }
}
```

---

# 📌 4. Retrieve Nutrition Goals

Fetches the user's configured nutrition goals.

Supports filtering between **currently active** and **expired** goals.

### Endpoint

```http
GET /api/nutrition/goals
```

### Authentication

Required ✅

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| show | String | `null` | `all` (active + expired), `expired` (expired only). If omitted, returns only active goals. |

### Example Request

```http
GET /api/nutrition/goals?show=expired
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "_id": "65ab1d99...",
      "goalType": "WEIGHT_LOSS",
      "isActive": true,
      "targets": [
        {
          "nutrientName": "Calories",
          "targetAmount": "1800 kcal"
        }
      ],
      "progressChart": [
        {
          "date": "2026-07-12",
          "nutrientProgress": [
            {
              "nutrientName": "Calories",
              "amountCompleted": "1450 kcal",
              "isCompleted": false
            }
          ]
        }
      ]
    }
  ]
}
```

---

# ⚠️ Common Error Codes

| Status Code | Description |
|-------------|-------------|
| **400 Bad Request** | Missing required fields in the request body. |
| **401 Unauthorized** | Missing or invalid JWT Bearer token. |
| **403 Forbidden** | User does not have permission to access or modify this resource. |
| **404 Not Found** | The requested `mealId` or `goalId` does not exist. |
| **500 Internal Server Error** | AI parsing failure or database connection issues. |