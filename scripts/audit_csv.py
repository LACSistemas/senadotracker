"""Audita CSV local em streaming sem copiar ou alterar o arquivo de origem."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path


def detect_encoding(path: Path) -> str:
    sample = path.read_bytes()[:131072]
    if sample.startswith(b"\xef\xbb\xbf"):
        return "utf-8-sig"
    for encoding in ("utf-8", "windows-1252", "latin-1"):
        try:
            sample.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            pass
    raise ValueError("Codificação não identificada")


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def audit(path: Path) -> dict[str, object]:
    encoding = detect_encoding(path)
    with path.open("r", encoding=encoding, newline="") as source:
        sample = source.read(131072)
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|")
        source.seek(0)
        reader = csv.DictReader(source, dialect=dialect)
        headers = reader.fieldnames or []
        counters = {field: Counter() for field in (
            "ANO_ELEICAO", "NR_TURNO", "DS_CARGO", "SG_UF", "SG_PARTIDO",
            "DS_SIT_TOT_TURNO", "DS_SITUACAO_CANDIDATURA", "DS_TIPO_BEM_CANDIDATO",
            "grupo", "cargo", "lotacao", "funcao",
        ) if field in headers}
        key_fields = [field for field in ("SQ_CANDIDATO", "SQ_BEM_CANDIDATO", "ponto") if field in headers]
        distinct = {field: set() for field in key_fields}
        blank_keys = Counter()
        malformed = 0
        rows = 0
        for row in reader:
            rows += 1
            if None in row:
                malformed += 1
            for field, counter in counters.items():
                counter[(row.get(field) or "").strip()] += 1
            for field, values in distinct.items():
                value = (row.get(field) or "").strip()
                if value:
                    values.add(value)
                else:
                    blank_keys[field] += 1
    stat = path.stat()
    return {
        "file": path.name,
        "bytes": stat.st_size,
        "sha256": hash_file(path),
        "encoding": encoding,
        "delimiter": dialect.delimiter,
        "rows": rows,
        "columns": len(headers),
        "headers": headers,
        "malformed_rows": malformed,
        "keys": {field: {"distinct": len(values), "blank": blank_keys[field]} for field, values in distinct.items()},
        "distributions": {
            field: [{"value": value, "count": count} for value, count in counter.most_common(30)]
            for field, counter in counters.items()
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = {"files": [audit(path) for path in args.files]}
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
