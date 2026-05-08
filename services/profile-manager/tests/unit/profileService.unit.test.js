import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createUserModelMock } from "../mocks/services.js";
import { chainableQuery } from "../mocks/query.js";

const userModelMock = createUserModelMock();

jest.unstable_mockModule("../../src/models/User.js", () => ({
  default: userModelMock,
}));

const profileService = await import("../../src/services/profileService.js");

describe("profileService unit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("getProfile selects safe fields", async () => {
    const profile = { _id: "u1", email: "john@example.com" };
    userModelMock.findById.mockReturnValue(chainableQuery(profile));

    const result = await profileService.getProfile("u1");

    expect(result).toEqual(profile);
  });

  it("getMedicalInfo fetches only medicalInfo projection", async () => {
    const payload = { medicalInfo: { bloodType: "A+" } };
    userModelMock.findById.mockResolvedValue(payload);

    const result = await profileService.getMedicalInfo("u1");

    expect(userModelMock.findById).toHaveBeenCalledWith("u1", {
      medicalInfo: 1,
    });
    expect(result).toEqual(payload);
  });

  it("updateProfile filters unallowed fields", async () => {
    const updated = { _id: "u1", name: "Jane" };
    userModelMock.findByIdAndUpdate.mockReturnValue(chainableQuery(updated));

    await profileService.updateProfile("u1", {
      name: "Jane",
      email: "blocked@example.com",
      roles: ["admin"],
      medicalInfo: { bloodType: "B+" },
    });

    expect(userModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
      "u1",
      {
        name: "Jane",
        medicalInfo: { bloodType: "B+" },
      },
      { new: true, runValidators: true },
    );
  });

  it("deleteProfile continues profile deletion when scheduler cleanup fails", async () => {
    global.fetch.mockRejectedValue(new Error("network"));
    userModelMock.findByIdAndDelete.mockResolvedValue({ _id: "u1" });

    const result = await profileService.deleteProfile("u1");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/reminders/user/u1"),
      { method: "DELETE" },
    );
    expect(userModelMock.findByIdAndDelete).toHaveBeenCalledWith("u1");
    expect(result).toEqual({ _id: "u1" });
  });

  it("addFcmToken de-duplicates token globally and upserts for user", async () => {
    userModelMock.updateMany.mockResolvedValue({ modifiedCount: 1 });
    userModelMock.findByIdAndUpdate.mockReturnValue(
      chainableQuery({ fcmTokens: ["fcm-1"] }),
    );

    const result = await profileService.addFcmToken("u1", "fcm-1");

    expect(userModelMock.updateMany).toHaveBeenCalledWith(
      { fcmTokens: "fcm-1", _id: { $ne: "u1" } },
      { $pull: { fcmTokens: "fcm-1" } },
    );
    expect(result.fcmTokens).toEqual(["fcm-1"]);
  });

  it("removeFcmToken removes token for user", async () => {
    userModelMock.findByIdAndUpdate.mockReturnValue(
      chainableQuery({ fcmTokens: [] }),
    );

    const result = await profileService.removeFcmToken("u1", "fcm-1");

    expect(userModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
      "u1",
      { $pull: { fcmTokens: "fcm-1" } },
      { new: true },
    );
    expect(result.fcmTokens).toEqual([]);
  });
});
