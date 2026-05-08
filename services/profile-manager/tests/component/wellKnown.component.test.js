import express from "express";
import request from "supertest";
import { describe, it, expect, jest } from "@jest/globals";

const keysMock = {
  getJWKS: () => ({
    keys: [
      {
        kty: "RSA",
        kid: "kid-1",
        use: "sig",
        alg: "RS256",
      },
    ],
  }),
};

jest.unstable_mockModule("../../src/utils/keys.js", () => keysMock);

const { default: wellKnownRoutes } =
  await import("../../src/routes/wellKnownRoutes.js");

function createApp() {
  const app = express();
  app.use("/.well-known", wellKnownRoutes);
  return app;
}

describe("well-known component", () => {
  it("serves jwks payload", async () => {
    const response = await request(createApp()).get("/.well-known/jwks.json");

    expect(response.status).toBe(200);
    expect(response.body.keys[0].kid).toBe("kid-1");
  });
});
