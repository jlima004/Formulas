export async function ensureDatabaseSchema(pool) {
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS formulas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      file_path TEXT,
      processed_at DATETIME NOT NULL,
      page_count INT,
      formula VARCHAR(255),
      partes VARCHAR(50),
      partes_value DECIMAL(18,4),
      total_items VARCHAR(50),
      total_items_value INT,
      codigo VARCHAR(100),
      detall VARCHAR(255),
      costo VARCHAR(50),
      hoja_n VARCHAR(50),
      observacion TEXT,
      warnings_json JSON,
      diagnostics_json JSON,
      extraction_json JSON,
      raw_text LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_formulas_file_name (file_name),
      INDEX idx_formulas_formula (formula),
      INDEX idx_formulas_processed_at (processed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
    await pool.execute(`
    CREATE TABLE IF NOT EXISTS formula_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formula_id INT NOT NULL,
      item_number INT,
      codigo VARCHAR(100),
      detall VARCHAR(255),
      partes VARCHAR(50),
      partes_value DECIMAL(18,4),
      costo VARCHAR(50),
      costo_value DECIMAL(18,4),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_formula_items_formula_id
        FOREIGN KEY (formula_id) REFERENCES formulas(id)
        ON DELETE CASCADE,
      INDEX idx_formula_items_formula_id (formula_id),
      INDEX idx_formula_items_codigo (codigo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
