import { describe, expect, it, vi } from "vitest";

describe("DriveWatchService", () => {
  it("normaliza webhook e encaminha driveId no start", async () => {
    vi.resetModules();
    vi.doMock("../src/config/env.js", () => ({
      env: {
        DRIVE_WEBHOOK_ADDRESS: "https://example.com/",
        DRIVE_SHARED_DRIVE_ID: "shared-drive-123",
        DRIVE_WEBHOOK_TOKEN: "webhook-token",
        DRIVE_WATCH_TTL_SECONDS: 3600,
      },
    }));

    const getStartPageToken = vi.fn().mockResolvedValue("pt-123");
    const watchChanges = vi.fn().mockResolvedValue({
      channelId: "channel-1",
      resourceId: "resource-1",
      resourceUri: "https://googleapis.test/resource",
      expirationMs: 1_800_000_000_000,
    });

    const watchRepository = {
      getActive: vi.fn(),
      upsertActive: vi.fn().mockResolvedValue(undefined),
      markStopped: vi.fn(),
    };

    const driveClient = {
      getStartPageToken,
      watchChanges,
      stopChannel: vi.fn(),
    };

    const { DriveWatchService } =
      await import("../src/services/drive/driveWatch.service.js");

    const service = new DriveWatchService(
      driveClient as never,
      watchRepository as never,
    );

    await service.start({} as never);

    expect(getStartPageToken).toHaveBeenCalledWith({
      driveId: "shared-drive-123",
    });

    expect(watchChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        pageToken: "pt-123",
        address: "https://example.com/webhooks/drive",
        driveId: "shared-drive-123",
        channelToken: "webhook-token",
      }),
    );

    expect(watchRepository.upsertActive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        webhookAddress: "https://example.com/webhooks/drive",
        pageToken: "pt-123",
      }),
    );

    vi.doUnmock("../src/config/env.js");
  });

  it("falha quando webhook nao esta configurado", async () => {
    vi.resetModules();
    vi.doMock("../src/config/env.js", () => ({
      env: {
        DRIVE_WEBHOOK_ADDRESS: "   ",
        DRIVE_SHARED_DRIVE_ID: "",
        DRIVE_WEBHOOK_TOKEN: "",
        DRIVE_WATCH_TTL_SECONDS: 3600,
      },
    }));

    const { DriveWatchService } =
      await import("../src/services/drive/driveWatch.service.js");

    const service = new DriveWatchService(
      {
        getStartPageToken: vi.fn(),
        watchChanges: vi.fn(),
        stopChannel: vi.fn(),
      } as never,
      {
        getActive: vi.fn(),
        upsertActive: vi.fn(),
        markStopped: vi.fn(),
      } as never,
    );

    await expect(service.start({} as never)).rejects.toThrow(
      "DRIVE_WEBHOOK_ADDRESS nao configurado.",
    );

    vi.doUnmock("../src/config/env.js");
  });
});
