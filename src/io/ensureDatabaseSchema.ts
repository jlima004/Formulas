import type { Pool } from "mysql2/promise";

export async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS formulas (
      id CHAR(36) PRIMARY KEY,
      formula VARCHAR(255),
      partes DECIMAL(18,4),
      hoja VARCHAR(50),
      total_items INT,
      warnings_json JSON,
      diagnostics_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_formulas_formula_hoja (formula, hoja),
      INDEX idx_formulas_formula (formula),
      INDEX idx_formulas_hoja (hoja)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

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
}
