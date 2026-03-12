-- LISTA TUDO DA TABELA FORMULAS
SELECT *
FROM formulas;

-- LISTA TUDO DA TABELA FORMULA_ITEMS
SELECT *
FROM formula_items;

-- LISTA TUDO DA TABELA FORMULAS COM ID = 1
SELECT *
FROM formulas
WHERE id = 1;

-- LISTA CAMPOS SELECIONADOS DA TABELA FORMULAS
SELECT 
  formulas.id,
  formulas.formula,
  -- formulas.hoja_n,
  -- formulas.item_number,
  -- inutil -formulas.costo,
  -- formulas.costo_value,
  formulas.total_items,
  formulas.total_items_value,
  formulas.partes,
  formulas.partes_value,
  formulas.partes*costo_value AS total_value
FROM formulas
JOIN formula_items ON formulas.id = formula_items.formula_id
ORDER BY formulas.id ASC;

SELECT
  formulas.*,
  COUNT(formula_items.id) AS quantidade_de_itens
FROM formulas
LEFT JOIN formula_items ON formulas.id = formula_items.formula_id
GROUP BY formulas.id
ORDER BY formulas.id ASC;


