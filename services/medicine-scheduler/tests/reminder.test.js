import request from 'supertest';
import express from 'express';
// import reminderRoutes from '../src/routes/reminderRoutes.js'; // Dynamic import needed after mocks
import { jest } from '@jest/globals';

// Mock dependencies using unstable_mockModule for ESM support
jest.unstable_mockModule('../src/models/Reminder.js', () => ({
  default: jest.fn() // Mock the class constructor
}));
jest.unstable_mockModule('../src/models/ReminderHistory.js', () => ({
  default: { find: jest.fn() } // Mock the model object logic
}));
jest.unstable_mockModule('../src/jobs/scheduler.js', () => ({
  scheduleReminder: jest.fn(),
  cancelReminderJobs: jest.fn(),
  startScheduler: jest.fn(),
  default: { define: jest.fn(), schedule: jest.fn(), create: jest.fn(), start: jest.fn() }
}));

// Dynamic imports
const { default: Reminder } = await import('../src/models/Reminder.js');
const { default: ReminderHistory } = await import('../src/models/ReminderHistory.js');
const { scheduleReminder, cancelReminderJobs } = await import('../src/jobs/scheduler.js');
const { default: reminderRoutes } = await import('../src/routes/reminderRoutes.js');

const app = express();
app.use(express.json());
app.use('/', reminderRoutes);

describe('Reminder API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation for Reminder constructor
    Reminder.mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ _id: '123', ...data }),
      deleteOne: jest.fn().mockResolvedValue(true)
    }));
  });

  describe('POST / (Create Reminder)', () => {
    it('should create a reminder with frequency X_TIMES_DAILY', async () => {
      const res = await request(app).post('/user1').send({
        medicineName: 'Aspirin',
        frequency: 'X_TIMES_DAILY',
        specificTimes: ['08:00', '20:00'],
        duration: 'FOR_X_DAYS',
        durationValue: 7
      });
      expect(res.statusCode).toEqual(201);
      expect(scheduleReminder).toHaveBeenCalledTimes(1);
    });

    it('should create a reminder with frequency EVERY_X_HOURS', async () => {
      const res = await request(app).post('/user1').send({
        medicineName: 'Antibiotic',
        frequency: 'EVERY_X_HOURS',
        frequencyValue: 6
      });
      expect(res.statusCode).toEqual(201);
      expect(scheduleReminder).toHaveBeenCalledTimes(1);
    });

    // Add validation test if your controller enforces it (currently mongoose schema does validation on save)
    // Since we mocked Reminder constructor, actual mongoose validation isn't running unless we manually mock it to throw.
    it('should handle errors during creation', async () => {
      const errorMsg = 'Validation failed';
      Reminder.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error(errorMsg))
      }));

      const res = await request(app).post('/user1').send({});
      expect(res.statusCode).toEqual(500);
      expect(res.body.message).toEqual(errorMsg);
    });
  });

  describe('GET /:userId (Get Reminders)', () => {
    it('should return paginated reminders (page 1, limit 10)', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { medicineName: 'Med 1', time: new Date() }
        ])
      };
      
      // We need to attach these to the *class* method, but Reminder is a class constructor mock.
      // In mongoose, Reminder.find() is a static method.
      Reminder.find = jest.fn().mockReturnValue(mockFind);
      Reminder.countDocuments = jest.fn().mockResolvedValue(20);

      const res = await request(app).get('/user1?page=1&limit=10');

      expect(res.statusCode).toEqual(200);
      expect(res.body.reminders).toHaveLength(1);
      expect(res.body.pagination).toEqual({
        total: 20,
        page: 1,
        limit: 10,
        totalPages: 2
      });
    });

    it('should handle pagination with page 2', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      };
      Reminder.find = jest.fn().mockReturnValue(mockFind);
      Reminder.countDocuments = jest.fn().mockResolvedValue(20);

      const res = await request(app).get('/user1?page=2&limit=10');
      
      expect(res.statusCode).toEqual(200);
      expect(mockFind.skip).toHaveBeenCalledWith(10);
    });
  });

  describe('GET /missed/:userId (Missed Reminders)', () => {
    it('should return missed reminders with calculated logic', async () => {
       const pastDate = new Date();
       pastDate.setHours(pastDate.getHours() - 2); // 2 hours ago

       const mockHistory = {
         scheduledTime: pastDate,
         reminderId: {
             medicineName: 'MissedMed',
             last_taken: new Date(pastDate.getTime() - 86400000) // Taken yesterday
         }
       };

       const mockPopulate = jest.fn().mockResolvedValue([mockHistory]);
       const mockFind = {
           populate: mockPopulate
       };
       // ReminderHistory is the object export from the mock
       ReminderHistory.find.mockReturnValue(mockFind);

       const res = await request(app).get('/missed/user1');
       
       expect(res.statusCode).toEqual(200);
       expect(res.body).toHaveLength(1);
       expect(res.body[0].medicineName).toBe('MissedMed');
       expect(res.body[0].timeSinceMissedMinutes).toBeGreaterThanOrEqual(119);
    });

    it('should return empty array if no missed reminders', async () => {
        const mockPopulate = jest.fn().mockResolvedValue([]);
        const mockFind = { populate: mockPopulate };
        ReminderHistory.find.mockReturnValue(mockFind);

        const res = await request(app).get('/missed/user1');
        expect(res.body).toEqual([]);
    });
  });

  describe('DELETE /:id (Delete Reminder)', () => {
      it('should delete existing reminder and cancel jobs', async () => {
          const mockReminderInst = {
              _id: '123',
              deleteOne: jest.fn().mockResolvedValue(true)
          };
          Reminder.findById = jest.fn().mockResolvedValue(mockReminderInst);

          const res = await request(app).delete('/123');
          
          expect(res.statusCode).toEqual(200);
          expect(cancelReminderJobs).toHaveBeenCalledWith('123');
          expect(mockReminderInst.deleteOne).toHaveBeenCalled();
      });

      it('should return 404 if reminder not found', async () => {
          Reminder.findById = jest.fn().mockResolvedValue(null);
          const res = await request(app).delete('/999');
          expect(res.statusCode).toEqual(404);
      });
  });
});
