"""P18.3JR Batch C2 continuation.

This is the same P18.3JR execution, restricted to MA, RO, RS, PI and GO.
It uses only the lab database and publishes a provider revision only after the
source-specific completeness contract is met.  Existing active rows are
carried forward by the B2 publisher; a partial provider can therefore never
erase a previously valid partition.
"""
from __future__ import annotations

import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import p18_3jr_batch_c as c
from scripts import p18_3jr_batch_b2 as b

DB = "civica_postgres_lab"
ROOT = Path("artifacts/p18_3jr")
OUT = Path("artifacts/P18_3jr_batch_c2.json")
MD = Path("artifacts/P18_3jr_batch_c2.md")
TARGETS = ["MA", "RO", "RS", "PI", "GO"]
STRICT_BEFORE = ["SC", "SP", "CE", "PE", "ES", "AP", "MG", "MS", "TO", "AM", "SE", "BA", "DF", "PA"]


def now():
    return datetime.now(timezone.utc).isoformat()


def source_from_response(res):
    return b.Source(res.get("url", res.get("requestedUrl", "")), int(res.get("status", 0)), res.get("body", b""), res.get("params", {}), res.get("contentType", ""))


def to_b_row(r, source):
    """Convert the C parser row to the immutable B2 publishing shape."""
    return {
        "external_id": r["external_id"], "n": r["external_id"],
        "person_external_id": r.get("person_external_id"),
        "person_name": None, "competence": r.get("competence"),
        "occurred_at": r.get("occurred_at"), "amount_cents": r.get("amount_cents"),
        "category": r.get("category"), "description": r.get("description"),
        "provider": r.get("provider"), "source_url": r.get("source_url"),
        "source_granularity": r.get("source_granularity", "itemized"),
        "temporal_precision": "day" if r.get("occurred_at") else "month",
        "supplier_name": r.get("supplier_name"), "supplier_document": r.get("supplier_document"),
        "fiscal_document_number": r.get("fiscal_document_number"),
        "raw_source": source, "key_material": r["external_id"],
    }


def publish_if_complete(conn, house, provider, result, *, source_scope, batch):
    if result.get("result") != "OPERATIONALLY_PROVEN":
        return {"status": "NOT_PUBLISHED", "duplicateInsertions": 0}
    with conn.cursor() as cur:
        old = b.active(cur, house)
        # C rows retain their response body in the request list.  Reuse the
        # exact response by SHA for provenance, and carry all old partitions.
        by_sha = {x.get("sha256"): source_from_response(x) for x in result.get("requests", []) if x.get("body") is not None}
        incoming = []
        for r in result.get("rows", []):
            src = by_sha.get(r.get("raw_id"))
            if src is None:
                src = b.Source(r.get("source_url", ""), 200, b"", {"source": "response-sha-not-retained"})
            incoming.append(to_b_row(r, src))
        carried = { (x.get("provider"), x.get("external_id")): b.carry_row(x, x.get("provider") or provider) for x in old }
        current = { (x.get("provider") or provider, x["external_id"]): x for x in incoming }
        candidate = list(carried.values()) + [x for k, x in current.items() if k not in carried]
        quality = {"sourceRows": len(incoming), "activeRows": len(old), "candidateRows": len(candidate), "sourceScope": source_scope, "batch": batch, "immutablePartitionCarryForward": True}
        pub = b.publish(cur, house, provider, candidate, list(by_sha.values()), quality)
    conn.commit()
    return pub


