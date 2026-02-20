import Reminder from '../models/Reminder.js';
import ReminderHistory from '../models/ReminderHistory.js';
import { scheduleReminder, cancelReminderJobs } from '../jobs/scheduler.js';

const calculateEndDate = (startDate, duration, durationValue) => {
  if (!startDate) startDate = new Date();
  const end = new Date(startDate);
  
  switch (duration) {
    case 'FOR_X_DAYS':
      end.setDate(end.getDate() + (durationValue || 0));
      return end;
    case 'FOR_X_WEEKS':
      end.setDate(end.getDate() + (durationValue || 0) * 7);
      return end;
    case 'FOR_X_MONTHS':
      end.setMonth(end.getMonth() + (durationValue || 0));
      return end;
    case 'CONTINUOUS':
      return null;
    case 'UNTIL_DATE':
      return null; // Should be provided in request if UNTIL_DATE
    default:
      return null;
  }
};

export const createReminder = async (req, res) => {
  const { userId } = req.params;
  try {
    const { 
      medicineName, dosage, 
      frequency, frequencyValue, specificWeekDays, specificDayOfMonth, specificTimes,
      duration, durationValue, endDate: requestedEndDate,
      time // Legacy or for ONCE
    } = req.body;

    let calcedEndDate = requestedEndDate;
    if (duration && duration !== 'UNTIL_DATE' && duration !== 'CONTINUOUS') {
      calcedEndDate = calculateEndDate(new Date(), duration, durationValue);
    }

    const reminder = new Reminder({
      userId,
      medicineName,
      dosage,
      frequency,
      frequencyValue,
      specificWeekDays,
      specificDayOfMonth,
      specificTimes,
      duration,
      durationValue,
      endDate: calcedEndDate,
      time,
      type: frequency === 'ONCE' ? 'once' : 'recurring'
    });

    const savedReminder = await reminder.save();
    
    // Schedule the job
    await scheduleReminder(savedReminder);

    res.status(201).json(savedReminder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (page - 1) * limit;

    const reminders = await Reminder.find({ userId })
      .sort({ time: 1, createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
      
    const total = await Reminder.countDocuments({ userId });

    res.status(200).json({
      reminders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMissedReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find histories provided they were scheduled but not taken (and are in the past)
    // Assuming 'scheduled' means pending.
    const missedHistories = await ReminderHistory.find({ 
      userId, 
      status: 'scheduled',
      scheduledTime: { $lt: new Date() } 
    }).populate('reminderId');

    const result = missedHistories.map(history => {
      const reminder = history.reminderId;
      const now = new Date();
      const scheduledTime = new Date(history.scheduledTime);
      const timeSinceMissedMs = now - scheduledTime;
      
      let timeSinceLastTakenMs = null;
      if (reminder && reminder.last_taken) {
        timeSinceLastTakenMs = now - new Date(reminder.last_taken);
      }

      return {
        medicineName: reminder ? reminder.medicineName : 'Unknown',
        scheduledTime: history.scheduledTime,
        timeSinceMissed: timeSinceMissedMs, // in ms
        timeSinceMissedMinutes: Math.floor(timeSinceMissedMs / 1000 / 60),
        timeSinceLastTaken: timeSinceLastTakenMs, // in ms
        timeSinceLastTakenMinutes: timeSinceLastTakenMs ? Math.floor(timeSinceLastTakenMs / 1000 / 60) : null
      };
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const reminder = await Reminder.findById(id);

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    // Cancel the agenda job
    await cancelReminderJobs(reminder._id);

    // Remove from DB
    await reminder.deleteOne();

    res.status(200).json({ message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
