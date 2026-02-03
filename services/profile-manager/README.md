# profile-manager

Minimal profile manager microservice scaffold.

Getting started

1. Copy `.env.example` to `.env` and update values (especially `MONGO_URI` and `JWT_SECRET`).
2. Install dependencies:

```powershell
npm install
```

3. Run locally:

```powershell
npm run start
```

Endpoints

- `POST /auth/signup` - create account
- `POST /auth/login` - login and receive tokens
- `POST /auth/refresh` - refresh tokens
- `GET /profile` - get current user profile (requires Bearer token)

JWT / Keys

- This service signs and verifies tokens using HS256 (shared secret). Provide the secret via `JWT_SECRET` (preferred) or `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`.
- Keep the shared secret secure (Kubernetes secret, Vault, or similar). Do not commit it to source control.

Deployment notes

- Recommended: use a central secrets-store (Vault/KMS) to manage `JWT_SECRET` and rotate it safely. When rotating, coordinate token expiry/refresh strategy to avoid breaking active sessions.
