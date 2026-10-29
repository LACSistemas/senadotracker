# P12.4-R — Recuperação operacional do Censo SUAS 2024

**Data:** 28/10/2026 · **Banco:** `projetoeleitor_db` · **Schema:** `civica_exec` · **RAW/staging:** `D:\Civica`.

## Resultado executivo

`P12_4R_STATUS = PASS_WITH_DOCUMENTED_SOURCE_LIMITATION`.

A fonte oficial foi recuperada pelo repositório público da SAGICAD-MDS no GitHub e processada com os arquivos reais de 2024. Foram publicados 10 indicadores municipais em 28 fatias (Brasil + 27 UFs), com competência `202412`, período `2024-01-01` a `2025-01-01`, no dataset `121`. A publicação é transacional e o replay integral retornou `NO_CHANGE` para as 28 fatias.

O Produto A (indicadores agregados por município) está operacional. O Produto B (inventário nacional de equipamentos com relações de sede, tipo, situação e regionalização) permanece parcial: os identificadores de unidade foram validados, mas nenhuma tabela de unidade foi criada nem relações regionais foram inferidas.

## Fonte e escopo

- Repositório oficial: [Sagicad-MDS/indicadores-de-desenvolvimento](https://github.com/Sagicad-MDS/indicadores-de-desenvolvimento).
- Arquivos utilizados: CSV CRAS 2024, dicionário, leia-me, `_carregamento.R`, IDCRAS 2024, IDCREAS 2024 retificado e IDConselho 2024.
- O CSV de RH não foi baixado nem persistido, conforme o mandato.
- O script público confirma o join source-native `Nº IDENTIFICADOR do CRAS` ↔ `NU_IDENTIFICADOR` para o IDCRAS 2024; não foi feito fuzzy matching.

## Publicação

Indicadores `9101–9301` foram publicados com `ranking_allowed=false`, sem transformar ausência em zero. Contagens são derivadas de identificadores e códigos IBGE; médias IDCRAS/IDCREAS/IDConselho são os valores oficiais das planilhas municipais, não médias recalculadas com RH.

### Cobertura observada

- CRAS: 8.546 linhas finais, 8.546 identificadores únicos, 5.333 municípios IBGE6 e 5.334 códigos IBGE7 resolvidos para entidade municipal (inclui a granularidade distrital publicada na fonte).
- IDCRAS: 8.546 unidades únicas; planilha municipal com 5.571 códigos, 5.333 municípios com respondentes e 5.570 médias não nulas.
- CREAS: 2.881 unidades únicas; 2.609 municípios com média/respondentes e 2.609 sedes com unidade contada. CREAS regionais não foram multiplicados por municípios atendidos.
- IDConselho: 5.570 códigos IBGE7 únicos; 4.976 scores não nulos.
- Municípios do cadastro executivo: 5.571; todos os códigos fonte usados nos joins são determinísticos.

## Limitações explícitas

1. `Q_incompleto` marca 59 linhas CRAS como incompletas; os indicadores de contagem preservam `flags=4` nessas unidades.
2. O IDCRAS municipal contém um município com média nula e o IDCREAS contém 2.962 municípios sem score/response; esses casos permanecem ausentes, não zero.
3. `Alto Rio Novo/ES` (IBGE7 `3200359`) aparece na planilha IDCRAS, mas não tem linha CRAS correspondente no CSV final; a divergência é reportada e não imputada.
4. `Boa Esperança do Norte/MT` (IBGE7 `5101837`) existe no cadastro territorial atual, mas não tem observação no Censo SUAS 2024; permanece sem valor.
5. Nenhum inventário de equipamento ou relação regional foi inventado a partir de nomes.

## Gates

| Gate | Resultado |
|---|---|
| DATABASE_GUARD | PASS — `current_database()=projetoeleitor_db` |
| SOURCE_AUTHORITY / RAW_PROVENANCE | PASS — 7 hashes e manifestos no D: |
| CRAS/IDCRAS/IDCREAS/IDConselho ingestion | PASS — dados reais, sem RH |
| MUNICIPALITY_LINKAGE | PASS — IBGE7/IBGE6 determinísticos |
| SOURCE_RECONCILIATION | PASS_WITH_DOCUMENTED_LIMITATION |
| NO_DOUBLE_COUNTING | PASS — IDs únicos e CREAS por sede |
| IDEMPOTENT_REPLAY | PASS — 28/28 `NO_CHANGE` |
| STORAGE_SAFETY | PASS — envelope P12.4-R de 250 MB não excedido |
| P12.2 regression | PASS — IDs 9001–9006 preservados |

P12.5 não foi iniciado.
