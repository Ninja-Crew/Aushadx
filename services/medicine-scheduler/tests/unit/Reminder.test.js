import { jest } from "@jest/globals";
import mongoose from "mongoose";
import Reminder from "../../src/models/Reminder.js";

describe("Reminder Model Unit Test", () => {
  it("should invalidate a reminder without a medicineName", () => {
    const reminder = new Reminder({
      userId: "123",
      dosage: "500mg",
      frequency: "ONCE"
    });

    const error = reminder.validateSync();
    expect(error.errors.medicineName).toBeDefined();
  });

  it("should validate a correct reminder", () => {
    const reminder = new Reminder({
      userId: "123",
      medicineName: "Test Med",
      dosage: "500mg",
      frequency: "ONCE",
      status: "active",
      startDate: new Date()
    });

    const error = reminder.validateSync();
    expect(error).toBeUndefined();
  });
});
