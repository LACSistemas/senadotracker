# Reconciliação nacional — Saúde Fase 1 (P1)

Data: 2026-10-21. Banco `projetoeleitor_db`, schema `civica_exec`. Todas as consultas rodaram sobre o estado publicado (publicações ativas).

## 1. CNES (ST/LT/EQ) — competência 202609

Referência: investigação P8 (competência 202609). Resultado: **igualdade exata em todos os quatro totais.**

| Medida | Publicado | P8 |
|---|---|---|
| Estabelecimentos com intervalo vigente em 202609 | 501.726 | 501.726 |
| Leitos existentes (todos os tipos, inclui hospital-dia) | 543.524 | 543.524 |
| Leitos SUS | 362.715 | 362.715 |
| Leitos não SUS | 180.809 | 180.809 |
| Leitos existentes sem hospital-dia (definição do IND-SAU-05) | 528.275 | — |

Cobertura: 27 UFs × 165 competências (201301–202609) × 3 tipos = 4.455 fatias por tipo, **todas publicadas**; integridade de intervalos (`assertIntervalIntegrity`) executada em cada publicação; nenhuma publicação com falha (`exec_ingestion_run.status = 11`: 0 registros ao final).

Observação de método: SP e MG tinham só 202607–202609 do piloto. O motor exige competências contíguas a partir do início e não antepõe histórico; a fatia piloto dessas UFs foi desfeita (somente linhas de `civica_exec` de SP/MG, datasets 3–5) e recarregada de 201301 em diante. Os hashes das três competências do piloto estão em `_reset_pilot_31.json` e `_reset_pilot_35.json`; o RAW foi preservado.

## 2. CNES-PF (profissionais, agregados município × grupo de CBO)

- Calendário aprovado: dezembro de 2013 a 2025 + 202609 = 14 snapshots × 27 UFs = **378 fatias publicadas**.
- 202609: 5.571 municípios, 6.816.036 vínculos, 5.413.616 pessoas (agregado). Nenhum registro individual persistido; os arquivos RAW de profissionais são mantidos porque o agregado depende deles.

## 3. SIH-RD (valores **aprovados**, não pagamentos)

- 163 competências (201301–202607) × 27 UFs = **4.401 fatias por hospital** e **163 fatias por residência**, todas publicadas.
- **Hospital × residência:** em todas as 163 competências, a soma de AIH por hospital é igual à soma por município de residência (diferença máxima 0 AIH e 0 centavos). Total de AIH: 167.967.146. Isso prova que a deduplicação, o roteamento por UF e a atribuição territorial não perderam nem duplicaram internações.
- **Junho/2024** (referência do piloto): 1.188.890 registros brutos, 183 duplicatas, 1.188.707 AIH, ICSAP 187.892 = 15,81 %, R$ 1.969.984.744,80 — idêntico ao publicado no G0–G9 e ao P8.
- **Julho/2026** (último mês): 1.271.441 AIH, ICSAP 186.515 = 14,67 %.
- **Código de residência fora do catálogo IBGE:** códigos 53xxxx do DF (regiões administrativas) são atribuídos a Brasília (único município do DF). Outros códigos 6 dígitos de UF válida iriam para "município ignorado" da UF; códigos de exterior/inválidos são descartados e contados em `quality.aihDroppedNoTerritory` (limite de bloqueio 0,1 %); nenhum mês chegou a esse limite.
- **Deduplicação:** uma ocorrência por `(N_AIH, IDENT, ANO_CMPT, MES_CMPT)` dentro do arquivo; duplicatas por competência ficam em `quality.duplicatesDropped` de cada run.
- **202608:** AC e RR sem arquivo no FTP; fora da série (regra de não misturar competências incompletas).
- Reprocessamento: o parser de residentes passou a `sih-resid-v3` (DF → Brasília); todos os 163 meses foram republicados nessa versão.

## 4. SIM e SINASC

- 27 UFs × 13 anos (2013–2025) = **351 fatias de cada** publicadas. 2025 é preliminar (`stage = 1`, flag `preliminary`), logo 27 fatias de cada com ressalva.
- **Erratum ao G0–G9:** o relatório anterior afirmava "SIM/SINASC 2013–2025 nas 27 UFs"; na verdade só o ES tinha a série inteira, as demais tinham 2024 (39 fatias). A série foi completada nesta execução (312 fatias novas de cada).
- Brasil 2024 (soma das 27 UFs): mortalidade infantil **12,56 ‰**, partos cesáreos **60,62 %**, pré-natal ≥ 6 consultas **87,50 %** — iguais à referência (12,56; 60,6; 87,5). Denominadores: 2.389.325 nascidos (UFs) e 2.389.271 (municípios; a diferença de 54 são nascidos em "município ignorado").

## 5. PNI (arquivo nacional `Cobertura_Residencia.parquet`)

- Um download (5,09 MB), 27 UFs publicadas, 5.571 municípios, 34 imunobiológicos, 2015–2026, 1.093.771 linhas de indicador.
- 330.173 linhas acima de 100 % mantidas com o flag `above100` (sem truncar). Ano da carga (2026) com `partialCoverage`.
- Versão do arquivo preservada por data de download; um novo download idêntico não duplica a cópia (`dedupeByHash`).

## 6. Indicadores publicados (municípios com valor)

| Código | Municípios | Valores | Período |
|---|---|---|---|
| IND-SAU-05 / 05S (leitos / leitos SUS por mil hab.) | 5.571 | 921.628 | 2013-01 a 2026-09 |
| IND-SAU-08 (mortalidade infantil) | 5.571 | 72.961 | 2013 a 2025 |
| IND-SAU-10 (ICSAP) | 5.570 | 912.223 | 2013-01 a 2026-07 |
| IND-SAU-11 / 12 (pré-natal / cesáreas) | 5.571 | 72.961 cada | 2013 a 2025 |
| IND-SAU-07:* (coberturas vacinais) | 5.571 | 1.093.771 | 2015 a 2026 |

Município sem registro continua sem linha (nunca zero). Pequeno número (< 100 nascidos) e `noDenominator` (anos sem população oficial) sinalizados por flag.

## 7. Integridade de proveniência

- RAW verificado após toda a carga: 18.861 arquivos, 23.430.094.246 bytes; **0 divergências** entre arquivo e manifesto; 4 arquivos fora do manifesto (respostas de sondagem Siconfi, `raw/siconfi/g5-probe-2026-10-19/`).
- `exec_raw_manifest`: 18.857 entradas, nenhum caminho absoluto (todos relativos à raiz de RAW).
- Duas execuções antigas (run 7952 e 19330, dataset 11) ficaram sem `parser_version` por um defeito do `ON CONFLICT` na reabertura de run; os campos foram preenchidos manualmente (`sih-resid-v3`) e o código passou a gravar `parser_version` e `bootstrap` nessa situação (`packages/db/src/exec/publication.ts`).
