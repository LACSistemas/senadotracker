param(
  [string]$OutDir = "artifacts/.p13_2_downloads"
)
$ErrorActionPreference = 'Stop'
$base = 'https://www.alepe.pe.gov.br'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
function Get-Json([string]$Url,[string]$File) {
  if (Test-Path -LiteralPath $File) { return }
  $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -Headers @{ 'User-Agent'='civica-p13.2/1.0'; Accept='application/json' }
  [IO.File]::WriteAllText((Join-Path (Get-Location) $File), $r.Content, [Text.UTF8Encoding]::new($false))
}
Get-Json "$base/servicos/transparencia/dep/deputados.php?leg=-16" "$OutDir/deputies.json"
Get-Json "$base/servicos/transparencia/adm/verbaindenizatoria-rubricas.php?ano=2026" "$OutDir/categories-2026.json"
$deps = Get-Content -Raw "$OutDir/deputies.json" | ConvertFrom-Json
$monthsManifest = @()
foreach ($d in $deps) {
  $id = [string]$d.id
  if (-not $id) { continue }
  $f = "$OutDir/months-$id-2026.json"
  Get-Json "$base/servicos/transparencia/adm/verbaindenizatoria-dep-meses.php?dep=$id&ano=2026" $f
  $monthRaw = Get-Content -Raw $f | ConvertFrom-Json
  $months = if ($monthRaw -is [array]) { $monthRaw } else { @($monthRaw) }
  $monthValues = @($months | ForEach-Object { [int]$_.mes })
  $monthsManifest += [pscustomobject]@{ deputyId=$id; months=$monthValues }
}
$monthsManifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 "$OutDir/months-manifest.json"
$documentsManifest = @()
foreach ($m in $monthsManifest) {
  foreach ($month in $m.months) {
    $f = "$OutDir/docs-$($m.deputyId)-2026-$month.json"
    Get-Json "$base/servicos/transparencia/adm/verbaindenizatoria.php?dep=$($m.deputyId)&ano=2026&mes=$month" $f
    $docRaw = Get-Content -Raw $f | ConvertFrom-Json
    $docs = if ($docRaw -is [array]) { $docRaw } else { @($docRaw) }
    foreach ($doc in $docs) {
      $docid = [string]$doc.docid
      if (-not $docid) { continue }
      $df = "$OutDir/detail-$docid.json"
      Get-Json "$base/servicos/transparencia/adm/verbaindenizatorianotas.php?docid=$docid" $df
      $documentsManifest += [pscustomobject]@{ deputyId=$m.deputyId; year=2026; month=$month; docid=$docid; indexFile=$f; detailFile=$df }
    }
  }
}
$documentsManifest | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 "$OutDir/documents-manifest.json"
Write-Output (ConvertTo-Json @{ deputies=$deps.Count; deputyMonthPairs=($monthsManifest | Where-Object {$_.months.Count -gt 0}).Count; documents=$documentsManifest.Count; outDir=$OutDir } -Compress)
