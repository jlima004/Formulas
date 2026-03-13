import { describe, expect, it } from "vitest";
import { computeDiagnosticsStatus } from "../src/api/routes/diagnostics.routes.js";

describe("computeDiagnosticsStatus", () => {
  it("retorna ok quando DB esta up e Redis esta disabled", () => {
    const status = computeDiagnosticsStatus({
      dbStatus: "up",
      redisStatus: "disabled",
      watchStatus: "down",
    });

    expect(status).toBe("ok");
  });

  it("retorna degraded quando DB esta down", () => {
    const status = computeDiagnosticsStatus({
      dbStatus: "down",
      redisStatus: "up",
      watchStatus: "up",
    });

    expect(status).toBe("degraded");
  });

  it("retorna degraded quando Redis esta down e deveria estar ativo", () => {
    const status = computeDiagnosticsStatus({
      dbStatus: "up",
      redisStatus: "down",
      watchStatus: "up",
    });

    expect(status).toBe("degraded");
  });
});
