import type { Pool, RowDataPacket } from "mysql2/promise";

interface DriveCheckpointRow extends RowDataPacket {
  file_id: string;
  last_version_key: string;
}

export class DriveFileCheckpointRepository {
  async getVersionMapByFileIds(
    pool: Pool,
    fileIds: string[],
  ): Promise<Map<string, string>> {
    const versionMap = new Map<string, string>();
    if (fileIds.length === 0) {
      return versionMap;
    }

    const placeholders = fileIds.map(() => "?").join(", ");
    const [rows] = await pool.query<DriveCheckpointRow[]>(
      `
      SELECT file_id, last_version_key
      FROM drive_file_checkpoints
      WHERE file_id IN (${placeholders})
      `,
      fileIds,
    );

    for (const row of rows) {
      versionMap.set(row.file_id, row.last_version_key);
    }

    return versionMap;
  }

  async upsert(
    pool: Pool,
    params: {
      fileId: string;
      fileName: string;
      lastVersionKey: string;
    },
  ): Promise<void> {
    await pool.execute(
      `
      INSERT INTO drive_file_checkpoints (
        file_id,
        file_name,
        last_version_key
      ) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        file_name = VALUES(file_name),
        last_version_key = VALUES(last_version_key),
        processed_at = CURRENT_TIMESTAMP
      `,
      [params.fileId, params.fileName, params.lastVersionKey],
    );
  }
}
