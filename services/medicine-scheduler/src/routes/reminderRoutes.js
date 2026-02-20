import express from 'express';
import { createReminder, getReminders, deleteReminder, getMissedReminders } from '../controllers/reminderController.js';

const router = express.Router();

router.post('/:userId', createReminder);
router.get('/missed/:userId', getMissedReminders); // Important: Place before /:userId to avoid conflict if logic wasn't specific, but here it's fine. 
// Actually, /:userId matches anything. So if I have /:userId, it might match 'missed' if :userId is a string. 
// Better standard: /users/:userId/reminders/missed or /reminders/missed?userId=...
// Given current route structure likely mounted at /api/reminders
// if I do router.get('/missed/:userId'...) it will conflict with router.get('/:userId'...).
// 'missed' will be interpreted as a userId.
// I should put this BEFORE /:userId
router.get('/missed/:userId', getMissedReminders);
router.get('/:userId', getReminders);
router.delete('/:id', deleteReminder);

export default router;
