# PNCP (P9.5) — continuidade durante a P9.6

Estado em 23/10/2026 (atualizado ao final da P9.6; ver `results.json` para o número final).

## O que foi preservado
- O coletor PNCP em execução (PID 23240) **não foi morto, reiniciado nem duplicado** em nenhum momento da P9.6. O supervisor detecta processo existente e sai com `COLLECTOR_RUNNING`.
- 2025 e os meses de 2026 já coletados continuam em `D:\Civica\raw\pncp` (nada apagado); 2026-01 e 2026-02 fechados; 2026-03 em andamento no encerramento da P9.6 (arquivo parcial `.part.jsonl`); restam abril–setembro (≈ 30 min por mês).

## Mecanismo persistente de publicação (testado)
- Tarefa agendada do Windows `Civica-P95-PNCP-Finish`, a cada 30 min, executa `scripts/exec/pncp-finish.cmd` → `scripts/exec/pncp-finish.ts`.
- Fluxo: (1) se `pncp-fetch.ts` está rodando → registra `COLLECTOR_RUNNING` e sai; (2) se faltam meses fechados de 2025-01 até o mês anterior e não há coletor → dispara um coletor destacado; (3) quando todos os meses existem → publica 2025 e o ano corrente com `publishPncpYear`, confere `mantidos == linhas em exec_fin_contract`, roda de novo para provar `NO_CHANGE`, grava `DONE` e desabilita a tarefa.
- Idempotente: a publicação é transacional por UF × competência e reaproveita o hash da fonte; relançar não duplica nem reescreve.
- Logs: `D:\Civica\logs\collectors\pncp-finish.out`.

## Gate G_PNCP_CONTINUITY
- Coletor preservado: **PASS**. Sem duplicidade de coleta: **PASS**. Mecanismo persistente e idempotente: **PASS** (tarefa criada e executada várias vezes, estados `COLLECTOR_RUNNING` observados).
- Publicação de 2025–2026: **PENDENTE_EXTERNO/EM_ANDAMENTO** — depende de a coleta de abril–setembro de 2026 terminar. Não se afirma publicação automática concluída: ela ocorre quando a tarefa registrar `DONE`.
- Ano corrente é parcial por definição (preliminar); 2025 só publica com 12 meses.
