# Contratos dos programas FNDE e transferências · G9

Estado: **PASS_WITH_CAVEATS** · Fase consumidora: P10.6 · Provas: `fnde_obras_probe.json`, `pdde_reprova_2026.json`, `pdde_{excelall_2025,prestacao_2024}_head.json`, `portal_transferencias_{urls,tamanhos}.json`, medições no RAW federal (`D:\Civica\raw\federal\despesas-execucao\2025*.zip`), transferências de 2025-10 (Portal). Somente leitura.

## 1. Fontes que funcionam (e as que não)
| Fonte | Acesso | Estado |
|---|---|---|
| **Portal da Transparência — Transferências** (`…/download-de-dados/transferencias/AAAAMM`) | zip mensal sem chave, **2014-01 a 2026-09 (153 meses, 514 MB no total; 1–6 MB/mês)** | funciona; traz **tipo de transferência, tipo de favorecido, UF, município SIAFI, ação, plano orçamentário, favorecido (CNPJ/nome) e valor transferido** |
| Portal — Despesas (execução, `despesas-execucao`) | já coletado (RAW federal 2014→) | totais por ação, **sem município** (coluna `Município` vazia nas ações de educação) |
| **PDDE Info** (`fnde.gov.br/pddeinfo`) | HTTP direto, sem chave | funciona: por escola (2014–2026), exportação por município (`excelall`), prestação de contas por UF (`excel`) |
| Tesouro Transparente (CKAN) | API pública, 200 | "Transferências Constitucionais para Municípios/Estados" CSV mensal por município (inclui linhas de Fundeb) |
| SIOPE (Olinda) | ver `contrato_siope.md` | funciona (2017+) |
| `dados.gov.br` (catálogo FNDE) | **401** (exige chave) | `PROVEN_EXTERNAL_BLOCKER` do catálogo |
| `dadosabertos.fnde.gov.br` | **DNS não resolve** (`getaddrinfo failed`) | `PROVEN_EXTERNAL_BLOCKER` |
| `dadosabertos.mec.gov.br` | HTTP **403** | bloqueado |
| FNDE "Liberações" (`sigefweb/index.php/liberacoes`) | HTML 200 | **não analisado**; candidato para PNAE/PNATE por ente (NEEDS_VALIDATION) |
- **Atenção operacional:** o Portal passou a responder **HTTP 405** depois de ~170 requisições (HEAD + GET) em poucos minutos. O coletor da P10.6 deve usar o `HttpGate` (espaçamento, pausa em 405/429) como em `federal.ts`.

## 2. Programas (os 16 itens pedidos, condensados)
Legenda de vínculo: **U→M** União→Município · **U→E** União→Estado · **U→UEx** União→Entidade executora (da escola) · **U→Escola** só com código INEP em fonte que o traga.

### 2.1 PDDE (Dinheiro Direto na Escola) — ação 0515
| Item | Resultado |
|---|---|
| Fontes | (a) PDDE Info por escola/UEx; (b) Portal Transferências (ação 0515); (c) RAW federal (total nacional) |
| Acesso | (a) GET HTML/XLSX; (b) zip mensal; (c) já no D: |
| Histórico | PDDE Info 2014–2026 (seletor de ano); Portal 2014–2026 |
| Beneficiário | **Unidade Executora (UEx)** = entidade sem fins lucrativos da escola (55.431 das 55.456 linhas de out/2025); ocasionalmente a prefeitura (13 linhas) |
| Valor | Portal: **R$ 216,1 mi só em out/2025**; federal 2025: R$ 1.873 mi pagos no ano |
| Previsto × devido × pago | **são diferentes** no PDDE Info (P3: previsto 110.576; devido 115.187; pago 97.576 em Alto Rio Novo/2024) |
| Identidade | PDDE Info: código INEP (8 dígitos, 100%) + CNPJ da UEx/EEx; Portal: CNPJ do favorecido + município; **liga ao INEP pelo CNPJ da UEx** (via PDDE Info) |
| Código INEP | **sim** no PDDE Info |
| CNPJ executor | sim (UEx) |
| Retificações | PDDE Info recalcula por ano; tratar como snapshot com `source_hash` |
| Cobertura | 2023: 27 UFs completo (126.402 escolas, P4); 2024: ES ok (esta fase), outras UFs a re-testar; **2025 por UF falha (HTTP 500, ORA-01722)**, mas `excelall` por **município** funciona (Alto Rio Novo 2025: 39 KB) |
| Reconciliação | Σ escola×destinação (PDDE Info) × Σ por município × Portal (CNPJ) × total federal da ação 0515 |
| Limitações | lote por UF falha em alguns anos; planilha "Contas UEx e EM" contém **agência/conta bancária e saldo** (não persistir dados bancários); filtro de inadimplência quebra (P4) |
| Vínculos | U→UEx→Escola (INEP) comprovado |
| Veredito | **`READY_WITH_CAVEATS`**: por escola 2023 (lote), 2025 por município (≈ 5.570 chamadas/ano), pagamentos do Portal para todos os anos |

