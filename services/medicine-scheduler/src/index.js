import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';
import reminderRoutes from './routes/reminderRoutes.js';
import { startScheduler } from './jobs/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Database
connectDB();

// Scheduler
startScheduler();

// Routes
app.use('/reminders', reminderRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'medicine-scheduler' });
});

app.listen(PORT, () => {
  console.log(`Medicine Scheduler running on port ${PORT}`);
});
