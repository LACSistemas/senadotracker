# CÍVICA — P9.3: Efetivos e estrutura das forças de segurança — relatório de execução

Execução em 21/10/2026. **Sem commit e sem push.** Sem scheduler, sem retenção do change log, sem limpeza destrutiva, sem página de Segurança, sem P9.4–P9.7.

## 1. Resumo executivo

O Cívica passou a ter, no PostgreSQL de produção (`civica_exec`, modelo D, **sem nenhuma migração nova**), uma base de efetivos e estrutura institucional de quatro fontes oficiais, cada uma separada das outras:

- **FBSP Raio-X 2026** (dados de 2025): 10 corporações no Brasil e, quando a fonte dá a UF, nas 27 UFs; quadro previsto × existente (PM, PC, polícia penal); taxas por 100 mil habitantes.
- **ESTADIC 2023 e 2019**: efetivo existente da PM e da PC por UF (31/12/2022 e 31/12/2018), unidades operacionais da PM, delegacias da PC. Rondônia recusou em 2023 (estado `refused`, nunca zero).
- **MUNIC 2023 e 2019**: guarda municipal (existência e efetivo) e delegacias/IML/comarca/bombeiros **por município**, nas 5.570 linhas da pesquisa.
- **SIAPE**: registros de vínculo de PF e PRF (agregados por órgão, 9 competências), **sempre separados** do efetivo FBSP.

**152.944 valores** em **62 indicadores** (FBSP 611, ESTADIC 540, MUNIC 151.757, SIAPE 36), 66 publicações transacionais, todas reconciliadas na própria transação. Reexecutar tudo = 59 fatias `NO_CHANGE`. Impressões digitais de Saúde, P9.1, P9.2, entidades, contratos compartilhados e Legislativo **idênticas** antes e depois. Banco +31 MB; WAL +146 MB; C: livre 60,9 → 60,7 GiB.

| Família | Cobertura Brasil | UFs | Municípios | Referência temporal | Indicadores | Estado |
|---|---|---:|---:|---|---:|---|
| Polícia Militar | 413.319 (FBSP); 398.455 (ESTADIC 2022, 26 UFs) | 27 (FBSP), 26 de 27 (ESTADIC 2022), 27 (ESTADIC 2018) | não existe por município | mar/2025; 31/12/2022; 31/12/2018 | 9 (FBSP 5; ESTADIC 4) | PASS_WITH_CAVEATS |
| Polícia Civil | 96.902 (FBSP); 107.968 (ESTADIC 2022) | 27; 26 de 27; 27 | não existe por município | idem | 10 (FBSP 5; ESTADIC 5) | PASS |
| Bombeiros Militares | 63.002 (FBSP, sem SP) | 26 com valor (SP somado à PM) | — | mar/2025 | 2 | PASS_WITH_CAVEATS |
| Perícia | 19.340 (FBSP) | 27 | — | mar/2025 | 2 (FBSP efetivo; ESTADIC vínculo à PC) | PASS |
| Polícia Penal | 91.850 estadual + 1.224 federal | 27 (estadual) | — | mar/2025; jun/2023 | 5 | PASS_WITH_CAVEATS |
| Polícia Federal | 12.536 (FBSP); 17.253 vínculos (SIAPE ago/2026) | não existe por UF | — | abr/2025; mensal | 3 | PASS_WITH_CAVEATS |
| Polícia Rodoviária Federal | 12.328 (FBSP); 14.000 vínculos (SIAPE ago/2026) | não existe por UF | — | mar/2025; mensal | 3 | PASS_WITH_CAVEATS |
| Guardas Municipais | 107.457 (FBSP, 25 UFs; AC e DF inexistentes); 101.854 (MUNIC 2023) | 27 | 1.322 com guarda (2023); 1.188 (2019) de 5.570 | 2025; 31/12/2022; 2019 | 12 (FBSP 5; MUNIC 7) | PASS |
| Existência de delegacias | 4.231 municípios com delegacia de PC (MUNIC 2023); 4.096 (2019) | contagens por UF (ESTADIC) | 5.570 | 2023; 2019 | 15 (MUNIC); as contagens de delegacias da ESTADIC (2) estão em Polícia Civil | PASS_WITH_CAVEATS |

