import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";
import { env } from "../../config/env.js";
import { DriveClient } from "../../infra/google/driveClient.js";
import {
  DriveWatchChannelRepository,
  type DriveWatchChannel,
} from "../../repositories/driveWatchChannel.repository.js";

export interface DriveWatchStartResult {
  channelId: string;
  resourceId: string;
  resourceUri?: string;
  expiresAt: Date | null;
  pageToken: string;
}

export class DriveWatchService {
  private readonly driveClient: DriveClient;
  private readonly watchRepository: DriveWatchChannelRepository;

  constructor(
    driveClient = new DriveClient(),
    watchRepository = new DriveWatchChannelRepository(),
  ) {
    this.driveClient = driveClient;
    this.watchRepository = watchRepository;
  }

  async getActive(pool: Pool): Promise<DriveWatchChannel | null> {
    return this.watchRepository.getActive(pool);
  }

  async start(pool: Pool): Promise<DriveWatchStartResult> {
    if (!env.DRIVE_WEBHOOK_ADDRESS) {
      throw new Error("DRIVE_WEBHOOK_ADDRESS nao configurado.");
    }

    const pageToken = await this.driveClient.getStartPageToken();
    const channelId = randomUUID();
    const channelToken = env.DRIVE_WEBHOOK_TOKEN || randomUUID();
    const expirationMs = Date.now() + env.DRIVE_WATCH_TTL_SECONDS * 1000;

    const watchResponse = await this.driveClient.watchChanges({
      pageToken,
      channelId,
      address: env.DRIVE_WEBHOOK_ADDRESS,
      channelToken,
      expirationMs,
    });

    const expiresAt = watchResponse.expirationMs
      ? new Date(watchResponse.expirationMs)
      : null;

    await this.watchRepository.upsertActive(pool, {
      channelId: watchResponse.channelId,
      resourceId: watchResponse.resourceId,
      resourceUri: watchResponse.resourceUri,
      channelToken,
      webhookAddress: env.DRIVE_WEBHOOK_ADDRESS,
      pageToken,
      expiresAt,
    });

    return {
      channelId: watchResponse.channelId,
      resourceId: watchResponse.resourceId,
      resourceUri: watchResponse.resourceUri,
      expiresAt,
      pageToken,
    };
  }

  async stop(pool: Pool): Promise<{ stopped: boolean; channelId?: string }> {
    const activeChannel = await this.watchRepository.getActive(pool);
    if (!activeChannel) {
      return { stopped: false };
    }

    await this.driveClient.stopChannel(
      activeChannel.channelId,
      activeChannel.resourceId,
    );
    await this.watchRepository.markStopped(pool, activeChannel.channelId);

    return { stopped: true, channelId: activeChannel.channelId };
  }

  async renew(pool: Pool): Promise<DriveWatchStartResult> {
    const activeChannel = await this.watchRepository.getActive(pool);
    if (activeChannel) {
      await this.driveClient.stopChannel(
        activeChannel.channelId,
        activeChannel.resourceId,
      );
      await this.watchRepository.markStopped(pool, activeChannel.channelId);
    }

    return this.start(pool);
  }
}
