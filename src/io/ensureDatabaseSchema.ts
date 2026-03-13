import type { Pool, RowDataPacket } from "mysql2/promise";

interface ColumnRow extends RowDataPacket {
  COLUMN_NAME: string;
}

export async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS formulas (
      id CHAR(36) PRIMARY KEY,
      formula VARCHAR(255),
      partes DECIMAL(18,4),
      hoja VARCHAR(50),
      total_items INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_formulas_formula_hoja (formula, hoja),
      INDEX idx_formulas_formula (formula),
      INDEX idx_formulas_hoja (hoja)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [columns] = await pool.query<ColumnRow[]>(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'formulas'
      AND COLUMN_NAME IN ('warnings_json', 'diagnostics_json')
  `);

  const hasWarningsColumn = columns.some(
    (column) => column.COLUMN_NAME === "warnings_json",
  );
  const hasDiagnosticsColumn = columns.some(
    (column) => column.COLUMN_NAME === "diagnostics_json",
  );

  if (hasWarningsColumn) {
    await pool.execute(`ALTER TABLE formulas DROP COLUMN warnings_json`);
  }

  if (hasDiagnosticsColumn) {
    await pool.execute(`ALTER TABLE formulas DROP COLUMN diagnostics_json`);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS formula_items (
      id CHAR(36) PRIMARY KEY,
      nome VARCHAR(255),
      formula_id CHAR(36) NOT NULL,
      item_number INT,
      codigo VARCHAR(100),
      partes INT,
      costo DECIMAL(18,4),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_formula_items_formula_id
        FOREIGN KEY (formula_id) REFERENCES formulas(id)
        ON DELETE CASCADE,
      INDEX idx_formula_items_formula_id (formula_id),
      INDEX idx_formula_items_codigo (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS drive_file_checkpoints (
      file_id VARCHAR(255) PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      last_version_key VARCHAR(255) NOT NULL,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_drive_checkpoints_processed_at (processed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS drive_watch_channels (
      channel_id VARCHAR(64) PRIMARY KEY,
      resource_id VARCHAR(255) NOT NULL,
      resource_uri VARCHAR(500),
      channel_token VARCHAR(255),
      webhook_address VARCHAR(500) NOT NULL,
      page_token VARCHAR(255) NOT NULL,
      expires_at DATETIME NULL,
      status ENUM('active', 'stopped') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_drive_watch_status (status),
      INDEX idx_drive_watch_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS drive_webhook_receipts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      channel_id VARCHAR(64) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      message_number VARCHAR(64) NOT NULL,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_drive_webhook_receipts_channel_message (channel_id, message_number),
      INDEX idx_drive_webhook_receipts_resource (resource_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