Outros: **Polícia Legislativa** (Câmara + Senado) 563, só Brasil, data-base não informada (1 indicador, `refDateUncertain`). Total: 9 + 10 + 2 + 2 + 5 + 3 + 3 + 12 + 15 + 1 = 62 indicadores (FBSP 26, ESTADIC 10, MUNIC 22, SIAPE 4).

## 2. Fontes

| Fonte | URL oficial | Arquivo no RAW (D:\Civica\raw\seguranca\efetivos) | SHA-256 | Coleta |
|---|---|---|---|---|
| FBSP Raio-X 2026 | forumseguranca.org.br/wp-content/uploads/2026/08/raio-x-forcas-seguranca-2026.pdf | `fbsp-raiox-2026/` (1,85 MB; 164 páginas) | `ae211717…1023` | baixado e preservado |
| ESTADIC 2023 | ftp.ibge.gov.br/Perfil_Estados/2023/Base_Estadic_2023.xlsx | `ibge-estadic-2023/` (245 KB) | `4579ca84…39b9` | idem |
| ESTADIC 2019 | ftp.ibge.gov.br/Perfil_Estados/2019/Base_ESTADIC_2019.xlsx | `ibge-estadic-2019/` (177 KB) | `7adec07a…37be` | idem |
| MUNIC 2023 | ftp.ibge.gov.br/Perfil_Municipios/2023/Base_de_Dados/Base_MUNIC_2023.xlsx | `ibge-munic-2023/` (23,3 MB) | `511d50a2…c759` | idem |
| MUNIC 2019 | ftp.ibge.gov.br/Perfil_Municipios/2019/Base_de_Dados/Base_MUNIC_2019_20210817.xlsx | `ibge-munic-2019/` (24,8 MB) | `a8ca1e21…892b` | idem |
| SIAPE (Portal da Transparência) | dadosabertos-download.cgu.gov.br/…/servidores/AAAAMM_Servidores_SIAPE.zip | **só o agregado** (`siape-agg/`, 9 arquivos `*.agg.json.gz`); o zip (80 MB, dados pessoais) foi descartado; manifesto `state = 3` | hash do zip no agregado e no `exec_raw_manifest` | 202001, 202101, 202201, 202301, 202401, 202501, 202601, 202607, 202608 |

Total novo no RAW: ~49 MB, todo no SSD externo (D:). Nenhuma cópia exploratória foi deixada no C:.

## 3. Contratos (G1, G10)

- **Um indicador por fonte × corporação × medida** (`IND-EFE-FBSP-…`, `…-ESTADIC-…`, `…-MUNIC-…`, `…-SIAPE-…`). IDs 5001–5399, domínio Segurança; as definições carregam definição, comparabilidade e método.
- **Medidas distintas**: existente, previsto, ocupação, diferença, taxa, estrutura (contagem), existência (sim/não) e vínculos. **Nenhuma conversão entre elas.** Nenhum indicador soma corporações; todas as taxas são de uma corporação (teste de contrato nas definições).
- **Ausência é estado**, em bits de `flags` (aditivos): `unavailable` ("..."), `notInformed`, `refused` ("Recusa"), `inexistent` ("-", valor 0 por definição), `composite` (o número inclui outra corporação ou está somado a outra linha), `refDateUncertain`. Linha de pergunta não aplicável não existe.
- **Janela de referência = data-base**, não ano de publicação (`period_start/period_end`). Cada corporação do FBSP tem a sua.
- **Proibições cumpridas**: nenhum efetivo estadual distribuído por município ou população; nenhum SIAPE convertido em policial; nenhum previsto tratado como existente; nenhuma contagem de unidades inferida da existência de delegacia; nenhum guarda somado duas vezes (MUNIC e FBSP coexistem como indicadores separados).
- Documento: `comparabilidade_efetivos.md`.

