import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createProfileServiceMock } from "../mocks/services.js";
import { fixtures } from "../mocks/fixtures.js";

const profileServiceMock = createProfileServiceMock();

jest.unstable_mockModule(
  "../../src/services/profileService.js",
  () => profileServiceMock,
);

const { default: profileRoutes } =
  await import("../../src/routes/profileRoutes.js");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/profile", profileRoutes);
  return app;
}

describe("profile routes integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /profile/:user_id returns profile", async () => {
    profileServiceMock.getProfile.mockResolvedValue(fixtures.user);

    const response = await request(createApp()).get(
      `/profile/${fixtures.userId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(fixtures.user.email);
  });

  it("GET /profile/medical-info/:user_id returns medical info", async () => {
    profileServiceMock.getMedicalInfo.mockResolvedValue({
      medicalInfo: { bloodType: "A+" },
    });

    const response = await request(createApp()).get(
      `/profile/medical-info/${fixtures.userId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.profile.medicalInfo.bloodType).toBe("A+");
  });

  it("PUT /profile/:user_id updates profile", async () => {
    profileServiceMock.updateProfile.mockResolvedValue({
      _id: fixtures.userId,
      name: "Updated Name",
    });

    const response = await request(createApp())
      .put(`/profile/${fixtures.userId}`)
      .send({ name: "Updated Name", email: "blocked@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.data.profile.name).toBe("Updated Name");
  });

  it("PATCH /profile/fcm-token/:user_id removes token", async () => {
    profileServiceMock.removeFcmToken.mockResolvedValue({ fcmTokens: [] });

    const response = await request(createApp())
      .patch(`/profile/fcm-token/${fixtures.userId}`)
      .send({ token: "fcm-token-1", action: "remove" });

    expect(response.status).toBe(200);
    expect(response.body.data.fcmTokens).toEqual([]);
  });

  it("DELETE /profile/:user_id marks profile deleted", async () => {
    profileServiceMock.deleteProfile.mockResolvedValue({
      _id: fixtures.userId,
    });

    const response = await request(createApp()).delete(
      `/profile/${fixtures.userId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.deleted).toBe(true);
  });
});
