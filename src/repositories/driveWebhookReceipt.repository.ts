import type { Pool, ResultSetHeader } from "mysql2/promise";

export class DriveWebhookReceiptRepository {
  async registerIfNew(
    pool: Pool,
    params: {
      channelId: string;
      resourceId: string;
      messageNumber: string;
    },
  ): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `
      INSERT IGNORE INTO drive_webhook_receipts (
        channel_id,
        resource_id,
        message_number
      ) VALUES (?, ?, ?)
      `,
      [params.channelId, params.resourceId, params.messageNumber],
    );

    return result.affectedRows > 0;
  }
}