## 4. Efetivos por instituição (G2, G3, G6)

**FBSP (Tabela 2, 2025)** — Brasil: PM 413.319; CBM 63.002; PC 96.902; perícia 19.340; polícia penal 91.850; PF 12.536; PRF 12.328; polícia penal federal 1.224; polícia legislativa 563; guardas 107.457; **total 818.521**. Σ das 27 UFs = Brasil em todas as colunas por UF; soma das corporações = total em todas as 28 linhas.

**Verificação direta de SP e RS (G2).** A tabela foi aberta no PDF (páginas 14, 22, 24 e 28), renderizada e conferida visualmente; as imagens estão em `reproducibilidade/analise/`. O problema de extração da P9 era real: **a célula do Corpo de Bombeiros de SP está vazia no PDF** (nota 7: os bombeiros já estão somados à PM). No texto corrido a linha de SP vinha com 8 números e deslocava todas as colunas. A extração agora usa a **posição** das palavras (colunas ancoradas na linha "Brasil"): SP PM 82.250 (**inclui bombeiros**, sinalizador `composite`), CBM vazio (sem valor, `composite`), PC 19.420, perícia 4.785, polícia penal 24.898, guardas 30.184, total 161.537. RS: PM 18.360, CBM 2.995, PC 5.771, perícia 825, polícia penal 6.036, guardas 2.436, total 36.423. As duas linhas fecham com o total impresso e, nas Tabelas 3 a 5, com a coluna "relação".

**ESTADIC** — 2023: PM 398.455 e PC 107.968 com **26 respondentes** (Rondônia recusou); 2019: PM 416.923 e PC 117.228 com 27. A ESTADIC só tem PM e PC (efetivo), mais contagem de unidades operacionais da PM e de delegacias da PC. Controles da P9 reproduzidos.

**PF e PRF** — FBSP por Brasil (12.536 e 12.328); SIAPE como **registros de vínculo** (ago/2026: 17.253 e 14.000, reproduzindo os controles da P9). Em PF e PRF situação, cargo, UF e identificador do servidor vêm "Sigiloso": nenhuma distribuição por UF, nenhuma contagem de pessoas, nenhuma conversão para policiais. O SIAPE de PF/PRF é **elegível só como contagem nacional de registros**, rotulada como tal (G6).

## 5. Cobertura territorial (G8)

Brasil (kind 1), 27 UFs (kind 3) e municípios (kind 4) reutilizando `exec_entity`. Nenhuma entidade nova. A MUNIC tem 5.570 municípios e a fundação tem 5.571: o município criado depois **não recebe linha** nem data inventada (coluna `na_pesquisa_*` em `cobertura_munic_guardas.csv`). Invariantes verificados dentro de cada transação: Σ UFs = Brasil (FBSP); Σ municípios = agregado da UF = arquivo (MUNIC); soma no banco = soma do arquivo (ESTADIC).

## 6. Guardas municipais (G4)

MUNIC 2023, reconciliada com os controles da P9: **1.322** com guarda + **4.242** sem + **6** não informaram = **5.570**; efetivo declarado **101.854**; 25 municípios declararam guarda com efetivo zero (marcados `zeroAmbiguous`, nunca omitidos). Município sem guarda **não recebe efetivo** (a fonte marca "-", pergunta não aplicável). Casos de regressão: Vitória 427, Vila Velha 286, Serra 142, Cariacica 43, Alto Rio Novo sem guarda, São Paulo 5.800, Rio de Janeiro 7.238 — todos conferidos no banco.

MUNIC 2019 (edição adicional): 1.188 com guarda, 4.380 sem, 2 recusas; efetivo 99.510. O dicionário 2019 não informa a data-base do efetivo: as linhas levam `refDateUncertain`.