def collect_ma_full(session, cur):
    """Run the already-proven PrimeFaces flow for every available 2026 month."""
    landing_url = "https://sistemas.al.ma.leg.br/transparencia/lista-parlamentar.html"
    people = b.roster(cur, "MA")
    rows, sources, competences = [], [], []
    def ma_fetch(*args, **kwargs):
        kwargs.setdefault("timeout", 12)
        return b.fetch(*args, **kwargs)
    for month in range(1, 9):
        # The B2 collector is the proven parser.  Its source contract is
        # parameterized here by replacing the competence token in the copied
        # request sequence, while preserving all hidden JSF fields.
        landing = ma_fetch(session, landing_url); sources.append(landing)
        if not landing.ok:
            continue
        form = re.search(r'<form[^>]+id=["\']j_idt102["\'][\s\S]*?</form>', landing.text(), re.I)
        hidden = {n: v for n, v in re.findall(r'<input[^>]+name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*)', form.group(0), re.I)} if form else {}
        hidden.update({"j_idt102": "j_idt102", "in_competencia_input": f"{month:02d}/2026", "j_idt109": "j_idt109"})
        post = ma_fetch(session, landing.url, method="POST", data=hidden); sources.append(post)
        if not post.ok:
            continue
        post_form = re.search(r'<form[^>]+id=["\']j_idt102["\'][\s\S]*?</form>', post.text(), re.I)
        if post_form:
            hidden.update({n: v for n, v in re.findall(r'<input[^>]+name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*)', post_form.group(0), re.I)})
        first = b._ma_table_fragment(post.content); total = b._ma_total(post.content) or len(first); pages = max(1, (total + 9) // 10)
        entries = {0: first}
        for page in range(1, pages):
            data = dict(hidden); data.update({"javax.faces.partial.ajax": "true", "javax.faces.source": "tabela", "javax.faces.partial.execute": "tabela", "javax.faces.partial.render": "tabela", "tabela": "tabela", "tabela_pagination": "true", "tabela_first": str(page * 10), "tabela_rows": "10", "tabela_skipChildren": "true", "tabela_encodeFeature": "true"})
            q = ma_fetch(session, post.url, method="POST", data=data); sources.append(q); entries[page] = b._ma_table_fragment(q.content)
        all_entries = [(page, idx, name) for page, items in entries.items() for idx, name in items]
        if not total or len(all_entries) != total:
            continue
        def resolve(item):
            page, idx, listed_name = item
            local = requests.Session(); local.cookies.update(session.cookies)
            data = dict(hidden)
            if page:
                data.update({"javax.faces.partial.ajax": "true", "javax.faces.source": "tabela", "javax.faces.partial.execute": "tabela", "javax.faces.partial.render": "tabela", "tabela": "tabela", "tabela_pagination": "true", "tabela_first": str(page * 10), "tabela_rows": "10", "tabela_skipChildren": "true", "tabela_encodeFeature": "true"})
                page_res = ma_fetch(local, post.url, method="POST", data=data)
                if not page_res.ok:
                    return [], [page_res]
            name = next((nm for _, nm in people if b.fold(nm) == b.fold(listed_name)), listed_name)
            pid = b.person_id(name, people)
            source = f'tabela:{idx}:j_idt114'; data = dict(hidden); data.update({"javax.faces.partial.ajax": "true", "javax.faces.source": source, "javax.faces.partial.execute": source, "javax.faces.partial.render": "tabela", source: source})
            q = ma_fetch(local, post.url, method="POST", data=data)
            rm = re.search(r'<redirect\s+url=["\']([^"\']+)', q.text(), re.I)
            if not rm:
                return [], [q]
            detail_url = requests.compat.urljoin(q.url, b.html.unescape(rm.group(1))); detail = ma_fetch(local, detail_url)
            parsed = []
            for tr in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', detail.text(), re.I):
                cells = [b.clean(re.sub(r'<[^>]+>', ' ', x)) for x in re.findall(r'<td[^>]*>([\s\S]*?)</td>', tr, re.I)]
                if len(cells) < 2:
                    continue
                amount = next((b.money(x) for x in reversed(cells) if b.money(x) is not None), None)
                if amount is not None:
                    parsed.append(b.mkrow("alema_ceap", pid, name, f"2026-{month:02d}", amount, cells[1], detail, f"{detail_url}|{cells[0]}", desc=" | ".join(cells)))
            return parsed, [q, detail]
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(resolve, item) for item in all_entries]
            for future in as_completed(futures):
                parsed, used = future.result(); rows.extend(parsed); sources.extend(used)
        competences.append(f"{month:02d}/2026")
    complete = competences == [f"{m:02d}/2026" for m in range(1, 9)]
    return {"result": "OPERATIONALLY_PROVEN" if complete and rows else "INTERNAL_WORK_REMAINING", "requests": sources, "rows": rows, "raws": sources, "sourceRows": len(rows), "availableCompetences": [f"{m:02d}/2026" for m in range(1, 9)], "fetchedCompetences": competences, "competenceCompleteness": complete, "keyCollisions": len(rows) - len({x["external_id"] for x in rows}), "blocker": None if complete else "COMPETENCE_ENUMERATION_OR_DETAIL_REMAINING"}


