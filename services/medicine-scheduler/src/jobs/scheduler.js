import Agenda from 'agenda';
import Reminder from '../models/Reminder.js';
import ReminderHistory from '../models/ReminderHistory.js';
import { sendPushNotification } from '../services/pushService.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const agenda = new Agenda({
  db: { address: process.env.MONGO_URI, collection: 'agendaJobs' },
});

agenda.define('send-medicine-reminder', async (job) => {
  const { reminderId } = job.attrs.data;
  
  // Use try-catch to ensure job doesn't fail silently
  try {
    const reminder = await Reminder.findById(reminderId);

    if (!reminder) {
      console.log(`Reminder ${reminderId} not found, skipping job.`);
      return;
    }

    if (reminder.status !== 'active') {
      console.log(`Reminder ${reminderId} is ${reminder.status}, skipping.`);
      return;
    }

    // Check end date
    if (reminder.endDate && new Date() > new Date(reminder.endDate)) {
        console.log(`Reminder ${reminderId} has expired (EndDate: ${reminder.endDate}), cancelling.`);
        await cancelReminderJobs(reminderId);
        reminder.status = 'completed';
        await reminder.save();
        return;
    }

    const message = `Time to take ${reminder.medicineName} (${reminder.dosage})`;
    console.log(`[REMINDER] ${message} for user ${reminder.userId}`);
    
    // Create History Record (Status: Scheduled/Pending)
    const history = new ReminderHistory({
      reminderId: reminder._id,
      userId: reminder.userId,
      scheduledTime: new Date(),
      status: 'scheduled'
    });
    await history.save();

    // Send Notification
    await sendPushNotification(reminder.userId, message, reminderId);

    if (reminder.type === 'once' || reminder.frequency === 'ONCE') {
      reminder.status = 'completed';
      await reminder.save();
    }
  } catch (err) {
    console.error(`Error in send-medicine-reminder job for ${reminderId}:`, err);
  }
});

export const startScheduler = async () => {
  await agenda.start();
  console.log('Agenda scheduler started');
};

export const scheduleReminder = async (reminder) => {
  const { _id, frequency, frequencyValue, specificTimes, specificWeekDays, specificDayOfMonth, time, timezone, status } = reminder;
  const reminderId = _id.toString();
  const tz = timezone || 'UTC';

  // Helper to standardise job data
  const jobData = { reminderId };

  // Cancel any existing jobs for this reminder (important for updates)
  await cancelReminderJobs(_id);

  // If the reminder is immediately invalid/completed upon creation or update, don't schedule
  if (status && status !== 'active') {
    console.log(`[SCHEDULER] Skipping scheduling for ${reminderId} as status is ${status}`);
    return;
  }

  if (frequency === 'ONCE') {
    // Client sends startDate as a full ISO datetime combining the chosen date + time
    if (reminder.startDate) {
      const scheduleDate = new Date(reminder.startDate);
      if (scheduleDate > new Date()) {
        await agenda.schedule(scheduleDate, 'send-medicine-reminder', jobData);
      } else {
        console.warn(`[SCHEDULER] ONCE reminder ${reminderId} startDate is in the past, skipping.`);
      }
    } else if (specificTimes && specificTimes.length > 0) {
      // Legacy fallback: reconstruct from time only (schedules today or tomorrow)
      for (const timeStr of specificTimes) {
        const [hour, minute] = timeStr.split(':');
        const scheduleDate = new Date();
        scheduleDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
        if (scheduleDate <= new Date()) {
          scheduleDate.setDate(scheduleDate.getDate() + 1);
        }
        await agenda.schedule(scheduleDate, 'send-medicine-reminder', jobData);
      }
    } else if (time) {
      await agenda.schedule(time, 'send-medicine-reminder', jobData);
    }
  }
  else if (frequency === 'DAILY') {
    // Schedule once per day at the specified start time
    if (specificTimes && specificTimes.length > 0) {
      const [hour, minute] = specificTimes[0].split(':');
      const cron = `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
      const job = agenda.create('send-medicine-reminder', jobData);
      job.repeatEvery(cron, { skipImmediate: true, timezone: tz });
      await job.save();
    }
  }
  else if (frequency === 'EVERY_X_HOURS') {
    const job = agenda.create('send-medicine-reminder', jobData);
    if (specificTimes && specificTimes.length > 0) {
      const [hour, minute] = specificTimes[0].split(':');
      const scheduleDate = new Date();
      scheduleDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
      if (scheduleDate <= new Date()) {
        scheduleDate.setDate(scheduleDate.getDate() + 1); // optionally start next occurrence tomorrow if missed
      }
      job.schedule(scheduleDate);
    }
    job.repeatEvery(`${frequencyValue} hours`);
    await job.save();
  }
  else if (frequency === 'EVERY_X_MINUTES') {
      const job = agenda.create('send-medicine-reminder', jobData);
      job.repeatEvery(`${frequencyValue} minutes`);
      await job.save();
  }
  else if (frequency === 'X_TIMES_DAILY') {
      // Schedule a recurring job for EACH specific time
      if (specificTimes && specificTimes.length > 0) {
          for (const timeStr of specificTimes) {
              const [hour, minute] = timeStr.split(':');
              const cron = `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
              
              const job = agenda.create('send-medicine-reminder', jobData);
              job.repeatEvery(cron, { skipImmediate: true, timezone: tz });
              await job.save();
          }
      }
  }
  else if (frequency === 'SPECIFIC_WEEK_DAYS') {
      // specificWeekDays is array of numbers 0-6 (Sun-Sat)
      if (specificWeekDays && specificWeekDays.length > 0) {
          const daysStr = specificWeekDays.join(','); // e.g. "1,3,5"
          const times = (specificTimes && specificTimes.length > 0) 
            ? specificTimes 
            : (time ? [`${new Date(time).getHours()}:${new Date(time).getMinutes()}`] : []);

          for (const timeStr of times) {
            const [hour, minute] = timeStr.split(':');
            const cron = `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * ${daysStr}`;
             
            const job = agenda.create('send-medicine-reminder', jobData);
            job.repeatEvery(cron, { skipImmediate: true, timezone: tz });
            await job.save();
          }
      }
  }
  else if (frequency === 'SPECIFIC_DAY_OF_MONTH') {
       if (specificDayOfMonth) {
           const times = (specificTimes && specificTimes.length > 0) 
            ? specificTimes 
            : (time ? [`${new Date(time).getHours()}:${new Date(time).getMinutes()}`] : []);

           for (const timeStr of times) {
               const [hour, minute] = timeStr.split(':');
               const cron = `${parseInt(minute, 10)} ${parseInt(hour, 10)} ${specificDayOfMonth} * *`;
               const job = agenda.create('send-medicine-reminder', jobData);
               job.repeatEvery(cron, { skipImmediate: true, timezone: tz });
               await job.save();
           }
       }
  }
};

export const cancelReminderJobs = async (reminderId) => {
  // Agenda queries by data in the job
  // Some jobs may exist with _id as ObjectId and some as String, so clean both
  await agenda.cancel({ 
    $or: [
       { 'data.reminderId': reminderId.toString() },
       { 'data.reminderId': mongoose.Types.ObjectId.isValid(reminderId) ? new mongoose.Types.ObjectId(reminderId) : reminderId }
    ]
  });
};

export default agenda;
