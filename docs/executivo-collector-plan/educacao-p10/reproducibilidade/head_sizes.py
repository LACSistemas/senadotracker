"""P10/G16 — soma tamanhos (HEAD) de listas de URLs. Uso: python -I -X utf8 head_sizes.py <entrada.csv|.json> <coluna_url> <saida.json>
Lê só cabeçalhos HTTP (Content-Length); nada é baixado."""
import concurrent.futures as cf, csv, json, sys, urllib.request
UA = 'civica-exec/1.0 (pesquisa de dados abertos)'
def head(u):
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, method='HEAD', headers={'User-Agent': UA}), timeout=40) as r:
                return u, r.status, int(r.headers.get('Content-Length') or 0)
        except urllib.error.HTTPError as e: return u, e.code, 0
        except Exception: pass
    return u, None, 0
src, col, out = sys.argv[1:4]
urls = [r[col] for r in csv.DictReader(open(src, encoding='utf-8'))] if src.endswith('.csv') else json.load(open(src, encoding='utf-8'))
with cf.ThreadPoolExecutor(6) as ex: res = list(ex.map(head, urls))
json.dump([{'url': u, 'status': s, 'bytes': b} for u, s, b in res], open(out, 'w', encoding='utf-8'), indent=1)
print(len(res), 'urls;', sum(1 for _, s, _ in res if s == 200), 'status 200;', round(sum(b for _, _, b in res) / 1e6, 1), 'MB')