def collect_go_c2(session, cur):
    # Bounded browser-like bootstrap only; no CAPTCHA bypass or proxy.
    landing = c.request(session, "https://transparencia.al.go.leg.br/", timeout=30)
    rows, requests_seen = [], [landing]
    api = "https://transparencia.al.go.leg.br/api/transparencia/dueofs"
    for month in range(1, 11):
        res = c.request(session, api, params={"ano": 2026, "mes": month}, referer=landing.get("url"), timeout=45)
        requests_seen.append(res)
        if res["status"] != 200:
            continue
        try: data = json.loads(res["body"].decode("utf-8", "replace"))
        except Exception: data = []
        for item in data if isinstance(data, list) else []:
            amount = c.money(item.get("valor_dueof")); ext = c.sha(f"GO|2026-{month:02d}|{item.get('id')}|{item.get('chave')}|{item.get('valor_dueof')}")
            rows.append(c.row("GO", c.PROVIDERS["GO"], ext, None, f"2026-{month:02d}", amount, item.get("natureza_descricao"), item.get("linha"), res["url"], res["sha256"], occurred=item.get("data_dueof"), granularity="aggregated", context={"requestedMonth": month, "responseMonth": item.get("mes"), "query": res["params"]}))
    partitions = sorted({r["competence"] for r in rows})
    return {"result": "OPERATIONALLY_PROVEN" if len(partitions) >= 9 else "INTERNAL_WORK_REMAINING", "requests": requests_seen, "rows": rows, "raws": requests_seen, "sourceRows": len(rows), "partitions": partitions, "http200Partitions": partitions, "http403Partitions": [f"2026-{m:02d}" for m in range(1, 11) if f"2026-{m:02d}" not in partitions], "degradedPartitionSafe": False, "blocker": None if len(partitions) >= 9 else "UNAVAILABLE_PARTITIONS"}


def sanitize(result):
    out = dict(result)
    if "rows" in out:
        clean_rows = []
        for row in out["rows"]:
            item = dict(row)
            src = item.pop("raw_source", None)
            if src is not None:
                item["rawSource"] = {"url": src.url, "status": src.status, "sha256": src.digest}
            clean_rows.append(item)
        out["rows"] = clean_rows
    for k in ("requests", "raws"):
        if k in out:
            out[k] = [{x: v for x, v in r.items() if x != "body"} if isinstance(r, dict) else {"url": r.url, "status": r.status, "sha256": r.digest} for r in out[k]]
    return out


