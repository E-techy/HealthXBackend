# HealthX - Docs Manager 

## Overview
The **Docs Manager** is a core module of the HealthX application responsible for the secure upload, storage, categorization, and access management of user health documents. It utilizes MongoDB to store document metadata and provides a flexible sharing system, allowing users to keep documents private, generate public links, set password protection, or grant access to specific users.

## Core Features

### 1. Document Upload & Categorization
* **Universal Uploads:** Accepts documents of various types (PDFs, images, text files, etc.).
* **Local Storage:** Files are securely saved to the server's filesystem, with the exact file path stored in the database.
* **Categorization:** Documents are tagged with specific categories for easy retrieval (e.g., `HEALTH`, `DIAGNOSTICS`, `NUTRITION_MONTHLY_REPORT`, etc.).
* **Metadata Tracking:** Each document is assigned a unique `documentId` and tracks the owner's `userId`, document name, and document type.

### 2. Flexible Access Control
By default, all uploaded documents are completely private to the owner. The module supports three distinct sharing mechanisms:

* **Public Links:** Owners can generate a unique `publicKey` for a document. The server returns a public URL that allows anyone with the link to view the document.
* **Password Protection:** Owners can assign a password to a specific document. The document can only be accessed by providing the correct password.
* **User-to-User Sharing:** Owners can explicitly grant access to other registered users by adding their `userID` to the document's permitted list.

---

## Database Models (MongoDB)

### `Document` Collection
Stores the core metadata for the uploaded files.
* `documentId` (String, Primary Key / UUID)
* `userId` (String, Owner)
* `documentName` (String)
* `documentType` (String, e.g., pdf, jpg, docx)
* `documentCategory` (Enum: HEALTH, DIAGNOSTICS, NUTRITION_MONTHLY_REPORT, etc.)
* `serverPath` (String, exact path on the server)
* `createdAt` (Timestamp)

### `DocumentAccess` Collection
Manages sharing permissions and public keys.
* `documentId` (String, Reference)
* `isPublic` (Boolean)
* `publicKey` (String, Unique generated string for public URLs)
* `passwordHash` (String, Hashed password if password-protected)
* `sharedWithUsers` (Array of Strings containing `userId`s)

---

## API Endpoints Design

### Upload & Management
* **`POST /api/docs/upload`**
  * **Auth:** Required
  * **Payload:** Multipart Form Data (File, `documentName`, `documentCategory`)
  * **Action:** Saves file to the server, generates `documentId`, stores metadata in MongoDB.

### Sharing Configuration (Owner Actions)
* **`POST /api/docs/{documentId}/make-public`**
  * **Auth:** Required (Must be document owner)
  * **Action:** Generates a `publicKey`, saves it to the access table, and returns the public URL to the user.
* **`POST /api/docs/{documentId}/set-password`**
  * **Auth:** Required (Must be document owner)
  * **Payload:** `{ "password": "user_defined_password" }`
  * **Action:** Hashes the password and enables password protection for the document.
* **`POST /api/docs/{documentId}/share`**
  * **Auth:** Required (Must be document owner)
  * **Payload:** `{ "targetUserId": "id_of_user_to_share_with" }`
  * **Action:** Adds the target user to the `sharedWithUsers` array.

### Accessing Documents
* **`GET /api/docs/public/{publicKey}`**
  * **Auth:** None
  * **Action:** Retrieves the document if the `publicKey` exists and `isPublic` is true.
* **`POST /api/docs/secure/{documentId}`**
  * **Auth:** None
  * **Payload:** `{ "password": "user_provided_password" }`
  * **Action:** Validates the password and returns the document if correct.
* **`GET /api/docs/shared/{documentId}`**
  * **Auth:** Required
  * **Action:** Checks if the authenticated user's ID exists in the `sharedWithUsers` array. Returns the document if authorized.

---

## Development Roadmap
- [ ] Initialize Spring Boot controllers and MongoDB repositories.
- [ ] Implement file I/O service for saving and serving physical files.
- [ ] Create JWT middleware checks for owner verification on sharing routes.
- [ ] Implement cryptographic generation for `publicKey` (Base64/UUID).
- [ ] Implement bcrypt hashing for password-protected documents.