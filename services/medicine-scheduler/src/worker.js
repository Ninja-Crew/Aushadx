import dotenv from 'dotenv';
import connectDB from './config/db.js';
import agenda, { startScheduler } from './jobs/scheduler.js';

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
const gracefulShutdown = async () => {
    console.log('[WORKER] Shutdown received. Stopping Agenda...');
    await agenda.stop();
    console.log('[WORKER] Agenda stopped. Exiting.');
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
