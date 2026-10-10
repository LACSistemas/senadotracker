import concurrent.futures
import json
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

base = "https://www3.al.es.gov.br/spl/"
html = Path("artifacts/P20_7D_ES_consulta-autor.aspx").read_text(encoding="utf-8", errors="ignore")
soup = BeautifulSoup(html, "html.parser")
ids = sorted({m.group(1) for a in soup.find_all("a", href=True) if (m := re.search(r"consulta-producao\.aspx\?autor=([^&]+)&ano=2026", a["href"]))})
print("author ids", len(ids))

def one(author_id):
    url = f"{base}consulta-producao.aspx?autor={author_id}&ano=2026"
    try:
        text = requests.get(url, timeout=45).text
        page = BeautifulSoup(text, "html.parser")
        announced = None
        m = re.search(r"(\d+)\s+proposi", page.get_text(" ", strip=True), re.I)
        if m:
            announced = int(m.group(1))
        return {"author_id": author_id, "url": url, "status": 200, "bytes": len(text), "announced": announced, "ids": sorted(set(re.findall(r"processo\.aspx\?id=(\d+)", text))), "pagination": "lbNext" in text}
    except Exception as exc:
        return {"author_id": author_id, "url": url, "status": "error", "error": str(exc)}

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    rows = list(pool.map(one, ids))
Path("artifacts/P20_7D_ES_author_partitions.json").write_text(json.dumps({"year": 2026, "partitions": rows}, ensure_ascii=False, indent=2), encoding="utf-8")
for row in rows:
    print(row["author_id"], row.get("announced"), len(row.get("ids", [])), row.get("pagination"))
print("sum announced", sum(row.get("announced") or 0 for row in rows), "distinct", len(set(i for row in rows for i in row.get("ids", []))))
