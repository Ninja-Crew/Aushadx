# API Gateway (api-server) 🛡️

> **The Central Nervous System of AushadX.**
> *Unified Entry Point. Security Enforcement. Request Routing.*

---

## 📖 Overview

The **API Gateway** is the single entry point for all client requests in the AushadX ecosystem. It abstracts the complexity of the underlying microservices architecture from the frontend, handling:
- **Request Routing**: Directing traffic to the correct microservice (Profile, Scheduler, or Analyzer).
- **Authentication**: Validating JWTs before requests reach protected services.
- **Load Balancing/Proxying**: Seamlessly proxying requests using `http-proxy-middleware`.

## ⚡ Key Features

- **Unified Surface**: One API endpoint (`/api`) for the entire application.
- **Middleware Injection**: Applies global middleware like Logging (`morgan`), CORS, and Authentication (`verifyToken`) centrally.
- **Failover & Error Handling**: Gracefully handles downstream service failures.

---

## 🛣️ API Map

| Route Prefix | Target Service | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `/auth` | **Profile Manager** | Login, Signup, Token Refresh | ❌ |
| `/profile` | **Profile Manager** | User Profile Data | ✅ |
| `/reminders` | **Medicine Scheduler** | CRUD Reminders, History | ✅ |
| `/analyze` | **Medicine Analyzer** | AI Analysis, Chat, Reports | ✅ |
| `/health` | **Gateway** | Gateway Health Check | ❌ |

---

## 🛠️ Configuration

### Environment Variables
Create a `.env` file in the `services/api-server` directory:

```env
PORT=3001
JWT_SECRET=your_super_secure_secret_shared_with_profile_manager

# Service URLs (Defaults usually work for local dev)
PROFILE_SERVICE_URL=http://localhost:3000
MEDICINE_SCHEDULER_URL=http://localhost:3002
MEDICINE_ANALYZER_URL=http://localhost:8000
```

> **Note**: `JWT_SECRET` must match the one used in `profile-manager`.

---

## 🚀 Usage

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
npm run dev
# Runs on http://localhost:3001
```

### Test
```bash
npm test
```
