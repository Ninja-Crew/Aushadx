import request from "supertest";
import express from "express";
import { jest } from "@jest/globals";
import { reminderBody, reminderId, userId } from "../mocks/fixtures.js";
import {
  chainableFind,
  createReminderHistoryMock,
  createReminderModelMock,
  createSchedulerMock,
} from "../mocks/services.js";

const ReminderMock = createReminderModelMock();
const ReminderHistoryMock = createReminderHistoryMock();
const schedulerMock = createSchedulerMock();

jest.unstable_mockModule("../../src/models/Reminder.js", () => ({
  default: ReminderMock,
}));

jest.unstable_mockModule("../../src/models/ReminderHistory.js", () => ({
  default: ReminderHistoryMock,
}));

jest.unstable_mockModule("../../src/jobs/scheduler.js", () => schedulerMock);

const { default: reminderRoutes } =
  await import("../../src/routes/reminderRoutes.js");

const app = express();
app.use(express.json());
app.use("/", reminderRoutes);

describe("medicine-scheduler reminder routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    ReminderMock.mockImplementation((payload) => ({
      ...payload,
      _id: reminderId,
      save: jest.fn().mockResolvedValue({ _id: reminderId, ...payload }),
      deleteOne: jest.fn().mockResolvedValue(true),
    }));
  });

  describe("POST /:userId", () => {
    it("creates reminder and schedules active reminder", async () => {
      const res = await request(app).post(`/${userId}`).send(reminderBody);

      expect(res.status).toBe(201);
      expect(res.body.medicineName).toBe("Aspirin");
      expect(schedulerMock.scheduleReminder).toHaveBeenCalledTimes(1);
    });

    it("returns 400 for invalid duration", async () => {
      const res = await request(app)
        .post(`/${userId}`)
        .send({ ...reminderBody, duration: "INVALID_DURATION" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid duration");
    });

    it("returns 500 when persistence fails", async () => {
      ReminderMock.mockImplementationOnce((payload) => ({
        ...payload,
        save: jest.fn().mockRejectedValue(new Error("db unavailable")),
      }));

      const res = await request(app).post(`/${userId}`).send(reminderBody);

      expect(res.status).toBe(500);
      expect(res.body.message).toContain("db unavailable");
    });
  });

  describe("PUT /:reminderId/:userId", () => {
    it("updates existing reminder and reschedules", async () => {
      ReminderMock.findOneAndUpdate.mockResolvedValue({
        _id: reminderId,
        ...reminderBody,
      });

      const res = await request(app)
        .put(`/${reminderId}/${userId}`)
        .send(reminderBody);

      expect(res.status).toBe(200);
      expect(schedulerMock.cancelReminderJobs).toHaveBeenCalledWith(reminderId);
      expect(schedulerMock.scheduleReminder).toHaveBeenCalledTimes(1);
    });

    it("returns 400 for invalid duration", async () => {
      const res = await request(app)
        .put(`/${reminderId}/${userId}`)
        .send({ ...reminderBody, duration: "BAD" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when reminder not found", async () => {
      ReminderMock.findOneAndUpdate.mockResolvedValue(null);

      const res = await request(app)
        .put(`/${reminderId}/${userId}`)
        .send(reminderBody);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("not found");
    });
  });

  describe("GET routes", () => {
    it("GET /:userId returns paginated reminders", async () => {
      ReminderMock.find.mockReturnValue(
        chainableFind([{ _id: reminderId, medicineName: "Aspirin" }]),
      );
      ReminderMock.countDocuments.mockResolvedValue(1);

      const res = await request(app).get(`/${userId}?page=1&limit=10`);

      expect(res.status).toBe(200);
      expect(res.body.reminders).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it("GET /pending/count/:userId returns pending count", async () => {
      ReminderHistoryMock.countDocuments.mockResolvedValue(3);

      const res = await request(app).get(`/pending/count/${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it("GET /missed/:userId returns transformed notifications", async () => {
      const missed = [
        {
          _id: "h1",
          scheduledTime: new Date(Date.now() - 3600000),
          status: "missed",
          reminderId: {
            _id: reminderId,
            medicineName: "Aspirin",
            last_taken: new Date(Date.now() - 7200000),
          },
        },
      ];
      ReminderHistoryMock.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(missed),
      });
      ReminderHistoryMock.countDocuments.mockResolvedValue(1);

      const res = await request(app).get(`/missed/${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].medicineName).toBe("Aspirin");
    });
  });

  describe("POST action routes", () => {
    it("POST /:reminderId/take/:userId marks earliest scheduled reminder as taken", async () => {
      const history = {
        status: "scheduled",
        save: jest.fn().mockResolvedValue(true),
      };
      ReminderHistoryMock.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(history),
      });
      ReminderMock.findOne.mockResolvedValue({
        _id: reminderId,
        save: jest.fn().mockResolvedValue(true),
      });

      const res = await request(app)
        .post(`/${reminderId}/take/${userId}`)
        .send({});

      expect(res.status).toBe(200);
      expect(history.status).toBe("taken");
    });

    it("POST /:reminderId/snooze/:userId returns 404 for unknown reminder", async () => {
      ReminderMock.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post(`/${reminderId}/snooze/${userId}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Reminder not found");
    });

    it("POST /:reminderId/snooze/:userId schedules snooze job", async () => {
      ReminderMock.findOne.mockResolvedValue({ _id: reminderId, userId });

      const res = await request(app)
        .post(`/${reminderId}/snooze/${userId}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("snoozed");
    });
  });

  describe("DELETE routes", () => {
    it("DELETE /:reminderId/:userId deletes reminder and history", async () => {
      const reminder = {
        _id: reminderId,
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      ReminderMock.findOne.mockResolvedValue(reminder);

      const res = await request(app).delete(`/${reminderId}/${userId}`);

      expect(res.status).toBe(200);
      expect(schedulerMock.cancelReminderJobs).toHaveBeenCalledWith(reminderId);
      expect(ReminderHistoryMock.deleteMany).toHaveBeenCalledWith({
        reminderId,
      });
      expect(reminder.deleteOne).toHaveBeenCalled();
    });

    it("DELETE /:reminderId/:userId returns 404 for unknown reminder", async () => {
      ReminderMock.findOne.mockResolvedValue(null);

      const res = await request(app).delete(`/${reminderId}/${userId}`);

      expect(res.status).toBe(404);
    });

    it("DELETE /user/:userId deletes all user reminders and histories", async () => {
      ReminderMock.find.mockResolvedValue([{ _id: "r1" }, { _id: "r2" }]);
      ReminderMock.deleteMany.mockResolvedValue({ acknowledged: true });
      ReminderHistoryMock.deleteMany.mockResolvedValue({ acknowledged: true });

      const res = await request(app).delete(`/user/${userId}`);

      expect(res.status).toBe(200);
      expect(schedulerMock.cancelReminderJobs).toHaveBeenCalledTimes(2);
      expect(ReminderMock.deleteMany).toHaveBeenCalledWith({ userId });
      expect(ReminderHistoryMock.deleteMany).toHaveBeenCalledWith({ userId });
    });
  });

  describe("POST /missed/clear/:userId", () => {
    it("clears missed reminders and removes orphan histories", async () => {
      ReminderHistoryMock.updateMany.mockResolvedValue({ modifiedCount: 2 });
      ReminderHistoryMock.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          { _id: "h1", reminderId: null, status: "missed" },
          { _id: "h2", reminderId: { _id: reminderId }, status: "missed" },
        ]),
      });

      const res = await request(app).post(`/missed/clear/${userId}`).send({});

      expect(res.status).toBe(200);
      expect(res.body.missedCount).toBe(2);
      expect(res.body.orphanCount).toBe(1);
      expect(ReminderHistoryMock.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ["h1"] },
      });
    });
  });
});
