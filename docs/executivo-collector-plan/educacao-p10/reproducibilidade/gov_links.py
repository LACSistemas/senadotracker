"""P10 — lista os links de arquivos (zip/xlsx/csv/pdf/ods) de uma página do gov.br (incluindo o conteúdo carregado por abas via data-url).
Uso: python -I -X utf8 gov_links.py <saida.json> <url> [<url> ...]"""
import html, json, re, sys, urllib.request
UA = 'civica-exec/1.0 (pesquisa de dados abertos)'
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=90).read().decode('utf-8', 'ignore')
out = {}
for url in sys.argv[2:]:
    pages = [url]; t = get(url); pages += re.findall(r'data-url="([^"]+)"', t)
    links = {}
    for p in dict.fromkeys(pages):
        try: body = t if p == url else get(p)
        except Exception as e: links[p] = ['ERRO ' + repr(e)[:80]]; continue
        found = []
        for h, txt in re.findall(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, flags=re.S):
            if re.search(r'\.(zip|xlsx?|csv|pdf|ods|json)(\?|$)|download\.inep|/@@download', h, flags=re.I):
                found.append({'href': h, 'texto': html.unescape(re.sub(r'<[^>]+>', '', txt)).strip()[:90]})
        links[p] = found
    out[url] = links
    print(url[-70:], {k[-40:]: len(v) for k, v in links.items()})
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
