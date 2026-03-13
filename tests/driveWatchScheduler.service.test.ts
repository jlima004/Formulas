import { describe, expect, it } from "vitest";
import { shouldRenewWatch } from "../src/services/drive/driveWatchScheduler.service.js";

describe("shouldRenewWatch", () => {
  it("retorna true quando expiracao esta dentro da janela de renovacao", () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0);
    const expiresAt = new Date(now + 5 * 60 * 1000);

    const result = shouldRenewWatch(expiresAt, now, 900);

    expect(result).toBe(true);
  });

  it("retorna false quando expiracao ainda esta fora da janela", () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0);
    const expiresAt = new Date(now + 30 * 60 * 1000);

    const result = shouldRenewWatch(expiresAt, now, 900);

    expect(result).toBe(false);
  });
});