**Sem taxa por 100 mil habitantes para a MUNIC**: o Cívica não tem estimativa populacional oficial para 2018 e 2022; nada foi interpolado. Para o FBSP, a taxa usa a população 2025 (as 80 taxas de PM, CBM e PC conferem com a Tabela 6 do FBSP a até 0,1 por mil).

## 7. Delegacias (G5)

Publicado **só existência** (MUNIC): delegacia de PC e 9 especializadas, IML, sede de comarca e unidade de bombeiros. 2023: 4.231 municípios com delegacia de PC; 2 "Não"; 6 não informaram; **1.331** têm "-" porque marcaram "Nenhuma das citadas" (`MSEG1611`), que exclui a delegacia de PC (guardado como indicador próprio, 5221; a leitura "não possui" é feita pelo read model, explicitamente). 4.231 + 1.333 + 6 = 5.570. Em 2019 a pergunta "nenhuma das citadas" não existe (1.472 "Não" diretos). **Nenhuma contagem de unidades, mapa de endereços ou cadastro de delegacias.** O produto futuro pode dizer "Possui delegacia de Polícia Civil, conforme a MUNIC 2023", sem afirmar funcionamento em 2026.

## 8. Efetivos previstos e existentes (G2)

PM 628.732 previsto × 413.319 existente (65,7 %); PC 175.477 × 96.902 (55,2 %); polícia penal estadual 134.164 × 91.850 (68,5 %). Publicados previsto, ocupação e diferença por UF e Brasil. Ocupação recalculada e conferida contra a coluna impressa (≤ 0,05 p.p.). Ocupação é preenchimento de cargos, **não** cobertura do policiamento. Casos: CE-PM 100,4 % (diferença −90); CE polícia penal sem previsto ("..."); AL polícia penal com "..." impresso mas calculável; **RJ-PM com nota de março/2022** (`refDateUncertain`).

## 9. Fontes divergentes

FBSP e ESTADIC são **mostradas lado a lado**, `comparable: false`, com fonte, data-base e definição (`getSecurityStaffingState().divergences`). Ex. ES-PM: FBSP 9.231 (mar/2025), ESTADIC 7.938 (2022) e 8.710 (2018). Para guardas, MUNIC (1.322/101.854), FBSP-leitura-da-MUNIC (1.306/101.653) e FBSP final (1.384/107.457) coexistem sem fusão. Tabelas completas em `reconciliacao_institucional.md`.

## 10. Histórico (G3, G12 onda E)

- **ESTADIC 2019 e MUNIC 2019** foram **implementadas** porque a comparabilidade foi demonstrada: mesmos códigos `ESEG*`/`MSEG*` e **mesmos rótulos** no dicionário oficial (a carga confere rótulo e contexto, com o ano da data-base) e mesma estrutura. Resultado: dois pontos por fonte (2018 e 2022), **sem nenhum valor para os anos intermediários**.
- **ESTADIC 2014** tem bloco equivalente ("Efetivo **ativo** em 31/12/2013", variáveis A641–A643 e A738–A740): a redação difere ("ativo" × "existente") e os códigos são outros. **Não publicada**; caminho de expansão: tabela de equivalência de variáveis + validação do enunciado.
- ESTADIC 2012/2017/2020/2021/2024 e MUNIC 2018/2020/2021/2024 não trazem o bloco de segurança pública de efetivos (conferido na lista de abas e no dicionário).
- **FBSP**: a edição anterior (2023) aparece só na Tabela 1 (totais nacionais); não foi publicada (dois pontos de uma tabela-resumo, sem as datas-base da edição anterior).
- **SIAPE**: 9 competências; os meses ausentes continuam ausentes.

## 11. Banco e migrations (G9)

