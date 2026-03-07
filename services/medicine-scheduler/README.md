# Medicine Scheduler
Microservice for managing user medicine schedules and reminders.

## Setup
1. Copy `.env.example` to `.env`. Ensure MongoDB is running.
2. Run `npm install`
3. Run `npm start`

## Docker
```bash
docker build -t medicine-scheduler .
docker run -p 3003:3003 medicine-scheduler
```
