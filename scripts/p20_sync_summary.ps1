$ErrorActionPreference='Stop'
$repo='C:\Projetos\senadotracker'
$docs='C:\Projetos\civicadocs\SUMMARY\deputados_estaduais'
New-Item -ItemType Directory -Force -Path $docs | Out-Null
foreach($name in @('P20.json','P20.md','P20_1.json','P20_1.md','P20_1_national_matrix.json','P20_1_schema_compatibility.md','P20_1_source_map.json')) { Copy-Item -LiteralPath (Join-Path $repo ('artifacts\'+$name)) -Destination (Join-Path $docs ('..\..\artifacts\'+$name)) -Force }
$p20 = @'
# P20 â€” Atividade legislativa estadual

P20.1 foi executada no laboratÃ³rio `civica_postgres_lab` como `PARTIAL_WITH_REAL_IMPLEMENTATION`. A fundaÃ§Ã£o canÃ´nica nacional reutiliza `civica_state`; nÃ£o foram criadas tabelas por UF.

- Primeira onda: SP, MG, SC, PE.
- SP: propostas, autoria e participaÃ§Ã£o persistidas com raw provenance; a participaÃ§Ã£o observada Ã© de comissÃµes permanentes e nÃ£o Ã© apresentada como plenÃ¡rio.
- SC: corpus controlado de propostas e relaÃ§Ãµes de autoria persistido.
- MG/PE: fontes oficiais confirmadas e mapeadas; corpus P20 ainda nÃ£o materializado.
- Replay: zero inserÃ§Ãµes duplicadas e nenhuma revisÃ£o nova para fonte inalterada.
- P18, P19 e dados federais: sem alteraÃ§Ãµes; produÃ§Ã£o, `projetoeleitor_db` e SQLite nÃ£o foram tocados.

EvidÃªncias: [P20_1](../../artifacts/P20_1.md), [matriz nacional](../../artifacts/P20_1_national_matrix.json), [compatibilidade de schema](../../artifacts/P20_1_schema_compatibility.md) e [mapa de fontes](../../artifacts/P20_1_source_map.json).
'@
Set-Content -LiteralPath (Join-Path $docs '08_P20_ATIVIDADE_LEGISLATIVA.md') -Value $p20 -Encoding utf8
$readme=Join-Path $docs '00_README.md'
Add-Content -LiteralPath $readme -Value "P20 summary: see 08_P20_ATIVIDADE_LEGISLATIVA.md; terminal PARTIAL_WITH_REAL_IMPLEMENTATION; P20.2 not started."
Add-Content -LiteralPath (Join-Path $docs '01_STATUS_EXECUTIVO.md') -Value "P20.1: canonical activity evidence is persisted for SP/SC; MG/PE source-mapped but not materialized. Replay duplicates: 0."
Add-Content -LiteralPath (Join-Path $docs '02_COBERTURA_POR_UF.md') -Value "P20.1 matrix separates proposals, authorship, sessions, attendance, roll calls, votes, rapporteurships and themes. SP participation is committee scope."
Add-Content -LiteralPath (Join-Path $docs '03_PROVIDERS_E_FONTES.md') -Value "P20.1 providers: ALESP, ALESC e-Legis, ALMG API v2 mapped, ALEPE mapped. See P20_1_source_map.json."
$statusPath=Join-Path $docs 'status_deputados_estaduais.json'
$status=Get-Content -Raw $statusPath | ConvertFrom-Json
$status | Add-Member -NotePropertyName p20 -NotePropertyValue ([ordered]@{phase='P20.1'; status='PARTIAL_WITH_REAL_IMPLEMENTATION'; database='civica_postgres_lab'; firstWave=@('SP','MG','SC','PE'); readyForP20_2=$true; artifact='../../artifacts/P20_1.json'}) -Force
$status | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $statusPath -Encoding utf8
Add-Content -LiteralPath (Join-Path $docs 'coverage_matrix.csv') -Value "P20_ACTIVITY,P20.1,SP;SC proposals/authorship;SP committee participation,see P20_1_national_matrix.json"
