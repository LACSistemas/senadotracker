# CÍVICA — P9.2: Trânsito e Segurança Viária (SIM + Senatran + RENAEST + PRF) — Relatório de execução

**Data:** 21/10/2026 · **Banco:** `projetoeleitor_db`, schema `civica_exec` · **Sem commit nem push.** Não foram iniciadas P9.3–P9.7 nem a página de Segurança; nenhum agendamento foi configurado; nenhuma retenção do `exec_change_log` foi aplicada.

## 1. Resumo executivo

Cinco famílias foram carregadas no banco real, cada uma reconciliada contra o **seu próprio** arquivo-fonte e mantida em seção separada (nenhuma soma entre famílias):

| Família | UFs | Municípios | Primeiro período | Último período | Indicadores | Estado |
|---|---:|---:|---|---|---:|---|
| SIM Trânsito (residência e ocorrência) | 27 | 5.570 com série | 2013 | 2025 (preliminar) | 28 | PASS_WITH_CAVEATS |
| Frota Senatran (registrada) | 27 | 5.571 (ao longo do tempo) | 2013-01 | 2026-09 | 3 + tabela de 22 colunas | PASS_WITH_CAVEATS |
| RENAEST | 19–27 por ano | 5.378 com sinistro | 2018-01 | 2026-05 | 68 | PASS_WITH_CAVEATS |
| PRF (rodovias federais) | 27 | 2.469 com sinistro | 2007 | 2026-08 | 22 | PASS_WITH_CAVEATS |
| Infrações Senatran (UF de jurisdição) | 27 | — (só UF) | 2019-01 | 2026-09 | 1 + tabela por código | PASS_WITH_CAVEATS |

- **Total:** 122 indicadores novos (todos com dados), **3.267.659 valores** em `exec_ind_value`, 919.256 linhas de frota por município × mês, 425.724 linhas de infração por UF × mês × código, 9.099 registros de cobertura, 8.113 fatias publicadas.
- **Reconciliações contra o arquivo-fonte: todas idênticas** — SIM 1.404/1.404; frota 165/165 meses e 378/378 UF × mês contra o arquivo "Frota por UF e Tipo" (dezembro de cada ano e setembro/2026: Brasil = **133.337.839** veículos); RENAEST 660/660 (8.659.572 sinistros); PRF 220/220; infrações 93/93.
- **Custo:** PostgreSQL **+801 MB** (22,26 → 23,07 GB), WAL ≈ 2,8 GB; SSD +230 MB de RAW e 370 MB de staging (caches agregados). RAW do SIM reaproveitado, nada duplicado. Tempo da carga real: 25 min (SIM 4 min, PRF 2, infrações 6, frota 5,5, RENAEST 7,5).
- **Testes:** 75/75 dos conjuntos do Executivo/Segurança/Trânsito, 0 ignorados; suíte completa 401 testes: 371 aprovados, 0 falhas, **30 ignorados** (legislativos/Pix, exigem o banco legislativo; não contam como evidência). `typecheck` limpo.
- **Saúde e P9.1 intactas:** fingerprints de indicadores, publicações, definições, entidades, contratos compartilhados e esquema legislativo idênticos antes e depois; páginas de estado, município e Saúde renderizadas byte a byte iguais.

## 2. O que é diferente do que se esperava (achados)

