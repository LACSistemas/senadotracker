# Inventário de reuso do Cívica para a Educação (G1)

Medido em 2026-10-24 por leitura do repositório, do schema `civica_exec` (PostgreSQL 17.4, `projetoeleitor_db`) e do RAW em `D:\Civica\raw`. Nada foi escrito em produção.

**Denominador:** 35 componentes auditados (lista abaixo). **Q1** usa este denominador (ver §Resumo).

Legenda: R = `READY_TO_REUSE` · A = `REUSE_WITH_ADAPTATION` · P = `PARTIAL` · E = `NEEDS_EXTENSION` · N = `NOT_PRESENT` · V = `NOT_VERIFIED`.

| # | Componente | Caminho / tabela | Fonte | Evidência (medida agora) | Estado | Adaptação necessária | Risco de regressão | Consumidor |
|---|---|---|---|---|---|---|---|---|
| C01 | Território UF/município | `exec_entity` (kind 3 UF, 4 município) | IBGE | 5.631 linhas; `UNIQUE(kind, ibge7)`, `ibge6` gerado | R | nenhuma (escola vira entidade própria, ver C02) | baixo | todas |
| C02 | Entidade "escola" | `exec_entity.kind` tem `CHECK (kind BETWEEN 1 AND 5)` | — | ddl-v1 linha 15 | E | **não** estender `exec_entity`; criar `exec_edu_school` (ver `arquitetura_educacao_modelo_d.md`). Estender o CHECK exigiria migration e tocaria todas as leituras de Saúde/Segurança | alto se estendido; baixo com tabelas novas | P10.1 |
| C03 | Códigos externos | `exec_entity_external_id` (source, code, valid_from/to) | IBGE/SIAFI | 11.169 linhas | A | novos `source` (ex.: `inep_municipio`, `siope_ibge6`); a regra IBGE6↔IBGE7 já existe (`ibge6` gerado) | baixo | P10.5 |
| C04 | População | `exec_territory_population` (entity, year, source, value) | SIDRA | 123.073 linhas, 2001–2026; **sem 2022–2023** (sem estimativa oficial; sem interpolar) | P | falta população por faixa etária (SIDRA t/9514, Censo 2022, testada: HTTP 200 por município) | baixo | P10.9 |
| C05 | Definição de indicadores | `exec_ind_def` | — | 502 definições (domínio 1 saúde: 40, ids 5–733; domínio 3 segurança: 462, ids 3001–8724); **`DOMAIN.educacao = 2` já reservado em código** e sem definições; `indicator_id` é `smallint` (livre: 9001–32767) | R | faixa de ids própria; bits `FLAG` existentes servem | baixo | todas |
| C06 | Valores de indicadores | `exec_ind_value` | — | 14.172.050 linhas, 2,4 GB | R | nenhuma | baixo | todas |
| C07 | Últimos valores | `exec_ind_latest` | — | 755.250 linhas | R | `refreshLatest` já genérico | baixo | todas |
| C08 | Códigos de referência | `exec_ref_code` (domínio, código, validade) | — | 117 linhas; domínio 30 já traz **12 Educação** e subfunções só de 06 | R | novos domínios (dependência, etapa, rede…) | baixo | P10.1+ |
| C09 | Fatos financeiros | `exec_fin_fact` (entity, exercício, período, conta, coluna) | Siconfi DCA/RREO | 5.481.475 linhas; **conta 72 = função 12 para 5.204–5.571 entes/ano, 2014–2025; soma EMP/LIQ/PAG idêntica ao RAW em 36/36 combinações** (`siconfi_fn12_raw_x_banco.json`) | R | só subfunções 12.xxx faltam (C23) | baixo | P10.5 |
| C10 | Cobertura financeira | `exec_fin_cov` | Siconfi | 81.786 linhas; coluna `fn06 CHECK (0,1)` | A | generalizar o flag de função (nova coluna ou tabela de cobertura por função) | médio (muda tabela usada pela Segurança) | P10.5 |
| C11 | Execução/dotação federais | `exec_fin_exec`, `exec_fin_dot` (função, subfunção, programa, ação, órgão) | Portal da Transparência | 127.736 e 2.030 linhas | R | filtro por função 12/órgão 26000 na leitura | baixo | P10.6 |
| C12 | Contratos classificados | `exec_fin_contract` | PNCP | 165.150 linhas; `theme smallint` único, `org_kind` de segurança, `link ∈ {1,2,3}` | A | tema múltiplo e tipos de órgão de educação (ver `plano_reuso_pncp_educacao.md`) | médio | P10.7 |
| C13 | Fornecedores | `exec_fin_supplier` (cnpj, name) | PNCP | 26.209 linhas | R | nenhuma (só PJ; sem PF) | baixo | P10.7 |
| C14 | Órgãos | `exec_fin_org` | Siconfi/federal | 1.187 linhas | R | níveis já genéricos | baixo | P10.5/7 |
| C15 | Transferências (convênios) | `exec_fin_transfer` | Transferegov (SICONV) | 26.161 linhas; só convênios/propostas | P | PDDE, PNAE, PNATE e Fundeb **não** estão aqui; vêm do Portal (C27) | baixo | P10.6 |
| C16 | Manifesto RAW | `exec_raw_manifest` (sha256 único, bytes, competência, uf) | — | 18.959 linhas | R | nenhuma | baixo | todas |
| C17 | Publicação transacional | `exec_publication` (dataset, uf, competência, run, hash) | — | 30.639 linhas | R | novos `dataset_id` em `specs.ts` | baixo | todas |
| C18 | Log de mudanças | `exec_change_log` | — | 15.086.184 linhas, 3,3 GB; **retenção não aplicada** (fora do escopo) | R | nenhuma; planejar espaço (G16) | baixo | todas |
| C19 | Execuções | `exec_ingestion_run` | — | 30.687 linhas | R | nenhuma | baixo | todas |
| C20 | Armazenamento seguro | `apps/collector/src/exec/storage.ts` (`volumeGuidOf`, `assertVolume`, `assertCanStore`, `fetchRaw`, `registerLocalRaw`, `recordManifest`) | — | volume D: `\\?\Volume{54b8f375-…}` (rótulo "Dados") | R | nenhuma | baixo | todas |
| C21 | Portão HTTP | `http-gate.ts` (`HttpGate`, `appendSerial`) | — | usado por Siconfi/PNCP/federal | R | hosts novos (`download.inep.gov.br`, `www.fnde.gov.br`, `portaldatransparencia.gov.br`) | baixo | todas |
| C22 | Collector + RAW Siconfi | `siconfi.ts`; `D:\Civica\raw\siconfi\dca\DCA_Anexo_I_E\2014…2025\uf*.jsonl.gz` (28 UFs × 12 anos) + `rreo/` | STN | 5.598 entes/ano; 9–374 respostas vazias/ano (`NOT_REPORTED`); **contém 12 e 12.122/361/362/363/364/365/366/367/368** (`siconfi_fn12_raw_scan.json`) | R | nenhuma coleta nova | baixo | P10.5 |
| C23 | Parser/publicador financeiro | `financas-build.ts` (`parseDcaIE`, `buildFinSlice`), `financas.ts` | STN | persiste todas as funções no total e **subfunções apenas da 06** (`06.181/182/183/122/999`) | A | reter subfunções `12.*` e criar ref codes; republicar com replay | médio | P10.5 |
| C24 | Collector + RAW PNCP | `pncp.ts`; `D:\Civica\raw\pncp\contratos\2021…2026\MM.jsonl.gz` (70 arquivos) | PNCP | **5.111.306 contratos** em 5.111.306 linhas (sem duplicidade em `numeroControlePNCP`); 8 páginas não-200 | R | competências após out/2026 (incremental) | baixo | P10.7 |
| C25 | Classificação PNCP | `pncp-build.ts` (`ORG_KINDS`, `SEC_THEMES`, `classifyOrgan/Theme`) | PNCP | específica de segurança, tema único | E | classificador de Educação multitemático (regras em `reproducibilidade/pncp_educacao_raw_scan.py`) | médio | P10.7 |
| C26 | Collector + RAW federal | `federal.ts`; `raw/federal/despesas-execucao/AAAAMM.zip` (2014→), `orcamento-despesa/AAAA.zip` | Portal | 1,1 GB; colunas `Município`/`UF` vazias para as ações de educação (2025) | R | só totais nacionais por ação | baixo | P10.6 |
| C27 | Collector de transferências (Portal) | — | Portal | **não existe**; dataset `transferencias/AAAAMM` testado (1,2–6 MB/mês, município e favorecido presentes) | N | novo collector (pequeno) | baixo | P10.6 |
| C28 | Motor de publicação | `publication.ts` (`publishSlice`, `rollbackRun`, `replayFrom`, `upsertIndicators`) | — | usado em P9.1–P9.7 | R | nenhuma | baixo | todas |
| C29 | Benchmarks | `security-bench.ts`, `apps/web/lib/security/bench.ts` | — | quartis por porte, supressão, população do mesmo ano | A | extrair o núcleo (porte × grupo × cobertura) para uso por Educação | médio | P10.9 |
| C30 | Frontend territorial | `components/territory/*`, `THEMES.educacao` | — | `educacao: { ready: false }` já previsto | R | trocar `ready` e criar rotas | baixo | P10.10 |
| C31 | Collectors INEP | — | INEP | **não existem** (provas desta fase: Range sobre ZIPs, 8 tabelas do Censo 2025) | N | novos (`inep-censo`, `inep-ideb`, `inep-indicadores`) | baixo | P10.1–4 |
| C32 | Collector SIOPE | — | FNDE | **não existe**; Olinda testado | N | novo (pequeno) | baixo | P10.5 |
| C33 | Collector PDDE Info | — | FNDE | **não existe**; consultas testadas | N | novo | baixo | P10.6 |
| C34 | Coleta SIDRA | fonte `population_sidra` (ref 2) | IBGE | população total já coletada | A | acrescentar t/9514 (idade) | baixo | P10.9 |
| C35 | Geocodificação de escolas | — | — | Censo não traz latitude/longitude (P4 e esta fase) | N | fora da P10 (sem fonte comprovada) | — | futuro |

## Resumo (Q1)

| Estado | Componentes | % de 35 |
|---|---:|---:|
| READY_TO_REUSE | 20 | 57,1% |
| REUSE_WITH_ADAPTATION | 6 | 17,1% |
| PARTIAL | 2 | 5,7% |
| NEEDS_EXTENSION | 2 | 5,7% |
| NOT_PRESENT | 5 | 14,3% |
| NOT_VERIFIED | 0 | 0% |

- **57,1% (20/35) podem ser usados sem nova migration nem novo collector.**
- Somando os que só exigem adaptação de código (A): **74,3% (26/35)**.
- Não é uma medida de esforço, só de contagem de componentes.

## Limites da auditoria
- "R" significa que o componente foi lido e/ou medido agora; não significa teste de carga novo.
- A UI foi verificada só por leitura do arquivo `territory-ui.tsx`.
