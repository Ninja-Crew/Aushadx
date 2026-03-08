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

## Push Notifications
To enable FCM push notifications, this service requires a Firebase Admin service account key:
1. Go to the **Firebase Console** -> **Project Settings** -> **Service accounts**
2. Click **Generate new private key** and download the JSON file
3. Rename the downloaded file to `service-account.json` and place it in the root of the `services/medicine-scheduler` directory.
4. (Optional) Set `GOOGLE_APPLICATION_CREDENTIALS` in your `.env` to point to the absolute path of this file. If omitted, the service will fallback to looking for `./service-account.json`.
