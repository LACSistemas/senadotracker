#!/usr/bin/env bash
# P10.4 — rodada de PRODUÇÃO (sem commit, sem push). Pré-condições: backup pre-educacao-p104-*.dump íntegro (sha256), cluster de teste já validado,
# C: com >= 20 GiB livres, nenhum outro coletor escrevendo em civica_exec. Cada etapa mede o banco depois (educacao-pilot measure) e PARA se o crescimento
# sobre o baseline passar de 4,5 GB (o limite inegociável é 5 GB).
set -euo pipefail
cd /c/Projetos/senadotracker
PILOT="node --import tsx scripts/exec/educacao-pilot.ts"
EV=docs/executivo-collector-plan/educacao-p104-execucao/evidencias
BASE=27292101779                                        # evidencias/baseline_pg_database_size.txt (medido antes de qualquer escrita)
LOG=/d/Civica/logs/collectors/educacao-measure.jsonl
unset EXEC_DATABASE_URL                                 # produção: nunca definir EXEC_DATABASE_URL de teste aqui
guard() {                                               # $1 = rótulo da medição
  $PILOT measure "$1" > /dev/null 2>&1
  python - "$LOG" "$BASE" "$1" <<'PY'
import json, sys
log, base, label = sys.argv[1], int(sys.argv[2]), sys.argv[3]
last = [json.loads(l) for l in open(log, encoding='utf8') if l.strip()][-1]
growth = last['dbBytes'] - base
print(json.dumps({'etapa': label, 'dbBytes': last['dbBytes'], 'crescimento_bytes': growth, 'crescimento_gb': round(growth / 1e9, 3), 'cFreeGiB': round(last['cFreeBytes'] / 2**30, 1)}))
if growth > 4_500_000_000: sys.exit('PARADO: crescimento acima de 4,5 GB');
if last['cFreeBytes'] < 20 * 2**30: sys.exit('PARADO: menos de 20 GiB livres no C:')
PY
}
guard p104-prod-00-antes
$PILOT migrate;                      guard p104-prod-01-migrate      # v13: 13 tabelas aditivas
$PILOT learn-register; $PILOT flow-register; guard p104-prod-02-register
for step in ideb-publish saeb-publish inse-publish trn-publish flow-publish; do
  $PILOT $step all;                  guard "p104-prod-$step"
done
# replay: mesma fonte, mesmo parser => NO_CHANGE em todas as fatias e nenhuma linha nova no change log
for step in ideb-publish saeb-publish inse-publish trn-publish flow-publish; do $PILOT $step all; done
guard p104-prod-99-final
node --import tsx scripts/exec/fingerprints-all.ts $EV/fingerprints_depois.json
