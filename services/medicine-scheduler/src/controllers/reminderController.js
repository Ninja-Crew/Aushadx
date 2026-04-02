import Reminder from "../models/Reminder.js";
import ReminderHistory from "../models/ReminderHistory.js";
import agenda, {
  scheduleReminder,
  cancelReminderJobs,
} from "../jobs/scheduler.js";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Calculates an endDate from the user's submitted startDate + duration.
 * Always anchors to startDate so the window is relative to when the user
 * actually wants the course to begin, not when the server processes it.
 */

const DURATIONS = {
  FOR_X_DAYS: "FOR_X_DAYS",
  FOR_X_WEEKS: "FOR_X_WEEKS",
  FOR_X_MONTHS: "FOR_X_MONTHS",
  SINGLE_DAY: "SINGLE_DAY",
  UNTIL_DATE: "UNTIL_DATE",
  CONTINUOUS: "CONTINUOUS",
};

const nowUTC = () => new Date(Date.now());

const toUTC = (value) =>
  new Date(value instanceof Date ? value.getTime() : value);

const addMinutesUTC = (date, minutes) =>
  new Date(toUTC(date).getTime() + minutes * 60000);

const addDaysUTC = (date, days) => addMinutesUTC(date, days * 24 * 60);

const addWeeksUTC = (date, weeks) => addDaysUTC(date, weeks * 7);

