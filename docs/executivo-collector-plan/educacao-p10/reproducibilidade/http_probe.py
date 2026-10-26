"""P10 — sonda HTTP pequena (HEAD/GET limitado) para uma lista de URLs. Uso: python -I -X utf8 http_probe.py <saida.json> <url> [<url> ...]
Registra status, tipo, tamanho declarado, primeiros 300 bytes (texto) e erro. Sem downloads grandes: lê no máximo 20 KB do corpo."""
import json, sys, time, urllib.request, urllib.error
UA = 'civica-exec/1.0 (pesquisa de dados abertos)'
out = []
for url in sys.argv[2:]:
    t0 = time.time(); rec = {'url': url}
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read(20000)
            rec.update(status=r.status, tipo=r.headers.get('Content-Type'), tamanho=r.headers.get('Content-Length'), trecho=body[:300].decode('latin-1', 'ignore').replace('\n', ' '))
    except urllib.error.HTTPError as e:
        rec.update(status=e.code, erro=f'HTTP {e.code}', trecho=e.read(300).decode('latin-1', 'ignore').replace('\n', ' '))
    except Exception as e:
        rec.update(status=None, erro=repr(e)[:160])
    rec['segundos'] = round(time.time() - t0, 2); out.append(rec); print(json.dumps({k: rec.get(k) for k in ('url', 'status', 'tipo', 'tamanho', 'erro', 'segundos')}, ensure_ascii=False))
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
