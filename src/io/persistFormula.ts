import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { FormulaParseResult } from "../types/formula.js";

interface FormulaIdRow extends RowDataPacket {
  id: string;
}

export async function persistFormula(
  pool: Pool,
  result: FormulaParseResult,
): Promise<void> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.execute(
      `
      INSERT INTO formulas (
        id,
        formula,
        partes,
        hoja,
        total_items,
        warnings_json,
        diagnostics_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        formula = VALUES(formula),
        partes = VALUES(partes),
        hoja = VALUES(hoja),
        total_items = VALUES(total_items),
        warnings_json = VALUES(warnings_json),
        diagnostics_json = VALUES(diagnostics_json)
      `,
      [
        randomUUID(),
        result.data.formula,
        result.data.partes,
        result.data.hoja,
        result.data.totalItems,
        JSON.stringify(result.warnings),
        JSON.stringify(result.diagnostics),
      ],
    );

    const [formulaRows] = await conn.execute<FormulaIdRow[]>(
      `
      SELECT id
      FROM formulas
      WHERE formula <=> ?
        AND hoja <=> ?
      LIMIT 1
      `,
      [result.data.formula, result.data.hoja],
    );

    const formulaId = formulaRows[0]?.id;
    if (!formulaId) {
      throw new Error(
        "Nao foi possivel localizar o ID UUID da formula persistida.",
      );
    }

    await conn.execute(`DELETE FROM formula_items WHERE formula_id = ?`, [
      formulaId,
    ]);

    if (result.data.items.length > 0) {
      const placeholders = result.data.items
        .map(() => "(?, ?, ?, ?, ?, ?, ?)")
        .join(", ");
      const values = result.data.items.flatMap((item) => [
        randomUUID(),
        item.nome,
        formulaId,
        item.itemNumber,
        item.codigo,
        item.partes,
        item.costo,
      ]);

      await conn.execute(
        `
        INSERT INTO formula_items (
          id,
          nome,
          formula_id,
          item_number,
          codigo,
          partes,
          costo
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