1. **Frota Senatran:** as páginas anuais listam o arquivo "Frota por Município e Tipo" de **todos os meses de 2013-01 a 2026-09** (não só 2000–… com frequência variável): 165 competências, layout de 22 colunas estável nos 14 anos, formatos xls, xlsx, zip, rar e csv. **Antes de 2013 não encontrei arquivo municipal** nas páginas testadas (a P9 mencionava histórico desde 2000: não comprovado aqui).
2. **O portal gov.br devolve a página HTML com status 200 quando limita a taxa.** Metade dos downloads da primeira tentativa eram HTML. O coletor agora valida o conteúdo (HTML nunca é aceito como planilha) e repete com espera.
3. **PRF:** a página tem links trocados/duplicados; cada link é validado pelo **ano das datas dentro do arquivo**. A partir de 2016 o arquivo traz poucos sinistros sem vítimas (113 mil em 2010 → 34 mil em 2016 → 11 mil em 2019): **o total de sinistros não é comparável entre 2015 e 2016**; só "com vítimas" (fatais + feridas) vai de 2007 a 2026.
4. **RENAEST:** `num_acidente` é único e `qtde_acidente` = 1 em todas as 8.659.572 linhas (1 linha = 1 sinistro); óbitos em Acidentes (192.221) = óbitos em Vítimas (192.221); 2,1 % das linhas de veículo não têm sinistro correspondente (preservado na qualidade, não contado). A cobertura é muito desigual (SP: 4,9 mil sinistros em 2018 → 188 mil em 2019; SC: 15 mil → 136 mil; RS ≈ 99,7 % fatais; PA com 1 registro em todo o histórico). O campo `qtde_feridosilesos` **não separa** feridos de ilesos.
5. **Infrações:** cinco layouts (UTF-16 largo, largo com aspas duplicadas, longo com colunas em ordem variável, XLSX com título e coluna TOTAL, CSV em host antigo com certificado inválido — recusado, usei o XLSX do gov.br). A série tem vales em 2020 (232 mil–1,08 milhão por mês entre abril e novembro contra ≈ 6 milhões em 2019) e em 2021; estão nos arquivos oficiais, a razão não consta.
6. **SIM:** os controles da P9 (2023, residência) reproduzem exatamente — ES 819, SP 5.132, RS 1.770, MG 3.351 — como V01–V99 **mais** Y85.0. A P9.2 separa a sequela (Y85.0) do evento agudo: ES 818 + 1, SP 5.111 + 21, RS 1.758 + 12, MG 3.344 + 7.

## 3. Arquivos e migration

**Novos:** `ddl-v3.ts`, `transito-defs.ts`, `transito-build.ts`, `transito-read.ts` (em `packages/db/src/exec/`); `apps/collector/src/exec/transito.ts`; `scripts/exec/{transito-pilot,transito-report,transito-perf}.ts`; extratores Python `sim_transito_extract`, `frota_extract`, `frota_uf_extract`, `prf_extract`, `renaest_extract`, `infr_extract`; testes `tests/unit/transito-p92{,-faults}.test.ts`, `tests/integration/transito-p92.test.ts`, 3 fixtures em `tests/fixtures/exec/`.
**Alterados (aditivos):** `specs.ts` (datasets 18–23, 4 specs), `migrations.ts` (v3), `index.ts`, `storage.ts` (`accept`, `retries`, retomada real), `package.json`, `exec-publication.test.ts` (25 tabelas). Dependência de ambiente: `xlrd 2.0.2` no Python do sistema (planilhas `.xls`).

**Migration v3 (`civica_exec_ddl_v3_transito`)** — três tabelas tipadas, sem dado pessoal, reversíveis (`DROP TABLE`), testadas em cluster isolado e aplicadas **após backup restaurável**:
`exec_tra_frota_mun_mes` (frota por município × mês, 22 colunas, mesmo padrão de `exec_sau_sih_mun_mes`), `exec_tra_infr_uf_mes` (UF de jurisdição × mês × código RENAINF) e `exec_tra_cov` (cobertura RENAEST/PRF por UF × mês). `exec_seg_cov` (P9.1) **não foi reutilizada**: é específica do VDE (indicador, abrangência).

## 4. G0 — segurança operacional