### 2.2 Fundeb
| Item | Resultado |
|---|---|
| Fontes | (a) **Complementação da União** — ação 00SB no Portal Transferências; (b) Tesouro "Transferências Constitucionais" (linhas Fundeb por município); (c) SIOPE (aplicação Fundeb, indicadores 27–30) |
| Beneficiário | município (3.787 em out/2025) e Estados (12); tipo de transferência "Constitucionais e Royalties" |
| Valor | Portal out/2025: R$ 4.210,2 mi (85% das linhas com município); federal 2025: **R$ 51.561,5 mi pagos** |
| Histórico | Portal 2014–2026; Tesouro desde 1997 |
| Identidade | município (SIAFI/IBGE) — **não há escola** |
| Limitação | o **significado das linhas `FUNDEB` do Tesouro (contribuição retida × recebimento) precisa de validação** com o PDF de metadados antes de uso; Fundeb **não** é gasto final do ente |
| Veredito | `READY_WITH_CAVEATS` (complementação); `NEEDS_VALIDATION` (receita Fundeb por município) |

### 2.3 PNAE (alimentação escolar) — ação 00PI
| Item | Resultado |
|---|---|
| Fonte provada | **RAW federal**: R$ 5.536,3 mi pagos em 2025 (nacional, sem município) |
| No Portal Transferências | **ausente em 2025-10** (nenhuma linha da ação 00PI; só a cota de salário-educação 0369 com 5.595 linhas) |
| Município/escola | **não comprovado**; P3 também não achou por escola |
| Caminho a validar | FNDE Liberações (HTML), Portal "Transferências fundo a fundo" |
| Veredito | **`PARTIAL`** (total nacional apenas); município/escola `NEEDS_VALIDATION`; só 1 mês foi testado no Portal (as demais tentativas foram bloqueadas com 405) |
- Contratos de alimentação escolar (PNCP) são **outra** coisa: 103 mil contratos temáticos (ver `plano_reuso_pncp_educacao.md`), não repasse do FNDE.

### 2.4 PNATE (transporte escolar) — ação 0969
Portal out/2025: R$ 32,1 mi, 432 linhas, 424 municípios (91% do valor com município), favorecido município/Estado; federal 2025: R$ 853,5 mi. Aquisição de veículos (ação 0E53, "Caminho da Escola"): R$ 79,4 mi em out/2025 (39% do valor com município). **U→M/U→E.** Sem escola. `READY_WITH_CAVEATS`.

### 2.5 Salário-Educação (cota estadual e municipal) — ação 0369
Federal 2025: R$ 18.501 mi pagos; Portal out/2025: 5.595 linhas (por município/Estado). Transferência constitucional/legal (não é gasto). `READY_WITH_CAVEATS`.

### 2.6 Infraestrutura e creches (PAR/Novo PAC)
Portal out/2025: 20RP apoio à infraestrutura (R$ 129,7 mi; 213 municípios), 00SU implantação de escolas de educação infantil (R$ 105,9 mi; 189 municípios, 100% com município), 00OW manutenção da educação infantil (R$ 27,5 mi; 42 municípios), 0509 apoio ao desenvolvimento da educação básica. Beneficiário município/Estado. **Obras** → `contrato_obras_educacionais.md`. `READY_WITH_CAVEATS`.

### 2.7 Outros identificados e não testados
PNLD/livros didáticos (ação 20RQ, R$ 1.266 mi federal 2025; distribuição por escola **não localizada**), bolsas (Pé-de-Meia etc., individuais → fora do escopo por privacidade). `NOT_EVALUATED`.

## 3. Matriz de vínculos (o que cada fluxo permite afirmar)
| Fluxo | Granularidade real | Pode ligar a escola? |
|---|---|---|
| Fundeb (complementação) | U→município/Estado | **não** |
| PNATE / veículos | U→município/Estado | não |
| Salário-educação | U→município/Estado | não |
| PDDE | U→UEx (CNPJ) → escola (INEP via PDDE Info) | **sim, com chave oficial** |
| PNAE | nacional (provado); ente/escola não provado | não provado |
| Obras | obra → escola só se a fonte trouxer INEP | ver G11 |
Fluxos **não equivalentes**: um repasse à prefeitura não é repasse à escola; um repasse à UEx não é gasto da prefeitura.

## 4. Proibições (vinculantes)
1. **Não ratear** valor municipal entre escolas por número de matrículas (a fonte não sustenta).
2. **Não somar repasse e pagamento final** como despesa nova: transferência da União é receita do ente; o gasto aparece no Siconfi/SIOPE do ente.
3. **Previsto ≠ devido ≠ pago** (PDDE): publicar as três medidas separadas.
4. Dados bancários (agência, conta, saldo detalhado de conta) **não persistem**.

## 5. Contrato de coleta (P10.6)
- Portal Transferências: RAW zip mensal em `D:\Civica\raw\federal\transferencias\AAAAMM.zip` (≈ 514 MB para 2014–2026), filtro por `CÓDIGO FUNÇÃO = 12` na construção; chave natural (ano/mês, tipo, favorecido, município, ação, plano orçamentário); publicação por (ano, mês).
- PDDE Info: 2023 (lote por UF) e anos recentes por município; guardar `previsto/devido/pago`, UEx (CNPJ), INEP; descartar colunas bancárias na leitura.
- Reconciliação: total por ação (Portal) × RAW federal; PDDE: Σ escolas × Σ municípios.
- Estimativa de chamadas: PDDE por município ≈ 5.570/ano × tamanho ~40 KB ≈ 220 MB/ano; por UF ≤ 2024 ≈ 27 × ~0,4 MB.

## 6. Limitações
- PNAE por município/escola não comprovado; só 1 mês de Portal foi inspecionado em detalhe.
- Fundeb receita por município depende de validação de significado.
- Anos 2024–2025 do PDDE por UF não foram re-testados em todas as UFs nesta fase.
