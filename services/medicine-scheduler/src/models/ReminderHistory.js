import mongoose from 'mongoose';

const reminderHistorySchema = new mongoose.Schema({
  reminderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reminder',
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  scheduledTime: {
    type: Date,
    required: true,
    index: true, // Useful for querying missed reminders
  },
  takenTime: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['scheduled', 'taken', 'missed', 'skipped'],
    default: 'scheduled',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ReminderHistory = mongoose.model('ReminderHistory', reminderHistorySchema);

export default ReminderHistory;
