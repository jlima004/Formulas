import type { Pool } from "mysql2/promise";
import { parseFormulaPdf } from "../../parser/parseFormulaPdf.js";
import { persistFormula } from "../../io/persistFormula.js";

export class FormulaProcessingService {
  async processFile(filePath: string, pool: Pool): Promise<void> {
    const parseResult = await parseFormulaPdf(filePath);
    await persistFormula(pool, parseResult);
  }
}
