# Contratos para a P10.5 (G-prontidão)

Esta fase **não iniciou a P10.5**. Este documento diz o que a P10.5 encontra pronto e as regras para se ligar ao que a P10.4 publicou.

## 1. O que existe agora (P10.1 a P10.4)

| Item | Onde | Garantia medida |
|---|---|---|
| Identidade e histórico escolar 2007–2025 | `exec_edu_school`, `exec_edu_school_year (inep, year)` | P10.1 |
| Oferta, infraestrutura, indicadores oficiais e docentes | `exec_edu_offer_year`, `exec_edu_infra_year`, `exec_edu_ind_school/terr`, `exec_edu_doc_terr` | P10.2 e P10.3 |
| Ideb por escola, rede, município, UF, região e Brasil, 2005–2025 | `exec_edu_ideb_school (inep, year, stage)`, `exec_edu_ideb_terr (year, entity_id, stage, dep)` | Quadro 1 da Nota Informativa do Ideb 2025 reproduzido exatamente (escolas, municípios por rede, UFs) |
| Saeb agregado 2017–2025 | `exec_edu_saeb_terr (year, entity_id, dep, loc, cap, grade, subj)` | Média e níveis conferidos célula a célula, sem perda de precisão |
| Rendimento e distorção idade-série | `exec_edu_flow_school (inep, year)`, `exec_edu_flow_terr (year, entity_id, loc, dep)` | Soma 100 conferida em ~2 milhões de combinações por edição |
| Transição | `exec_edu_trn_terr (year, entity_id, loc, dep)` | ~5,3 milhões de somas de 100 conferidas |
| INSE 2019, 2021, 2023 | `exec_edu_inse_school`, `exec_edu_inse_terr` | Agregados oficiais, níveis somam 100 |
| Cobertura | `exec_edu_{ideb,saeb,flow,trn,inse}_cov (year, uf, family, lvl)` | Linhas lidas, válidas, rejeitadas, sem identidade, células publicadas e suprimidas |
| Leitura | `getIdebTerritory/School`, `getSaebTerritory`, `getFlowTerritory/School`, `getTransitionTerritory`, `getInseTerritory/School`, `getLearningCoverage` | p95 ≤ 48 ms nos 99 casos medidos (p50 ≤ 33 ms) |
| RAW | `D:\Civica\raw\inep\{ideb\2025,saeb,indicadores\arquivos}` | SHA-256 no manifesto; **não rebaixar** |
| Ids livres | dataset ≥ 80, `table_id` ≥ 106, migration v14 | conferir em `specs.ts` |

## 2. Regras de integração

1. **Chave escolar e edição.** O `inep` das tabelas de aprendizagem tem FK para `exec_edu_school` (identidade), não para `exec_edu_school_year`: o Ideb de 2005 e escolas que saíram do cadastro de uma edição existem sem linha no cadastro daquele ano. Para dependência, localização e município da escola numa edição use `exec_edu_school_year` quando existir e as colunas `dep`/`loc`/`uf` da própria linha quando não.
2. **Rede única.** 0 total, 1 federal, 2 estadual, 3 municipal, 4 privada, 5 pública (federal+estadual+municipal), 6 estadual+municipal. Qualquer nova tabela deve usar este esquema (o INSE do INEP vem com 5 e 6 invertidos e foi convertido).
3. **Resultado ≠ explicação.** Recursos (financiamento, programas, obras) podem ser exibidos **ao lado** do resultado de aprendizagem. A P10.5 não pode afirmar que um programa "melhorou" o Ideb: sem desenho causal, sem controle, a leitura é descritiva. Mesma regra para infraestrutura e docentes.
4. **Município pequeno.** Ideb e Saeb de município com participação insuficiente não são divulgados; ausência ≠ pior. Para cruzar com recursos, use apenas pares com valor nos dois lados e informe o tamanho do universo.
5. **Escala e etapa.** Nunca comparar escalas do Saeb entre séries/disciplinas, nem Ideb de etapas diferentes; nunca ranquear escolas por um número único.
6. **Ausência.** NULL = não divulgado/suprimido/não se aplica; `cells_supp` conta o sigilo. Nunca preencher.
7. **Publicação.** Datasets 75–79, fatia = edição × UF, competência `ano × 100 + 5`, `NO_CHANGE` por impressão digital, rollback exato pelo change log. **O change log guarda a linha antiga inteira**: ~1,3 KB por linha de rendimento/distorção por escola alterada; uma retificação em massa dessas tabelas custa gigabytes (ver `CUSTO_REAL_ARMAZENAMENTO_P104.md`). Valide o parser no banco de teste antes de publicar.
8. **Privacidade e licença.** Só agregados oficiais. A questão da NT 12/2023 da ANPD e da redistribuição de tabelas derivadas continua **aberta** (`PRIVACIDADE_PUBLICABILIDADE_P103.md`); a P10.4 não autoriza publicação pública.

## 3. O que a P10.5 ainda precisa construir

Qualquer coisa fora de aprendizagem e fluxo: financiamento da educação (FNDE, SIOPE, Fundeb), programas, obras, contratos e ensino superior. A P10.4 não leu nem baixou nada disso.

## 4. Armazenamento

A P10.4 usou parte da folga acumulada das ondas anteriores; o saldo está em `CUSTO_REAL_ARMAZENAMENTO_P104.md`. Piloto antes do backfill, como nas ondas anteriores.
