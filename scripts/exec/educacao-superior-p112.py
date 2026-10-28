"""P11.2 real collector for INEP Censo Superior 2022-2024.

RAW/CSV inputs are read only from D:\\Civica. Loading uses PostgreSQL COPY through
temporary staging tables, then deterministic upserts into civica_exec. This file
intentionally does not call an external source or write outside D:\\Civica.
"""
from __future__ import annotations
import csv, hashlib, json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from io import StringIO
import psycopg2
from psycopg2.extras import execute_values

ROOT = Path(r"D:\Civica")
RAW = ROOT / "raw" / "inep" / "censo_superior"
STAGING = ROOT / "staging" / "p112"
YEARS = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else "2022,2023,2024").split(",")]
PARSER = "p112-2026-10-27-v3"
URLS = {y: f"https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_{y}.zip" for y in YEARS}

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""): h.update(b)
    return h.hexdigest()

def integer(v):
    if v is None: return None
    s = str(v).strip().replace(".", "") if str(v).strip().isdigit() else str(v).strip()
    if not s or s in {"-", "NA", "N/A", "nan"}: return None
    try: return int(float(s.replace(",", ".")))
    except ValueError: return None

def clean(v):
    s = "" if v is None else str(v).strip()
    return s or None

def csv_rows(path: Path):
    return csv.DictReader(path.open("r", encoding="latin1", newline=""), delimiter=";")