**Nenhuma migração** (versões 1–3 inalteradas; `applyExecMigrations` devolve `[]`). A verificação de G9 mostrou que `exec_ind_def/value/latest` suportam o contrato (cardinalidade baixa: 152.944 valores; metodologia em `methodology_note`; mesma medida em várias fontes = indicadores distintos). Mudanças **aditivas**: bits de `flags` (256–8192), IDs de dataset 24–27 em `specs.ts`, opção `includeNational` em `replaceIndicatorsBulk` (padrão `false`; P9.1/P9.2 inalterados) e as definições 5001–5304. Backup restaurável testado (ver §12). Rollback exato testado para FBSP, ESTADIC, MUNIC e SIAPE.

## 12. Reconciliação (G11)

`reconciliacao_institucional.md` — por fonte: 41 verificações do FBSP (Σ UFs = Brasil, soma de corporações = total, existente das Tabelas 3–5 = Tabela 2, guardas Tabela 2 = Tabela 15, ocupação impressa), 80 taxas × Tabela 6, ESTADIC (respondentes, recusas, H+M = total, controles 398.455/107.968), MUNIC (5.570, controles, regressão ES/SP/RJ), GCM FBSP × MUNIC, FBSP × ESTADIC por UF, SIAPE × FBSP. Controles pedidos: ES, SP, RJ, RS, RO, DF e as cinco cidades capixabas, todos verificados. Nenhum total foi ajustado.

G0 (estimativa antes de iniciar): ~150 mil linhas × ~120 B + índices ≈ 30–40 MB de tabelas; WAL ≤ 300 MB; temporários só no D:; margem sobre a reserva de 20 GiB do C: de ~40 GiB. Real: +31 MB e +146 MB de WAL. Limpeza: só artefatos desta execução (cluster de ensaio, cópias exploratórias, caches de extração antigos, cópia de build); nenhum backup, arquivo de outro projeto ou diretório do PostgreSQL foi removido, e `%TEMP%\claude` não foi tocado por esta execução. Backup: `pre-efetivos-p93-20261021.dump` (370 MB, SHA-256 registrado) restaurado em cluster isolado; as 8 contagens dos contratos principais são idênticas às de produção (`reproducibilidade/restore_check.txt`).

## 13. Testes (G15)

| Conjunto | Resultado |
|---|---|
| Novos: `efetivos-p93.test.ts` (16, unit), `efetivos-p93-faults.test.ts` (3), `efetivos-p93.test.ts` de integração (6, PostgreSQL descartável) | **25 de 25 aprovados** |
| Suíte completa (`npm test`) | 426 testes: **396 aprovados, 0 falhas, 30 ignorados** (os mesmos 30 legislativos da P9.2; ignorados não contam como aprovados) |
| Typecheck (`packages/db`, `apps/collector`, `tsconfig.tests.json`) | limpo |
| `next build` | **passou** (Next 16.3.4, Turbopack, exit 0) em **cópia isolada** de `apps/web` + `packages` (`C:/Projetos/build_p93`, com `turbopack.root` ajustado só na cópia). O `.next` de `apps/web` e o servidor do usuário não foram tocados; a cópia foi removida. Tentativas anteriores com junção entre discos e com cópia aninhada falharam por limitação de caminho (logs `next_build_isolado_*_falha.log`), não do código. Log: `reproducibilidade/next_build_isolado.log` |

Cobertura: layout alterado (dicionário, rótulo, contexto/ano, edição trocada), fonte incompleta (linhas, UFs, municípios), célula vazia inesperada, valor desconhecido, município inexistente (`unmatched`), não respondente (recusa e "não informou"), reconciliações que barram a carga, falha injetada depois de aplicar, replay/idempotência, rollback exato, SSD ausente (`VolumeError` antes de qualquer gravação), arquivo corrompido, edições coexistindo, histórico de uma fonte alterado sem tocar a outra edição, e **privacidade do extrator SIAPE** (nenhum nome, CPF, matrícula ou identificador na saída). Os 3 testes antigos que falharam na primeira rodada eram de ambiente: o cluster de teste emitia mensagens em português (`lc_messages`); com `lc_messages = 'C'` a suíte passou limpa.

## 14. Performance (G13)

