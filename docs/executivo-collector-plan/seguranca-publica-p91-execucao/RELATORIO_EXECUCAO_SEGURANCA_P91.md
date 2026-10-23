# CÍVICA — P9.1: Criminalidade nacional (SIM + Sinesp VDE) — Relatório de execução

**Data da execução:** 21/10/2026 · **Banco:** `projetoeleitor_db` (PostgreSQL 17.4), schema `civica_exec` · **Sem commit nem push.**
Escopo estrito: P9.1. Não foram iniciadas P9.2 a P9.7, nem a página de Segurança, nem coleta de fontes estaduais, efetivos, prisional, Detran, RENAEST, PRF, finanças ou facções.

---

## 1. Resumo executivo

O Cívica passou a ter criminalidade nacional histórica **publicada, reconciliada e auditável** em duas famílias que **não são equivalentes e não foram misturadas**:

| Família | O que mede | Cobertura publicada | Granularidade |
|---|---|---|---|
| **SIM** (DATASUS, RAW já preservado) | óbitos não fetais por causa básica CID-10 (agressão, intervenção legal, operações de guerra, intenção indeterminada) | **27/27 UFs · 13/13 anos** (2013–2024 definitivos + 2025 preliminar) · 351 fatias de residência + 13 nacionais de ocorrência | município de **residência** e de **ocorrência**, UF e "município ignorado" |
| **Sinesp VDE** (MJSP, XLSX anuais) | registros das polícias: vítimas, ocorrências, mandados, apreensões, pessoas | **27/27 UFs · 12/12 anos** (2015–2026, 2026 parcial até set) · **141 competências** · 324 fatias | **11 eventos com município + UF; 20 eventos somente UF** |

Números centrais:

- **Homicídio por município em todo o Brasil**: sim, via SIM — 5.570 municípios com série (de 5.571 na referência territorial; Boa Esperança do Norte/MT só entra se houver óbito, por não ter instalação comprovada); 5.475 municípios têm ao menos 1 óbito por agressão na série.
- **Reconciliação com o Atlas da Violência: 324 de 324 pares UF × ano idênticos** (100 %), inclusive os controles do ES (2023 = 1.161; 2024 = 1.064). A única diferença do período, antes de fixar o recorte, era um único óbito Y36 (MG 2022), que o Atlas exclui; o recorte do Cívica é **X85–Y09 + Y35**, com Y36 em indicador próprio.
- **VDE**: totais por UF × ano × evento do arquivo = linha da UF publicada = Σ municípios + município ignorado, em **474 de 474** combinações (independente do caminho de leitura do banco).
- **Crosswalk VDE → IBGE**: **5.570 de 5.570 nomes municipais válidos** (5.564 diretos + 6 aliases validados), 0 não conciliados, 27 pares "NÃO INFORMADO" preservados na UF.
- **Persistência**: 62 definições de indicador (13 SIM + 49 VDE), **2.133.062 valores** em `exec_ind_value`, 149.606 registros de cobertura em `exec_seg_cov` (única estrutura nova), 140.983 pares em `exec_ind_latest`.
- **Custo**: PostgreSQL **+340 MiB** (21,91 → 22,26 GB); SSD **+358 MB** de RAW (VDE 293 MB + Atlas 65 MB) e 137 MB de staging; RAW do SIM **reutilizado, 0 byte duplicado**. WAL gerado ≈ 1,50 GB.
- **Testes**: 64/64 dos conjuntos Executivo/Segurança passam, **0 ignorados**; suíte completa do repositório 374 testes: 344 aprovados, 0 falhas, **30 ignorados** (todos legislativos/Pix, dependentes de outro banco; não contam como evidência).
- **Saúde e Legislativo intactos**: fingerprints de indicadores, publicações, definições e contratos compartilhados idênticos antes/depois; páginas `/estados/ES`, `/estados/ES/saude`, `/municipios/3205309` e `/municipios/3205309/saude` renderizadas **byte a byte iguais**.

Principais ressalvas (detalhadas na seção 13): zero do VDE é ambíguo em 28 % dos UF × evento × mês; o Atlas municipal de 2020 é internamente inconsistente; 2022 e 2023 não têm população oficial carregada (sem taxa); a perspectiva de ocorrência exclui residentes no exterior (arquivo DOEX não preservado); 2025 (SIM) e 2026 (VDE) são provisórios.

---

## 2. Arquivos alterados e criados

**Novos (código):**

| Arquivo | Função |
|---|---|
| `packages/db/src/exec/ddl-v2.ts` | migration v2 (`exec_seg_cov`) |
| `packages/db/src/exec/seguranca-defs.ts` | contratos semânticos: CID-10, 62 indicadores, taxonomia VDE, aliases do crosswalk, normalização de nomes |
| `packages/db/src/exec/seguranca-build.ts` | construtores puros (SIM residência/ocorrência, VDE, crosswalk) |
| `packages/db/src/exec/seguranca.ts` | `replaceIndicatorsBulk`: substituição em lote com change log e `exec_ind_latest` |
| `packages/db/src/exec/seguranca-read.ts` | contratos de leitura (`getSegState`, `getSegMunicipality`) |
| `apps/collector/src/exec/seguranca.ts` | coletores SIM e VDE, localização de RAW por manifesto, publicação por fatia |
| `scripts/exec/sim_seg_extract.py`, `vde_extract.py` | extratores agregadores (DBC e XLSX em fluxo) |
| `scripts/exec/seguranca-pilot.ts`, `-g0.ts`, `-report.ts`, `-perf.ts` | CLI, G0, relatórios, desempenho |
| `tests/unit/seguranca-p91.test.ts`, `seguranca-p91-faults.test.ts`, `tests/integration/seguranca-p91.test.ts` | 30 testes |

