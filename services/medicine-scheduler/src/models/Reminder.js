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
  frequency: {
    type: String,
    enum: [
      'ONCE',
      'DAILY',
      'X_TIMES_DAILY',
      'EVERY_X_HOURS',
      'EVERY_X_MINUTES',
      'SPECIFIC_WEEK_DAYS',
      'SPECIFIC_DAYS_OF_MONTH'
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
    required: true,
  },
  duration: {
    type: String,
    enum: [
      'SINGLE_DAY',
      'FOR_X_DAYS',
      'FOR_X_WEEKS',
      'FOR_X_MONTHS',
      'UNTIL_DATE',
      'CONTINUOUS'
    ],
    default: 'CONTINUOUS',
    required: true,
  },
  durationValue: {
    type: Number,
  },
  startDate: {
    required: true,
    type: Date,
  },
  endDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Reminder = mongoose.model('Reminder', reminderSchema);

export default Reminder;
