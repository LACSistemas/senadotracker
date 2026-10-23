# Errata — reconciliação federal da P9.5

## O que estava errado

A versão anterior de `reconciliacao_financeira_seguranca.md` (§4 e §5) mostrava o Portal da Transparência R$ 2–4 bi acima da DCA da União (ex.: 2019 empenhado R$ 13,19 bi × R$ 10,23 bi; 2020 R$ 15,66 bi × R$ 12,48 bi), contradizendo o relatório principal (2020/2021 idênticos ao centavo; 2019 −2,2%).

**Causa: erro da consulta do relatório, não dos dados nem do parser.** A tabela `exec_fin_exec` guarda a execução detalhada de TRÊS esferas na função 06: União (entidade Brasil, `kind = 1`), Pernambuco (`kind = 3`) e prefeituras do RS (`kind = 4`). As consultas de `financas-report.ts` (§4 e §5) e as da leitura `getSecurityFinanceUnion` somavam `funcao = 6` **sem filtrar a entidade Brasil**; depois que PE e RS foram publicados, entraram no "Portal". Prova (empenhado, modalidade ≠ 91):

| exercício | União | Estado de PE | Prefeituras do RS | Σ (o que a tabela errada mostrava) |
|---|---:|---:|---:|---:|
| 2019 | 10.004.982.274,18 | 2.892.252.835,04 | 293.605.838,75 | 13.190.840.947,97 |
| 2020 | 12.482.047.199,68 | 2.880.151.335,77 | 297.063.967,61 | 15.659.262.503,06 |
| 2021 | 11.866.094.291,78 | 2.884.598.185,52 | 291.246.461,74 | 15.041.938.939,04 |

A soma de 2019 coincide exatamente com o valor da tabela errada (R$ 13.190.840.947,97). Eram esses os "bilhões de diferença".

## Verificações pedidas (1–8)

1. **Filtros contábeis diferentes?** Sim, o erro era de filtro (entidade). Estágios, intra e função estavam corretos.
2. **Funcional × institucional?** Ambas as consultas eram funcionais (função 06); a institucional (MJSP) é outra consulta e não entrou na tabela.
3. **Intra-orçamentárias?** Tratadas corretamente: Portal `modalidade <> 91` ↔ DCA I-E "exceto intra-orçamentárias".
4. **Estágios confundidos?** Não: empenhado, liquidado e pago em colunas distintas.
5. **Total de várias funções?** Não: `funcao = 6` em ambos os lados.
6. **Relatório principal reproduz o SQL?** O relatório principal usou a consulta ad hoc correta (feita antes de PE/RS existirem em `exec_fin_exec`); a tabela do arquivo de reconciliação usava a consulta nova sem filtro de entidade. Agora ambas coincidem.
7. **Tabela gerada com filtro incorreto?** Sim (item acima).
8. **Erro real no parser/agregador?** Não: Σ mensal por entidade reproduz a DCA ao centavo em 2020 e 2021.

## Correções

- `scripts/exec/financas-report.ts`: filtro `entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1)` nas consultas federais (§4, §5).
- `packages/db/src/exec/financas-read.ts` (`getSecurityFinanceUnion`): mesmo filtro em todas as consultas de `exec_fin_exec`/`exec_fin_dot` (a visão por órgão já excluía PE/RS por junção, mas natureza e contagem de meses não). Teste de regressão em `tests/integration/financas-p95.test.ts` (inclui uma linha de função 06 de entidade estadual que não pode aparecer na visão federal).
- `reconciliacao_financeira_seguranca.md` regenerado; nenhum dado foi ajustado.

## Resultado corrigido (empenhado / liquidado / pago, União, função 06, modalidade ≠ 91, Σ dos 12 meses × DCA I-E da União)

| exercício | empenhado: Portal − DCA | liquidado | pago |
|---|---:|---:|---:|
| 2019 | −R$ 228.737.280,43 (−2,2%) | −R$ 18.263.716,15 | −R$ 4.230.061,53 |
| 2020 | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| 2021 | −R$ 0,01 | R$ 0,00 | R$ 0,00 |
| 2022 | −R$ 11.239,72 | −R$ 11.239,72 | −R$ 11.239,73 |
| 2023 | −R$ 950.000,11 | −R$ 950.000,05 | −R$ 0,05 |
| 2024 | −R$ 369.119,41 | −R$ 375.792,95 | −R$ 296.988,64 |
| 2025 | −R$ 29.998.371,08 | −R$ 29.140.320,50 | −R$ 28.976.582,92 |

Orçamento "realizado" (arquivo anual) = pago (Σ mensal, todas as modalidades), diferença R$ 0,00 em 2019–2025. O "orçamento empenhado" difere do Σ mensal só em 2023 (−R$ 592.000,81). Com a consulta corrigida, 2014–2018 também fecham: empenhado −R$ 1.062 (2014), −R$ 134 mil (2015), R$ 0,00 (2016 e 2017), −R$ 300 mil (2018); pago em centavos ou até R$ 3,2 mil. A única divergência material é **2019** (−2,2% no empenhado), real e sem explicação na fonte.

## SQL de conferência reproduzível

```sql
-- Σ mensal da União (entidade Brasil), função 06, exceto intra, em centavos, por exercício
SELECT x.exercicio,
       sum(x.emp)  FILTER (WHERE x.modalidade <> 91) AS emp,
       sum(x.liq)  FILTER (WHERE x.modalidade <> 91) AS liq,
       sum(x.pago) FILTER (WHERE x.modalidade <> 91) AS pago
FROM civica_exec.exec_fin_exec x
WHERE x.funcao = 6
  AND x.entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1)   -- ESTE filtro faltava
GROUP BY 1 ORDER BY 1;

-- DCA I-E da União, função 06 (indicadores 7001/7002/7003: numerador em reais)
SELECT extract(year FROM v.period_start)::int AS exercicio,
       round(max(v.numerator) FILTER (WHERE v.indicator_id = 7001) * 100) AS emp,
       round(max(v.numerator) FILTER (WHERE v.indicator_id = 7002) * 100) AS liq,
       round(max(v.numerator) FILTER (WHERE v.indicator_id = 7003) * 100) AS pago
FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id)
WHERE e.kind = 1 AND v.indicator_id IN (7001, 7002, 7003) GROUP BY 1 ORDER BY 1;

-- Prova da causa: mesma soma por esfera
SELECT e.kind, x.exercicio, sum(x.emp) FILTER (WHERE x.modalidade <> 91) AS emp
FROM civica_exec.exec_fin_exec x JOIN civica_exec.exec_entity e USING (entity_id)
WHERE x.funcao = 6 GROUP BY 1, 2 ORDER BY 2, 1;
```
