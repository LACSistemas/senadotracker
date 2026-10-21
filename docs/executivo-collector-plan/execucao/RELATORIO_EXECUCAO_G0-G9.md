# Cívica — Implementação inicial do Executivo: relatório de execução (G0–G9)

Data: 2026-10-19. Branch `post-migration`. Nenhum commit/push foi feito. Banco: `projetoeleitor_db` (PostgreSQL 17.4 local), schema novo `civica_exec`.

## 1. Resumo por gate

| Gate | Situação | Evidência |
|---|---|---|
| G0 segurança/backup | **Passou** | `pg_dump` em `artifacts/backups/pre-exec-20261019.dump` (+SHA-256); restauração completa em cluster descartável com contagens idênticas; linha de base em `baseline_antes.csv`; orçamento de disco definido (RAW 6 GiB, staging 3 GiB, reserva livre 30 GiB). |
| G1 fundação + motor de publicação | **Passou** | 21 tabelas + `schema_migrations` em `civica_exec`; 5.631 entidades (1 Brasil + 5 regiões + 27 UFs + 5.571 municípios + 27 "município ignorado"); população IBGE (SIDRA 6579) 7.257 linhas; 18 testes automáticos (7 cenários de mesa + intervalos/competência) passam contra cluster descartável e estão no `npm test` (pulam sem `EXEC_TEST_ADMIN_URL`). |
| G2 CNES | **Passou (ES completo)** | ES 201301–202609 (165 competências × ST/LT/EQ), 78 municípios; SP e MG: apenas 202607–202609 (amostra controlada, não histórico); PF 202609 ES/SP/MG. |
| G3 epidemiologia | **Passou** | SINASC e SIM 2013–2025 nas 27 UFs (39 recortes cada); PNI ES (SIPNIBD, 34 vacinas, 12 anos). |
| G4 SIH | **Passou** | ES 2024 por hospital (12 competências); SIH nacional 202406 para internações de residentes (27 arquivos). |
| G5 APS e Siconfi | **Parcial, limitado e medido** | Siconfi acessível; API e-Gestor/APS indisponível (ver §5). Nenhum indicador financeiro/APS publicado. |
| G6 contratos de consulta | **Passou** | `packages/db/src/exec/read.ts`; `apps/web/lib/exec-territory.ts`. Uma consulta pequena por seção; `exec_story` (read model da UF) reconstruído por `source_key`. |
| G7 páginas | **Passou** | `/estados`, `/estados/[uf]`, `/estados/[uf]/saude`, `/estados/[uf]/representacao`, `/estados/[uf]/[tema]`, `/municipios`, `/municipios/[ibge]`, `/municipios/[ibge]/saude`, `/municipios/[ibge]/[tema]`. Item "Estados" do cabeçalho agora aponta para `/estados`. |
| G8 regressão | **Passou** | Ver §6. |
| G9 relatório | Este documento. |

## 2. Tabelas, coletores e fontes

Tabelas de `civica_exec` (tamanho total do schema: **175 MiB**): `exec_entity`, `exec_entity_version`, `exec_entity_external_id`, `exec_territory_population`, `exec_ref_code`, `exec_ingestion_run`, `exec_raw_manifest`, `exec_publication`, `exec_change_log`, `exec_sau_cnes_estab`, `exec_sau_cnes_estab_v`, `exec_sau_cnes_leito_v`, `exec_sau_cnes_equip_v`, `exec_sau_prof_mun_cbo`, `exec_sau_hosp_mes_subgrupo`, `exec_sau_sih_mun_mes`, `exec_ind_def`, `exec_ind_value`, `exec_ind_latest`, `exec_story`, `exec_fin_fact` (vazia; reservada ao Siconfi), mais `schema_migrations`.

Coletores (`apps/collector/src/exec/`): `storage.ts` (download FTP via curl, `.part`, SHA-256, `MANIFEST.jsonl`, orçamentos, parada segura), `cnes.ts`, `epi.ts`. Execução: `scripts/exec/*` (`foundation`, `population`, `cnes-pilot`, `epi-pilot`, `refresh-latest`, `geo-fetch`, `seed-defs`, `ref-codes`). Nenhum registro individual é persistido: AIH, nascidos e óbitos são agregados por município/hospital no extrator Python antes de qualquer escrita.

Fontes: IBGE (localidades, SIDRA 6579, malhas v3), DATASUS FTP (CNES ST/LT/EQ/PF, SINASC, SIM, SIHSUS RD, SIPNIBD), DEMAS (tipos de unidade), Siconfi (sondagem).

## 3. Cobertura publicada (`exec_publication`)

