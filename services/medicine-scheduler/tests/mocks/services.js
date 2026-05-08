import { jest } from "@jest/globals";

export function createReminderModelMock() {
  const ReminderCtor = jest.fn();
  ReminderCtor.find = jest.fn();
  ReminderCtor.findOne = jest.fn();
  ReminderCtor.findOneAndUpdate = jest.fn();
  ReminderCtor.countDocuments = jest.fn();
  ReminderCtor.deleteMany = jest.fn();
  return ReminderCtor;
}

export function createReminderHistoryMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  };
}

export function createSchedulerMock() {
  return {
    scheduleReminder: jest.fn(),
    cancelReminderJobs: jest.fn(),
    startScheduler: jest.fn(),
    default: {
      define: jest.fn(),
      schedule: jest.fn(),
      create: jest.fn(),
      start: jest.fn(),
      cancel: jest.fn(),
    },
  };
}

export function chainableFind(result) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
    populate: jest.fn().mockResolvedValue(result),
  };
}
