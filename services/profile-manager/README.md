# Profile Manager 👤

> **Secure Identity & User Management.**
> *Authentication. Profile Storage. Privacy First.*

---

## 📖 Overview

The **Profile Manager** is the vault of AushadX. It handles all thing related to user identity, authentication, and static profile data. It issues JSON Web Tokens (JWT) that act as keys to the rest of the ecosystem.

Designed with security in mind, it ensures that sensitive user collection/storage is isolated from high-traffic scheduling or analysis operations.

## ⚡ Key Features

- **JWT Authentication**: Stateless, scalable authentication using signed tokens.
- **Secure Password Storage**: Bcrypt hashing for password protection.
- **Profile Management**: Stores basic user info (Name, Age, Medical Constraints).
- **Inter-Service Trust**: shares `JWT_SECRET` with the API Gateway for zero-latency verification.

---

## 🔌 API Endpoints

Base URL: `/auth` (for auth) or `/profile` (for data)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/signup` | Create a new account |
| `POST` | `/auth/login` | Authenticate and receive `accessToken` |
| `POST` | `/auth/refresh` | Refresh an expired access token |
| `GET` | `/profile` | Get current user's profile detail (Requires Token) |

---

## 🛠️ Configuration

### Environment Variables
Create a `.env` file in `services/profile-manager`:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/aushadx_users
JWT_SECRET=your_super_secure_secret_shared_with_gateway
JWT_EXPIRE=30d
```

> **Security Note**: In production, `JWT_SECRET` should be rotated and managed via a secrets manager.

---

## 🚀 Usage

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
npm run start
# Runs on http://localhost:3000
```
