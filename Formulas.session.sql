-- Auditoria 1: validar formato UUID em formulas.id e formula_items.id/formula_id
SELECT 'formulas.id' AS coluna,
  COUNT(*) AS total,
  SUM(
    id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) AS uuids_validos,
  SUM(
    NOT (
      id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    )
  ) AS uuids_invalidos
FROM formulas
UNION ALL
SELECT 'formula_items.id' AS coluna,
  COUNT(*) AS total,
  SUM(
    id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) AS uuids_validos,
  SUM(
    NOT (
      id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    )
  ) AS uuids_invalidos
FROM formula_items
UNION ALL
SELECT 'formula_items.formula_id' AS coluna,
  COUNT(*) AS total,
  SUM(
    formula_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) AS uuids_validos,
  SUM(
    NOT (
      formula_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    )
  ) AS uuids_invalidos
FROM formula_items;
-- Auditoria 2: checar integridade referencial (itens órfãos)
SELECT fi.id AS formula_item_id,
  fi.formula_id
FROM formula_items fi
  LEFT JOIN formulas f ON f.id = fi.formula_id
WHERE f.id IS NULL
ORDER BY fi.id;
-- Auditoria 3: contagem rápida de itens órfãos
SELECT COUNT(*) AS total_itens_orfaos
FROM formula_items fi
  LEFT JOIN formulas f ON f.id = fi.formula_id
WHERE f.id IS NULL;
-- Auditoria 4: possíveis duplicidades por formula + hoja
SELECT formula,
  hoja,
  COUNT(*) AS total_registros,
  GROUP_CONCAT(
    id
    ORDER BY id SEPARATOR ', '
  ) AS ids
FROM formulas
GROUP BY formula,
  hoja
HAVING COUNT(*) > 1
ORDER BY total_registros DESC,
  formula,
  hoja;
-- Auditoria 5: visão resumida por formula + hoja com quantidade de itens
SELECT f.id,
  f.formula,
  f.hoja,
  COUNT(fi.id) AS quantidade_de_itens
FROM formulas f
  LEFT JOIN formula_items fi ON fi.formula_id = f.id
GROUP BY f.id,
  f.formula,
  f.hoja
ORDER BY f.formula,
  f.hoja,
  f.id;
-- Saúde geral: uma linha por critério com status PASS/FAIL
SELECT checks.criterio,
  CASE
    WHEN checks.violacoes = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  checks.total,
  checks.violacoes
FROM (
    SELECT 'uuid_formulas_id' AS criterio,
      COUNT(*) AS total,
      COALESCE(
        SUM(
          NOT (
            id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          )
        ),
        0
      ) AS violacoes
    FROM formulas
    UNION ALL
    SELECT 'uuid_formula_items_id' AS criterio,
      COUNT(*) AS total,
      COALESCE(
        SUM(
          NOT (
            id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          )
        ),
        0
      ) AS violacoes
    FROM formula_items
    UNION ALL
    SELECT 'uuid_formula_items_formula_id' AS criterio,
      COUNT(*) AS total,
      COALESCE(
        SUM(
          NOT (
            formula_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          )
        ),
        0
      ) AS violacoes
    FROM formula_items
    UNION ALL
    SELECT 'fk_formula_items_formula_id' AS criterio,
      COUNT(*) AS total,
      COUNT(*) AS violacoes
    FROM formula_items fi
      LEFT JOIN formulas f ON f.id = fi.formula_id
    WHERE f.id IS NULL
    UNION ALL
    SELECT 'duplicidade_formula_hoja' AS criterio,
      COUNT(*) AS total,
      COUNT(*) AS violacoes
    FROM (
        SELECT formula,
          hoja
        FROM formulas
        GROUP BY formula,
          hoja
        HAVING COUNT(*) > 1
      ) duplicados
  ) checks;
-- Saúde geral (resumo único): PASS apenas se todos os critérios passarem
SELECT CASE
    WHEN MIN(pass_flag) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END AS status_geral
FROM (
    SELECT CASE
        WHEN COALESCE(
          SUM(
            NOT (
              id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
            )
          ),
          0
        ) = 0 THEN 1
        ELSE 0
      END AS pass_flag
    FROM formulas
    UNION ALL
    SELECT CASE
        WHEN COALESCE(
          SUM(
            NOT (
              id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
            )
          ),
          0
        ) = 0 THEN 1
        ELSE 0
      END AS pass_flag
    FROM formula_items
    UNION ALL
    SELECT CASE
        WHEN COALESCE(
          SUM(
            NOT (
              formula_id REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
            )
          ),
          0
        ) = 0 THEN 1
        ELSE 0
      END AS pass_flag
    FROM formula_items
    UNION ALL
    SELECT CASE
        WHEN COUNT(*) = 0 THEN 1
        ELSE 0
      END AS pass_flag
    FROM formula_items fi
      LEFT JOIN formulas f ON f.id = fi.formula_id
    WHERE f.id IS NULL
    UNION ALL
    SELECT CASE
        WHEN COUNT(*) = 0 THEN 1
        ELSE 0
      END AS pass_flag
    FROM (
        SELECT formula,
          hoja
        FROM formulas
        GROUP BY formula,
          hoja
        HAVING COUNT(*) > 1
      ) duplicados
  ) health_checks;