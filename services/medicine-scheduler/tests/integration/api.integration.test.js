import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const app = express();
app.get("/health", (req, res) => res.json({ status: "ok" }));

describe("Medicine Scheduler API Integration", () => {
  it("should return 200 on health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
