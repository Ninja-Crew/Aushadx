# Profile Manager
Microservice responsible for user profiles, authentication, and JWT lifecycle.

## Setup
1. Copy `.env.example` to `.env`. Ensure MongoDB is running.
2. Run `npm install`
3. Run `npm start`

## Docker
```bash
docker build -t profile-manager .
docker run -p 3001:3001 profile-manager
```
