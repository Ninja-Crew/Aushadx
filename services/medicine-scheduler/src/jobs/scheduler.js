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
    await sendPushNotification(reminder.userId, message);

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
  const { _id, frequency, frequencyValue, specificTimes, specificWeekDays, specificDayOfMonth, time } = reminder;
  const reminderId = _id.toString();

  // Helper to standardise job data
  const jobData = { reminderId: _id };

  // Cancel any existing jobs for this reminder (important for updates)
  await cancelReminderJobs(_id);

  if (frequency === 'ONCE') {
    if (time) {
      await agenda.schedule(time, 'send-medicine-reminder', jobData);
    }
  } 
  else if (frequency === 'EVERY_X_HOURS') {
    const job = agenda.create('send-medicine-reminder', jobData);
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
              // timeStr is "HH:mm"
              // Cron format: "mm HH * * *"
              const [hour, minute] = timeStr.split(':');
              const cron = `${minute} ${hour} * * *`;
              
              const job = agenda.create('send-medicine-reminder', jobData);
              job.repeatEvery(cron, { skipImmediate: true });
              await job.save();
          }
      }
  }
  else if (frequency === 'SPECIFIC_WEEK_DAYS') {
      // specificWeekDays is array of numbers 0-6 (Sun-Sat)
      // We also need time (or specificTimes? Assuming single time for now if not X_TIMES_DAILY logic mixed)
      // Usually "Specific Days" implies a specific time on those days.
      // Let's assume `time` field holds the time of day, or `specificTimes`?
      // User request "X_TIMES_DAILY" was separate.
      // Let's assume if simple frequency, use `time` for the time-of-day.
      const timeDate = time ? new Date(time) : new Date(); // Fallback
      const minute = timeDate.getMinutes();
      const hour = timeDate.getHours();

      if (specificWeekDays && specificWeekDays.length > 0) {
          const daysStr = specificWeekDays.join(','); // e.g. "1,3,5"
          const cron = `${minute} ${hour} * * ${daysStr}`;
           
          const job = agenda.create('send-medicine-reminder', jobData);
          job.repeatEvery(cron, { skipImmediate: true });
          await job.save();
      }
  }
  else if (frequency === 'SPECIFIC_DAY_OF_MONTH') {
       const timeDate = time ? new Date(time) : new Date();
       const minute = timeDate.getMinutes();
       const hour = timeDate.getHours();
       
       if (specificDayOfMonth) {
           const cron = `${minute} ${hour} ${specificDayOfMonth} * *`;
           const job = agenda.create('send-medicine-reminder', jobData);
           job.repeatEvery(cron, { skipImmediate: true });
           await job.save();
       }
  }
};

export const cancelReminderJobs = async (reminderId) => {
    // Agenda queries by data in the job
  await agenda.cancel({ 'data.reminderId': reminderId });
  // Also stringify comparison if needed depending on how agenda stored it, but mongoose ID usually matches
  // agenda stores data as object.
};

export default agenda;
