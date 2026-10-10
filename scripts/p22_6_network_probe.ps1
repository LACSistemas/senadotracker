$ErrorActionPreference = 'Continue'
$targets = @(
  @{ house='PA'; url='https://www.alepa.pa.gov.br/Legislativo/DetalhesProposicao?IdProposicao=15971'; host='www.alepa.pa.gov.br'; port=443 },
  @{ house='PR'; url='http://webservices.assembleia.pr.leg.br/api/public/proposicao/1'; host='webservices.assembleia.pr.leg.br'; port=80 },
  @{ house='RJ'; url='https://www.alerj.rj.gov.br/Deputados/LinhaDireta'; host='www.alerj.rj.gov.br'; port=443 },
  @{ house='SE'; url='https://aleselegis.al.se.leg.br/processo.aspx?id=1&ano=2026'; host='aleselegis.al.se.leg.br'; port=443 },
  @{ house='AL'; url='https://sapl.al.al.leg.br/api/materia/tramitacao/?materia=15234'; host='sapl.al.al.leg.br'; port=443 },
  @{ house='DF'; url='https://ple.cl.df.gov.br/pleservico/api/public/historico-proposicao/153333?page=0&size=100'; host='ple.cl.df.gov.br'; port=443 },
  @{ house='SC'; url='https://portalelegis.alesc.sc.gov.br/proposicoes/524D7/tramitacoes'; host='portalelegis.alesc.sc.gov.br'; port=443 },
  @{ house='RS'; url='https://ww4.al.rs.gov.br/legislativo/pesquisa?anoProposicao=2026&pagina=2'; host='ww4.al.rs.gov.br'; port=443 }
)
function Run-Command([string]$file, [string[]]$args) {
  $sw=[Diagnostics.Stopwatch]::StartNew();
  try { $o=& $file @args 2>&1; $code=$LASTEXITCODE; return [ordered]@{exitCode=$code; elapsedMs=$sw.ElapsedMilliseconds; output=(($o|Out-String).Trim())} }
  catch { return [ordered]@{exitCode=-1; elapsedMs=$sw.ElapsedMilliseconds; output=$_.Exception.Message} }
}
$out=@()
foreach($t in $targets) {
  $dns=@{status='NOT_RUN';addresses=@();error=$null}
  try { $a=[System.Net.Dns]::GetHostAddresses($t.host); $dns.status=if($a.Count){'PASS'}else{'FAIL'}; $dns.addresses=@($a|ForEach-Object {$_.IPAddressToString}) } catch { $dns.status='FAIL'; $dns.error=$_.Exception.Message }
  $tcp=@{status='NOT_RUN';detail=$null}
  try { $client=[Net.Sockets.TcpClient]::new(); $task=$client.ConnectAsync($t.host,$t.port); $ok=$task.Wait(3000); $tcp.status=if($ok -and $client.Connected){'PASS'}else{'FAIL'}; $tcp.detail=[ordered]@{connected=$client.Connected;timeoutMs=3000}; $client.Dispose() } catch { $tcp.status='FAIL'; $tcp.detail=$_.Exception.Message }
  $curl=Run-Command 'curl.exe' @('--location','--silent','--show-error','--max-time','8','--connect-timeout','4','--user-agent','civica-p22-6-probe','--write-out','\nHTTP_STATUS=%{http_code}\n','--head',$t.url)
  $ps=Run-Command 'powershell.exe' @('-NoProfile','-NonInteractive','-Command',"try { `$r=Invoke-WebRequest -UseBasicParsing -MaximumRedirection 3 -TimeoutSec 8 -Uri '$($t.url)'; Write-Output ('HTTP_STATUS='+[int]`$r.StatusCode); Write-Output ('BYTES='+[Text.Encoding]::UTF8.GetByteCount([string]`$r.Content)) } catch { Write-Output ('ERROR='+`$_.Exception.Message); exit 1 }")
  $py=Run-Command 'python.exe' @('-c',"import urllib.request,sys; u='$($t.url)'; r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'civica-p22-6-probe'}),timeout=8); b=r.read(1024); print('HTTP_STATUS='+str(r.status)); print('BYTES_AT_LEAST='+str(len(b)))")
  $node=Run-Command 'node.exe' @('-e',"fetch('$($t.url)',{redirect:'follow',headers:{'user-agent':'civica-p22-6-probe'}}).then(async r=>{let b=await r.arrayBuffer(); console.log('HTTP_STATUS='+r.status);console.log('BYTES='+b.byteLength)}).catch(e=>{console.error('ERROR='+e.message);process.exit(1)})")
  $out += [ordered]@{house=$t.house;url=$t.url;host=$t.host;dns=$dns;tcp=$tcp;transports=[ordered]@{curl=$curl;powershell=$ps;python=$py;node=$node}}
}
$out | ConvertTo-Json -Depth 12
