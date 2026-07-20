# 🩺 HealthX Backend

<div align="center">

# 🩺 HealthX Backend

### Secure • AI Powered • Scalable • Offline First

<img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white">
<img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white">
<img src="https://img.shields.io/badge/JWT-Authentication-orange?style=for-the-badge">
<img src="https://img.shields.io/badge/Google-Gemini-blue?style=for-the-badge">
<img src="https://img.shields.io/badge/Firebase-FCM-FFCA28?style=for-the-badge&logo=firebase&logoColor=black">
<img src="https://img.shields.io/badge/Razorpay-Payments-0C2451?style=for-the-badge">

Enterprise-grade backend powering every cloud feature of the **HealthX Android Application**.

</div>

---

# 📖 Overview

HealthX Backend is the centralized cloud platform that powers the complete HealthX ecosystem.

It provides secure authentication, cloud synchronization, AI-powered nutrition analysis, delegated health-data sharing, reminders, push notifications, document management, subscriptions, and user personalization through a modular REST API architecture.

The backend is designed around scalability, modularity, security, and offline-first synchronization so that Android clients can work both online and offline without losing consistency.

---

# ✨ Core Features

- 🔐 JWT Authentication
- 📧 Email OTP Verification
- 👤 User Management
- 🍏 AI Nutrition Analysis
- 📊 Nutrition Tracking
- 🎯 Nutrition Goals
- 📁 Secure Document Storage
- 🔒 Password Protected Documents
- 🌍 Public Share Links
- 👥 Shared Documents
- 🩺 QR Based Health Sharing
- 🤝 Delegated Access Middleware
- 🚫 Blocklists
- 🔔 Smart Reminder Engine
- 💊 Medication Tracking
- 💧 Hydration Tracking
- 📅 Health Checkup Scheduling
- 🎙 AI Voice Generation
- 📲 Firebase Push Notifications
- 💳 Razorpay Payments
- ⭐ Subscription Management
- ⚙ User Settings
- 🔄 Offline Synchronization

---

# 🏗 System Architecture

```text
                  Android Application
                           │
                    HTTPS REST APIs
                           │
                ┌──────────▼──────────┐
                │   Express Backend   │
                └──────────┬──────────┘
                           │
     ┌──────────┬──────────┼──────────┬──────────┐
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
 Authentication Nutrition Documents Reminders Payments
     │          │          │          │          │
     └──────────┴──────────┴──────────┴──────────┘
                           │
                     MongoDB Database
```

---

# 🧩 Backend Modules

## 🔐 Authentication

Responsible for secure account lifecycle management.

### Features

- User Signup
- Email Verification
- Login
- JWT Authentication
- Password Reset
- Session Validation

### Routes

| Method | Endpoint |
|--------|----------|
| POST | `/api/auth/signup` |
| POST | `/api/auth/verify-otp` |
| POST | `/api/auth/login` |
| POST | `/api/auth/forgot-password` |
| POST | `/api/auth/reset-password` |

---

## 🍏 AI Nutrition Engine

Uses Google Gemini Vision to analyze food images and automatically generate nutrition data.

### Capabilities

- Multi-image analysis
- AI food recognition
- Macro calculation
- AI food scoring
- Daily nutrition aggregation
- Personalized recommendations

### Flow

```text
Images
   │
   ▼
Gemini Vision
   │
   ▼
Structured JSON
   │
   ▼
Meal Creation
   │
   ▼
Nutrition Log
```

### Routes

| Method | Endpoint |
|--------|----------|
| POST | `/api/nutrition/ai/analyze` |
| POST | `/api/nutrition/log/save` |
| GET | `/api/nutrition/meals` |
| POST | `/api/nutrition/goals` |
| GET | `/api/nutrition/goals` |

---

## 📁 Secure Documents

Stores sensitive medical records securely outside publicly accessible folders.

### Features

- Secure Upload
- Password Protection
- Public Sharing
- Private Sharing
- Permission Management
- Secure Downloads

### Routes

| Method | Endpoint |
|--------|----------|
| POST | `/api/docs/upload` |
| GET | `/api/docs/my-docs` |
| GET | `/api/docs/shared-with-me` |
| POST | `/api/docs/:id/share` |
| POST | `/api/docs/:id/make-public` |
| POST | `/api/docs/:id/set-password` |
| DELETE | `/api/docs/:id` |

