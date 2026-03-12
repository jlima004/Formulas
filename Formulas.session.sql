SELECT *
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

SELECT
  formulas.*,
  GROUP_CONCAT(formula_items.codigo) AS codigos_dos_itens
FROM formulas
LEFT JOIN formula_items ON formulas.id = formula_items.formula_id
GROUP BY formulas.id
ORDER BY formulas.id ASC;