Medida em produção (7 execuções, 1ª descartada): perfil de **UF = 3 consultas, ~2 ms de relógio, ~42 KB de JSON**; **município = 4 consultas, ~1,5 ms, 25–29 KB**; Brasil = 3 consultas, ~1,4 ms. Todas as consultas principais são `Index Scan` na PK de `exec_ind_value` (0,04–0,16 ms no banco). Nada varre município para obter número de UF (`desempenho_consultas.json`). O contrato de município devolve o total da UF **só** em `stateContext`, rotulado "Contexto estadual" e com aviso "não é o efetivo lotado neste município".

## 15. Armazenamento (G16)

| | Antes | Depois |
|---|---:|---:|
| PostgreSQL (banco) | 23.065.676.947 B | 23.097.082.383 B (**+31,4 MB**) |
| Schema `civica_exec` | 6.858.096.640 B | 6.889.480.192 B (+31,4 MB) |
| WAL gerado | — | **+145,8 MB** (1,17 milhão de registros); 0 checkpoints requisitados a mais |
| `exec_ind_value` | 9.468.854 linhas | 9.621.798 (+152.944) |
| `exec_ind_latest` | 543.605 | 628.103 (+84.498) |
| `exec_change_log` | 16.134.052 | 16.134.052 (**sem alteração**: primeiras cargas são `bootstrap`) |
| Livre no C: | 60,9 GiB | 60,7 GiB (reserva mínima de 20 GiB preservada; inclui temporários de teste e build já removidos) |
| Livre no D: | 440,2 GiB | 439,8 GiB (RAW +49 MB; cluster de ensaio de ~7 GB e cópias exploratórias removidos; backup +370 MB) |

Backup novo validado (370 MB, em `D:\Civica\backups`); os três backups anteriores foram mantidos. Nenhuma retenção do change log; PGDATA não movido; nenhuma dependência global instalada. Detalhe em `armazenamento_execucao.csv`.

## 16. Privacidade (G14)

Só dados agregados e institucionais no banco. As colunas de `exec_ind_value` são numéricas e territoriais (teste de integração). SIAPE: baixado para o staging, **agregado em memória** (colunas lidas: identificador pseudonimizado, órgão, tipo e situação do vínculo, UF e cargo — só para contar), saída com contagens por órgão, **zip descartado** (`state = 3`). Em PF/PRF o identificador também é sigiloso (valor distinto = 1), logo nem a contagem de pessoas é possível. Nada pessoal em log, em API ou em RAW. A lista municipal do FBSP (Tabela 27) não foi importada.

## 17. Ressalvas

1. **SP**: PM inclui bombeiros (nota 7); CBM de SP sem valor; a taxa de PM de SP leva `composite`. O total nacional de CBM (63.002) exclui SP.
2. **RJ-PM**: nota da Tabela 3 diz março/2022; a fonte não esclarece a linha da Tabela 2 (sinalizado em efetivo, previsto, ocupação, diferença e taxa).
3. PF, PRF, polícia penal federal e polícia legislativa: **só Brasil**. Polícia legislativa sem data-base; guardas do FBSP misturam RAIS 2024 e MUNIC 2023 (data incerta, sinalizada).
4. ESTADIC só tem PM e PC; efetivo de CBM, perícia e polícia penal por UF só no FBSP. Sem taxa para ESTADIC/MUNIC (sem população oficial 2018/2022).
5. MUNIC 2019: data-base do efetivo não informada; sem a pergunta "nenhuma das citadas".
6. Existência de delegacia não é quantidade; estrutura declarada em 2019/2023 pode ter mudado.
7. SIAPE: registros, não pessoas; série esparsa (9 meses); sem UF.
8. FBSP leu a MUNIC 2023 com números diferentes da planilha oficial (1.306 × 1.322; 101.653 × 101.854): publicamos a planilha, registramos a diferença.
9. ESTADIC 2014 e a Tabela 1 do FBSP (2023) não foram publicadas (ver §10).
10. 30 testes legislativos continuam ignorados (não dependem desta onda).