**Alterados (mínimo, aditivo):** `specs.ts` (datasets 15–17 e spec `seg_cov`), `indicator-defs.ts` (bit `zeroAmbiguous = 128`), `migrations.ts` (v2), `index.ts` (exports), `storage.ts` (`fetchRaw` aceita User-Agent e segue redirecionamento; `readManifest` exportado), `read.ts` (`getCoverage` ignora datasets ≥ 15, para não alterar as páginas de Saúde), `exec-publication.test.ts` (21 → 22 tabelas), `package.json` (novos testes no `npm test`).

Nenhuma tabela, função ou publicação de Saúde foi alterada; nenhum arquivo legislativo foi tocado.

---

## 3. Migration

**v2 `civica_exec_ddl_v2_seguranca_cobertura_vde`** — cria `civica_exec.exec_seg_cov` (PK `uf, indicator_id, competence`; colunas `mun_pairs, src_lines, dup_lines, nz_rows, uf_total, unassigned, status`). Necessária porque o VDE reescreve o arquivo do ano e a fonte não distingue zero reportado de ausência de relato: sem esse registro, a ausência de linha em `exec_ind_value` perderia o significado dos zeros. Compatível com o modelo D (usa `exec_ind_def/value/latest`, fatias, manifesto, change log); **reversível** (`DROP TABLE civica_exec.exec_seg_cov`, nada depende dela); testada em cluster PostgreSQL 17 descartável e depois aplicada no banco real **após backup restaurável**. Sem dados pessoais (10 colunas numéricas/códigos).

---

## 4. G0 — Segurança operacional

Evidências em `reproducibilidade/g0_producao_antes.json` e `g0_producao_depois.json`.

