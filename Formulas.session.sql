SELECT 
--   formulas.file_name,
--   formulas.file_path,
--   processed_at,
--   page_count,
--   formulas.codigo, -- verificar
--   formulas.detall, -- verificar
--   observacion,
--   warnings_json, -- verificar
--   diagnostics_json,
--   extraction_json,
--   raw_text,
--   formulas.created_at,
--   formulas.updated_at,
  formulas.id,
  formulas.formula,
  formulas.hoja_n,-- Hoja
  formulas.costo, -- INUTIL
  formulas.total_items, -- Valor em inteiro
  formulas.total_items_value, -- EXCLUIR
  formulas.partes, --- 1000 gramas 
  formulas.partes_value -- EXCLUIR
FROM formulas
JOIN formula_items ON formulas.id = formula_items.formula_id
GROUP BY formulas.id
ORDER BY formulas.id ASC;

SELECT *
FROM formula_items;

