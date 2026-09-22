"""Count title and summary tokens for active, distinct propositions."""
import csv
import json
import sqlite3
import statistics
from collections import defaultdict
from pathlib import Path
from tokenizers import Tokenizer

root = Path(__file__).resolve().parent.parent
db = sqlite3.connect(root / "data/senadotracker.sqlite")
tokenizers = list((Path.home() / ".cache/huggingface/hub/models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2/snapshots").glob("*/tokenizer.json"))
if not tokenizers:
    raise SystemExit("Tokenizer local indisponível")
tokenizer = Tokenizer.from_file(str(tokenizers[0]))
tokenizer.no_truncation()
query = """SELECT p.source,p.external_id,p.grupo_atribuido,p.payload
FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id
ORDER BY p.source,p.external_id"""
rows = db.execute(query)
seen = set()
groups = defaultdict(list)
houses = defaultdict(list)
missing = defaultdict(int)
duplicates = 0
output = root / "data/proposition-token-counts.csv"
with output.open("w", encoding="utf-8", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["source", "external_id", "grupo_atribuido", "type", "label", "summary_tokens", "label_summary_tokens", "has_summary"])
    for source, external_id, group, payload in rows:
        key = (source, external_id)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        proposal = json.loads(payload)
        label = (proposal.get("label") or "").strip()
        summary = (proposal.get("summary") or "").strip()
        summary_tokens = len(tokenizer.encode(summary, add_special_tokens=False).ids) if summary else 0
        title_tokens = len(tokenizer.encode(f"{label}\n{summary}", add_special_tokens=False).ids)
        writer.writerow([source, external_id, group, proposal.get("type") or "", label, summary_tokens, title_tokens, bool(summary)])
        groups[(source, group)].append((summary_tokens, title_tokens))
        houses[source].append((summary_tokens, title_tokens))
        if not summary:
            missing[(source, group)] += 1

def stats(values):
    descriptions = [item[0] for item in values]
    titles = [item[1] for item in values]
    return {"n": len(values), "summary_total": sum(descriptions), "label_summary_total": sum(titles),
            "summary_mean": round(statistics.mean(descriptions), 1) if descriptions else 0,
            "summary_median": statistics.median(descriptions) if descriptions else 0,
            "summary_min": min(descriptions, default=0), "summary_max": max(descriptions, default=0)}

print(json.dumps({"tokenizer": "paraphrase-multilingual-MiniLM-L12-v2 WordPiece", "counted": len(seen),
                  "duplicate_active_rows": duplicates, "csv": str(output),
                  "houses": {house: stats(values) for house, values in sorted(houses.items())},
                  "groups": [{"source": source, "group": group, **stats(values), "missing_summary": missing[(source, group)]}
                             for (source, group), values in sorted(groups.items())]}, ensure_ascii=False, indent=2))