def copy_chunks(cur, table: str, columns: list[str], rows, chunk_size=12000):
    buf = []
    total = 0
    def flush():
        nonlocal total
        if not buf: return
        sio = StringIO()
        w = csv.writer(sio, delimiter="\t", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
        for row in buf: w.writerow(["\\N" if x is None else x for x in row])
        sio.seek(0)
        cur.copy_expert(f"COPY {table} ({','.join(columns)}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')", sio)
        total += len(buf); buf.clear()
    for row in rows:
        buf.append(row)
        if len(buf) >= chunk_size: flush()
    flush()
    return total

def main():
    for y in YEARS:
        if y not in (2022, 2023, 2024): raise SystemExit(f"edição não preparada: {y}")
    conn = psycopg2.connect(host=os.getenv("DB_HOST", "localhost"), port=int(os.getenv("DB_PORT", "5432")),
                            dbname=os.getenv("DB_NAME", "projetoeleitor_db"), user=os.getenv("DB_USER", "projetoeleitor_user"),
                            password=os.getenv("DB_PASSWORD", "projetoeleitorsenha"))
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("SELECT current_database(), current_user")
    print(json.dumps({"database": cur.fetchone()[0], "user": cur.fetchone()[1] if False else os.getenv("DB_USER", "projetoeleitor_user")}))
    cur.execute("SELECT coalesce(json_object_agg(ibge7::text, entity_id) FILTER (WHERE kind=4), '{}'::json) FROM civica_exec.exec_entity")
    mun_map = {int(k): int(v) for k,v in cur.fetchone()[0].items()}
    cur.execute("SELECT coalesce(json_object_agg(uf, entity_id) FILTER (WHERE kind=3), '{}'::json) FROM civica_exec.exec_entity")
    uf_map = {k: int(v) for k,v in cur.fetchone()[0].items() if k}
    all_cov = []
    hashes = {}
    for y in YEARS:
        zip_path = RAW / f"microdados_censo_da_educacao_superior_{y}.zip"
        if not zip_path.exists(): raise FileNotFoundError(zip_path)
        hashes[str(y)] = sha256(zip_path)
    cur.execute("SELECT run_id,source_hashes,parser_version FROM civica_exec.exec_edu_higher_collection_run WHERE status='published' ORDER BY run_id DESC LIMIT 1")
    previous = cur.fetchone()
    if previous and previous[1] == hashes and previous[2] == PARSER:
        print(json.dumps({"run_id": int(previous[0]), "status": "no_change", "source_hashes": hashes}, ensure_ascii=False)); cur.close(); conn.close(); return
    cur.execute("INSERT INTO civica_exec.exec_edu_higher_collection_run(years,source_urls,source_hashes,parser_version,status,data_through) VALUES (%s,%s,%s,%s,'running',%s) RETURNING run_id", (YEARS, json.dumps(URLS), json.dumps(hashes), PARSER, max(YEARS)))
    run_id = cur.fetchone()[0]
    conn.commit()
    try:
        
        cur.execute("UPDATE civica_exec.exec_edu_higher_collection_run SET source_hashes=%s WHERE run_id=%s", (json.dumps(hashes), run_id)); conn.commit()
        for y in YEARS:
            t0 = time.perf_counter()
            d = STAGING / str(y)
            ies_path = d / f"MICRODADOS_ED_SUP_IES_{y}.CSV"
            course_path = d / f"MICRODADOS_CADASTRO_CURSOS_{y}.CSV"
            ies_sha, course_sha = sha256(ies_path), sha256(course_path)
            # IES identity and annual facts.
            ies_rows = []
            ies_year_rows = []
            with ies_path.open("r", encoding="latin1", newline="") as fh:
                for r in csv.DictReader(fh, delimiter=";"):
                    co = integer(r.get("CO_IES"));
                    if co is None: continue
                    mun = integer(r.get("CO_MUNICIPIO_IES")); entity = mun_map.get(mun)
                    name, sigla, com, mant = clean(r.get("NO_IES")) or f"IES {co}", clean(r.get("SG_IES")), integer(r.get("CO_MANTENEDORA")), clean(r.get("NO_MANTENEDORA"))
                    org, cat = integer(r.get("TP_ORGANIZACAO_ACADEMICA")), integer(r.get("TP_CATEGORIA_ADMINISTRATIVA"))
                    # 2022 IES layout omits TP_REDE; it is reconciled from the course file below.
                    rede = integer(r.get("TP_REDE"))
                    doc, doce, tec = integer(r.get("QT_DOC_TOTAL")), integer(r.get("QT_DOC_EXE")), integer(r.get("QT_TEC_TOTAL"))
                    ies_rows.append((co, name, sigla, com, mant, y, y))
                    ies_year_rows.append((y, co, mun, entity, integer(r.get("CO_UF_IES")), clean(r.get("SG_UF_IES")), name, sigla, com, mant, org, cat, rede, doc, doce, tec, run_id, ies_sha))
            execute_values(cur, """INSERT INTO civica_exec.exec_edu_higher_ies(co_ies,canonical_name,canonical_sigla,co_mantenedora,canonical_mantenedora,first_year,last_year) VALUES %s ON CONFLICT(co_ies) DO UPDATE SET canonical_name=EXCLUDED.canonical_name, canonical_sigla=EXCLUDED.canonical_sigla, co_mantenedora=EXCLUDED.co_mantenedora, canonical_mantenedora=EXCLUDED.canonical_mantenedora, first_year=LEAST(exec_edu_higher_ies.first_year,EXCLUDED.first_year), last_year=GREATEST(exec_edu_higher_ies.last_year,EXCLUDED.last_year), source_updated_at=now()""", [r[:7] for r in ies_rows], page_size=1000)
            execute_values(cur, """INSERT INTO civica_exec.exec_edu_higher_ies_year(year,co_ies,co_municipio_ies,entity_id,uf_code,uf,name,sigla,co_mantenedora,mantenedora,tp_organizacao_academica,tp_categoria_administrativa,tp_rede,qt_doc_total,qt_doc_exe,qt_tec_total,source_run_id,source_file_sha256) VALUES %s ON CONFLICT(year,co_ies) DO UPDATE SET co_municipio_ies=EXCLUDED.co_municipio_ies,entity_id=EXCLUDED.entity_id,uf_code=EXCLUDED.uf_code,uf=EXCLUDED.uf,name=EXCLUDED.name,sigla=EXCLUDED.sigla,co_mantenedora=EXCLUDED.co_mantenedora,mantenedora=EXCLUDED.mantenedora,tp_organizacao_academica=EXCLUDED.tp_organizacao_academica,tp_categoria_administrativa=EXCLUDED.tp_categoria_administrativa,tp_rede=EXCLUDED.tp_rede,qt_doc_total=EXCLUDED.qt_doc_total,qt_doc_exe=EXCLUDED.qt_doc_exe,qt_tec_total=EXCLUDED.qt_tec_total,source_run_id=EXCLUDED.source_run_id,source_file_sha256=EXCLUDED.source_file_sha256""", ies_year_rows, page_size=1000)
            # Course identity plus deterministic offer key. Base-key collisions are counted explicitly.
            course_rows = []
            offer_rows = []
            base_seen = {}
            with course_path.open("r", encoding="latin1", newline="") as fh:
                for r in csv.DictReader(fh, delimiter=";"):
                    ies, course = integer(r.get("CO_IES")), integer(r.get("CO_CURSO"))
                    if ies is None or course is None: continue
                    mun = integer(r.get("CO_MUNICIPIO")) or 0
                    mod, dim = integer(r.get("TP_MODALIDADE_ENSINO")) or 0, integer(r.get("TP_DIMENSAO")) or 0
                    base = (ies, course, mun, mod); base_seen[base] = base_seen.get(base, 0) + 1
                    course_rows.append((course, clean(r.get("NO_CURSO")) or f"Curso {course}", integer(r.get("TP_GRAU_ACADEMICO")), integer(r.get("TP_NIVEL_ACADEMICO")), clean(r.get("CO_CINE_AREA_GERAL")) or clean(r.get("CO_CINE_AREA_ESPECIFICA")), clean(r.get("CO_CINE_SUBAREA")), y, y))
                    offer_rows.append((y, ies, course, mun, mun_map.get(mun), clean(r.get("SG_UF")) or clean(r.get("SG_UF_IES")), mod, dim, integer(r.get("TP_REDE")), integer(r.get("TP_CATEGORIA_ADMINISTRATIVA")), integer(r.get("TP_GRAU_ACADEMICO")), integer(r.get("TP_NIVEL_ACADEMICO")), clean(r.get("NO_CURSO")) or f"Curso {course}", integer(r.get("QT_CURSO")), integer(r.get("QT_VG_TOTAL")), integer(r.get("QT_INSCRITO_TOTAL")), integer(r.get("QT_ING")), integer(r.get("QT_MAT")), integer(r.get("QT_CONC")), run_id, course_sha))
            execute_values(cur, """INSERT INTO civica_exec.exec_edu_higher_course(co_curso,canonical_name,tp_grau_academico,tp_nivel_academico,cine_area_detalhada,cine_subarea,first_year,last_year) VALUES %s ON CONFLICT(co_curso) DO UPDATE SET canonical_name=EXCLUDED.canonical_name,tp_grau_academico=EXCLUDED.tp_grau_academico,tp_nivel_academico=EXCLUDED.tp_nivel_academico,cine_area_detalhada=EXCLUDED.cine_area_detalhada,cine_subarea=EXCLUDED.cine_subarea,first_year=LEAST(exec_edu_higher_course.first_year,EXCLUDED.first_year),last_year=GREATEST(exec_edu_higher_course.last_year,EXCLUDED.last_year)""", list({r[0]:r for r in course_rows}.values()), page_size=1000)
            cur.execute("CREATE TEMP TABLE IF NOT EXISTS p112_offer_stage (LIKE civica_exec.exec_edu_higher_offer_year INCLUDING DEFAULTS) ON COMMIT DELETE ROWS")
            cur.execute("TRUNCATE p112_offer_stage")
            cols = ['year','co_ies','co_curso','co_municipio','entity_id','uf','tp_modalidade','tp_dimensao','tp_rede','tp_categoria_administrativa','tp_grau_academico','tp_nivel_academico','nome_curso','qt_curso','qt_vg_total','qt_inscrito_total','qt_ing','qt_mat','qt_conc','source_run_id','source_file_sha256']
            copy_chunks(cur, 'p112_offer_stage', cols, offer_rows)
            cur.execute("SELECT count(*)-count(DISTINCT (year,co_ies,co_curso,co_municipio,tp_modalidade,tp_dimensao)) FROM p112_offer_stage")
            stage_dups = int(cur.fetchone()[0])
            if stage_dups: raise RuntimeError(f"{y}: chave final de oferta ainda colide: {stage_dups}")
            cur.execute("""INSERT INTO civica_exec.exec_edu_higher_offer_year SELECT * FROM p112_offer_stage ON CONFLICT(year,co_ies,co_curso,co_municipio,tp_modalidade,tp_dimensao) DO UPDATE SET entity_id=EXCLUDED.entity_id,uf=EXCLUDED.uf,tp_rede=EXCLUDED.tp_rede,tp_categoria_administrativa=EXCLUDED.tp_categoria_administrativa,tp_grau_academico=EXCLUDED.tp_grau_academico,tp_nivel_academico=EXCLUDED.tp_nivel_academico,nome_curso=EXCLUDED.nome_curso,qt_curso=EXCLUDED.qt_curso,qt_vg_total=EXCLUDED.qt_vg_total,qt_inscrito_total=EXCLUDED.qt_inscrito_total,qt_ing=EXCLUDED.qt_ing,qt_mat=EXCLUDED.qt_mat,qt_conc=EXCLUDED.qt_conc,source_run_id=EXCLUDED.source_run_id,source_file_sha256=EXCLUDED.source_file_sha256""")
            if y == 2022:
                # O layout IES/2022 não traz TP_REDE; o arquivo de cursos traz a mesma classificação.
                # Reconciliar por IES a partir do valor source-native observado nas ofertas, inclusive categoria 7 (Especial).
                cur.execute("""UPDATE civica_exec.exec_edu_higher_ies_year i SET tp_rede=x.tp_rede
                  FROM (SELECT co_ies,mode() WITHIN GROUP (ORDER BY tp_rede) tp_rede FROM civica_exec.exec_edu_higher_offer_year WHERE year=2022 AND tp_rede IS NOT NULL GROUP BY co_ies) x
                  WHERE i.year=2022 AND i.co_ies=x.co_ies""")
            base_dups = sum(v-1 for v in base_seen.values() if v > 1)
            cur.execute("""INSERT INTO civica_exec.exec_edu_higher_coverage(year,source_url,source_file_sha256,ies_rows,ies_distinct,course_rows,course_distinct,offer_rows,municipalities_resolved,municipalities_unresolved,duplicate_base_rows,parser_version,data_through,status) SELECT %s,%s,%s,%s,%s,%s,%s,count(*),count(*) FILTER (WHERE entity_id IS NOT NULL AND co_municipio<>0),count(*) FILTER (WHERE entity_id IS NULL AND co_municipio<>0),%s,%s,%s,'published' FROM p112_offer_stage ON CONFLICT(year) DO UPDATE SET source_url=EXCLUDED.source_url,source_file_sha256=EXCLUDED.source_file_sha256,ies_rows=EXCLUDED.ies_rows,ies_distinct=EXCLUDED.ies_distinct,course_rows=EXCLUDED.course_rows,course_distinct=EXCLUDED.course_distinct,offer_rows=EXCLUDED.offer_rows,municipalities_resolved=EXCLUDED.municipalities_resolved,municipalities_unresolved=EXCLUDED.municipalities_unresolved,duplicate_base_rows=EXCLUDED.duplicate_base_rows,parser_version=EXCLUDED.parser_version,data_through=EXCLUDED.data_through,status=EXCLUDED.status""", (y, URLS[y], course_sha, len(ies_rows), len({r[0] for r in ies_rows}), len(offer_rows), len({r[2] for r in offer_rows}), base_dups, PARSER, f"{y}-12-31"))
            conn.commit(); all_cov.append({"year":y,"ies_rows":len(ies_rows),"offer_rows":len(offer_rows),"base_duplicate_rows":base_dups,"seconds":round(time.perf_counter()-t0,2),"sha256_zip":hashes[str(y)],"sha256_ies":ies_sha,"sha256_courses":course_sha})
            print(json.dumps(all_cov[-1], ensure_ascii=False), flush=True)
        # Compact read model: BR, UF and municipality. Geography is only attributed where INEP supplies a municipality.
        for y in YEARS:
            cur.execute("DELETE FROM civica_exec.exec_edu_higher_territory_year WHERE year=%s", (y,))
            cur.execute("""INSERT INTO civica_exec.exec_edu_higher_territory_year(scope,scope_key,year,ies_count,course_count,offer_count,municipalities_count,public_ies_count,private_ies_count,in_person_offer_count,distance_offer_count,vacancies,applicants,entrants,enrollments,graduates,source_run_id)
              SELECT 1,'BR',o.year,count(DISTINCT o.co_ies),count(DISTINCT o.co_curso),count(*),count(DISTINCT NULLIF(o.entity_id,0)),count(DISTINCT o.co_ies) FILTER(WHERE i.tp_rede=1),count(DISTINCT o.co_ies) FILTER(WHERE i.tp_rede=2),count(*) FILTER(WHERE o.tp_modalidade=1),count(*) FILTER(WHERE o.tp_modalidade=2),sum(o.qt_vg_total),sum(o.qt_inscrito_total),sum(o.qt_ing),sum(o.qt_mat),sum(o.qt_conc),%s FROM civica_exec.exec_edu_higher_offer_year o JOIN civica_exec.exec_edu_higher_ies_year i ON i.year=o.year AND i.co_ies=o.co_ies WHERE o.year=%s GROUP BY o.year""", (run_id,y))
            cur.execute("""INSERT INTO civica_exec.exec_edu_higher_territory_year(scope,scope_key,year,ies_count,course_count,offer_count,municipalities_count,public_ies_count,private_ies_count,in_person_offer_count,distance_offer_count,vacancies,applicants,entrants,enrollments,graduates,source_run_id)
              SELECT 3,o.uf,o.year,count(DISTINCT o.co_ies),count(DISTINCT o.co_curso),count(*),count(DISTINCT NULLIF(o.entity_id,0)),count(DISTINCT o.co_ies) FILTER(WHERE i.tp_rede=1),count(DISTINCT o.co_ies) FILTER(WHERE i.tp_rede=2),count(*) FILTER(WHERE o.tp_modalidade=1),count(*) FILTER(WHERE o.tp_modalidade=2),sum(o.qt_vg_total),sum(o.qt_inscrito_total),sum(o.qt_ing),sum(o.qt_mat),sum(o.qt_conc),%s FROM civica_exec.exec_edu_higher_offer_year o JOIN civica_exec.exec_edu_higher_ies_year i ON i.year=o.year AND i.co_ies=o.co_ies WHERE o.year=%s AND o.entity_id IS NOT NULL AND o.uf IS NOT NULL GROUP BY o.uf,o.year""", (run_id,y))
            cur.execute("""INSERT INTO civica_exec.exec_edu_higher_territory_year(scope,scope_key,year,ies_count,course_count,offer_count,municipalities_count,public_ies_count,private_ies_count,in_person_offer_count,distance_offer_count,vacancies,applicants,entrants,enrollments,graduates,source_run_id)
              SELECT 4,o.entity_id::text,o.year,count(DISTINCT o.co_ies),count(DISTINCT o.co_curso),count(*),1,count(DISTINCT o.co_ies) FILTER(WHERE i.tp_rede=1),count(DISTINCT o.co_ies) FILTER(WHERE i.tp_rede=2),count(*) FILTER(WHERE o.tp_modalidade=1),count(*) FILTER(WHERE o.tp_modalidade=2),sum(o.qt_vg_total),sum(o.qt_inscrito_total),sum(o.qt_ing),sum(o.qt_mat),sum(o.qt_conc),%s FROM civica_exec.exec_edu_higher_offer_year o JOIN civica_exec.exec_edu_higher_ies_year i ON i.year=o.year AND i.co_ies=o.co_ies WHERE o.year=%s AND o.entity_id IS NOT NULL GROUP BY o.entity_id,o.year""", (run_id,y))
        cur.execute("UPDATE civica_exec.exec_edu_higher_collection_run SET status='published',finished_at=now(),data_through=%s,rows_ies=(SELECT sum(ies_rows) FROM civica_exec.exec_edu_higher_coverage),rows_courses=(SELECT sum(course_distinct) FROM civica_exec.exec_edu_higher_coverage),rows_offers=(SELECT sum(offer_rows) FROM civica_exec.exec_edu_higher_coverage) WHERE run_id=%s", (max(YEARS),run_id))
        conn.commit()
        print(json.dumps({"run_id":run_id,"coverage":all_cov,"status":"published"}, ensure_ascii=False))
    except Exception as exc:
        conn.rollback(); cur.execute("UPDATE civica_exec.exec_edu_higher_collection_run SET status='failed',finished_at=now(),error=%s WHERE run_id=%s", (str(exc)[:4000],run_id)); conn.commit(); raise
    finally:
        cur.close(); conn.close()

if __name__ == "__main__": main()
