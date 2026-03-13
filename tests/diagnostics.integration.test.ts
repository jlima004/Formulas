import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const pingMock = vi.fn();
const getActiveMock = vi.fn();

vi.mock("../src/io/dbConnection.js", () => ({
  getDbPool: () => ({
    query: queryMock,
  }),
}));

vi.mock("../src/io/ensureDatabaseSchema.js", () => ({
  ensureDatabaseSchema: vi.fn(async () => undefined),
}));

vi.mock("../src/infra/queue/redis.js", () => ({
  getRedisClient: () => ({
    ping: pingMock,
  }),
}));

vi.mock("../src/services/drive/driveWatch.service.js", () => ({
  DriveWatchService: class {
    async getActive() {
      return getActiveMock();
    }
  },
}));

describe("Diagnostics integration", () => {
  beforeEach(() => {
    queryMock.mockReset();
    pingMock.mockReset();
    getActiveMock.mockReset();
  });

  it("GET /api/diagnostics returns ok with mocked healthy dependencies", async () => {
    vi.resetModules();
    vi.doMock("../src/config/env.js", () => ({
      env: {
        API_MODE: "api",
        REDIS_ENABLED: true,
      },
    }));

    queryMock.mockResolvedValueOnce([[], []]);
    pingMock.mockResolvedValueOnce("PONG");
    getActiveMock.mockResolvedValueOnce({ channelId: "c1" });

    const { buildApiServer } = await import("../src/api/server.js");
    const app = await buildApiServer();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/diagnostics",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: "ok",
        services: {
          db: "up",
          redis: "up",
          watch: "up",
        },
      });
    } finally {
      await app.close();
      vi.doUnmock("../src/config/env.js");
    }
  });

  it("GET /api/diagnostics returns degraded when db fails", async () => {
    vi.resetModules();
    vi.doMock("../src/config/env.js", () => ({
      env: {
        API_MODE: "api",
        REDIS_ENABLED: false,
      },
    }));

    queryMock.mockRejectedValueOnce(new Error("db down"));

    const { buildApiServer } = await import("../src/api/server.js");
    const app = await buildApiServer();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/diagnostics",
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        status: "degraded",
        services: {
          db: "down",
          redis: "disabled",
          watch: "down",
        },
      });
    } finally {
      await app.close();
      vi.doUnmock("../src/config/env.js");
    }
  });
});