| Dataset | UFs | Competências |
|---|---|---|
| Território IBGE | Brasil | 2026 |
| População SIDRA | ES + nacional | 2001–2026 (lacunas oficiais em 2007, 2010, 2022, 2023: marcadas `noDenominator`) |
| CNES ST/LT/EQ | ES (165 recortes) | 201301–202609 |
| CNES ST/LT/EQ | SP, MG (3 recortes) | 202607–202609 |
| CNES PF | ES, SP, MG | 202609 |
| SIM e SINASC | 27 UFs | 2013–2025 (2025 preliminar) |
| PNI | ES | 2015–2026 (2026 parcial) |
| SIH por hospital | ES | 202401–202412 |
| SIH de residentes | 27 UFs (5.570 municípios) | 202406 |

Indicadores publicados (somente os aprovados): IND-SAU-05 (leitos/1.000), 05S (leitos SUS/1.000), 08 (mortalidade infantil), 10 (ICSAP, 202406), 11 (≥6 consultas de pré-natal), 12 (cesáreas) e 34 coberturas vacinais (IND-SAU-07:*, ES). Total: 56.944+ valores (+15.454 de PNI). Não publicados, por decisão metodológica: ocupação de leitos, resolutividade, satisfação, mortalidade materna.

## 4. Valores reconciliados

| Verificação | Obtido | Referência |
|---|---|---|
| Entidades IBGE | 5.571 municípios, 27 UFs, 5 regiões | catálogo IBGE |
| ES: estabelecimentos distintos (identidade) | 13.093 | CNES |
| ES: leitos | 4.271 intervalos, 1.100 abertos | CNES-LT |
| Brasil 2024: mortalidade infantil | 12,56 ‰ | P8 |
| Brasil 2024: cesáreas | 60,6 % | P8 |
| Brasil 2024: pré-natal ≥ 6 consultas | 87,5 % | P8 |
| SIH nacional 202406: registros lidos | **1.188.890** | P8: 1.188.890 |
| SIH nacional 202406: AIH após deduplicação | 1.188.707 (183 duplicatas removidas) | — |
| SIH nacional 202406: ICSAP | 187.892 = **15,81 %** | P8: ≈ 15,8 % |
| SIH nacional 202406: valor aprovado | **R$ 1.969.984.744,80** | P8: ≈ R$ 1,97 bi |
| SIH nacional 202406: municípios de residência | 5.570 | 5.571 IBGE (1 sem internação) |

## 5. G5 — APS e Siconfi (medido, sem carga em massa)

- **Siconfi** (`apidatalake.tesouro.gov.br`): `/entes` 200, 0,47 s, 866 KB, 5.598 entes, sem paginação pendente; RREO ES 2024 bim. 6 Anexo 01: 200, 1,11 s, 216 KB, 599 itens; DCA 2023 Vitória (Anexo I-C): 200, 0,20 s, 67 KB, 203 itens. Latência baixa e payload pequeno por ente/anexo: viável fazer carga **por ente e exercício com checkpoint**, mas isso exige definir o conjunto de contas (função 10 – Saúde) e a regra do mínimo constitucional antes de publicar. RAW capturado em `data/exec-raw/g5/` (3 arquivos, SHA-256 em `MANIFEST.sha256`).
- **APS (e-Gestor, `relatorioaps-prd.saude.gov.br/cobertura/aps`)**: 6 variações de parâmetros devolveram HTTP 500 ("Falha interna do servidor") em ~0,15 s. Sem contrato verificável, **interrompido após a sondagem** (sem tentativas em massa). Cobertura APS não foi publicada.
- Indicadores financeiros (16, 17, 19, 20): **não elegíveis** nesta entrega.

## 6. G8 — regressão e verificação

- `git diff` das mudanças em arquivos já rastreados: apenas `app-header.tsx` (link "Estados"), `package.json` (testes exec) e `packages/db/src/index.ts` (uma linha de export). Nenhuma lógica das páginas legislativas foi alterada; `/quem-me-representa` e seus parâmetros (`uf, casa, metrica, comparar, assunto, paginaDeputados`) permanecem.
- Rotas após a mudança: `/legislativo/estaduais`, `/legislativo/estaduais/ES/deputados`, `/quem-me-representa?uf=SP&casa=camara&metrica=presence`, `/comissoes`, `/metodologia`, `/` → 200. (`/legislativo/senado` retorna 404; a rota não existe e não é afetada por esta entrega.)
- `npm test`: 326 testes, 283 passam, 0 falham, 43 pulados (incluem os testes de banco do `exec`, que rodaram à parte: **18/18** contra cluster descartável). `npm run typecheck` (db, domain) e `tsc --noEmit` de `apps/web` e `apps/collector`: limpos.
- Inspeção visual (desktop 1366 px e mobile 390 px, Playwright; capturas em `execucao/screens/`): `/estados`, `/estados/ES`, `/estados/ES/saude`, `/estados/SP?mapa=leitos`, `/estados/AC`, `/estados/ES/educacao`, `/municipios/3205309` (Vitória), `/municipios/3205309/saude`. Sem rolagem horizontal em nenhuma.
- Tempos (dev, 1ª requisição): /estados 1,7 s; /estados/ES 0,5–5,7 s; /municipios/3205309/saude 1,4–2,2 s. `/estados/SP` envia 846 KB de HTML (645 polígonos); aceitável por ora, candidato a simplificação da malha.

