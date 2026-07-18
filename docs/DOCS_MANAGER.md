# HealthX - Docs Manager API Documentation

## 1. System Architecture & Workflow

The Docs Manager is designed to handle sensitive user health documents securely.

### How it works

#### Upload & Storage
When a user uploads a file, `multer` intercepts the `multipart/form-data` request and saves the physical file to a private `../../protected_docs` folder on the server. This directory is not exposed to the web via static routing.

#### Metadata Tracking
The server creates a `Document` record containing the exact server path, MIME type, and owner ID.

#### Access Control Initialization
Simultaneously, a `DocumentAccess` record is created for the new document, defaulting to entirely private (no public key, no password, empty shared list).

#### Permission Gates

**Public**
- Generates a 16-byte hex string.
- Anyone with the string can hit the `GET /public/:publicKey` route.

**Password**
- Hashes a user-provided string using `bcrypt`.
- Users must `POST` the password to the secure route.

**Shared**
- Adds a target `userId` to an array.
- The system checks the requester's JWT against this array.

#### Secure Delivery
If the permission gate is passed, the server uses `res.download()` to stream the file directly from the `protected_docs` folder to the client.

---

# 2. Database Models (MongoDB)

## Document Collection

This model stores the core metadata of the uploaded file.

```json
{
  "_id": "ObjectId('...')",
  "userId": "ObjectId('...')",
  "documentName": "String",
  "documentType": "String",
  "documentCategory": "String",
  "serverPath": "String",
  "createdAt": "ISODate('...')",
  "updatedAt": "ISODate('...')"
}
```

| Field | Description |
|--------|-------------|
| `_id` | ObjectId |
| `userId` | Indexed. Ref: `UserAuth` |
| `documentName` | Original filename or user-provided name |
| `documentType` | MIME type (e.g. `image/jpeg`, `application/pdf`) |
| `documentCategory` | Enum: `['HEALTH', 'DIAGNOSTICS', 'NUTRITION_MONTHLY_REPORT', 'PRESCRIPTION', 'OTHER']` |
| `serverPath` | Exact absolute path on the physical server |
| `createdAt` | ISODate |
| `updatedAt` | ISODate |

---

## DocumentAccess Collection

This model governs exactly who can view the document and how.

```json
{
  "_id": "ObjectId('...')",
  "documentId": "ObjectId('...')",
  "isPublic": "Boolean",
  "publicKey": "String | null",
  "passwordHash": "String | null",
  "sharedWithUsers": [
    "ObjectId('...')"
  ],
  "createdAt": "ISODate('...')",
  "updatedAt": "ISODate('...')"
}
```

| Field | Description |
|--------|-------------|
| `_id` | ObjectId |
| `documentId` | Unique. Ref: `Document` |
| `isPublic` | Default: `false` |
| `publicKey` | Sparse index. URL-safe hex string if public |
| `passwordHash` | Bcrypt hash if password protected |
| `sharedWithUsers` | Array of `UserAuth` IDs who have been granted access |
| `createdAt` | ISODate |
| `updatedAt` | ISODate |

---

# 3. API Endpoints Reference

**Base URL**

```text
/api/docs
```

---

# 3.1 Upload a Document

Uploads a file securely to the server and initializes private access.

## Endpoint

```http
POST /api/docs/upload
```

**Authentication Required**

- Yes (Bearer JWT)

**Headers**

```text
Content-Type: multipart/form-data
```

## Body (Form-Data)

| Field | Type | Required | Description |
|--------|------|----------|-------------|
| `documentFile` | File | ✅ | The physical file (Max 15MB). |
| `documentName` | Text | Optional | Custom name (defaults to original filename). |
| `documentCategory` | Text | Optional | Must be a valid enum (defaults to `OTHER`). |

## Success Response (201 Created)

```json
{
  "success": true,
  "message": "Document uploaded successfully.",
  "document": {
    "userId": "64a7c...",
    "documentName": "Blood_Test.pdf",
    "documentType": "application/pdf",
    "documentCategory": "DIAGNOSTICS",
    "serverPath": "/path/to/backend/protected_docs/1689...-Blood_Test.pdf",
    "_id": "64b8d...",
    "createdAt": "2026-07-19T02:27:58.000Z",
    "updatedAt": "2026-07-19T02:27:58.000Z"
  }
}
```

## Error Responses

**400 Bad Request**

```json
{
  "success": false,
  "message": "No document file provided."
}
```

**500 Server Error**

```json
{
  "success": false,
  "message": "An unexpected error occurred while saving the document."
}
```

---