Evidências em `reproducibilidade/g0_producao_*.json`, `restore_check.txt`, `logs/`. Banco certo, 0 sessões ativas, 0 locks, 0 execuções em andamento; backup novo (`pre-transito-p92-20261021.dump`, 320.965.905 B, SHA-256 `18a2eef0…4f0e`) **restaurado num cluster descartável com contagens idênticas** (5.631 entidades; 6.201.195 valores; 20.321 publicações; 149.606 coberturas; 16.134.052 linhas de log); volume `D:\` = GUID esperado; 351 arquivos do SIM verificados por SHA-256 (0 divergentes); C: com 41 GiB livres antes e **31 GiB depois** (reserva de 20 GiB respeitada). Orçamento recalculado: ≈ 0,8 GB de PostgreSQL, ≈ 3 GB de WAL, ≈ 0,6 GB de SSD; a projeção da P9 (13,4 GiB de RAW para todo o domínio) não foi um teto.

Sobre o C:: o banco mora no C: por desenho; os ~10 GB a menos medidos durante a sessão vieram de arquivos temporários da ferramenta (`%TEMP%\claude`, ≈ 6 GB), do WAL/dados das cargas e de **cópias exploratórias minhas em `data/`** (VDE, frota, PRF, infrações e o zip de microdados do RENAEST), que **apaguei** — o RAW oficial está só no D:. (Registrado como preferência em memória.)

## 5. Contratos semânticos (G1)

Cada família tem indicadores, definição, perspectiva, cobertura e restrições próprios (`transito-defs.ts`; lidos por `getTrafficState` / `getTrafficMunicipality`). Verificado por testes: SIM residência ≠ ocorrência; sequela Y85.0 nunca somada; V90–V99 fora do terrestre; frota ≠ circulante; ausência no RENAEST ≠ zero; município desconhecido → município **ignorado da UF**, nunca a sede; veículos ≠ sinistros; infração por UF de jurisdição; categoria ou evento desconhecido **interrompe** a carga; nenhuma soma ou taxa entre famílias.

## 6. Famílias

### 6.1 SIM (G2)
RAW já preservado; extrator próprio (`sim_transito_extract.py`, só contagens por município e CID de 3 caracteres). Indicadores: acidentes terrestres V01–V89, total V01–V99, V90–V99, sequela Y85.0, 9 categorias (pedestre, ciclista, motociclista, triciclo, automóvel, camionete, transporte pesado, ônibus, outros terrestres) e taxas por 100 mil (residência). Totais com zero explícito no universo; categorias e V90–V99 só quando > 0 (fatia publicada sem linha = zero, exposto como `zero_derivado`). Residência (351 fatias UF × ano) e ocorrência (13 fatias nacionais), cada uma em indicadores distintos; total nacional V01–V99 idêntico nas duas perspectivas em todos os anos (43.452 em 2013 … 37.954 em 2025). Limites: ocorrência exclui residentes no exterior (DOEX não preservado — informado, não oculto); 2025 preliminar; sem taxa em 2022–2023.

### 6.2 Frota Senatran (G3)
165 competências (2013-01 a 2026-09), uma por mês, sem interpolação; nome → IBGE por UF + chave compacta + 48 aliases validados, **sem fuzzy**; "MUNICIPIO NAO INFORMADO" e nomes sem correspondência vão ao município ignorado da UF e **entram** na UF (SP "IBITIUVA", 7 meses). Validação operacional dos aliases: nenhuma colisão e nenhuma entidade mapeada duas vezes em 165 meses. Municípios criados depois aparecem só a partir do mês em que a fonte os lista (Boa Esperança do Norte: 15 de 165 meses; Mojuí dos Campos, Pescaria Brava, Paraíso das Águas, Balneário Rincão). Setembro/2026: **133.337.839**. Em 2013-08 o TOTAL do arquivo excede a soma dos tipos em 6 veículos (preservado como publicado). Indicadores: veículos por 1.000 hab. e participação de motos e automóveis (dezembro de cada ano e último mês).

### 6.3 RENAEST (G4)
Recurso cumulativo mais recente (05-2026, 529.020.946 B) baixado, agregado em fluxo (sem DataFrame; ≈ 2,7 min) e **o original descartado** (microdados com endereço, CEP, coordenadas, hora e atributos de vítimas, sem política aprovada de retenção). Ficam hash, tamanho e URL no manifesto (state 3) e o agregado sem dado pessoal no RAW (`transito/renaest/*.agg.json.gz`, 2,3 MB). Fatias UF × ano; **hash da fatia = conteúdo canônico**, então um pacote novo só republica as fatias que mudaram (testado em banco isolado; não ocorreu revisão real porque existe um só pacote novo). Cobertura por UF × mês com escopo: `registros_presentes (escopo desconhecido)`, `restrito_a_fatais (inferido)` — 168 UF-meses (AM, MA, AL, SP, RS, MT) — e `sem_registros`. UFs com registro por ano 2018–2025: 25, 27, 26, 26, 26, 25, 23, 23 (igual à P9); 2026 (jan–mai): 19. Os 3 últimos meses do pacote são preliminares. **Teste ES 2023:** RENAEST 972 óbitos × SIM 818 (residência) / 847 (ocorrência) — explicado em `reconciliacao_transito.md`, sem exigir igualdade.

### 6.4 PRF (G5)
20 arquivos (2007–2026) "agrupados por ocorrência" do Drive, ZIP validado, ano conferido pelo conteúdo. 1 linha = 1 sinistro (id repetida conta uma vez: 4–7 por ano até 2016). Mensal por UF (zero explícito dentro do período do arquivo; agosto/2026 preliminar) e anual por município. Não persistidos: id, km, BR, coordenadas, horário. 12 sinistros com UF "(null)" (2007: 5, 2008: 3, 2012: 4) não atribuídos a UF; 118 sinistros com município sem correspondência foram ao município ignorado (inclui "NOVA SERRANA/PB", "SAO BENTO DE POMBAL/PB", "VILA ALTA/PR", sem inferência). O ZIP original (sem dado pessoal; localização do evento) fica no RAW do D:, nunca exposto.

### 6.5 Infrações (G6)
93 competências (2019-01 a 2026-09), 27 UFs de **jurisdição do veículo**, códigos RENAINF (≈ 250), 8,23 milhões de notificações em 2026-09. Piloto com 3 arquivos de layouts distintos antes do backfill; XLSX de 2020-06 serve de fallback quando o CSV está num host com certificado inválido (a verificação TLS **não** foi desligada).

## 7. Identidade territorial (G7)
Reconciliação por construção e por verificação dentro da transação: Σ municípios + município ignorado = UF; Σ UFs = Brasil confirmado contra o arquivo por UF; Σ categorias SIM = total. Nenhum município criado; ausências ficam sem linha. `crosswalk_transito_ibge.csv` lista cada alias usado, os nomes não conciliados (4), os 6 casos "MUNICIPIO NAO INFORMADO" e os municípios IBGE com meses sem linha.

## 8. Persistência (G8), derivados (G9), comparabilidade (G10)
Modelo D reutilizado (`exec_ind_*`, fatias, manifesto, log, publicações); só três tabelas novas (acima). Publicados: taxas SIM (residência) e veículos por 1.000 hab. Pesquisados e **não publicados**: sinistros por habitante, por 10 mil veículos, mortes por 10 mil veículos, letalidade — o denominador de cada fonte não é a frota/população do município (ver `sobreposicao_fontes.md`, que também traz a matriz de comparabilidade). Sem índice único.

## 9. Contratos de leitura (G11)
`getTrafficState(uf, {sources, from, frequency})` e `getTrafficMunicipality(id, …)`: seções por fonte, cobertura RENAEST/PRF por UF × mês, frota com tipos, infrações com códigos do último mês, fontes e competências, restrições. 6–7 consultas por perfil; **SP completo 162 ms / 1,0 MB**; filtros reduzem (SP só frota anual: 134 ms / 17 KB; SP só PRF desde 2024: 3,7 ms / 69 KB; município 3–15 ms). A consulta mais cara é a frota agregada da UF (159 ms em SP); índices existentes bastaram.

## 10. Privacidade (G12)
Persistido: somente contagens por território/mês e códigos. **Não** persistido: endereço, CEP, bairro, coordenadas, hora, km, número de sinistro, gênero/faixa etária de vítimas, placas/proprietários (a fonte nem os traz). RENAEST: original descartado; staging com o zip é removido (`renaest-dl`); agregado preservado sem dado pessoal. PRF: ZIPs oficiais (sem dados pessoais) preservados no RAW restrito. Nenhuma rota/API nova. Ressalva: reprocessar o RENAEST exige baixar o pacote de novo (a URL do Drive pode mudar); o agregado cobre o replay das fatias.

## 11. Republicação (G13)
Idempotente (`NO_CHANGE` por hash de fonte+parser ou, no RENAEST/PRF, por conteúdo canônico); republicação com `exec_change_log` e `rollbackRun` exato testados em banco isolado para as cinco famílias; falha injetada após aplicar não deixa estado parcial; reconciliação dentro da transação barra totais divergentes; retomada real de download parcial (servidor derruba a conexão em 1 MiB; o curl retoma com `Range`; SHA-256 final igual). A carga inicial usa `bootstrap` (sem log), como as demais. **Sem agendador.** Proposta de periodicidade: SIM anual (e troca de preliminar por definitivo); frota mensal (reprocessar os 3 últimos meses); RENAEST mensal (um pacote cumulativo, republica só fatias alteradas); PRF mensal (ano corrente); infrações mensal.

## 12. Testes e regressão (G14)
75/75 (Executivo, P9.1, P9.2) sem ignorados — cluster PostgreSQL descartável (porta 55434): CID, universo e zeros do SIM, aliases/colisões, frota nula ≠ 0, escopo do RENAEST, dedupe da PRF, layouts de infração, extratores com XLSX/ZIP/UTF-16 sintéticos, HTML por limite de taxa, retomada de download, SSD trocado, migração, publicação, rollback, leitura. Suíte completa 371/401 aprovados, 0 falhas, 30 ignorados (legislativos). `typecheck` limpo. **`next build` não foi executado**: o servidor do usuário (porta 3000) roda do mesmo diretório e o build sobrescreveria `.next`; a verificação foi SSR das páginas atuais (byte a byte iguais) e `typecheck`.

## 13. Desempenho e armazenamento (G15)
Ver `armazenamento_execucao.csv` e `desempenho_consultas.json`. +801 MB no banco (`exec_ind_value` 1,68 GB no total, frota larga 151 MB, infrações 36 MB), WAL ≈ 2,8 GB, C: com 31 GiB livres. Sem VACUUM FULL, sem reindex global, sem retenção do log.

## 14. Problemas e ressalvas
1. Antes de 2013 não há frota municipal localizada. 2. IBITIUVA/SP e três nomes da PRF não conciliam. 3. RENAEST: cobertura desigual e escopo só inferido; revisão real de pacote antigo não observada. 4. PRF: quebra de série em 2016; 12 sinistros sem UF. 5. Infrações: série irregular preservada; UF de jurisdição. 6. Ocorrência do SIM sem DOEX; 2025 preliminar; sem taxa em 2022–2023. 7. `next build` não rodado. 8. 30 testes legislativos ignorados. 9. Meu erro de ambiente: cópias exploratórias no C: (corrigido) e `xlrd` instalado no Python do sistema.

## 15. Pendências
Página de Segurança (contratos prontos); agendamento (aguarda autorização); retenção do change log (não aplicada); arquivo de frota anterior a 2013 (investigar); população 2022–2023 e feminina; política de retenção para microdados do RENAEST caso se queira replay sem novo download.

## 16. Gates

| Gate | Estado | Evidência |
|---|---|---|
| G0_INFRASTRUCTURE_SAFETY | PASS | banco/volume/locks; backup restaurado com contagens idênticas; 351 hashes do SIM; fingerprints |
| G1_TRAFFIC_SEMANTICS | PASS | contratos em código + testes de proibições |
| G2_SIM_TRAFFIC | PASS_WITH_CAVEATS | 1.404/1.404; controles P9 exatos; sem DOEX; 2025 preliminar |
| G3_SENATRAN_FLEET | PASS_WITH_CAVEATS | 165 meses, 378/378 UF × mês; sem frota < 2013; IBITIUVA; TOTAL ≠ Σ em 2013-08 |
| G4_RENAEST | PASS_WITH_CAVEATS | 660/660; cobertura e escopo explícitos; original descartado; revisão real não observada |
| G5_PRF | PASS_WITH_CAVEATS | 220/220; quebra 2016; 12 sem UF; 118 sem município |
| G6_SENATRAN_INFRACTIONS | PASS_WITH_CAVEATS | piloto de 5 layouts; 93/93; UF de jurisdição; série irregular |
| G7_TERRITORIAL_RECONCILIATION | PASS | Σ partes = UF = Brasil; nada inventado |
| G8_PERSISTENCE_CONTRACT | PASS | 3 tabelas mínimas, reversíveis, testadas, com backup |
| G9_DERIVED_INDICATORS | PASS_WITH_CAVEATS | taxas SIM e frota/1.000 hab.; demais não publicadas por falta de denominador compatível |
| G10_SOURCE_COMPARABILITY | PASS | matriz em `sobreposicao_fontes.md` |
| G11_SERVING_CONTRACT | PASS | 6–7 consultas; 3–162 ms; filtros |
| G12_PRIVACY | PASS_WITH_CAVEATS | só agregados; RENAEST original descartado (replay exige novo download) |
| G13_REPUBLICATION | PASS_WITH_CAVEATS | idempotência, log, rollback e retomada comprovados; sem agendador |
| G14_TESTS_AND_REGRESSION | PASS_WITH_CAVEATS | 75/75; suíte 371/401, 30 ignorados; `next build` não rodado |
| G15_PERFORMANCE_AND_STORAGE | PASS_WITH_CAVEATS | +801 MB, WAL 2,8 GB; C: 31 GiB livres (reserva 20) |

**Resumo:** 6 PASS e 10 PASS_WITH_CAVEATS; 0 PARTIAL/FAIL.

Total de arquivos RAW novos: 165 (frota) + 14 (frota por UF) + 20 (PRF) + 93 (infrações) + 1 agregado RENAEST = **293**, 230 MB. Municípios não conciliados: 4 nomes (SP IBITIUVA; PB NOVA SERRANA, SAO BENTO DE POMBAL; PR VILA ALTA). UFs sem reporte no RENAEST: PA (todos os anos), AP (2018, 2024, 2026), AM (2025–2026), MA (2024+), RN (2023+), TO e AL e RS (2026 parcial). Fontes provisórias: SIM 2025, PRF agosto/2026, RENAEST 3 últimos meses.
