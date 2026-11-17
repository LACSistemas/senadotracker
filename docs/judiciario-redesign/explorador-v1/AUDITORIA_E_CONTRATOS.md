# Explorador Analítico de Tribunais V1 — Auditoria e contratos (X0)

Auditoria read-only antes de qualquer mudança de código, em 2 frentes (2 agentes de pesquisa em
paralelo): (1) implementação atual de `/judiciario/tribunais`, `/judiciario/comparar` e componentes
do Judiciário; (2) contratos de leitura reais no backend (`packages/db`). Também foi lido o programa
de redesign anterior (`docs/judiciario-redesign/J0-J6` + `j7/*`), já committado, que é o baseline
real de hoje — não um mock.

## 1. O que já existia e foi reaproveitado (não reconstruído)

| Necessidade do mandato | Contrato já existente |
|---|---|
| Listar/filtrar os 93 tribunais | `getJudiciaryTribunalDirectory` (`postgres-judiciary-serving.ts`) — busca, `branchCode`, `uf`, `sort`, paginação; já devolvia `casos_novos`/`taxa_congestionamento` por linha (extensão de J3). |
| Distribuição "cada tribunal é um ponto" | `getJudiciaryIndicatorDistribution` — já validava `comparison_eligible`, excluía `institutional_level='CONTROL'`, devolvia pontos ordenados. Construída em J7 para o beeswarm de `/judiciario`, **nunca usada em `/judiciario/tribunais` até agora**. |
| Comparar 2–3 tribunais num indicador | `getJudiciaryComparison` — até 50 ids, 1 indicador, 1 ano, já recusava indicadores `!comparison_eligible`. |
| Catálogo de indicadores com metadado de comparabilidade | `getJudiciarySourceMethodology`/`loadJudiciaryMethodology` — `jud_jn_indicator` completo, já embrulhado em `ServingResult`. |
| Abas (navegação) | `ChapterNav` já suporta `layout="tabs"` (adicionado nesta mesma sessão, P14.44, perfil de tribunal). |
| Seletor de tribunais com chips | `TribunalMultiSelect` (usado no comparador clássico). |
| Tabela alternativa responsiva | `DataTable` (table ↔ lista de cards, automático). |

## 2. 4 achados reais de integridade, corrigidos

1. **`getJudiciaryIndicatorDistribution` e `getJudiciaryComparison` nunca filtravam por
   `jud_publication_revision` ativa** — diferente de `getJudiciaryNationalSeries`/
   `getJudiciaryInstanceGroupStatistics`, que já fazem isso no mesmo arquivo. Risco real: o schema
   permite mais de uma revisão por indicador/tribunal/ano — sem o filtro, uma reemissão da
   publicação poderia misturar linhas de revisões diferentes no mesmo ponto/comparação. Corrigido
   com um helper novo (`activeObservationRevisions`, reaproveitando `activeRevision` já existente).
2. **`getJudiciaryTribunalDirectory`'s subconsultas de `casos_novos`/`taxa_congestionamento`** —
   mesmo gap, mesma correção, por tocar a mesma tabela.
3. **`getJudiciaryComparison` descartava silenciosamente qualquer tribunal selecionado sem dado
   publicado para o indicador/ano pedido** (fazia `JOIN` a partir da própria observação, não da
   lista pedida). Reescrita com `LEFT JOIN` a partir de `unnest($tribunalIds)` — agora todo tribunal
   válido aparece, com `value_numeric: null` quando não há publicação (confirmado ao vivo: STF
   aparece com `null` em Receita total, nunca desaparece nem vira zero).
4. **`TribunalMultiSelect` tinha um bug latente de parsing**: emitia N `<input name="tribunais">`
   repetidos (o navegador entrega isso como array), mas o servidor espera 1 valor único separado
   por vírgulas (`scalar()` descarta arrays). Corrigido para emitir 1 único hidden input já unido
   por vírgula — sem mudar a interface pública do componente.

Nenhuma das 4 é migration, schema novo ou mudança de collector — extensão de leitura e correção de
bug de parsing, dentro do permitido pelo mandato (§24).

## 3. Taxonomia das 4 abas — validada ao vivo, não suposta

`institutional_grain`/`statistical_universe` em `jud_jn_indicator` são texto livre — não existe
(nem deveria existir, seria schema novo) uma coluna de "aba". A lista de 19 indicadores usada nas 4
abas (Movimento processual, Tempo e congestionamento, Pessoas e estrutura, Despesas e recursos) foi
checada ao vivo contra o catálogo antes de fixar a constante estática `TRIBUNAL_TABS`:

- Todos os 19 têm `comparison_eligible = true`.
- Cobertura real em 2025 (ano-base), por indicador: de 26 tribunais (Casos pendentes por 100k — só
  Justiça Estadual) a 91 (a maioria) — `JN_REVENUE_TOTAL` é o mais esparso, 63/91.
- `JN_CASES_NEW_G1`/`G2` entraram separados (1º/2º grau) — não existe um indicador único "casos
  novos total" no catálogo; a Mesa nunca soma os dois client-side para não inventar uma agregação
  que o CNJ não publica.

## 4. Achados de contrato (confirmados ao vivo, read-only)

- `tribunal_id` é sempre `JUD:TRIBUNAL:<sigla>` (inclusive siglas com hífen, ex. `TRE-BA`) —
  permitiu resolver sigla/ramo/nome de qualquer id reaproveitando a própria busca do diretório pela
  sigla, sem precisar de uma função nova "buscar por id".
- `jud_branch.code` real: `ESTADUAL`(27), `FEDERAL`(6), `TRABALHO`(25), `ELEITORAL`(28),
  `MILITAR`(3), `SUPERIOR`(2, só STJ+STM — **não** inclui STF/TST/TSE), `STF`(1), `CNJ`(1) = 93.
- `CNJ` tem `institutional_level='CONTROL'`; `STF`/`STJ`/`STM` têm `institutional_level='SUPERIOR'`
  — confirmado por consulta direta antes de reaproveitar essa distinção no selo "Órgão de
  controle"/"Tribunal superior" dos resultados de busca.
- `getJudiciaryComparison(JN_CONGESTION_RATE, [TJES, TJRJ], 2025)` devolveu TJES 71,0% e TJRJ 66,0%
  — batendo com os números já documentados no programa J0-J7 (TJES é o máximo real da distribuição).

## 5. Dead code identificado (não removido, só evitado)

`getJudiciaryIndicatorComparison` (`postgres-judiciary-statistics.ts`) é um gêmeo de
`getJudiciaryComparison` **sem** a checagem de `comparison_eligible` e sem filtro de revisão —
exportado do pacote, mas sem nenhum importador em `apps/web` antes ou depois desta fase. A UI nova
usa exclusivamente `getJudiciaryComparison` (o guardado); o gêmeo não foi tocado nem removido (fora
do escopo autorizado — só leitura/remoção de código morto não pedida).

## 6. Decisões de design herdadas do programa anterior (reaplicadas, não revisitadas)

- Fotografia de arquivo para hero: evitada (risco de licenciamento) — mantida a mesma ilustração
  SVG já existente (`/judiciario-tribunais.svg`), em tratamento mais compacto.
- `/judiciario`, `/judiciario/temas`, `/judiciario/comparar`: intocados por este mandato.
- `seat_uf` ausente no catálogo pra maioria dos tribunais: gap pré-existente, documentado 2× no
  programa anterior, não corrigido aqui (exigiria investigação de backfill fora do escopo de um
  redesign de frontend).

**Gate X0**: inventário e contratos concluídos, 4 achados de integridade corrigidos, taxonomia
validada ao vivo. Pronto para construção.
