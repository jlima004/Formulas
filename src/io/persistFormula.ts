import type { Pool, ResultSetHeader } from "mysql2/promise";
import type { FormulaParseResult } from "../types/formula.js";

export async function persistFormula(
  pool: Pool,
  result: FormulaParseResult,
): Promise<void> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [upsertResult] = await conn.execute<ResultSetHeader>(
      `
      INSERT INTO formulas (
        file_name,
        file_path,
        processed_at,
        page_count,
        formula,
        partes,
        partes_value,
        total_items,
        total_items_value,
        codigo,
        detall,
        costo,
        hoja_n,
        observacion,
        warnings_json,
        diagnostics_json,
        extraction_json,
        raw_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        file_path = VALUES(file_path),
        processed_at = VALUES(processed_at),
        page_count = VALUES(page_count),
        formula = VALUES(formula),
        partes = VALUES(partes),
        partes_value = VALUES(partes_value),
        total_items = VALUES(total_items),
        total_items_value = VALUES(total_items_value),
        codigo = VALUES(codigo),
        detall = VALUES(detall),
        costo = VALUES(costo),
        hoja_n = VALUES(hoja_n),
        observacion = VALUES(observacion),
        warnings_json = VALUES(warnings_json),
        diagnostics_json = VALUES(diagnostics_json),
        extraction_json = VALUES(extraction_json),
        raw_text = VALUES(raw_text),
        id = LAST_INSERT_ID(id)
      `,
      [
        result.metadata.fileName,
        result.metadata.filePath,
        new Date(result.metadata.processedAt),
        result.metadata.pageCount,
        result.data.formula,
        result.data.partes,
        result.data.partesValue,
        result.data.totalItems,
        result.data.totalItemsValue,
        result.data.codigo,
        result.data.detall,
        result.data.costo,
        result.data.hojaN,
        result.data.observacion,
        JSON.stringify(result.warnings),
        JSON.stringify(result.diagnostics),
        JSON.stringify(result.extraction ?? null),
        result.rawText,
      ],
    );

    const formulaId = upsertResult.insertId;

    await conn.execute(`DELETE FROM formula_items WHERE formula_id = ?`, [
      formulaId,
    ]);

    if (result.data.items.length > 0) {
      const placeholders = result.data.items
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?)")
        .join(", ");
      const values = result.data.items.flatMap((item) => [
        formulaId,
        item.itemNumber,
        item.codigo,
        item.detall,
        item.partes,
        item.partesValue,
        item.costo,
        item.costoValue,
      ]);

      await conn.execute(
        `
        INSERT INTO formula_items (
          formula_id,
          item_number,
          codigo,
          detall,
          partes,
          partes_value,
          costo,
          costo_value
        ) VALUES ${placeholders}
        `,
        values,
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
