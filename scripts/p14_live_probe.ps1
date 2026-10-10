$ErrorActionPreference = 'Continue'
$targets = @(
  @{house='GO'; provider='alego_custom'; urls=@(
    'https://portal.al.go.leg.br/',
    'https://portal.al.go.leg.br/deputados/em-exercicio',
    'https://portal.al.go.leg.br/deputados/liderancas-parlamentares',
    'https://portal.al.go.leg.br/legislaturas',
    'https://portal.al.go.leg.br/proposicoes',
    'https://portal.al.go.leg.br/transparencia',
    'https://alegodigital.al.go.leg.br/'
  )},
  @{house='RJ'; provider='alerj_lotus'; urls=@(
    'https://www3.alerj.rj.gov.br/',
    'https://www3.alerj.rj.gov.br/lotus_notes/default.asp?id=124',
    'https://www.alerj.rj.gov.br/Deputados/QuemSao',
    'https://www.alerj.rj.gov.br/Deputados/RepresentacaoPartidaria',
    'https://www.alerj.rj.gov.br/atividade-parlamentar',
    'https://www.alerj.rj.gov.br/transparencia'
  )},
  @{house='RS'; provider='alrs_custom'; urls=@(
    'http://www.al.rs.gov.br/',
    'https://www.al.rs.gov.br/',
    'https://ww4.al.rs.gov.br/',
    'https://ww4.al.rs.gov.br/atividadeparlamentar/',
    'https://www.al.rs.gov.br/deputados',
    'https://ww4.al.rs.gov.br:5000/listarDestaqueDeputados',
    'https://www.al.rs.gov.br/transparencia'
  )},
  @{house='SE'; provider='alese_spl'; urls=@(
    'https://aleselegis.al.se.leg.br/',
    'https://aleselegis.al.se.leg.br/spl/',
    'https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026',
    'https://al.se.leg.br/',
    'https://al.se.leg.br/transparencia'
  )}
)
$out = @()
foreach($target in $targets) {
  foreach($url in $target.urls) {
    $started = [DateTime]::UtcNow
    try {
      $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 8 -TimeoutSec 30 -Headers @{'User-Agent'='Civica-P14-Discovery/1.0'}
      $body = [string]$resp.Content
            $sha = (([BitConverter]::ToString(([Security.Cryptography.SHA256]::Create()).ComputeHash([Text.Encoding]::UTF8.GetBytes($body)))) -replace '-', '').ToLowerInvariant()
      $out += [pscustomobject]@{house=$target.house;provider=$target.provider;url=$url;finalUrl=$resp.BaseResponse.ResponseUri.AbsoluteUri;status=[int]$resp.StatusCode;contentType=[string]$resp.Headers['Content-Type'];bytes=$body.Length;sha256=$sha;fetchedAt=$started.ToString('o');durationMs=([int](([DateTime]::UtcNow)-$started).TotalMilliseconds);body=$body}
    } catch {
      $status = $null; $final = $null; $errBody = $null; $ct = $null
      try {
        if ($_.Exception.Response) {
          $status = [int]$_.Exception.Response.StatusCode
          $final = $_.Exception.Response.ResponseUri.AbsoluteUri
          $ct = [string]$_.Exception.Response.Headers['Content-Type']
          $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
          $errBody = $reader.ReadToEnd(); $reader.Dispose()
        }
      } catch {}
      if (-not $errBody) { $errBody = $_.Exception.Message }
      $out += [pscustomobject]@{house=$target.house;provider=$target.provider;url=$url;finalUrl=$final;status=$status;contentType=$ct;bytes=$errBody.Length;sha256=$null;fetchedAt=$started.ToString('o');durationMs=([int](([DateTime]::UtcNow)-$started).TotalMilliseconds);error=$_.Exception.Message;body=$errBody}
    }
  }
}
$out | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'artifacts/p14_live_probe.json' -Encoding UTF8
($out | Select-Object house,url,status,finalUrl,contentType,bytes,error | Format-Table -AutoSize | Out-String) | Write-Output


