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
-- LISTA TUDO DA TABELA FORMULAS AGRUPADA POR ID E CONTANDO QUANTIDADE DE ITENS
SELECT formulas.*,
    COUNT(formula_items.id) AS quantidade_de_itens
FROM formulas
    LEFT JOIN formula_items ON formulas.id = formula_items.formula_id
GROUP BY formulas.id
ORDER BY formulas.id ASC;