## 7. Armazenamento e tempo

| Item | Valor |
|---|---|
| Banco antes (linha de base) | 14,94 GiB, 16.002.824 linhas (`baseline_antes.csv`) |
| Banco depois | 15,13 GiB (16.242.846.867 B); `civica_exec` = 175 MiB (maiores: `exec_sau_cnes_equip_v` 68 MiB, `exec_change_log` 40 MiB, `exec_sau_cnes_estab_v` 25 MiB) |
| RAW mantido (`data/exec-raw`) | 657 MiB (cap 6 GiB); staging vazio no fim |
| Backup pré-execução | 2,1 GiB em `artifacts/backups` |
| Disco livre | 53 GiB (reserva mínima 30 GiB respeitada) |
| Tempos medidos | CNES ES 165 competências × 3 arquivos; SP 9 publicações em 102 s; MG em 66 s; PF ES 6 s / SP 57 s / MG 31 s; PNI ES 17 s; SIH ES 2024 12 competências ≈ 11 min; SIH nacional 202406 (27 UFs, 89 MiB de DBC) ≈ 3 min |
| Pico temporário | decodificação DBC→DBF abaixo do orçamento de staging (3 GiB); estimativa conservadora 15× nunca atingida |

Os intervalos medidos de `exec_sau_cnes_estab_v` (23.464) e `exec_sau_cnes_equip_v` (45.674) para o ES ficaram abaixo da extrapolação do P8 (38.916 / 70.733) porque a versão rastreia menos atributos; a projeção nacional deve ser refeita com esses fatores.

## 8. Erros encontrados e corrigidos

1. Total de entidades documentado (5.667) estava errado: o correto é **5.631** (1+5+27+5.571+27). Guarda de `foundation.ts` corrigida. **Errata** para os documentos anteriores.
2. Boa Esperança do Norte não tem polígono na malha IBGE usada: o mapa avisa a ausência em vez de inventar geometria; o município segue acessível pela busca.
3. Rollback por replay duplicava chaves em intervalos abertos (ordem do change-log): corrigido e coberto por teste.
4. `quality` JSON `null` gravado como valor JSON: passa a SQL NULL.
5. Parâmetros SQL não referenciados (erro de tipo): corrigido.
6. `refreshLatest` priorizava preliminar: agora definitivo mais recente, senão preliminar.
7. FTP: `HEAD` lento (19 s) removido; usa `-w %{filetime}`.
8. PNI falhou ao inserir `method_version`/`sort_order` (smallint com "70.01"): ordenação passou a `700 + n`; ES republicado.
9. Teste inicial do ES CNES deixou dados parciais: apagados (somente linhas de `civica_exec`) e recarregados.
10. Rótulo de cobertura nas páginas corrigido para "três competências do cadastro (jul–set/2026)" em SP/MG, em vez de "amostra", para não sugerir cobertura que não existe.

## 9. Limitações e pendências

- **HD externo** ainda indisponível: nenhum backfill nacional foi iniciado; a carga nacional completa permanece **suspensa**. Os coletores têm diretório RAW configurável, manifestos SHA-256 e parada retomável por orçamento.
- Cobertura de saúde: ES completo; SP e MG só jul–set/2026 (CNES); SIH de residentes só 202406; PNI só ES. Outras 24 UFs exibem território e população; páginas dizem explicitamente que o dado não foi coletado. **Não há cobertura nacional declarada.**
- Educação, Segurança, Bem-estar e Infraestrutura: páginas de cobertura honesta, sem números.
- APS (API 500) e finanças Siconfi: pendentes; Siconfi pronto para piloto por ente com checkpoint.
- População sem estimativa em 2007, 2010, 2022 e 2023: IND-SAU-05 e derivados nesses anos saem sinalizados `noDenominator`.
- Datas de instalação de municípios não foram inventadas: marcadas "não comprovada" e não exibidas.
- Representação integrada: `/estados/[uf]/representacao` aponta para as leituras existentes (Câmara, Senado, Assembleia) sem duplicar consultas pesadas; incorporar os agregados diretamente exige mexer em `stateRepresentation`, fora do escopo de não alterar a lógica legislativa.
- Dev server local ainda em execução; cluster descartável (porta 55434) encerrado.
