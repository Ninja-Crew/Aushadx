import Agenda from "agenda";
import Reminder from "../models/Reminder.js";
import ReminderHistory from "../models/ReminderHistory.js";
import { sendPushNotification } from "../services/pushService.js";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const agenda = new Agenda({
  db: { address: process.env.MONGO_URI, collection: "agendaJobs" },
  processEvery: "5 second",
});

agenda.on("fail", (err, job) => {
  console.error(
    `[Agenda][fail] job="${job?.attrs?.name}" id=${job?.attrs?._id} nextRunAt=${job?.attrs?.nextRunAt?.toISOString?.() || "n/a"}`,
    err?.stack || err?.message || err,
  );
});

agenda.on("success", (job) => {
  console.log(
    `[Agenda][success] job="${job?.attrs?.name}" id=${job?.attrs?._id} lastRunAt=${job?.attrs?.lastRunAt?.toISOString?.() || "n/a"}`,
  );
});

const FREQUENCY = {
  ONCE: "ONCE",
  DAILY: "DAILY",
  EVERY_X_HOURS: "EVERY_X_HOURS",
  EVERY_X_MINUTES: "EVERY_X_MINUTES",
  X_TIMES_DAILY: "X_TIMES_DAILY",
  SPECIFIC_WEEK_DAYS: "SPECIFIC_WEEK_DAYS",
  SPECIFIC_DAYS_OF_MONTH: "SPECIFIC_DAYS_OF_MONTH",
};

const THRESHOLD_STRATEGIES = {
  [FREQUENCY.ONCE]: () => 120,
  [FREQUENCY.DAILY]: () => 120,
  [FREQUENCY.EVERY_X_HOURS]: (val) => Math.min(120, (val * 60) / 2),
  [FREQUENCY.EVERY_X_MINUTES]: (val) => val / 2,
  [FREQUENCY.X_TIMES_DAILY]: () => 60,
  [FREQUENCY.SPECIFIC_WEEK_DAYS]: () => 120,
  [FREQUENCY.SPECIFIC_DAYS_OF_MONTH]: () => 120,
};

const calculateThreshold = (frequency, frequencyValue) => {
  const strategy = THRESHOLD_STRATEGIES[frequency];
  return strategy ? strategy(frequencyValue) : 60;
};

/**
 * Returns the current UTC time as a Date.
 * Drop-in replacement for `new Date()` to make UTC intent explicit.
 */
const nowUTC = () => new Date(Date.now());

/**
 * Parses any date-like value and returns a new Date whose numeric value
 * is identical (Date objects are always UTC-epoch internally).
 * Accepts: Date | string | number
 */
const toUTC = (value) =>
  new Date(value instanceof Date ? value.getTime() : value);

/**
 * Builds a UTC Date from a base date plus explicit UTC hour/minute fields.
 * Avoids any local-time setHours() drift.
 *
 * @param {Date|string} baseDate  - Source date (year/month/day taken from its UTC values)
 * @param {number}      hours     - UTC hour  (0-23)
 * @param {number}      minutes   - UTC minute (0-59)
 * @returns {Date}
 */
const buildUTCDate = (baseDate, hours, minutes) => {
  const d = toUTC(baseDate);
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      hours,
      minutes,
      0,
      0,
    ),
  );
};

/**
 * Clears seconds and milliseconds from a Date without touching local time.
 */
const floorToMinuteUTC = (date) => {
  const d = toUTC(date);
  d.setUTCSeconds(0, 0);
  return d;
};

/**
 * Adds `minutes` to a Date and returns a new Date (UTC-safe).
 */
const addMinutesUTC = (date, minutes) =>
  new Date(toUTC(date).getTime() + minutes * 60_000);

// ---------------------------------------------------------------------------
// NAG JOB
// ---------------------------------------------------------------------------

