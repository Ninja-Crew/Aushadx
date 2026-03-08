import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { startScheduler } from './jobs/scheduler.js';

dotenv.config();

// Connect to Database
connectDB().then(() => {
  console.log('[WORKER] Connected to MongoDB');
  // Start processing Agenda Jobs
  startScheduler();
}).catch(err => {
  console.error('[WORKER] MongoDB connection error:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('[WORKER] SIGTERM received. Shutting down gracefully.');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[WORKER] SIGINT received. Shutting down gracefully.');
    process.exit(0);
});