- **Banco certo:** `projetoeleitor_db`, 20 GB; schema `civica_exec` 5,3 GiB; 0 sessões ativas, 0 locks não concedidos, 0 locks consultivos, 0 execuções em andamento; nenhum collector ou scheduler em curso.
- **Logs do PostgreSQL** (dias 20 e 21): sem PANIC nem corrupção; os erros do dia são consultas minhas de exploração (permissão em `pg_ls_waldir`, coluna inexistente) e 3 `FATAL` de autenticação (timeout/senha) do dia 20, anteriores a esta execução.
- **Espaço:** C: 41,2 GiB livres (reserva mínima do projeto 20 GiB); `max_wal_size` 1 GiB; WAL gerado medido por `pg_stat_wal`.
- **Backup restaurável:** `pg_dump -Fc` do schema (`D:\Civica\backups\pre-seguranca-p91-20261021.dump`, 306.987.135 B, SHA-256 `e93733f2…bc01`), **restaurado num cluster descartável** com contagens idênticas às do banco real (5.631 entidades, 4.068.133 valores, 19.633 publicações, 16.134.048 linhas de change log).
- **SSD:** `D:\` = volume `54b8f375-0000-0000-0000-100000000000` (igual ao configurado); marcador `.civica-volume.json` presente; `assertVolume` PASS; 435,2 GiB livres. Os 351 arquivos do SIM do manifesto (324 definitivos + 27 preliminares) foram **conferidos por SHA-256: 0 ausentes, 0 divergentes**. Os coletores novos chamam `assertVolume` antes de qualquer leitura de banco/gravação (teste de SSD trocado/ausente aborta com `VolumeError` sem tocar em nada).
- **Fingerprints dos contratos reutilizados** (idênticos antes e depois): definições de Saúde `fd49e58c…`, publicações de Saúde `23080024…`, valores de indicadores de Saúde `ec65675e…` (4.068.133 linhas), entidades `c67c4dfd…` (5.631), colunas das tabelas compartilhadas `0eb27fde…`, esquema legislativo (59 tabelas, 639.746 linhas vivas).

**`G0_INFRASTRUCTURE_SAFETY = PASS`**

---

## 5. G1 — Reconciliação documental da P9

Aplicada na origem (`seguranca-publica-p9/`, seção *Errata* e `results.json`), sem alterar nenhum gate:

1. **Gates da P9:** contagem real **5 PASS, 10 PASS_WITH_CAVEATS, 7 PARTIAL** (o resumo dizia 6/10/6). Verificado por programa; `results.json` ganhou `gates_resumo`.
2. **Cobertura municipal do VDE com denominadores:**

| Medida | Valor |
|---|---:|
| Pares UF × município distintos no arquivo | **5.597** |
| Pares com nome municipal válido | **5.570** |
| "NÃO INFORMADO" (um por UF) | **27** |
| Conciliados automaticamente (nome normalizado) | **5.564** (99,89 % dos 5.570 válidos) |
| Conciliados por alias validado | **6** |
| Não conciliados | **0** |
| Municípios IBGE sem par no VDE | **1** (Boa Esperança do Norte/MT) |
| Linhas de valor ≠ 0 em "NÃO INFORMADO" (municipais), 2015–2026 | 633 chaves UF × evento × mês |
| Eventos atribuídos somente à UF | 20 (nunca distribuídos por município) |

3. **Calendário:** 5.571 municípios na referência (2026) × 5.570 no VDE/SIM-até-2024: a diferença é Boa Esperança do Norte, cuja instalação **não é comprovada** no cadastro; nada foi criado para períodos anteriores — o SIM só a inclui se houver óbito com o código.
4. **Correções de leitura da P9** registradas na errata: apreensão de cocaína/maconha está em `total_peso` (não era "100 % zero"); "Mortes no trânsito" do VDE é de rodovias federais.

**`G1_P9_CONTRACT_RECONCILIATION = PASS`**

---

## 6. G2 — Contratos semânticos

Implementados em `seguranca-defs.ts` e protegidos por testes. **Proibido e verificado:** SIM ≠ VDE (indicadores, códigos e perspectivas distintos); ocorrência ≠ crime comprovado (notas em cada definição); `NÃO INFORMADO` ≠ zero e ≠ município (vai ao "município ignorado"); ausência de linha ≠ zero (zero explícito no SIM; cobertura no VDE); evento só-UF ≠ indicador municipal (falha se aparecer município em evento só-UF); medidas `total_vitima`, `total` e `total_peso` nunca somadas (falha se um evento trouxer coluna inesperada); evento ou abrangência desconhecidos **interrompem** a publicação.

### 6.1 SIM (13 indicadores)

Só óbitos não fetais (`TIPOBITO = 2`). Ano do óbito = ano do arquivo (0 divergências de data detectadas nas fatias).

| ID | Código | Perspectiva | Definição |
|---|---|---|---|
| 3001 | IND-SEG-SIM-AGR-RES | residencia | CID-10 X85–Y09 (agressões) |
| 3002 | IND-SEG-SIM-INT-RES | residencia | CID-10 Y35 (intervenção legal) |
| 3003 | IND-SEG-SIM-GUE-RES | residencia | CID-10 Y36 (operações de guerra) |
| 3004 | IND-SEG-SIM-IND-RES | residencia | CID-10 Y10–Y34 (eventos cuja intenção é indeterminada) |
| 3005 | IND-SEG-SIM-ATL-RES | residencia | X85–Y09 + Y35: agressões e intervenção legal, o recorte que reconcilia com o Atlas da Violência (324 pares UF × ano idênticos; o único óbito Y36 do período, MG 2022, é a única diferença e fica de fora). Não equivale a homicídio doloso. |
| 3011 | IND-SEG-SIM-AGR-OCO | ocorrencia | CID-10 X85–Y09 (agressões) |
| 3012 | IND-SEG-SIM-INT-OCO | ocorrencia | CID-10 Y35 (intervenção legal) |
| 3013 | IND-SEG-SIM-GUE-OCO | ocorrencia | CID-10 Y36 (operações de guerra) |
| 3014 | IND-SEG-SIM-IND-OCO | ocorrencia | CID-10 Y10–Y34 (eventos cuja intenção é indeterminada) |
| 3015 | IND-SEG-SIM-ATL-OCO | ocorrencia | X85–Y09 + Y35: agressões e intervenção legal, o recorte que reconcilia com o Atlas da Violência (324 pares UF × ano idênticos; o único óbito Y36 do período, MG 2022, é a única diferença e fica de fora). Não equivale a homicídio doloso. |
| 3006 | IND-SEG-SIM-AGR-TAXA | residencia | mortes por agressão ÷ população × 100 mil |
| 3007 | IND-SEG-SIM-ATL-TAXA | residencia | (X85–Y09 + Y35) ÷ população × 100 mil |
| 3008 | IND-SEG-SIM-IND-PROP | residencia | indeterminadas ÷ (agressões + indeterminadas + intervenções legais + operações de guerra) |


Mais: **3006** taxa de mortes por agressão, **3007** taxa do recorte Atlas, **3008** proporção de mortes violentas por intenção indeterminada (todas por residência). O recorte Atlas é **X85–Y09 + Y35**; Y36 permanece separado (um único óbito em 13 anos × 27 UFs).

### 6.2 VDE (49 indicadores: 41 contagens + 8 taxas anuais)

Evento nativo × abrangência (Estadual/PF/PRF) vira um indicador; dimensões agente, arma, faixa etária e sexo foram **somadas** (documentado no indicador). As 6 combinações que são zero em todos os anos (PF: furto/roubo de veículo, roubo de carga, roubo a instituição financeira; PRF: morte e suicídio de agente) **não viram indicador** (zero estrutural).

| Evento nativo (VDE) | Medida (coluna) | Nível | Abrangências → indicador | Taxa anual |
|---|---|---|---|---|
| Homicídio doloso | vítimas (total_vitima) | município + UF | Estadual → 3101 | 3201 |
| Tentativa de homicídio | vítimas (total_vitima) | município + UF | Estadual → 3102 | 3202 |
| Roubo seguido de morte (latrocínio) | vítimas (total_vitima) | município + UF | Estadual → 3103 | 3203 |
| Lesão corporal seguida de morte | vítimas (total_vitima) | município + UF | Estadual → 3104 | 3204 |
| Feminicídio | vítimas (total_vitima) | município + UF | Estadual → 3105 | — |
| Tentativa de feminicídio | vítimas (total_vitima) | município + UF | Estadual → 3106 | — |
| Suicídio | vítimas (total_vitima) | município + UF | Estadual → 3107 | 3205 |
| Mortes a esclarecer (sem indício de crime) | vítimas (total_vitima) | município + UF | Estadual → 3108 | — |
| Morte no trânsito ou em decorrência dele (exceto homicídio doloso) | vítimas (total_vitima) | município + UF | Estadual → 3109 | 3206 |
| Mortes no trânsito | vítimas (total_vitima) | município + UF | Polícia Federal → 3110; PRF → 3111 | — |
| Mandado de prisão cumprido | mandados cumpridos (total) | município + UF | Estadual → 3112; Polícia Federal → 3113 | — |
| Estupro | vítimas (total_vitima) | somente UF | Estadual → 3114 | 3207 |
| Estupro de vulnerável | vítimas (total_vitima) | somente UF | Estadual → 3115 | 3208 |
| Tráfico de drogas | ocorrências (total) | somente UF | Estadual → 3116; Polícia Federal → 3117 | — |
| Furto de veículo | ocorrências (total) | somente UF | Estadual → 3118 | — |
| Roubo de veículo | ocorrências (total) | somente UF | Estadual → 3119 | — |
| Roubo de carga | ocorrências (total) | somente UF | Estadual → 3120 | — |
| Roubo a instituição financeira | ocorrências (total) | somente UF | Estadual → 3121 | — |
| Arma de Fogo Apreendida | armas (total) | somente UF | Estadual → 3122; Polícia Federal → 3123 | — |
| Apreensão de Cocaína | peso (total_peso) | somente UF | Estadual → 3124; Polícia Federal → 3125 | — |
| Apreensão de Maconha | peso (total_peso) | somente UF | Estadual → 3126; Polícia Federal → 3127 | — |
| Morte de Agente do Estado | vítimas (total_vitima) | somente UF | Estadual → 3128; Polícia Federal → 3129 | — |
| Suicídio de Agente do Estado | vítimas (total_vitima) | somente UF | Estadual → 3130; Polícia Federal → 3131 | — |
| Morte por intervenção de Agente do Estado | vítimas (total_vitima) | somente UF | Estadual → 3132; Polícia Federal → 3133; PRF → 3134 | — |
| Pessoa Desaparecida | vítimas (total_vitima) | somente UF | Estadual → 3135 | — |
| Pessoa Localizada | vítimas (total_vitima) | somente UF | Estadual → 3136 | — |
| Atendimento pré-hospitalar | atendimentos (total) | somente UF | Estadual → 3137 | — |
| Busca e salvamento | ocorrências (total) | somente UF | Estadual → 3138 | — |
| Combate a incêndios | ocorrências (total) | somente UF | Estadual → 3139 | — |
| Emissão de Alvarás de licença | alvarás (total) | somente UF | Estadual → 3140 | — |
| Realização de vistorias | vistorias (total) | somente UF | Estadual → 3141 | — |


Taxas anuais só existem para vítimas de eventos com população geral válida (8 eventos) e **abrangência Estadual**; feminicídio e tentativa de feminicídio ficam **sem taxa**, porque a taxa correta é por 100 mil *mulheres* e não há população feminina compatível carregada.

**`G2_CRIME_SEMANTICS = PASS`**

---

## 7. SIM — extração, publicação e cobertura (G3, G9)

- **Reuso:** nenhum download; `locateSimFile` escolhe pelo manifesto o definitivo (precedência) ou o preliminar mais recente; confere o tamanho antes de decodificar. Os extratores e indicadores de Saúde **não foram modificados** — foi criada uma projeção agregada própria (`sim_seg_extract.py`) que só conta por município e grupo CID.
- **Perspectivas separadas:** residência (27 fatias por ano, `dataset 15`, uma por UF de residência) e ocorrência (1 fatia nacional por ano, `dataset 16`, `uf = 0`, reunindo os 27 arquivos). Nunca no mesmo indicador.
- **Município ignorado:** códigos `xx0000`, vazios, inexistentes ou de outra UF vão ao "município ignorado" da UF (nunca descartados, nunca fabricados). Residência: **9.189** óbitos por agressão (1,40 % de 655.690). Ocorrência: **71**. O total nacional de agressões (655.690 em 13 anos) é **idêntico** nas duas perspectivas.
- **Universo:** todo município vigente da UF recebe **zero explícito** quando não há óbito (a ausência de linha deixa de ter ambiguidade); município sem instalação comprovada só entra se houver óbito.
- **Privacidade:** o RAW é lido em processo Python de vida curta; sai apenas JSON com **contagens por (código de município, grupo CID)**. Nenhum registro individual é lido além dos campos TIPOBITO, DTOBITO, CAUSABAS, CODMUNRES, CODMUNOCOR, nem persistido.
- **Idempotência/retificação:** o hash da fatia inclui a versão do parser; o mesmo arquivo reprocessado devolve `NO_CHANGE`; o definitivo de 2025 substituirá o preliminar na mesma fatia (hash e `stage` novos); a republicação por mudança de contrato (esta execução ajustou o recorte Atlas) reescreveu apenas as 4 linhas afetadas, com change log.
- **Cobertura por UF × ano:** `cobertura_sim.csv` (351 linhas, com arquivo, SHA-256, registros lidos, grupos, municípios com óbito e universo).

**`G3_SIM_NATIONAL = PASS_WITH_CAVEATS`** — todas as 27 UFs × 13 anos têm contagens, manifesto verificado por hash e publicação reconciliada (Σ municípios + ignorado = UF = arquivo, verificada dentro da transação). Ressalvas: 2025 é preliminar (status 1, sinal `preliminary`); a ocorrência exclui residentes no exterior (arquivo DOEX não preservado).
**`G9_SIM_PUBLISHED = PASS`**

---

## 8. SIM × Atlas (G4)

Detalhe em `reconciliacao_sim_atlas.md` e `…_detalhe.csv`. O arquivo do Atlas (`AVIOL12_HOMIC`, 64,6 MB) foi preservado no RAW (SHA-256 `b9091a08…24da`) e é só conferência.

| Nível | Pares comparáveis | Idênticos |
|---|---:|---:|
| UF × ano (2013–2024) | 324 | **324 (100 %)** |
| Município × ano (2013–2022) | 55.340 | 53.339 (96,38 %) |

Os 2.001 municipais divergentes: **2.000 em 2020** — o próprio Atlas é inconsistente nesse ano (Σ municípios do Atlas = 51.755 > Σ UFs do Atlas = 49.868; 10 UFs com municípios somando mais que a UF), enquanto os totais do Cívica por UF coincidem com o Atlas — e **1 em 2022** (município 3102308/MG): o único óbito Y36 do período, que o Atlas municipal parece incluir e o recorte fixado exclui. Em todos os outros anos (2013–2019, 2021, 2022) os municípios coincidem integralmente (p. ex. 2019: 5.565 de 5.565; 2021: 5.563 de 5.563).

**Resíduo de causa indeterminada** (2025 preliminar: SP 65,6 %, MG 65,9 %, RJ 56,4 %, DF 49,3 %, CE 46,4 %; definitivo 2021: SP 58,5 %, MG 43,4 %, SC 27,5 %): o contrato de leitura devolve sempre `indeterminateShare` e a restrição explícita de que taxas de agressão não podem ser comparadas entre UFs sem ele; **nada foi reclassificado**.

**`G4_SIM_RECONCILIATION = PASS_WITH_CAVEATS`** (UF e controles do ES: exatos; município 2020 não reproduzível por inconsistência do Atlas).

---

## 9. VDE — RAW, parser e territorial (G5, G6, G7)

- **Download:** `fetchRaw` com User-Agent de navegador, `curl --retry 5` com `-C -` (retomável), SHA-256, manifesto (`MANIFEST.jsonl` + `exec_raw_manifest`), pasta datada `seguranca/sinesp-vde/2026-10-21/` e `dedupeByHash` (republicação com conteúdo diferente cria nova versão; idêntica não duplica). HEAD 403 não é tratado como indisponibilidade. 12 arquivos, 293.133.871 B. O arquivo de 2026 traz 9 meses (jan–set); **nenhum mês futuro foi preenchido**, e meses totalmente zerados em todo o arquivo seriam descartados (função `findEmptyMonths`, testada).
- **Parser em fluxo** (zip + XML, sem pandas): 40 s por arquivo; totais conferidos contra pandas (2025: vítimas 367.142, total 5.400.060, peso 2.945.946,29 — idênticos). Layout de 14 colunas validado nos 12 anos (iguais), 31 eventos estáveis, universo de 5.597 pares (5.570 municípios + 27 "NÃO INFORMADO") constante, por indicador, em todos os meses de 2015–2026 (verificado em `exec_seg_cov`).
- **Regras:** linhas repetidas na mesma chave são somadas (201.686 em 12 anos; DF informa por região administrativa sob o nome BRASÍLIA); vazio ≠ zero; apenas valores ≠ 0 são persistidos por município; o universo (inclusive zeros) está em `exec_seg_cov`.
- **Crosswalk** `vde-xw-v1`: UF + nome normalizado → entidade IBGE, **sem fuzzy**; 6 aliases com evidência e data (lista versionada em `seguranca-defs.ts`, auditoria completa em `crosswalk_vde_ibge.csv`, 5.598 linhas: os 5.597 pares + 1 município IBGE sem par); colisão de nome na mesma UF e alias sem município canônico interrompem a carga.

**`G5_VDE_RAW = PASS`** · **`G6_VDE_PARSER = PASS`** · **`G7_VDE_TERRITORIAL = PASS`**

---

## 10. VDE — publicação e reconciliação (G10)

Fatias `UF × ano` (`dataset 17`), cada uma com valores + `exec_seg_cov` numa única transação, verificação interna (Σ municípios + ignorado = UF por indicador e mês) e change log nas republicações.

- 324 fatias publicadas (27 × 12); 141 competências; 1.266.767 valores; 149.606 registros de cobertura.
- Reconciliação independente (`reconciliacao_vde.md`, `reconciliacao_vde_totais.csv`): 474 combinações ano × indicador, **todas iguais**.
- Comparação com a publicação oficial (Mapa da Segurança Pública 2026, extração do Sinesp em 25/02/2026), Brasil 2025: homicídio doloso 31.448 × 31.518 (+0,22 %), tentativa 34.199 × 33.881 (−0,93 %), feminicídio 1.548 × 1.578 (+1,94 %), lesão corporal seguida de morte 644 × 643, intervenção de agente do Estado 6.583 × 6.601, mortes no trânsito 25.030 × 25.074. As diferenças são de revisão posterior à extração do Mapa e **não foram ajustadas**.
- **Cobertura:** `cobertura_vde.csv` (UF × ano × evento); mensal completo em `D:\Civica\reports\seguranca-p91\cobertura_vde_mensal.csv` (149.606 linhas, 20 MB, fora do repositório).
- **Zero ambíguo:** 42.290 de 149.606 UF × evento × mês são zero em toda a UF (28,3 %). Em homicídio doloso, só GO 2015 (12 meses), GO 2016 (3), RR 2015–2017 (11 meses/ano) — UFs que provavelmente não reportaram. Esses meses recebem a flag `zeroAmbiguous` e `status = 2` na cobertura; a leitura devolve `sem_relato_ou_zero`, nunca "zero reportado".

**`G10_VDE_PUBLISHED = PASS_WITH_CAVEATS`** — completo e reconciliado; ressalvas: zero ambíguo e 2026 provisório (status 1 até a próxima republicação do arquivo).

---

## 11. Persistência (G8), taxas (G11) e leitura (G12)

**Modelo D reutilizado:** `exec_entity`, `exec_ind_def/value/latest`, `exec_publication`, `exec_ingestion_run`, `exec_raw_manifest`, `exec_change_log`, `exec_territory_population`. Sem tabela por UF/município, sem schema territorial ou de população paralelo. `replaceIndicatorsBulk` troca o escopo (indicadores × entidades da UF × período) em lote, loga `I/U/D` no formato do motor (o `rollbackRun` existente continua exato — testado) e refaz `exec_ind_latest` só nos pares tocados. A carga inicial de uma fatia usa `bootstrap` (sem change log, recuperável por replay do RAW), como as demais cargas do Executivo; **não foi aplicada nenhuma retenção destrutiva do change log**.

**Taxas (G11):** `contagem ÷ população do mesmo ano × 100.000`, população do `exec_territory_population` (SIDRA 6579); sem denominador, a contagem é persistida e a taxa **não é gravada** (2022 e 2023 não têm estimativa oficial; sem interpolação; Censo/estimativa/projeção não foram misturados). Município com menos de 20 mil habitantes leva o sinal de pequeno número. Taxa por 100 mil mulheres: não calculada.

**Leitura (G12):** `getSegState(uf)` e `getSegMunicipality(entityId)` devolvem, para cada métrica, valor, numerador/denominador, unidade, fonte, definição, competência, granularidade, perspectiva, provisoriedade, flags, restrições de comparabilidade e cobertura (anos SIM, meses VDE, meses ambíguos, anos sem população); opções `indicatorIds` e `from` reduzem o payload. Município sem linha no VDE vira `zero_reportado` **somente** se a UF-mês tem registros e o universo do arquivo está completo; caso contrário `sem_relato_ou_zero`.

Desempenho real no banco (`desempenho_consultas.json`): perfil de estado 5 consultas, 32–40 ms; perfil de município 6 consultas, 5–12 ms; planos por índice (`exec_ind_value_pkey`, `exec_seg_cov_pkey`), execução 0,2–3,3 ms. Nenhum índice novo foi necessário. Payload completo ≈ 0,8 MB (estado) e 0,25 MB (município), reduzível por opções.

**`G8_PERSISTENCE = PASS`** · **`G11_RATES_AND_DENOMINATORS = PASS_WITH_CAVEATS`** · **`G12_SERVING_CONTRACT = PASS`**

---

## 12. Privacidade (G13), armazenamento (G14), regressão (G15), testes (G16)

**Privacidade — `PASS`.** O pipeline lê registros individuais do SIM só em memória/stream, persiste exclusivamente contagens; o VDE já é agregado. Tabelas novas: apenas códigos e números. Os JSON de staging (137 MB) contêm somente contagens por código de município. Nenhum endpoint, rota ou API foi criado; o RAW do SIM não foi duplicado; os microdados estaduais com atributos pessoais (SP, RS, ES, CE, PE, AL) **não foram coletados**.

**Armazenamento — `PASS`** (medido; `armazenamento_execucao.csv`):

| Medida | Antes | Depois |
|---|---:|---:|
| PostgreSQL (banco) | 21.907.737.747 B | 22.264.155.283 B (+356,4 MB) |
| Schema `civica_exec` | 5.709.496.320 B | 6.065.315.840 B |
| `exec_ind_value` (total) | 796,96 MB (4,07 M linhas) | 1.105,7 MB (6,20 M linhas) — Segurança: 2,13 M linhas, ≈ 145 B/linha com índices |
| `exec_seg_cov` | — | 19,2 MB (149.606 linhas) |
| `exec_ind_latest` | 61,4 MB | 88,9 MB |
| `exec_change_log` | 3.428.687.872 B | idem (+4 linhas de log de Segurança) |
| WAL gerado | — | ≈ 1,50 GB |
| RAW SSD novo | — | 293,1 MB (VDE) + 64,7 MB (Atlas) |
| Staging (caches agregados) | — | 136,9 MB |
| SSD livre | 435,2 GiB | 434,9 GiB |
| Disco do PostgreSQL livre | 41,2 GiB | 40,6 GiB |

Comparação com a projeção da P9: VDE previsto ≈ 1,2 M linhas não-zero (real 1,27 M); SIM previsto ≈ 0,7 M (real 0,87 M, por conta dos zeros explícitos). O custo real da P9.1 (≈ 0,33 GiB sem log) está dentro da faixa do Cenário A.

Tempos: publicação SIM 2013–2025 com extração em cache 180 s; VDE 2015–2026 em cache 167 s; republicação SIM 95 s; extração a frio ≈ 40 s por XLSX e 2–5 min por ano de DBC (SP/MG/RJ dominam).

**Regressão — `PASS`.** Fingerprints iguais (seção 4); `quem-me-representa` byte a byte igual; as quatro páginas territoriais de Saúde/Estados idênticas depois de um ajuste que esta execução precisou fazer: `getCoverage` listava os novos datasets (15–17) na linha "fontes" das páginas de Saúde, e passou a filtrar `dataset_id < 15`. `npm run typecheck`: sem erros.

**Testes — `PASS_WITH_CAVEATS`:**

- 64 testes (Executivo + Segurança), **0 ignorados**, todos aprovados, em PostgreSQL 17 descartável (porta 55433): CID-10, universo e zeros do SIM, município ignorado, DF, perspectivas, Y36, crosswalk e aliases, colisões, zero ambíguo, meses futuros, taxas, falhas de contrato, migração v2, bootstrap, `NO_CHANGE`, republicação com change log, `rollbackRun` exato, falha injetada após aplicar, reconciliação que barra a publicação, contratos de leitura (≤ 6 consultas), XLSX válido/corrompido/sem colunas/truncado, DBC inválido, arquivo incompleto, definitivo × preliminar, download indisponível, cache de extração, SSD trocado.
- Suíte completa: 374 testes, 344 aprovados, 0 falhas, 30 ignorados (legislativos/Pix; exigem o banco legislativo local) — **não usados como evidência**.
- Não testado: retomada de download interrompido no meio de um arquivo (`-C -`); apenas falha de conexão.

---

## 13. Problemas encontrados e ressalvas

1. **Y36 × Atlas:** o recorte inicial (X85–Y09 + Y35 + Y36) divergia do Atlas em exatamente 1 óbito (MG 2022). O recorte foi corrigido para X85–Y09 + Y35 e todas as fatias do SIM foram republicadas (contrato `sim-seg-v2`; 4 linhas alteradas, com change log).
2. **Atlas municipal 2020 inconsistente** (seção 8): 2.000 pares divergentes não são erro do Cívica; permanecem listados.
3. **Zero ambíguo do VDE** (28,3 % dos UF × evento × mês; ver seção 10): leitura marca `sem_relato_ou_zero`.
4. **Correções à P9:** apreensões em `total_peso` (unidade não declarada); "Mortes no trânsito" são de rodovias federais; denominador do crosswalk.
5. **Falha de ambiente (minha):** o cluster descartável foi criado dentro do staging do projeto e o cálculo de orçamento do staging (`dirSize`) tropeçou em arquivo temporário do PostgreSQL, derrubando o ensaio do SIM; movido para `D:\Civica\pgtest_p91`. A carga é idempotente e retomou do ponto da falha (os caches de extração por hash evitaram redecodificar).
6. **Efeito colateral nas páginas de Saúde** (datasets 15–17 na linha de fontes): detectado pela comparação de SSR e corrigido.
7. Os totais VDE variam com a data da extração: o arquivo é reescrito pela fonte; cada republicação com hash novo substitui a fatia e registra o log.
8. **Diferenças entre SIM e VDE são esperadas** (ES 2025: SIM preliminar 919 agressões × VDE 762 homicídios dolosos): conceitos distintos; o contrato de leitura sempre as separa.

## 14. Pendências (fora do escopo desta onda)

- Página de Segurança no frontend (os contratos estão prontos; nada foi construído).
- Reexecução periódica: o VDE do ano corrente deve ser rebaixado/republicado mensalmente (o `vde-range` é idempotente); não foi criado agendador.
- Substituição do preliminar 2025 do SIM pelo definitivo quando o DATASUS publicar (basta preservar o arquivo e rodar `sim 2025`).
- População feminina para taxas de feminicídio; estimativa de população 2022–2023 (sem série oficial compatível).
- Boa Esperança do Norte: sem par no VDE; revisar quando houver data de instalação comprovada.
- Retenção do `exec_change_log`: nada aplicado; requer autorização (seção 17 do prompt).
- Cluster descartável de teste removido ao final; o backup `pre-seguranca-p91-20261021.dump` permanece em `D:\Civica\backups`.

## 15. Gates finais

| Gate | Estado | Evidência |
|---|---|---|
| G0_INFRASTRUCTURE_SAFETY | PASS | banco correto, sem sessões/locks/runs; logs sem PANIC; backup restaurado em cluster descartável com contagens idênticas; volume D: = GUID esperado; 351 arquivos do SIM verificados por SHA-256; fingerprints registrados |
| G1_P9_CONTRACT_RECONCILIATION | PASS | errata na origem: gates 5/10/7 verificados por programa; denominadores do crosswalk (5.597 / 5.570 / 5.564 / 6 / 0 / 27); calendário 5.571 × 5.570; correções de leitura da P9 |
| G2_CRIME_SEMANTICS | PASS | contratos tipados em código, SIM ≠ VDE, vítima/ocorrência/mandado/peso separados, proibições de equivalência cobertas por testes |
| G3_SIM_NATIONAL | PASS_WITH_CAVEATS | 27 UFs × 13 anos, 351 fatias reconciliadas com o arquivo; 2025 preliminar; ocorrência exclui residentes no exterior (DOEX não preservado) |
| G4_SIM_RECONCILIATION | PASS_WITH_CAVEATS | UF × ano: 324/324 idênticos ao Atlas (controles do ES exatos); município: 53.339/55.340, com 2.000 divergências em 2020 por inconsistência interna do Atlas e 1 por Y36 |
| G5_VDE_RAW | PASS | 12 arquivos, SHA-256, manifesto, pasta datada, dedupe por hash, User-Agent; 2026 com 9 meses sem preenchimento futuro |
| G6_VDE_PARSER | PASS | layout validado nos 12 anos; medidas por evento fixadas e verificadas; zeros, nulos e linhas repetidas tratados; eventos novos interrompem a carga |
| G7_VDE_TERRITORIAL | PASS | 5.570/5.570 nomes válidos conciliados, 0 não conciliados, 27 NÃO INFORMADO na UF; totais estaduais preservados em todas as fatias |
| G8_PERSISTENCE | PASS | modelo D reutilizado; única estrutura nova (exec_seg_cov) mínima, testada em cluster isolado, reversível, com backup restaurável; Saúde intacta |
| G9_SIM_PUBLISHED | PASS | 351 fatias de residência + 13 de ocorrência; Σ municípios + ignorado = UF = arquivo; idempotência, replay e retomada comprovados |
| G10_VDE_PUBLISHED | PASS_WITH_CAVEATS | 324 fatias, 141 competências, 474/474 totais iguais ao arquivo; zero ambíguo em 28,3 % dos UF × evento × mês; 2026 provisório |
| G11_RATES_AND_DENOMINATORS | PASS_WITH_CAVEATS | taxas só com denominador do mesmo ano; 2022–2023 sem estimativa; sem taxa por 100 mil mulheres |
| G12_SERVING_CONTRACT | PASS | contratos tipados de estado e município, cobertura explícita, 5–6 consultas, 5–40 ms |
| G13_PRIVACY | PASS | somente agregados; nenhum registro individual persistido; nenhum endpoint novo; RAW do SIM não duplicado |
| G14_STORAGE | PASS | PostgreSQL +340 MiB, SSD +358 MB, WAL ≈ 1,5 GB, medidos |
| G15_REGRESSION | PASS | fingerprints de Saúde e entidades idênticos; páginas de estado/município/Saúde byte a byte iguais; Legislativo intacto; typecheck limpo |
| G16_TESTS | PASS_WITH_CAVEATS | 64/64 sem ignorados; suíte completa 344 aprovados, 0 falhas, 30 ignorados (legislativos); retomada de download parcial não testada |

Contagem: 12 PASS, 5 PASS_WITH_CAVEATS, 0 PARTIAL, 0 FAIL, 0 NOT_EVALUATED, 0 PROVEN_EXTERNAL_BLOCKER. Nenhum gate foi declarado PASS por simples existência de página ou arquivo.

## 16. Resumo obrigatório

| Item | Valor |
|---|---|
| UFs SIM | **27/27** |
| Anos SIM | **13/13** (2013–2024 definitivos + 2025 preliminar) |
| Municípios SIM | **5570** com série (de 5.571); **5475** com ao menos 1 óbito por agressão na série |
| UFs VDE | **27/27** |
| Anos VDE | **12/12** (2015–2026) |
| Competências VDE publicadas | **141** (201501–202609) |
| Eventos estaduais (somente UF) | **20** |
| Eventos municipais | **11** |
| Correspondências IBGE | **5570/5570** nomes válidos (5564 diretos + 6 aliases); 27 NÃO INFORMADO; 0 não conciliados |
| Registros ignorados por município | VDE: **633** chaves UF × evento × mês com valor no município ignorado (nenhuma perda de total); SIM: **9189** óbitos por agressão (residência) de 655.690 |
| Agregados persistidos | **2,133,062** valores (866,295 SIM + 1,266,767 VDE) + 149,606 de cobertura |
| Indicadores publicados | **62** (13 SIM + 41 contagens VDE + 8 taxas VDE) |
| PostgreSQL antes → depois | 21,907,737,747 B → 22,264,155,283 B (**+340 MiB**); schema `civica_exec` +339 MiB |
| SSD antes → depois | 435.2 GiB livres → 434.8 GiB livres (RAW +358 MB; SIM sem duplicação) |
| Testes aprovados | 64/64 (Executivo + Segurança); suíte completa 344 |
| Testes ignorados | 0 nos conjuntos desta onda; 30 na suíte completa (legislativos/Pix, banco local) |
| Erros | 1 de ambiente (cluster de teste dentro do staging) e 1 efeito colateral nas páginas de Saúde, ambos corrigidos; nenhuma falha de dado |
| Ressalvas | seção 13 |

## 17. Como reproduzir

Ver `reproducibilidade/README.md`.
