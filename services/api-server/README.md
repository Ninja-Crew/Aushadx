# API Server (Gateway)
Main entry point for AushadX backend services. Handles routing and JWT verification.

## Setup
1. Copy `.env.example` to `.env` and fill in the values.
2. Run `npm install`
3. Run `npm start`

## Docker
To run with Docker:
```bash
docker build -t api-server .
docker run -p 3000:3000 api-server
```