agenda.define("nag-medicine-reminder", async (job) => {
  const jobData = job.attrs.data || {};
  const { reminderId, scheduledTime, nagCount = 0 } = jobData;

  // Always reconstruct from ISO string — guaranteed UTC
  const scheduledDate = toUTC(scheduledTime);
  const currentTime = toUTC(job.attrs.lastRunAt);

  const reminder = await Reminder.findById(reminderId);
  if (!reminder || reminder.status !== "active") return;

  console.log(
    `[Agenda][nag-medicine-reminder] reminder="${reminder.medicineName}" scheduledTime=${scheduledDate.toISOString()} currentRunAt=${currentTime.toISOString()} nagCount=${nagCount}`,
  );

  // 1. Check if already taken
  const taken = await ReminderHistory.findOne({
    reminderId,
    scheduledTime: scheduledDate,
    status: "taken",
  });
  if (taken) return;

  const threshold = calculateThreshold(
    reminder.frequency,
    reminder.frequencyValue,
  );
  const windowEnd = addMinutesUTC(scheduledDate, threshold);

  // 2. Check if missed (always evaluated first)
  if (currentTime >= windowEnd) {
    await ReminderHistory.findOneAndUpdate(
      { reminderId, scheduledTime: scheduledDate, status: "scheduled" },
      { $set: { status: "missed" } },
    );

    const message = `Safety Alert: You missed your dose of ${reminder.medicineName}. Check with your doctor before doubling up.`;
    try {
      await sendPushNotification(reminder.userId, message, reminderId, {
        status: "missed",
        notificationType: "missed",
      });
    } catch (err) {
      console.error(
        `[nag-medicine-reminder] Push failed for missed dose:`,
        err.message,
      );
    }
    return;
  }

  // 3. Nag loop
  const MAX_NAGS = 12;
  if (nagCount >= MAX_NAGS) {
    console.log(
      `[nag-medicine-reminder] Max nag count reached for ${reminderId}, stopping.`,
    );
    return;
  }

  const message = `Reminder: Don't forget to take ${reminder.medicineName} (${reminder.dosage}).`;
  try {
    await sendPushNotification(reminder.userId, message, reminderId, {
      status: "pending",
      notificationType: "nag",
    });
  } catch (err) {
    console.error(
      `[nag-medicine-reminder] Push failed for nag dose:`,
      err.message,
    );
  }

  const nextNagTime = addMinutesUTC(currentTime, 5);
  const scheduleAt = nextNagTime > windowEnd ? windowEnd : nextNagTime;

  if (scheduleAt > nowUTC() && scheduleAt <= windowEnd) {
    await agenda.schedule(scheduleAt, "nag-medicine-reminder", {
      ...jobData,
      nagCount: nagCount + 1,
    });
  }
});

// ---------------------------------------------------------------------------
// MAIN SEND JOB
// ---------------------------------------------------------------------------

agenda.define("send-medicine-reminder", async (job) => {
  const jobData = job.attrs.data || {};
  const reminderId = jobData.reminderId;

  const reminder = await Reminder.findById(reminderId);
  if (!reminder || reminder.status !== "active") return;

  const currentRunAt = toUTC(job.attrs.lastRunAt || nowUTC());
  
  // Update to use precise medicine schedule time for cron-based histories
  let scheduledDate;
  const cronFrequencies = [FREQUENCY.DAILY, FREQUENCY.X_TIMES_DAILY, FREQUENCY.SPECIFIC_WEEK_DAYS, FREQUENCY.SPECIFIC_DAYS_OF_MONTH];
  
  if (reminder.frequency === FREQUENCY.ONCE && jobData.scheduledTime) {
    scheduledDate = toUTC(jobData.scheduledTime);
  } else if (cronFrequencies.includes(reminder.frequency) && jobData.scheduledTime) {
    const origTime = toUTC(jobData.scheduledTime);
    scheduledDate = buildUTCDate(currentRunAt, origTime.getUTCHours(), origTime.getUTCMinutes());
  } else {
    scheduledDate = floorToMinuteUTC(currentRunAt);
  }

  console.log(
    `[Agenda][send-medicine-reminder] reminder="${reminder.medicineName}" scheduledTime=${scheduledDate.toISOString()} currentRunAt=${currentRunAt.toISOString()}`,
  );

  if (reminder.endDate && scheduledDate >= toUTC(reminder.endDate)) {
    await cancelReminderJobs(reminderId);
    reminder.status = "completed";
    await reminder.save();
    return;
  }

  // Atomic history creation to prevent race conditions. Include jobId to handle 
  // one per every job run.
  await ReminderHistory.findOneAndUpdate(
    { reminderId: reminder._id, jobId: job.attrs._id, scheduledTime: scheduledDate },
    { $setOnInsert: { userId: reminder.userId, status: "scheduled" } },
    { upsert: true },
  );

  const message = `Time to take ${reminder.medicineName} (${reminder.dosage})`;
  try {
    await sendPushNotification(reminder.userId, message, reminderId, {
      status: "pending",
      notificationType: "scheduled",
    });
  } catch (err) {
    console.error(`[send-medicine-reminder] Push failed:`, err.message);
  }

  const nextNag = addMinutesUTC(scheduledDate, 5);

  await agenda.schedule(nextNag, "nag-medicine-reminder", {
    reminderId,
    scheduledTime: scheduledDate.toISOString(),
  });

  if (reminder.frequency === FREQUENCY.ONCE) {
    reminder.status = "completed";
    await reminder.save();
  }
});

