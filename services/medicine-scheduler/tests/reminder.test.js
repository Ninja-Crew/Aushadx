import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock dependencies using unstable_mockModule for ESM support
jest.unstable_mockModule('../src/models/Reminder.js', () => ({
  default: jest.fn() // Mock the class constructor
}));
jest.unstable_mockModule('../src/models/ReminderHistory.js', () => ({
  default: { find: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn(), deleteMany: jest.fn() }
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
      if (res.statusCode !== 201) console.log('POST / ERROR:', res.body);
      expect(res.statusCode).toEqual(201);
      expect(scheduleReminder).toHaveBeenCalledTimes(1);
    });

    it('should create a reminder with frequency EVERY_X_HOURS', async () => {
      const res = await request(app).post('/user1').send({
        medicineName: 'Antibiotic',
        frequency: 'EVERY_X_HOURS',
        frequencyValue: 6
      });
      if (res.statusCode !== 201) console.log('POST / ERROR:', res.body);
      expect(res.statusCode).toEqual(201);
      expect(scheduleReminder).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /:userId (Get Reminders)', () => {
    it('should return paginated reminders', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { medicineName: 'Med 1', startDate: new Date() }
        ])
      };
      
      Reminder.find = jest.fn().mockReturnValue(mockFind);
      Reminder.countDocuments = jest.fn().mockResolvedValue(20);

      const res = await request(app).get('/user1?page=1&limit=10');

      expect(res.statusCode).toEqual(200);
      expect(res.body.reminders).toHaveLength(1);
      expect(res.body.pagination.total).toBe(20);
    });
  });

  describe('GET /missed/:userId (Missed Reminders)', () => {
    it('should return missed reminders with notifications wrapper', async () => {
       const pastDate = new Date();
       pastDate.setHours(pastDate.getHours() - 2);

       const mockHistory = {
         scheduledTime: pastDate,
         status: 'scheduled',
         reminderId: {
             _id: '123',
             medicineName: 'MissedMed',
             last_taken: new Date(pastDate.getTime() - 86400000)
         }
       };

       const mockPopulate = jest.fn().mockResolvedValue([mockHistory]);
       const mockFind = {
           sort: jest.fn().mockReturnThis(),
           skip: jest.fn().mockReturnThis(),
           limit: jest.fn().mockReturnThis(),
           populate: mockPopulate
       };
       ReminderHistory.find.mockReturnValue(mockFind);
       ReminderHistory.countDocuments.mockResolvedValue(1);

       const res = await request(app).get('/missed/user1');
       
       expect(res.statusCode).toEqual(200);
       expect(res.body.notifications).toHaveLength(1);
       expect(res.body.notifications[0].medicineName).toBe('MissedMed');
    });
  });

  describe('POST /:reminderId/take/:userId (Take Reminder)', () => {
    it('should mark the EARLIEST scheduled reminder as taken', async () => {
      const mockHistory = {
        status: 'scheduled',
        save: jest.fn().mockResolvedValue(true)
      };
      const mockSort = jest.fn().mockResolvedValue(mockHistory);
      const mockFindOne = { sort: mockSort };
      
      ReminderHistory.findOne.mockReturnValue(mockFindOne);
      Reminder.findOne = jest.fn().mockResolvedValue({
        _id: '123',
        save: jest.fn().mockResolvedValue(true)
      });

      const res = await request(app).post('/123/take/user1').send({});
      
      expect(res.statusCode).toEqual(200);
      expect(mockSort).toHaveBeenCalledWith({ scheduledTime: 1 }); // Verification of my fix
      expect(mockHistory.status).toBe('taken');
    });
  });

  describe('DELETE /:reminderId/:userId (Delete Reminder)', () => {
    it('should delete existing reminder and cancel jobs', async () => {
      const mockReminderInst = {
        _id: '123',
        deleteOne: jest.fn().mockResolvedValue(true)
      };
      Reminder.findOne = jest.fn().mockResolvedValue(mockReminderInst);

      const res = await request(app).delete('/123/user1');
      
      expect(res.statusCode).toEqual(200);
      expect(cancelReminderJobs).toHaveBeenCalledWith(mockReminderInst._id);
      expect(mockReminderInst.deleteOne).toHaveBeenCalled();
    });
  });
});
