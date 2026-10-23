# PNCP (P9.5) — status final

**PNCP_P95_STATUS: PUBLISHED · RECONCILED · NO_CHANGE_VERIFIED** (23/10/2026, 15:04–15:09 no horário local).

## Verificação inicial (antes de qualquer ação da P9.7)
- Coletor: **COLLECTOR_FINISHED** — nenhum processo `pncp-fetch` ativo; `01.jsonl.gz`…`10.jsonl.gz` de 2026 presentes e fechados (`10` às 14:46). Arquivos parciais restantes: nenhum.
- Antes, o supervisor tinha sido cancelado por Ctrl+C (resultado `-1073741510`) por um terminal fechado sem querer; o lock ficou órfão (processo morto) e foi retomado pelo próprio script. Nada foi apagado nem alterado (RAW, logs, checkpoints).
- Publicação: **PUBLICATION_PENDING** até o passo seguinte.

## Ação
Disparei o **mecanismo persistente existente** (`schtasks /Run /TN Civica-P95-PNCP-Finish`), sem script novo e sem iniciar coleta. O supervisor encontrou `missingMonths: []`, publicou e se auto-desabilitou.

## Resultado (log `D:\Civica\state\pncp-finish.jsonl`, estado `DONE`, tentativa 17)
| Ano | Contratos lidos | Retidos no RAW | Linhas em `exec_fin_contract` | Republicação |
|---|---:|---:|---:|---|
| 2025 (12 meses) | 2.023.034 | 69.733 | 69.733 | `NO_CHANGE` |
| 2026 (jan–out, parcial) | 1.712.181 | 52.279 | 52.279 | `NO_CHANGE` |

2026: 46.464 institucionais, 2.658 temáticos, 3.157 ambos; 41 sem ente, 2.818 de pessoa física omitidos (nunca persistidos). Série completa no banco: 2021 (135), 2022 (806), 2023 (2.304), 2024 (39.893), 2025 (69.733), 2026 (52.279).

## Estado da tarefa agendada
`Civica-P95-PNCP-Finish`: **Desabilitada** (resultado 0), como projetado ao final do `DONE`. Não há coleta em andamento.

## Pendências restantes
1. **2026 é parcial.** Para incorporar os meses novos é preciso coletar (`pncp-fetch.ts 2025 2026`) e republicar com `publishPncpYear`. O supervisor sai imediatamente ao ver `state: DONE` em `D:\Civica\state\pncp-finish.status.json`; um novo ciclo exige arquivar esse arquivo de status e reabilitar a tarefa (`schtasks /Change /TN Civica-P95-PNCP-Finish /ENABLE`). Não foi feito nesta etapa de propósito: a tarefa está desabilitada e não há coleta em andamento.
2. Os relatórios da P9.5 foram regenerados com o PNCP completo; os anteriores estão em `reproducibilidade/p95_antes_pncp/`.
3. Gates da P9.5 atualizados: G8 `PARTIAL → PASS_WITH_CAVEATS`; G13 permanece `PARTIAL` por motivos independentes do PNCP (detalhe estadual só PE, municipal só RS, TCE-RS 2013–2015 truncado na origem).
4. Valor contratado não é pago; contratos só se ligam a empenho por referência explícita.