## 18. Gates

| Gate | Estado | Evidência resumida |
|---|---|---|
| G0_INFRASTRUCTURE_SAFETY | **PASS** | banco/schema/volume conferidos; C: 60,9 GiB (sobra de ~40 GiB sobre a reserva; carga estimada < 0,5 GiB com WAL); SSD GUID confere; sem jobs/locks; backup restaurado com contagens idênticas |
| G1_STAFFING_SEMANTICS | **PASS** | indicadores por fonte × corporação × medida; sem conversões; testes de contrato |
| G2_FBSP_STAFFING | **PASS_WITH_CAVEATS** | SP/RS verificados visualmente e por soma; ressalvas SP, RJ, CE |
| G3_ESTADIC | **PASS_WITH_CAVEATS** | 2023 (26/27) e 2019 (27/27); RO = recusa; só PM/PC; 2014 não publicada |
| G4_MUNIC_GUARDAS | **PASS** | 5.570 reconciliadas; 101.854; casos de regressão |
| G5_MUNIC_DELEGACIAS | **PASS_WITH_CAVEATS** | existência declarada; binária; sem unidades |
| G6_FEDERAL_STAFFING | **PASS_WITH_CAVEATS** | FBSP nacional; SIAPE só registros nacionais, separados |
| G7_INSTITUTIONAL_STRUCTURE | **PASS_WITH_CAVEATS** | mapa técnico entregue; nenhum cadastro criado (por desenho) |
| G8_TERRITORIAL_IDENTITY | **PASS** | exec_entity reutilizado; 5.570 × 5.571; RO ≠ zero; invariantes na transação |
| G9_PERSISTENCE | **PASS** | sem migração; aditivo; rollback/idempotência testados |
| G10_INDICATOR_COMPARABILITY | **PASS** | nenhuma soma entre corporações; restrições no payload |
| G11_SOURCE_RECONCILIATION | **PASS_WITH_CAVEATS** | 41 + 80 + controles; divergências preservadas |
| G12_BACKFILL | **PASS_WITH_CAVEATS** | ondas A–D completas; E parcial (2019 sim; 2014 e FBSP 2023 não) |
| G13_SERVING | **PASS** | 3 contratos tipados; ≤ 4 consultas; ~2 ms |
| G14_PRIVACY | **PASS** | só agregados; teste de vazamento; zip descartado |
| G15_REGRESSION_AND_TESTS | **PASS_WITH_CAVEATS** | 396/426 aprovados, 0 falhas, 30 ignorados (não contam como aprovados); fingerprints idênticos; typecheck limpo; `next build` passou só em cópia isolada |
| G16_STORAGE_AND_PERFORMANCE | **PASS** | +31 MB, +146 MB de WAL, C: livre 60,7 GiB |
| G17_REPUBLICATION | **PASS** | comandos idempotentes; hash/versão/rollback; proposta de periodicidade; sem scheduler |

Pendências para as próximas ondas (não autorizadas aqui): página de Segurança; cadastro oficial de unidades (P9.6/P9.7); P9.4 (sistema prisional); P9.5 (finanças); retenção do change log; scheduler.

## Entregáveis

`RELATORIO_EXECUCAO_SEGURANCA_P93.md` (este), `cobertura_fbsp.csv` (719 linhas), `cobertura_estadic.csv` (540), `cobertura_munic_guardas.csv` (5.571), `cobertura_munic_delegacias.csv` (5.571), `comparabilidade_efetivos.md`, `reconciliacao_institucional.md`, `mapa_entidades_institucionais.md`, `periodicidade_republicacao.md`, `armazenamento_execucao.csv`, `desempenho_consultas.json`, `results.json`, `summary_relatorio.json`, `reproducibilidade/` (README, G0 antes/depois, restore check, logs de produção, extratores, evidências do PDF, TAP da suíte, log do build isolado).
