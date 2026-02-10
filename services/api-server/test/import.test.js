import request from "supertest";
import express from "express";
import app from "../src/app.js";

describe("Import Check", () => {
  it("should pass deps", () => {
    expect(request).toBeDefined();
    expect(express).toBeDefined();
  });
});