// ---------------------------------------------------------------------------
// SCHEDULER START
// ---------------------------------------------------------------------------

export const startScheduler = async () => {
  await agenda.start();
  console.log("Agenda scheduler started");
};

// ---------------------------------------------------------------------------
// SCHEDULING STRATEGIES
// ---------------------------------------------------------------------------

/**
 * Resolves the first fire time for a reminder in UTC.
 * specificTimes entries are treated as UTC HH:MM strings.
 */
const getStartDateTime = (reminder, timeStr) => {
  const base = toUTC(reminder.startDate);
  const source = timeStr ?? reminder.specificTimes?.[0];

  if (source) {
    const [hours, minutes] = source.split(":").map(Number);
    return buildUTCDate(base, hours, minutes);
  }

  return base;
};

const SCHEDULING_STRATEGIES = {
  /**
   * ONCE — fires exactly at the user-supplied startDate/specificTime.
   */
  [FREQUENCY.ONCE]: async (reminder, jobData) => {
    if (!reminder.specificTimes?.length) return;

    const scheduleDateTime = getStartDateTime(reminder);
    // If already past, fire immediately (tiny buffer so agenda picks it up)
    const targetTime =
      scheduleDateTime > nowUTC() ? scheduleDateTime : nowUTC();

    console.log(
      `[Scheduler][ONCE] reminder="${reminder.medicineName}" firstSchedule=${targetTime.toISOString()}`,
    );
    await agenda.schedule(targetTime, "send-medicine-reminder", {
      ...jobData,
      scheduledTime: scheduleDateTime.toISOString(),
    });
  },

  /**
   * DAILY — cron anchored to the user's UTC time of day.
   */
  [FREQUENCY.DAILY]: async (reminder, jobData) => {
    if (!reminder.specificTimes?.length) return;

    const scheduleDateTime = getStartDateTime(reminder);
    const cron = `${scheduleDateTime.getUTCMinutes()} ${scheduleDateTime.getUTCHours()} * * *`;

    console.log(
      `[Scheduler][DAILY] reminder="${reminder.medicineName}" firstSchedule=${scheduleDateTime.toISOString()} cron="${cron}"`,
    );
    const job = agenda.create("send-medicine-reminder", {
      ...jobData,
      scheduledTime: scheduleDateTime.toISOString(),
      timezone: "UTC",
    });
    job.repeatEvery(cron, {
      skipImmediate: true,
      timezone: "UTC",
      startDate: scheduleDateTime,
      endDate: reminder.endDate,
    });
    await job.save();
  },

  /**
   * EVERY_X_HOURS — repeats every N hours from the first UTC slot.
   */
  [FREQUENCY.EVERY_X_HOURS]: async (reminder, jobData) => {
    if (!reminder.frequencyValue) return;

    const scheduleDateTime = getStartDateTime(reminder);
    console.log(
      `[Scheduler][EVERY_X_HOURS] reminder="${reminder.medicineName}" firstSchedule=${scheduleDateTime.toISOString()} every=${reminder.frequencyValue}h`,
    );
    const job = agenda.create("send-medicine-reminder", {
      ...jobData,
      scheduledTime: scheduleDateTime.toISOString(),
      timezone: "UTC",
    });
    job.repeatEvery(`${reminder.frequencyValue} hours`, {
      timezone: "UTC",
      startDate: scheduleDateTime,
      endDate: reminder.endDate,
    });
    job.attrs.nextRunAt = scheduleDateTime;
    await job.save();
  },

  /**
   * EVERY_X_MINUTES — repeats every N minutes from the first UTC slot.
   */
  [FREQUENCY.EVERY_X_MINUTES]: async (reminder, jobData) => {
    if (!reminder.frequencyValue) return;

    const scheduleDateTime = getStartDateTime(reminder);
    console.log(
      `[Scheduler][EVERY_X_MINUTES] reminder="${reminder.medicineName}" firstSchedule=${scheduleDateTime.toISOString()} every=${reminder.frequencyValue}m`,
    );
    const job = agenda.create("send-medicine-reminder", {
      ...jobData,
      scheduledTime: scheduleDateTime.toISOString(),
      timezone: "UTC",
    });
    job.repeatEvery(`${reminder.frequencyValue} minutes`, {
      timezone: "UTC",
      startDate: scheduleDateTime,
      endDate: reminder.endDate,
    });
    job.attrs.nextRunAt = scheduleDateTime;
    await job.save();
  },

  /**
   * X_TIMES_DAILY — one cron job per UTC time slot.
   */
  [FREQUENCY.X_TIMES_DAILY]: async (reminder, jobData) => {
    if (!reminder.specificTimes?.length) return;

    for (const timeStr of reminder.specificTimes) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const scheduleDateTime = buildUTCDate(reminder.startDate, hours, minutes);
      const cron = `${minutes} ${hours} * * *`;

      console.log(
        `[Scheduler][X_TIMES_DAILY] reminder="${reminder.medicineName}" slot="${timeStr}" firstSchedule=${scheduleDateTime.toISOString()} cron="${cron}"`,
      );
      const job = agenda.create("send-medicine-reminder", {
        ...jobData,
        scheduledTime: scheduleDateTime.toISOString(),
        timezone: "UTC",
      });
      job.repeatEvery(cron, {
        skipImmediate: true,
        timezone: "UTC",
        startDate: scheduleDateTime,
        endDate: reminder.endDate,
      });
      await job.save();
    }
  },

  /**
   * SPECIFIC_WEEK_DAYS — cron restricted to chosen UTC days + times.
   */
  [FREQUENCY.SPECIFIC_WEEK_DAYS]: async (reminder, jobData) => {
    if (!reminder.specificWeekDays || !reminder.specificTimes?.length) return;

    for (const timeStr of reminder.specificTimes) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const scheduleDateTime = buildUTCDate(reminder.startDate, hours, minutes);
      const cron = `${minutes} ${hours} * * ${reminder.specificWeekDays.join(",")}`;

      console.log(
        `[Scheduler][SPECIFIC_WEEK_DAYS] reminder="${reminder.medicineName}" slot="${timeStr}" firstSchedule=${scheduleDateTime.toISOString()} cron="${cron}"`,
      );
      const job = agenda.create("send-medicine-reminder", {
        ...jobData,
        scheduledTime: scheduleDateTime.toISOString(),
        timezone: "UTC",
      });
      job.repeatEvery(cron, {
        skipImmediate: true,
        timezone: "UTC",
        startDate: scheduleDateTime,
        endDate: reminder.endDate,
      });
      await job.save();
    }
  },

  /**
   * SPECIFIC_DAYS_OF_MONTH — monthly cron on chosen UTC day numbers.
   */
  [FREQUENCY.SPECIFIC_DAYS_OF_MONTH]: async (reminder, jobData) => {
    if (!reminder.specificDaysOfMonth || !reminder.specificTimes?.length)
      return;

    for (const timeStr of reminder.specificTimes) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const scheduleDateTime = buildUTCDate(reminder.startDate, hours, minutes);
      const cron = `${minutes} ${hours} ${reminder.specificDaysOfMonth.join(",")} * *`;

      console.log(
        `[Scheduler][SPECIFIC_DAYS_OF_MONTH] reminder="${reminder.medicineName}" slot="${timeStr}" firstSchedule=${scheduleDateTime.toISOString()} cron="${cron}"`,
      );
      const job = agenda.create("send-medicine-reminder", {
        ...jobData,
        scheduledTime: scheduleDateTime.toISOString(),
        timezone: "UTC",
      });
      job.repeatEvery(cron, {
        skipImmediate: true,
        timezone: "UTC",
        startDate: scheduleDateTime,
        endDate: reminder.endDate,
      });
      await job.save();
    }
  },
};

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export const scheduleReminder = async (reminder) => {
  const { _id, frequency, status } = reminder;
  const reminderId = _id.toString();
  const jobData = { reminderId };

  await cancelReminderJobs(reminder._id);

  if (status && status !== "active") return;

  const strategy = SCHEDULING_STRATEGIES[frequency];
  if (strategy) {
    await strategy(reminder, jobData);
  } else {
    console.warn(
      `[SCHEDULER] No scheduling strategy found for frequency: ${frequency}`,
    );
  }
};

export const cancelReminderJobs = async (reminderId) => {
  await agenda.cancel({ "data.reminderId": reminderId.toString() });
};

export default agenda;
