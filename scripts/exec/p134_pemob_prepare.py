import hashlib
import json
from pathlib import Path
from openpyxl import load_workbook

RAW = Path(r"D:\Civica\raw\infraestrutura\mobilidade\pemob\2026\pemob_municipal_2026.xlsx")
RAW_METRO = Path(r"D:\Civica\raw\infraestrutura\mobilidade\pemob\2026\pemob_metropolitana_2026.xlsx")
OUT = Path(r"D:\Civica\staging\infraestrutura\mobilidade\pemob\2026\p134_pemob_municip_rows.json")
URL = "https://www.gov.br/cidades/pt-br/assuntos/mobilidade-urbana/arquivos/pemob_municipal_2026.xlsx"
URL_METRO = "https://www.gov.br/cidades/pt-br/assuntos/mobilidade-urbana/arquivos/pemob_metropolitana_2026.xlsx"

FIELDS = ["1.1.1", "1.4.1.A", "1.4.1.B", "1.4.2", "1.4.5", "1.5.1.A", "2.5.1", "3.1.1.A"]

def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def clean(v):
    return None if v is None else str(v).strip()

def main():
    wb = load_workbook(RAW, read_only=True, data_only=True)
    ws = wb["pemob_municipal_26"]
    it = ws.iter_rows(values_only=True)
    next(it)  # question descriptions
    header = [clean(v) for v in next(it)]
    # The downloaded workbook contains a replacement character in accented
    # labels (e.g. C�DIGO/MUNIC�PIO); use a conservative ASCII key only for
    # locating columns, while preserving source values verbatim.
    def key(v):
        return ''.join(ch for ch in (v or '').upper() if ch.isalnum() or ch == '.')
    idx = {key(h): i for i, h in enumerate(header) if h}
    code_key = next((k for k in idx if k.endswith("DIGOIBGE")), None)
    municipality_key = next((k for k in idx if k.startswith("MUNIC")), None)
    wanted = {"CÓDIGO IBGE": code_key, "UF": "UF", "MUNICÍPIO": municipality_key}
    wanted.update({f: f for f in FIELDS})
    missing = [f for f, k in wanted.items() if k not in idx]
    if missing:
        raise RuntimeError(f"missing columns: {missing}")
    rows, blank = [], 0
    for raw in it:
        code = clean(raw[idx[wanted["CÓDIGO IBGE"]]])
        if not code:
            blank += 1
            continue
        code = code.replace(".", "")
        if not code.isdigit():
            raise RuntimeError(f"invalid IBGE code: {code}")
        item = {"ibge7": int(code), "uf": clean(raw[idx[wanted["UF"]]]), "municipality": clean(raw[idx[wanted["MUNICÍPIO"]]])}
        for field in FIELDS:
            item[field] = clean(raw[idx[field]])
        rows.append(item)
    if len({r["ibge7"] for r in rows}) != len(rows):
        raise RuntimeError("duplicate IBGE codes")
    files = [
        {"provider": "Ministério das Cidades", "family": "PEMOB", "edition": 2026, "resource": RAW.name, "url": URL, "path": str(RAW), "bytes": RAW.stat().st_size, "sha256": sha256(RAW), "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "httpStatus": 200},
        {"provider": "Ministério das Cidades", "family": "PEMOB", "edition": 2026, "resource": RAW_METRO.name, "url": URL_METRO, "path": str(RAW_METRO), "bytes": RAW_METRO.stat().st_size, "sha256": sha256(RAW_METRO), "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "httpStatus": 200, "publication": "validated_not_published_no_metro_entity_contract"},
    ]
    payload = {"edition": 2026, "sheet": ws.title, "fields": FIELDS, "rows": rows, "sourceFiles": files, "stats": {"sheetRows": ws.max_row - 2, "respondentRows": len(rows), "blankTemplateRows": blank, "byUf": {uf: sum(1 for r in rows if r["uf"] == uf) for uf in sorted({r["uf"] for r in rows})}}}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"out": str(OUT), "stats": payload["stats"]}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
