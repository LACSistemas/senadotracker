import hashlib
import json
import unicodedata
from pathlib import Path
from openpyxl import load_workbook

SOURCE_BASE = Path(r"D:\Civica\raw\bem-estar\cotidiano\municip-2024\Base_MUNIC_2024_20251107.xlsx")
SOURCE_TABLE = Path(r"D:\Civica\raw\bem-estar\cotidiano\municip-2024\05_Transporte.xlsx")
OUT = Path(r"D:\Civica\staging\infraestrutura\mobilidade\p134_municip_transport_rows.json")

FIELDS = ["Mtra01", "Mtra07", "Mtra09", "Mtra10", "Mtra16", "Mtra17", "Mtra19", "Mtra23", "Mtra231", "Mtra24a1", "Mtra24a2", "Mtra24a3", "Mtra24a4", "Mtra25"]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()

def clean(v):
    if v is None:
        return None
    return unicodedata.normalize("NFC", str(v).strip())

def main():
    wb = load_workbook(SOURCE_BASE, read_only=True, data_only=True)
    ws = next(s for s in wb.worksheets if s.title.startswith("Transporte"))
    it = ws.iter_rows(values_only=True)
    headers = [clean(v) for v in next(it)]
    idx = {h.lower(): i for i, h in enumerate(headers) if h}
    required = ["Cod Munic", "Uf", *FIELDS]
    missing = [x for x in required if x.lower() not in idx]
    if missing:
        raise RuntimeError(f"missing columns: {missing}")
    rows = []
    stats = {"sourceRows": 0, "mappedRows": 0, "unresolvedRows": 0, "byUf": {}, "fieldValues": {}}
    for row in it:
        stats["sourceRows"] += 1
        code = clean(row[idx["cod munic" ]])
        if not code or not code.isdigit():
            stats["unresolvedRows"] += 1
            continue
        uf = clean(row[idx["uf"]])
        item = {"ibge7": int(code), "uf": uf}
        for field in FIELDS:
            value = clean(row[idx[field.lower()]])
            item[field] = value
            stats["fieldValues"].setdefault(field, {})[value or "<NULL>"] = stats["fieldValues"].setdefault(field, {}).get(value or "<NULL>", 0) + 1
        rows.append(item)
        stats["mappedRows"] += 1
        stats["byUf"][uf] = stats["byUf"].get(uf, 0) + 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "sourceFiles": [
            {"provider": "IBGE", "family": "MUNIC", "edition": 2024, "resource": SOURCE_BASE.name, "url": "https://ftp.ibge.gov.br/Perfil_Municipios/2024/Base_de_Dados/Base_MUNIC_2024_20251107.xlsx", "path": str(SOURCE_BASE), "bytes": SOURCE_BASE.stat().st_size, "sha256": sha256(SOURCE_BASE), "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "sheet": ws.title, "httpStatus": 200},
            {"provider": "IBGE", "family": "MUNIC", "edition": 2024, "resource": SOURCE_TABLE.name, "url": "https://ftp.ibge.gov.br/Perfil_Municipios/2024/Tabelas_de_Resultados/xlsx/05_Transporte.xlsx", "path": str(SOURCE_TABLE), "bytes": SOURCE_TABLE.stat().st_size, "sha256": sha256(SOURCE_TABLE), "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "httpStatus": 200}
        ],
        "edition": 2024,
        "sheet": ws.title,
        "fields": FIELDS,
        "rows": rows,
        "stats": stats,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"out": str(OUT), "bytes": OUT.stat().st_size, "stats": stats}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
