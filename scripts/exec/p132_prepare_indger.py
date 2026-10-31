import csv, json, hashlib
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"D:\Civica\raw\infraestrutura\energia\aneel")
STG = Path(r"D:\Civica\staging\infraestrutura\energia\aneel\indger")
SRC = ROOT / "indger-dados-comerciais.csv"
MONTHS = {f"2025-{m:02d}-01" for m in range(1, 13)} | {"2026-08-01"}
FIELDS = [
    "QtdUCAtiva", "QtdUCAtivaFat", "QtdFatura", "QtdFaturaSemLeitura",
    "QtdUCSuspInadimplemento", "QtdSolicRessarcimentoDano", "VlrPagoRessarcDano",
]

def digits(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit())

def ibge7(value):
    s = digits(value)
    if len(s) == 7:
        return s
    if len(s) == 8 and s.startswith("0"):
        return s[1:]
    if len(s) > 7:
        return s[-7:]
    return None

def decimal(value):
    s = str(value or "").strip()
    if not s:
        return None
    # INDGER integer counters are generally serialized as integers; monetary
    # values may use Brazilian decimal punctuation.
    try:
        return float(s.replace(".", "").replace(",", ".")) if "," in s else float(s)
    except ValueError:
        return None

def main():
    STG.mkdir(parents=True, exist_ok=True)
    by_month = defaultdict(dict)
    source_rows = defaultdict(int)
    duplicate_identical = 0
    duplicate_conflicting = 0
    bad_rows = 0
    with SRC.open("r", encoding="utf-8-sig", newline="", errors="replace") as f:
        rd = csv.DictReader(f, delimiter=";")
        for row in rd:
            ref = (row.get("DatReferenciaInformada") or "").strip()
            if ref not in MONTHS:
                continue
            source_rows[ref] += 1
            key = (ref, (row.get("NumCNPJ") or "").strip(), ibge7(row.get("CodMunicipioIBGE")), (row.get("SigAgente") or "").strip())
            if not key[1] or not key[2]:
                bad_rows += 1
                continue
            rec = {
                "competence": ref,
                "ibge7": key[2],
                "cnpj": key[1],
                "agent": key[3],
                "values": {field: decimal(row.get(field)) for field in FIELDS},
            }
            old = by_month[ref].get(key)
            if old is not None:
                if old == rec:
                    duplicate_identical += 1
                else:
                    duplicate_conflicting += 1
                continue
            by_month[ref][key] = rec

    records = []
    month_summary = {}
    for month in sorted(MONTHS):
        rows = list(by_month[month].values())
        by_mun = defaultdict(list)
        for rec in rows:
            by_mun[rec["ibge7"]].append(rec)
        eligible = []
        excluded = []
        for mun, group in by_mun.items():
            if len(group) == 1:
                eligible.extend(group)
            else:
                excluded.extend(group)
        records.extend(eligible)
        month_summary[month] = {
            "sourceRows": source_rows[month],
            "deduplicatedRows": len(rows),
            "eligibleRowsSingleDistributor": len(eligible),
            "excludedRowsMultipleDistributors": len(excluded),
            "distinctMunicipalities": len(by_mun),
            "eligibleMunicipalities": sum(1 for g in by_mun.values() if len(g) == 1),
            "excludedMunicipalities": sum(1 for g in by_mun.values() if len(g) > 1),
        }
    out = STG / "indger_selected.jsonl"
    with out.open("w", encoding="utf-8", newline="\n") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False, separators=(",", ":")) + "\n")
    h = hashlib.sha256(SRC.read_bytes()).hexdigest()
    summary = {
        "source": str(SRC), "sourceSha256": h, "selectedCompetences": sorted(MONTHS),
        "fields": FIELDS, "sourceRows": sum(source_rows.values()),
        "preparedRows": len(records), "duplicateIdentical": duplicate_identical,
        "duplicateConflicting": duplicate_conflicting, "badRows": bad_rows,
        "months": month_summary, "rule": "publish only municipalities with exactly one distributor in the competence; never sum across distributors without official disjointness proof",
        "output": str(out),
    }
    (STG / "indger_selected_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
