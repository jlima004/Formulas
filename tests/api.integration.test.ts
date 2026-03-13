import { afterEach, describe, expect, it } from "vitest";
import { buildApiServer } from "../src/api/server.js";

describe("API integration", () => {
  afterEach(async () => {
    // No-op, each test closes its own instance.
  });

  it("GET /health returns service status", async () => {
    const app = await buildApiServer();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: "ok",
        service: "formulas-api",
      });
    } finally {
      await app.close();
    }
  });

  it("POST /webhooks/drive returns 400 when required headers are missing", async () => {
    const app = await buildApiServer();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/webhooks/drive",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        message: "Headers obrigatorios ausentes.",
      });
    } finally {
      await app.close();
    }
  });
});
