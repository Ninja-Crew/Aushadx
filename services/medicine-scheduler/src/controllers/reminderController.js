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
    case 'SINGLE_DAY':
      end.setHours(23, 59, 59, 999);
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
      startDate,
      time, // Legacy or for ONCE
      timezone
    } = req.body;

    let calcedEndDate = requestedEndDate;
    if (duration && duration !== 'UNTIL_DATE' && duration !== 'CONTINUOUS') {
      calcedEndDate = calculateEndDate(new Date(), duration, durationValue);
    }

    // For ONCE reminders, startDate should match the scheduled time, not default to now
    const resolvedStartDate = (frequency === 'ONCE' && !startDate && time)
      ? new Date(time)
      : startDate;

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
      startDate: resolvedStartDate,
      time,
      timezone,
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

export const updateReminder = async (req, res) => {
  const { reminderId, userId } = req.params;
  try {
    const { 
      medicineName, dosage, 
      frequency, frequencyValue, specificWeekDays, specificDayOfMonth, specificTimes,
      duration, durationValue, endDate: requestedEndDate,
      startDate,
      time,
      timezone
    } = req.body;

    if (!reminderId) {
      return res.status(400).json({ message: 'Reminder ID is required for update' });
    }

    let calcedEndDate = requestedEndDate;
    if (duration && duration !== 'UNTIL_DATE' && duration !== 'CONTINUOUS') {
      calcedEndDate = calculateEndDate(new Date(), duration, durationValue);
    }

    let newStatus = 'active';
    if (calcedEndDate && new Date() > new Date(calcedEndDate)) {
      newStatus = 'completed';
    } else if (frequency === 'ONCE' && startDate && new Date() > new Date(startDate)) {
      newStatus = 'completed';
    }

    const updatedReminder = await Reminder.findOneAndUpdate(
      { _id: reminderId, userId: userId },
      {
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
        startDate,
        time,
        timezone,
        type: frequency === 'ONCE' ? 'once' : 'recurring',
        status: newStatus
      },
      { new: true, runValidators: true }
    );

    if (!updatedReminder) {
      return res.status(404).json({ message: 'Reminder not found or access denied' });
    }
    
    // Reschedule the job
    await cancelReminderJobs(updatedReminder._id);
    await scheduleReminder(updatedReminder);

    res.status(200).json(updatedReminder);
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
        reminderId: reminder ? reminder._id : null,
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
    const { reminderId, userId } = req.params;
    const reminder = await Reminder.findOne({ _id: reminderId, userId: userId });

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

export const takeReminder = async (req, res) => {
  try {
    const { reminderId, userId } = req.params;
    
    // Find the most recent pending history record for this reminder
    const history = await ReminderHistory.findOne({
      reminderId,
      userId,
      status: 'scheduled'
    }).sort({ scheduledTime: -1 });

    if (history) {
      history.status = 'taken';
      history.takenTime = new Date();
      await history.save();
    }

    // Update the reminder's last_taken string
    const reminder = await Reminder.findOne({ _id: reminderId, userId });
    if (reminder) {
      reminder.last_taken = new Date().toISOString();
      await reminder.save();
    }

    res.status(200).json({ message: 'Reminder marked as taken' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const snoozeReminder = async (req, res) => {
  try {
    const { reminderId, userId } = req.params;
    
    // Validate reminder exists
    const reminder = await Reminder.findOne({ _id: reminderId, userId });
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    // Schedule a one-off job 10 minutes from now
    const snoozeTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const agenda = req.app.locals.agenda;

    if (agenda) {
      await agenda.schedule(snoozeTime, 'send-medicine-reminder', { reminderId: reminder._id });
    }

    res.status(200).json({ message: 'Reminder snoozed for 10 minutes', snoozeTime });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