# 3.2 Make Document Public

Generates a public URL for a document.

## Endpoint

```http
POST /api/docs/:documentId/make-public
```

**Authentication Required**

- Yes (Bearer JWT - Must be Document Owner)

**Headers**

```text
Content-Type: application/json
```

**Body**

None

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Document is now public.",
  "publicUrl": "/api/docs/public/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "publicKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

## Error Responses

**404 Not Found**

```json
{
  "success": false,
  "message": "Document not found or unauthorized."
}
```

**500 Server Error**

```json
{
  "success": false,
  "message": "Failed to generate public link."
}
```

---

# 3.3 Set Document Password

Enables password protection for a document.

## Endpoint

```http
POST /api/docs/:documentId/set-password
```

**Authentication Required**

- Yes (Bearer JWT - Must be Document Owner)

**Headers**

```text
Content-Type: application/json
```

## Body (JSON)

```json
{
  "password": "MySecurePassword123"
}
```

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Password protection enabled."
}
```

## Error Responses

**400 Bad Request**

```json
{
  "success": false,
  "message": "Password is required."
}
```

**404 Not Found**

```json
{
  "success": false,
  "message": "Document not found or unauthorized."
}
```

**500 Server Error**

```json
{
  "success": false,
  "message": "Failed to set document password."
}
```

---

# 3.4 Share Document with Specific User

Grants viewing access to another registered user.

## Endpoint

```http
POST /api/docs/:documentId/share
```

**Authentication Required**

- Yes (Bearer JWT - Must be Document Owner)

**Headers**

```text
Content-Type: application/json
```

## Body (JSON)

```json
{
  "targetUserId": "64a7c8e9f0..."
}
```

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Document shared successfully."
}
```

## Error Responses

**400 Bad Request**

```json
{
  "success": false,
  "message": "Target User ID is required."
}
```

**404 Not Found**

```json
{
  "success": false,
  "message": "Document not found or unauthorized."
}
```

**500 Server Error**

```json
{
  "success": false,
  "message": "Failed to share document."
}
```

---

# 3.5 Download Public Document

Retrieves a document using its public key.

## Endpoint

```http
GET /api/docs/public/:publicKey
```

**Authentication Required**

- No

**Input**

The `publicKey` string in the URL parameters.

## Success Response (200 OK)

**Headers**

```text
Content-Type: <mime-type>
Content-Disposition: attachment; filename="<documentName>"
```

**Body**

Raw binary file stream.

## Error Responses

**404 Not Found**

```json
{
  "success": false,
  "message": "Invalid or inactive public link."
}
```

**404 Not Found (Stream Error)**

```json
{
  "success": false,
  "message": "File could not be found on the server or transfer failed."
}
```

---

# 3.6 Download Password-Protected Document

Retrieves a document by verifying a password.

## Endpoint

```http
POST /api/docs/secure/:documentId
```

**Authentication Required**

- No

**Headers**

```text
Content-Type: application/json
```

## Body (JSON)

```json
{
  "password": "MySecurePassword123"
}
```

## Success Response (200 OK)

**Headers**

```text
Content-Type: <mime-type>
Content-Disposition: attachment; filename="<documentName>"
```

**Body**

Raw binary file stream.

## Error Responses

**400 Bad Request**

```json
{
  "success": false,
  "message": "Password is required to access this document."
}
```

or

```json
{
  "success": false,
  "message": "This document is not password protected."
}
```

**401 Unauthorized**

```json
{
  "success": false,
  "message": "Incorrect password."
}
```

**500 Server Error**

```json
{
  "success": false,
  "message": "Error validating secure access."
}
```

---

# 3.7 Download Shared or Owned Document

Retrieves a document if the requester is the owner or explicitly listed in the `sharedWithUsers` array.

## Endpoint

```http
GET /api/docs/shared/:documentId
```

**Authentication Required**

- Yes (Bearer JWT)

**Input**

The `documentId` in the URL parameters.

## Success Response (200 OK)

**Headers**

```text
Content-Type: <mime-type>
Content-Disposition: attachment; filename="<documentName>"
```

**Body**

Raw binary file stream.

## Error Responses

**401 Unauthorized**

```json
{
  "success": false,
  "message": "Not authorized. No token provided."
}
```

*(From JWT Middleware)*

**403 Forbidden**

```json
{
  "success": false,
  "message": "You do not have permission to view this document."
}
```

**404 Not Found**

```json
{
  "success": false,
  "message": "Document not found."
}
```

**500 Server Error**

```json
{
  "success": false,
  "message": "Error verifying document permissions."
}
```