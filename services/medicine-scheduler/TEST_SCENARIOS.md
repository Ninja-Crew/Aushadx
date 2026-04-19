# Medicine Scheduler Test Scenarios

## Execution Summary

- Date: 2026-04-19
- Command: `npm test`
- Result: Passed (Unit, Component, and Integration suites passed)

## Mock Separation

Shared mock modules are separated under:

- `tests/mocks/fixtures.js`
- `tests/mocks/services.js`

## Unit Scenarios

### `tests/unit/Reminder.test.js`

1. Validate that the Mongoose Reminder schema correctly identifies an invalid reminder (missing `medicineName`).
2. Validate that the Mongoose Reminder schema correctly passes a fully well-formed reminder payload.

## Component Scenarios

### `tests/component/reminder.test.js`

1. Create reminder (`POST /:userId`) succeeds and schedules active reminders.
2. Create reminder fails with `400` on invalid duration.
3. Create reminder fails with `500` on persistence error.
4. Update reminder succeeds and re-schedules jobs.
5. Update reminder fails with `400` on invalid duration.
6. Update reminder returns `404` when reminder does not exist.
7. Get reminders returns paginated response shape.
8. Get pending count returns numeric count.
9. Get missed reminders returns transformed notification payload.
10. Take reminder marks earliest scheduled slot as taken.
11. Snooze reminder returns `404` for unknown reminder.
12. Snooze reminder succeeds and schedules snooze window.
13. Delete reminder removes reminder, jobs, and histories.
14. Delete reminder returns `404` when reminder is missing.
15. Delete all user reminders removes reminders and histories.
16. Clear missed reminders updates missed statuses and removes orphan histories.

## Integration Scenarios

### `tests/integration/api.integration.test.js`

1. Validates that the Express routing container for the medicine-scheduler API successfully responds with a `200` to an HTTP health check.