---

## 🩺 Delegated Access

Secure QR-based health data sharing between HealthX users.

### Features

- QR Hash Generation
- Friendship Management
- Permission Matrix
- Dynamic Context Swapping
- Blocklists

### Delegation Flow

```text
User Scan
    │
Hash Validation
    │
Friendship Lookup
    │
Permission Check
    │
Context Swap
    │
Controller
```

### Routes

| Method | Endpoint |
|--------|----------|
| POST | `/api/access/hash` |
| GET | `/api/access/hash` |
| POST | `/api/access/connect/:hashId` |
| PATCH | `/api/access/friends/:id/permissions` |
| POST | `/api/access/friends/:id/block` |
| DELETE | `/api/access/friends/:id` |

---

## 🔔 Reminder Engine

Offline-first reminder system supporting multiple healthcare reminder categories.

### Categories

- Medication
- Supplements
- Hydration
- Nutrition
- Sleep
- Fitness
- Vaccination
- Consultation
- Therapy
- Recovery
- Elder Care
- Custom

### Routes

| Method | Endpoint |
|--------|----------|
| POST | `/api/reminders` |
| PUT | `/api/reminders/:id` |
| GET | `/api/reminders` |
| POST | `/api/reminders/sync` |
| POST | `/api/devices/register` |
| POST | `/api/voice/generate` |

---

## 📲 Notification Engine

Automatically schedules and sends push notifications using Firebase Cloud Messaging.

```text
Reminder
    │
Scheduler
    │
Background Worker
    │
Firebase FCM
    │
Android Device
```

---

## 💳 Subscription System

Premium subscription management powered by Razorpay.

### Features

- Plans
- Orders
- Signature Verification
- Subscription Activation

### Routes

| Method | Endpoint |
|--------|----------|
| GET | `/api/subscriptions/plans` |
| GET | `/api/subscriptions/plans/:id` |
| POST | `/api/subscriptions/order/create` |
| POST | `/api/subscriptions/order/verify` |
| POST | `/api/subscriptions/order/cancel` |

---

## ⚙ User Settings

Centralized profile and application configuration.

### Stores

- Profile
- Height
- Weight
- Allergies
- Theme
- API Keys
- Notification Sounds
- Language
- Country

### Routes

| Method | Endpoint |
|--------|----------|
| GET | `/api/settings` |
| PUT | `/api/settings` |

---

# 🗄 Database Collections

- UserAuth
- UserSettings
- Meal
- DailyNutritionLog
- NutritionGoal
- Document
- DocumentAccess
- ShareableHash
- Friendship
- Blocklist
- Reminder
- ScheduledNotification
- Device
- SubscriptionPlan
- Order

---

# 🔒 Security

- JWT Authentication
- bcrypt Password Hashing
- Ownership Validation
- Role Validation
- Permission Middleware
- Secure File Storage
- Delegated Access Verification
- QR Validation
- Subscription Verification
- Input Validation

---

# 🤖 AI Services

- Google Gemini Vision
- Nutrition Analysis
- Personalized Recommendations
- Food Scoring
- AI Voice Generation

---

# 🛠 Technology Stack

| Layer | Technology |
|--------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | JWT |
| AI | Google Gemini |
| Payments | Razorpay |
| Notifications | Firebase Cloud Messaging |
| Uploads | Multer |
| Email | Nodemailer |
| Hashing | bcrypt |

---

# 📁 Project Structure

```text
HealthXBackend/

├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── prompts/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── workers/
│
├── protected_docs/
├── public/
├── uploads/
├── package.json
└── README.md
```

---

# 🚀 Design Principles

- Modular Architecture
- Offline First
- AI Driven
- REST APIs
- Secure By Default
- Middleware Based Authorization
- Cloud Synchronization
- Reusable Controllers
- Scalable Database Design

---

# ❤️ HealthX Backend

HealthX Backend is a scalable cloud platform built using **Node.js**, **Express.js**, **MongoDB**, **Google Gemini**, **Firebase**, and **Razorpay**.

It powers authentication, AI nutrition, secure document storage, delegated health sharing, reminders, notifications, subscriptions, offline synchronization, and personalized healthcare experiences for the complete HealthX ecosystem.