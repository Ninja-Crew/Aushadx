# Medicine Scheduler ⏰

> **The Heartbeat of Adherence.**
> *Precision Reminders. Missed Dose Tracking. Reliable Notifications.*

---

## 📖 Overview

The **Medicine Scheduler** is responsible for the core utility of AushadX: making sure users take their medicine. It manages the lifecycle of medication reminders, from creation to notification dispatch.

Using **Agenda.js** backed by MongoDB, it serves as a persistent, fault-tolerant job scheduler that survives server restarts and handles complex recurrence rules.

## ⚡ Key Capabilities

- **Flexible Frequencies**:
  - `ONCE`: Single-time reminders.
  - `EVERY_X_HOURS` / `EVERY_X_MINUTES`: Interval-based.
  - `X_TIMES_DAILY`: Specific times (e.g., 9:00 AM, 2:00 PM, 9:00 PM).
  - `SPECIFIC_WEEK_DAYS`: Days of the week (e.g., Mon, Wed, Fri).
- **Missed Logic**: Automatically flags reminders as "missed" if not confirmed within a grace window.
- **History Tracking**: Keeps a permanent log of taken vs. missed medicines for analytics.

---

## 🔌 API Endpoints

Base URL: `/reminders` (when accessed via API Gateway)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/` | Create a new reminder |
| `GET` | `/:userId` | Get active reminders for a user |
| `GET` | `/missed/:userId` | Get missed medicine history |
| `DELETE` | `/:id` | Delete/Cancel a reminder |

### Schema Example
```json
{
  "userId": "123456",
  "medicineName": "Amoxicillin",
  "dosage": "500mg",
  "frequency": "X_TIMES_DAILY",
  "specificTimes": ["08:00", "20:00"],
  "startDate": "2023-10-01",
  "endDate": "2023-10-07"
}
```

---

## 🛠️ Configuration

### Environment Variables
Create a `.env` file in `services/medicine-scheduler`:

```env
PORT=3002
MONGO_URI=mongodb://localhost:27017/aushadx_scheduler
```

---

## 🚀 Usage

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
npm run dev
# Runs on http://localhost:3002
```

### Run Tests
```bash
npm test
```