const addMonthsUTC = (date, months) => {
  const d = toUTC(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

const END_DATE_CALCULATIONS = {
  FOR_X_DAYS: ({ startDate, durationValue }) => {
    return addDaysUTC(startDate, Number(durationValue || 0));
  },
  FOR_X_WEEKS: ({ startDate, durationValue }) => {
    return addWeeksUTC(startDate, Number(durationValue || 0));
  },
  FOR_X_MONTHS: ({ startDate, durationValue }) => {
    return addMonthsUTC(startDate, Number(durationValue || 0));
  },
  SINGLE_DAY: ({ startDate }) => {
    return addDaysUTC(startDate, 1);
  },
  UNTIL_DATE: ({ untilDate }) => {
    return toUTC(untilDate);
  },
  CONTINUOUS: ({ startDate }) => {
    return null;
  },
};
const calculateEndDate = ({
  startDate,
  duration,
  durationValue,
  untilDate,
}) => {
  const strategy = END_DATE_CALCULATIONS[duration];
  if (!strategy) throw new Error(`Unknown duration type: ${duration}`);
  return strategy({ startDate, durationValue, untilDate });
};

const resolveStatus = (calcedEndDate) => {
  const now = nowUTC();
  if (calcedEndDate && now > toUTC(calcedEndDate)) return "completed";
  return "active";
};

// ---------------------------------------------------------------------------
// CONTROLLERS
// ---------------------------------------------------------------------------

export const createReminder = async (req, res) => {
  const { userId } = req.params;
  try {
    const {
      medicineName,
      dosage,
      frequency,
      frequencyValue,
      specificWeekDays,
      specificDaysOfMonth,
      specificTimes,
      duration,
      durationValue,
      endDate: endDate, // only used when duration === 'UNTIL_DATE'
      startDate,
    } = req.body;

    if (!DURATIONS[duration])
      return res.status(400).json({ message: `Invalid duration: ${duration}` });
    // Calculate endDate anchored to the user's start, not server time
    const calcedEndDate = calculateEndDate({
      startDate,
      duration,
      durationValue,
      untilDate: endDate, // passed through as untilDate for UNTIL_DATE case
    });

    // 3. Status — handle edge case where user books a ONCE reminder in the past
    const status = resolveStatus(calcedEndDate);

    const reminder = new Reminder({
      userId,
      medicineName,
      dosage,
      frequency,
      frequencyValue,
      specificWeekDays,
      specificDaysOfMonth,
      specificTimes,
      duration,
      durationValue,
      startDate,
      endDate: calcedEndDate,
      status,
    });

    const savedReminder = await reminder.save();

    if (status === "active") {
      await scheduleReminder(savedReminder);
    }

    res.status(201).json(savedReminder);
  } catch (error) {
    console.error("[createReminder]", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateReminder = async (req, res) => {
  const { reminderId, userId } = req.params;
  try {
    const {
      medicineName,
      dosage,
      frequency,
      frequencyValue,
      specificWeekDays,
      specificDaysOfMonth,
      specificTimes,
      duration,
      durationValue,
      endDate,
      startDate,
    } = req.body;

    if (!reminderId) {
      return res
        .status(400)
        .json({ message: "Reminder ID is required for update" });
    }

    if (!DURATIONS[duration])
      return res.status(400).json({ message: `Invalid duration: ${duration}` });
    const calcedEndDate = calculateEndDate({
      startDate,
      duration,
      durationValue,
      untilDate: endDate,
    });

    const status = resolveStatus(calcedEndDate);

    const updatedReminder = await Reminder.findOneAndUpdate(
      { _id: reminderId, userId },
      {
        medicineName,
        dosage,
        frequency,
        frequencyValue,
        specificWeekDays,
        specificDaysOfMonth,
        specificTimes,
        duration,
        durationValue,
        endDate: calcedEndDate,
        startDate,
        status,
      },
      { new: true, runValidators: true },
    );

    if (!updatedReminder) {
      return res
        .status(404)
        .json({ message: "Reminder not found or access denied" });
    }

    // Always cancel existing jobs first, then reschedule only if still active
    await cancelReminderJobs(updatedReminder._id);
    if (status === "active") {
      await scheduleReminder(updatedReminder);
    }

    res.status(200).json(updatedReminder);
  } catch (error) {
    console.error("[updateReminder]", error);
    res.status(500).json({ message: error.message });
  }
};

export const getReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const [reminders, total] = await Promise.all([
      Reminder.find({ userId })
        .sort({ startDate: 1, createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      Reminder.countDocuments({ userId }),
    ]);

    res.status(200).json({
      reminders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPendingCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await ReminderHistory.countDocuments({
      userId,
      status: "scheduled",
      scheduledTime: { $lt: new Date() },
    });
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMissedReminders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      userId,
      status: { $in: ["scheduled", "missed"] },
      scheduledTime: { $lt: new Date() },
    };

    const [missedHistories, total] = await Promise.all([
      ReminderHistory.find(query)
        .sort({ status: -1, scheduledTime: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate("reminderId"),
      ReminderHistory.countDocuments(query),
    ]);

    const now = new Date();
    const notifications = missedHistories.map((history) => {
      const reminder = history.reminderId;
      const scheduledTime = new Date(history.scheduledTime);

      return {
        historyId: history._id,
        reminderId: reminder?._id ?? null,
        medicineName: reminder?.medicineName ?? "Unknown",
        scheduledTime: history.scheduledTime,
        timeSinceMissedMinutes: Math.floor((now - scheduledTime) / 60000),
        status: history.status,
        timeSinceLastTakenMinutes: reminder?.last_taken
          ? Math.floor((now - new Date(reminder.last_taken)) / 60000)
          : null,
      };
    });

    res.status(200).json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteReminder = async (req, res) => {
  try {
    const { reminderId, userId } = req.params;
    const reminder = await Reminder.findOne({ _id: reminderId, userId });

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    await cancelReminderJobs(reminder._id);
    await ReminderHistory.deleteMany({ reminderId: reminder._id });
    await reminder.deleteOne();

    res.status(200).json({ message: "Reminder deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const takeReminder = async (req, res) => {
  try {
    const { reminderId, userId } = req.params;

    // Accept an optional scheduledTime from the client so the exact slot is
    // marked taken rather than always the most recent one (handles edge cases
    // where two doses are close together).
    const { scheduledTime } = req.body || {};

    const query = { reminderId, userId, status: "scheduled" };
    if (scheduledTime) {
      query.scheduledTime = toUTC(scheduledTime);
    }

    const history = await ReminderHistory.findOne(query).sort({
      scheduledTime: 1,
    });

    if (history) {
      history.status = "taken";
      history.takenTime = new Date();
      await history.save();
    }

    const reminder = await Reminder.findOne({ _id: reminderId, userId });
    if (reminder) {
      reminder.last_taken = new Date();
      await reminder.save();
    }

    // Taking a dose should stop any pending nag loop for this reminder/slot.
    const nagCancelQuery = {
      name: "nag-medicine-reminder",
      "data.reminderId": reminderId.toString(),
    };
    if (scheduledTime) {
      nagCancelQuery["data.scheduledTime"] = toUTC(scheduledTime).toISOString();
    }
    await agenda.cancel(nagCancelQuery);

    res.status(200).json({ message: "Reminder marked as taken" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const snoozeReminder = async (req, res) => {
  try {
    const { reminderId, userId } = req.params;
    // Snooze action should always re-trigger this reminder in 5 minutes.
    const snoozeMinutes = 5;
    const { scheduledTime } = req.body;

    const reminder = await Reminder.findOne({ _id: reminderId, userId });
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    const snoozeTime = addMinutesUTC(nowUTC(), snoozeMinutes);

    const nagCancelQuery = {
      name: "nag-medicine-reminder",
      "data.reminderId": reminder._id.toString(),
    };
    // If client provides the original slot timestamp, cancel only nags tied to that slot.
    if (scheduledTime) {
      nagCancelQuery["data.scheduledTime"] = toUTC(scheduledTime).toISOString();
    }
    await agenda.cancel(nagCancelQuery);

    // Schedule a fresh main reminder in 5 minutes.
    await agenda.schedule(snoozeTime, "send-medicine-reminder", {
      reminderId: reminder._id.toString(),
      scheduledTime: snoozeTime.toISOString(),
    });

    res.status(200).json({
      message: `Reminder snoozed for ${snoozeMinutes} minutes`,
      snoozeTime,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const clearAllMissedReminders = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Mark 'missed' status as 'ignored' - preserve 'scheduled' (pending)
    const missedResult = await ReminderHistory.updateMany(
      {
        userId,
        status: "missed",
        scheduledTime: { $lt: new Date() },
      },
      { $set: { status: "ignored", takenTime: new Date() } },
    );

    // 2. Handle "unknown" (orphan) reminders - histories where parent reminder is gone
    // We find all histories for this user and identify those with missing parents
    const histories = await ReminderHistory.find({
      userId,
      status: { $in: ["scheduled", "missed"] },
    }).populate("reminderId");
    const orphanIds = histories.filter((h) => !h.reminderId).map((h) => h._id);

    if (orphanIds.length > 0) {
      await ReminderHistory.deleteMany({ _id: { $in: orphanIds } });
    }

    res.status(200).json({
      message: "Missed and unknown reminders cleared successfully",
      missedCount: missedResult.modifiedCount,
      orphanCount: orphanIds.length,
    });
  } catch (error) {
    console.error("[clearAllMissedReminders]", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteAllUserReminders = async (req, res) => {
  try {
    const { userId } = req.params;

    const userReminders = await Reminder.find({ userId }, "_id");
    await Promise.all(userReminders.map((r) => cancelReminderJobs(r._id)));

    await Promise.all([
      Reminder.deleteMany({ userId }),
      ReminderHistory.deleteMany({ userId }),
    ]);

    res
      .status(200)
      .json({ message: "All user reminders and histories deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