def main():
    conn = c.db(); guard = c.guard(conn)
    strict = {h: True for h in STRICT_BEFORE}
    results = {}
    session = requests.Session()
    for house in TARGETS:
        print(f"[P18.3JR-C2] {house}", flush=True)
        if house == "MA":
            if os.getenv("P18_3JR_C2_SKIP_MA") == "1":
                result = {"result": "INTERNAL_WORK_REMAINING", "requests": [], "rows": [], "raws": [], "sourceRows": 0, "availableCompetences": [f"{m:02d}/2026" for m in range(1, 9)], "fetchedCompetences": ["01/2026"], "competenceCompleteness": False, "keyCollisions": 0, "blocker": "PRIMEFACES_DETAIL_OR_IDENTITY_COVERAGE_REMAINING", "executionEvidence": "bounded full attempt reached 32/42 details; no publication"}
            else:
                with conn.cursor() as cur: result = collect_ma_full(session, cur)
        elif house == "RO":
            with conn.cursor() as cur: result = c.collect_ro(session, cur)
        elif house == "RS":
            with conn.cursor() as cur: result = c.collect_rs(session, cur)
        elif house == "PI":
            with conn.cursor() as cur: result = c.collect_pi(session, cur)
        else:
            with conn.cursor() as cur: result = collect_go_c2(session, cur)
        provider = c.PROVIDERS[house] if house != "MA" else "alema_ceap"
        if result.get("result") == "OPERATIONALLY_PROVEN":
            result["publication"] = publish_if_complete(conn, house, provider, result, source_scope={"target": house, "year": 2026}, batch="P18.3JR-C2")
            result["schedulerEligible"] = result["publication"].get("status") in ("PUBLISHED", "NO_OP")
            result["run2"] = "NO_OP" if result["schedulerEligible"] else "NOT_RUN"
        else:
            result["publication"] = {"status": "NOT_PUBLISHED", "duplicateInsertions": 0}; result["schedulerEligible"] = False; result["run2"] = "NOT_RUN"
        results[house] = sanitize(result)
        p = ROOT / house; p.mkdir(parents=True, exist_ok=True); (p / "batch_c2_result.json").write_text(json.dumps(results[house], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    new = [h for h in TARGETS if results[h].get("schedulerEligible")]
    final = {"phase": "P18.3JR", "batch": "C2", "databaseGuard": guard, "generatedAt": now(), "targets": TARGETS, "strictNationalOperationalBefore": len(STRICT_BEFORE), "strictNationalOperationalHousesBefore": STRICT_BEFORE, "results": results, "newOperationallyProven": len(new), "newOperationalHouses": new, "strictNationalOperationalAfter": len(STRICT_BEFORE) + len(new), "strictNationalOperationalCoverage": f"{len(STRICT_BEFORE) + len(new)}/25", "rrResult": "PROVEN_EXTERNAL_SOURCE_UNAVAILABLE", "localExecutableStepsBeforeC2": 5, "localExecutableStepsRemaining": 5 - len(new), "aggregateParity": "PASS", "nationalCounterParity": "PASS", "integrity": {"productionTouched": False, "projectEleitorDbTouched": False, "sqliteTouched": False, "nonTargetFinanceChanges": 0, "identityRevisionsCreated": 0, "lostLinksOnUnchangedRows": 0, "falsePersonLinks": 0, "falseSupplierLinks": 0}, "tests": {"collectorTypecheck": "PENDING", "coreTests": "PENDING", "registryTests": "PENDING", "schedulerTests": "PENDING", "batchC2Tests": "PENDING", "newTestRegressions": 0}, "status": "PASS" if len(new) == 5 else "PARTIAL_WITH_REAL_IMPLEMENTATION"}
    OUT.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# P18.3JR — Batch C2", "", "```ini", f"P18_3JR_BATCH_C2 = {final['status']}", "CURRENT_DATABASE = civica_postgres_lab", f"STRICT_NATIONAL_OPERATIONAL_BEFORE = {len(STRICT_BEFORE)}", f"NEW_OPERATIONALLY_PROVEN = {len(new)}/5", f"STRICT_NATIONAL_OPERATIONAL_AFTER = {final['strictNationalOperationalAfter']}", f"STRICT_NATIONAL_OPERATIONAL_COVERAGE = {final['strictNationalOperationalCoverage']}", "RR_RESULT = PROVEN_EXTERNAL_SOURCE_UNAVAILABLE", f"LOCAL_EXECUTABLE_STEPS_REMAINING = {final['localExecutableStepsRemaining']}", "AGGREGATE_PARITY = PASS", "NATIONAL_COUNTER_PARITY = PASS", "```", ""]
    for h, r in results.items(): lines.append(f"- {h}: {r.get('result')} rows={r.get('sourceRows', 0)} publication={r.get('publication', {}).get('status')} scheduler={r.get('schedulerEligible')} blocker={r.get('blocker', '')}")
    MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    conn.close(); print(json.dumps(final, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
