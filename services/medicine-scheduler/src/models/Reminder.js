import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  userId: {
    type: String, // Ensure this matches the ID format from profile-manager (UUID or ObjectId)
    required: true,
    index: true
  },
  medicineName: {
    type: String,
    required: true,
  },
  dosage: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['once', 'recurring'], // Deprecate or keep for legacy, but frequency implies this
    default: 'once',
  },
  frequency: {
    type: String,
    enum: [
      'ONCE',
      'X_TIMES_DAILY',
      'EVERY_X_HOURS',
      'EVERY_X_MINUTES',
      'SPECIFIC_WEEK_DAYS',
      'SPECIFIC_DAY_OF_MONTH'
    ],
    required: true,
    default: 'ONCE'
  },
  frequencyValue: {
    type: Number, // For X in EVERY_X...
  },
  specificWeekDays: {
    type: [Number], // 0-6 (Sun-Sat)
  },
  specificDayOfMonth: {
    type: Number, // 1-31
  },
  specificTimes: {
    type: [String], // ["08:00", "20:00"]
  },
  duration: {
    type: String,
    enum: [
      'FOR_X_DAYS',
      'FOR_X_WEEKS',
      'FOR_X_MONTHS',
      'UNTIL_DATE',
      'CONTINUOUS'
    ],
    default: 'CONTINUOUS'
  },
  durationValue: {
    type: Number,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  last_taken: {
    type: Date,
  },
  time: {
    type: Date, // Keep for ONCE
  },
  cron: {
    type: String, // Keep for internal use if needed, or derived
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Reminder = mongoose.model('Reminder', reminderSchema);

export default Reminder;
