# Diagnóstico do WinError 10013

## Causa separada

No sandbox do Codex, DNS resolveu o domínio, mas TCP/443 não abriu. PowerShell e `curl.exe` falharam antes do HTTP; `urllib` e `requests` retornaram `WinError 10013`. Isso é uma restrição de socket do ambiente de execução, não prova de bloqueio do MEC.

Fora do sandbox, sem alteração de firewall, antivírus, proxy ou Defender, o mesmo URL foi alcançado por PowerShell, `curl.exe`, `urllib` e `requests` e respondeu **HTTP 403**. Os headers observados foram `Server: cloudflare`, `Cf-Mitigated: challenge`, `Content-Type: text/html; charset=UTF-8`; não houve CSV. O catálogo ProUni 2025 retornou 5594 bytes HTML e o FIES 2022, 5721 bytes HTML.

## Proxy e DNS

- `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`: não definidos.
- WinHTTP: acesso direto, sem proxy.
- DNS: CNAME para `dadosabertos.mec.gov.br.cdn.cloudflare.net`, IPv4 `104.17.46.238`/`104.17.47.238` e IPv6 Cloudflare.

Conclusão: há dois bloqueios distintos: restrição local do sandbox e desafio externo Cloudflare que exige sessão autorizada. Não foi feita tentativa de contorno.

