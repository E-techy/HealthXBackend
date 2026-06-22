# Health X Backend API Documentation

This document outlines the available REST API endpoints for the Health X backend. 

**Base URL:** `http://<YOUR_SERVER_IP>:5001/api/auth`
**Headers Required:** `Content-Type: application/json`

All responses follow a predictable format with a `success` boolean to make Android client-side parsing (e.g., using Retrofit and Gson/Moshi) straightforward.

---

## 1. User Signup (Initiate)
Creates a new user account and triggers an email verification OTP.

* **URL:** `/signup`
* **Method:** `POST`

### Request Body
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "OTP sent to email. Please verify to complete signup."
}
```

### Error Responses (409 Conflict / 500 Server Error)
```json
{
  "success": false,
  "message": "Email already registered. Please login."
}
```

---

## 2. Verify Signup OTP
Verifies the OTP sent to the user's email and returns the authentication token.

* **URL:** `/verify-otp`
* **Method:** `POST`

### Request Body
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Email verified successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "accountId": "60d0fe4f5311236168a109ca",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Error Responses (400 Bad Request / 404 Not Found)
```json
{
  "success": false,
  "message": "Invalid or expired OTP."
}
```

---

## 3. User Login
Authenticates an existing, verified user.

* **URL:** `/login`
* **Method:** `POST`

### Request Body
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "accountId": "60d0fe4f5311236168a109ca",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Error Responses (401 Unauthorized / 403 Forbidden)
```json
{
  "success": false,
  "message": "Invalid email or password." 
  // OR "Please verify your email first." 
  // OR "Account is suspended."
}
```

---

## 4. Forgot Password (Request OTP)
Generates and sends a 6-digit OTP to the registered email address for password reset.

* **URL:** `/forgot-password`
* **Method:** `POST`

### Request Body
```json
{
  "email": "user@example.com"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "OTP sent to registered email."
}
```

---

## 5. Reset Password
Verifies the forgot-password OTP and updates the user's password.

* **URL:** `/reset-password`
* **Method:** `POST`

### Request Body
```json
{
  "email": "user@example.com",
  "otp": "654321",
  "newPassword": "newBrilliantPassword456"
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Password updated successfully. You can now login."
}
```

### Error Responses (400 Bad Request)
```json
{
  "success": false,
  "message": "Invalid or expired OTP."
}
```
