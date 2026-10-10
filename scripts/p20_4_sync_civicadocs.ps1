$ErrorActionPreference = 'Stop'
$repo = 'C:\Projetos\senadotracker'
$docs = 'C:\Projetos\civicadocs\SUMMARY\deputados_estaduais'
$artifacts = 'C:\Projetos\civicadocs\artifacts'
$names = @('P20.json','P20.md','P20_4.json','P20_4.md','P20_4_national_matrix.json','P20_4_source_map.json','P20_4_terminal_exceptions.json','P20_4_bounded_exception_probe.json')
foreach ($name in $names) {
  Copy-Item -LiteralPath (Join-Path $repo ('artifacts\' + $name)) -Destination (Join-Path $artifacts $name) -Force
}
$marker = '## P20.4 — Fechamento nacional de atividade legislativa'
$section = @'

## P20.4 — Fechamento nacional de atividade legislativa

P20.4 foi executada exclusivamente no laboratório `civica_postgres_lab`. As 27 Casas receberam classificação terminal independente para proposições, autoria, sessões plenárias, presença, roll-call, voto individual, relatoria e temas. Nenhuma matriz final usa `NOT_ATTEMPTED`, `NOT_MAPPED` ou `SOURCE_CONFIRMED_NOT_IMPLEMENTED`.

- Proposições operacionalmente comprovadas: **10/27** (SP, MG, SC, PE, AC, AL, RO, TO, RR e DF).
- Autoria operacionalmente comprovada: **7/27**; PE e SC permanecem `PARTIAL`, sem fuzzy matching.
- Participação plenária operacional: **0/27**. SP conserva somente o escopo de comissões, explicitamente separado de plenário.
- Temas operacionalmente comprovados: **1/27** (DF, source-native).
- PB, AM e MA: bloqueios externos documentados (429, 503 e 401). ES, PR e MT: fonte descoberta sem contrato público estruturado 2026 reproduzível no corpus preservado.
- Partição de autoria: PASS; projeção agregada: PASS; replay: `DUPLICATE_INSERTIONS=0`, `NEW_REVISION_ON_UNCHANGED_REPLAY=0`.

P20.4 está encerrada com exceções documentadas e `READY_FOR_P21=YES`. P21 não foi iniciada. Nenhuma alteração foi feita em produção, `projetoeleitor_db`, P17/P18/P19 ou SQLite.

Evidências: [P20.4](../../artifacts/P20_4.md), [matriz nacional](../../artifacts/P20_4_national_matrix.json), [mapa de fontes](../../artifacts/P20_4_source_map.json) e [exceções terminais](../../artifacts/P20_4_terminal_exceptions.json).
'@
foreach ($name in @('00_README.md','01_STATUS_EXECUTIVO.md','02_COBERTURA_POR_UF.md','03_PROVIDERS_E_FONTES.md','04_PENDENCIAS_BLOCKERS_E_DEFERRED.md','08_P20_ATIVIDADE_LEGISLATIVA.md')) {
  $path = Join-Path $docs $name
  $text = if (Test-Path -LiteralPath $path) { Get-Content -Raw -LiteralPath $path } else { '' }
  if ($text -notlike "*$marker*") { Add-Content -LiteralPath $path -Value $section -Encoding utf8 }
}
$statusPath = Join-Path $docs 'status_deputados_estaduais.json'
$status = Get-Content -Raw -LiteralPath $statusPath | ConvertFrom-Json
$p20 = [ordered]@{
  phase = 'P20.4'
  status = 'NATIONAL_CLOSURE_WITH_DOCUMENTED_EXCEPTIONS'
  database = 'civica_postgres_lab'
  proposalsOperational = '10/27'
  authorshipOperational = '7/27'
  plenarySessionsOperational = '0/27'
  plenaryAttendanceOperational = '0/27'
  rollCallOperational = '0/27'
  individualVoteOperational = '0/27'
  themesOperational = '1/27'
  authorClassificationPartition = 'PASS'
  aggregateProjectionParity = 'PASS'
  replayDuplicateInsertions = 0
  replayNewRevisionOnUnchanged = 0
  readyForP21 = $true
  p21Started = $false
  artifacts = $names
}
$status | Add-Member -NotePropertyName p20 -NotePropertyValue $p20 -Force
$status | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $statusPath -Encoding utf8
$csv = Join-Path $docs 'coverage_matrix.csv'
$csvText = Get-Content -Raw -LiteralPath $csv
$csvMarker = 'NATIONAL,P20.4,'
if ($csvText -notlike "*$csvMarker*") {
  Add-Content -LiteralPath $csv -Value 'NATIONAL,P20.4,,,,,,,,,LAB_ONLY,P20.4 terminal matrix,YES,,,10/27 proposals; 7/27 authorship; participation committee-only SP,,,,,,P20.4 exceptions documented' -Encoding utf8
}
Write-Output 'P20.4 civicadocs sync complete'
