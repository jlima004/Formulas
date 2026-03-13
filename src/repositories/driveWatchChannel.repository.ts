import type { Pool, RowDataPacket } from "mysql2/promise";

export interface DriveWatchChannel {
  channelId: string;
  resourceId: string;
  resourceUri: string | null;
  channelToken: string | null;
  webhookAddress: string;
  pageToken: string;
  expiresAt: Date | null;
  status: "active" | "stopped";
}

interface DriveWatchChannelRow extends RowDataPacket {
  channel_id: string;
  resource_id: string;
  resource_uri: string | null;
  channel_token: string | null;
  webhook_address: string;
  page_token: string;
  expires_at: Date | null;
  status: "active" | "stopped";
}

function mapRow(row: DriveWatchChannelRow): DriveWatchChannel {
  return {
    channelId: row.channel_id,
    resourceId: row.resource_id,
    resourceUri: row.resource_uri,
    channelToken: row.channel_token,
    webhookAddress: row.webhook_address,
    pageToken: row.page_token,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

export class DriveWatchChannelRepository {
  async getActive(pool: Pool): Promise<DriveWatchChannel | null> {
    const [rows] = await pool.query<DriveWatchChannelRow[]>(
      `
      SELECT
        channel_id,
        resource_id,
        resource_uri,
        channel_token,
        webhook_address,
        page_token,
        expires_at,
        status
      FROM drive_watch_channels
      WHERE status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
      `,
    );

    if (rows.length === 0) {
      return null;
    }

    return mapRow(rows[0]);
  }

  async upsertActive(
    pool: Pool,
    params: {
      channelId: string;
      resourceId: string;
      resourceUri?: string;
      channelToken?: string;
      webhookAddress: string;
      pageToken: string;
      expiresAt: Date | null;
    },
  ): Promise<void> {
    await pool.execute(
      `
      INSERT INTO drive_watch_channels (
        channel_id,
        resource_id,
        resource_uri,
        channel_token,
        webhook_address,
        page_token,
        expires_at,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      ON DUPLICATE KEY UPDATE
        resource_id = VALUES(resource_id),
        resource_uri = VALUES(resource_uri),
        channel_token = VALUES(channel_token),
        webhook_address = VALUES(webhook_address),
        page_token = VALUES(page_token),
        expires_at = VALUES(expires_at),
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        params.channelId,
        params.resourceId,
        params.resourceUri || null,
        params.channelToken || null,
        params.webhookAddress,
        params.pageToken,
        params.expiresAt,
      ],
    );
  }

  async markStopped(pool: Pool, channelId: string): Promise<void> {
    await pool.execute(
      `
      UPDATE drive_watch_channels
      SET status = 'stopped',
          updated_at = CURRENT_TIMESTAMP
      WHERE channel_id = ?
      `,
      [channelId],
    );
  }
}
