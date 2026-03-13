import { describe, expect, it, vi } from "vitest";
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { DriveWebhookReceiptRepository } from "../src/repositories/driveWebhookReceipt.repository.js";

describe("DriveWebhookReceiptRepository", () => {
  it("retorna true quando INSERT IGNORE afeta linha", async () => {
    const repository = new DriveWebhookReceiptRepository();
    const execute = vi.fn(async () => [{ affectedRows: 1 } as ResultSetHeader]);
    const pool = { execute } as unknown as Pool;

    const isNew = await repository.registerIfNew(pool, {
      channelId: "channel-1",
      resourceId: "resource-1",
      messageNumber: "7",
    });

    expect(isNew).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("retorna false quando INSERT IGNORE nao afeta linha", async () => {
    const repository = new DriveWebhookReceiptRepository();
    const execute = vi.fn(async () => [{ affectedRows: 0 } as ResultSetHeader]);
    const pool = { execute } as unknown as Pool;

    const isNew = await repository.registerIfNew(pool, {
      channelId: "channel-1",
      resourceId: "resource-1",
      messageNumber: "7",
    });

    expect(isNew).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
