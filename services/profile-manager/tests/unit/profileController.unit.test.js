import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockReq, createMockRes } from "../mocks/http.js";
import { fixtures } from "../mocks/fixtures.js";
import { createProfileServiceMock } from "../mocks/services.js";

const profileServiceMock = createProfileServiceMock();

jest.unstable_mockModule(
  "../../src/services/profileService.js",
  () => profileServiceMock,
);

const profileController =
  await import("../../src/controllers/profileController.js");

function expectSuccess(res, statusCode = 200) {
  expect(res.statusCode).toBe(statusCode);
  expect(res.body.success).toBe(true);
}

function expectError(res, statusCode, message) {
  expect(res.statusCode).toBe(statusCode);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toContain(message);
}

describe("profileController unit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getProfile returns 404 when profile does not exist", async () => {
    const req = createMockReq({ params: { user_id: fixtures.userId } });
    const res = createMockRes();
    profileServiceMock.getProfile.mockResolvedValue(null);

    await profileController.getProfile(req, res);

    expectError(res, 404, "Profile not found");
  });

  it("getProfile returns profile payload", async () => {
    const req = createMockReq({ params: { user_id: fixtures.userId } });
    const res = createMockRes();
    profileServiceMock.getProfile.mockResolvedValue(fixtures.user);

    await profileController.getProfile(req, res);

    expectSuccess(res);
    expect(res.body.data.user._id).toBe(fixtures.userId);
  });

  it("getMedicalInfo returns profile medical info", async () => {
    const req = createMockReq({ params: { user_id: fixtures.userId } });
    const res = createMockRes();
    profileServiceMock.getMedicalInfo.mockResolvedValue({
      medicalInfo: { bloodType: "A+" },
    });

    await profileController.getMedicalInfo(req, res);

    expectSuccess(res);
    expect(res.body.data.profile.medicalInfo.bloodType).toBe("A+");
  });

  it("updateProfile sends body to service and returns updated profile", async () => {
    const req = createMockReq({
      params: { user_id: fixtures.userId },
      body: { name: "Updated" },
    });
    const res = createMockRes();
    profileServiceMock.updateProfile.mockResolvedValue({
      _id: fixtures.userId,
      name: "Updated",
    });

    await profileController.updateProfile(req, res);

    expectSuccess(res);
    expect(profileServiceMock.updateProfile).toHaveBeenCalledWith(
      fixtures.userId,
      { name: "Updated" },
    );
  });

  it("deleteProfile returns deleted true", async () => {
    const req = createMockReq({ params: { user_id: fixtures.userId } });
    const res = createMockRes();
    profileServiceMock.deleteProfile.mockResolvedValue({
      _id: fixtures.userId,
    });

    await profileController.deleteProfile(req, res);

    expectSuccess(res);
    expect(res.body.data.deleted).toBe(true);
  });

  it("updateFcmToken validates missing token", async () => {
    const req = createMockReq({
      params: { user_id: fixtures.userId },
      body: {},
    });
    const res = createMockRes();

    await profileController.updateFcmToken(req, res);

    expectError(res, 400, "FCM Token is required");
  });

  it("updateFcmToken adds token by default", async () => {
    const req = createMockReq({
      params: { user_id: fixtures.userId },
      body: { token: "fcm-1" },
    });
    const res = createMockRes();
    profileServiceMock.addFcmToken.mockResolvedValue({ fcmTokens: ["fcm-1"] });

    await profileController.updateFcmToken(req, res);

    expectSuccess(res);
    expect(profileServiceMock.addFcmToken).toHaveBeenCalledWith(
      fixtures.userId,
      "fcm-1",
    );
    expect(res.body.data.fcmTokens).toEqual(["fcm-1"]);
  });

  it("updateFcmToken removes token when action=remove", async () => {
    const req = createMockReq({
      params: { user_id: fixtures.userId },
      body: { token: "fcm-1", action: "remove" },
    });
    const res = createMockRes();
    profileServiceMock.removeFcmToken.mockResolvedValue({ fcmTokens: [] });

    await profileController.updateFcmToken(req, res);

    expectSuccess(res);
    expect(profileServiceMock.removeFcmToken).toHaveBeenCalledWith(
      fixtures.userId,
      "fcm-1",
    );
    expect(res.body.data.fcmTokens).toEqual([]);
  });
});
