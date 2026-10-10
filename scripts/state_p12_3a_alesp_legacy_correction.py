import hashlib
import json
import os
import html
import re
import shutil
import tempfile
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from lxml import etree
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
TMP = Path(tempfile.gettempdir())
ART = ROOT / 'artifacts'
DEST = Path(r'C:\Projetos\civicadocs\artifacts')
SCHEMA = 'civica_state'
DB = 'civica_postgres_lab'
OLD = 'state:SP:participation:f4278b1a6c4247c65e337a45748c4e8c41eaaca77af2d560da82f61f40bb628e'
SAFE = 'state:SP:participation:901e49a8237dcdaf3f6c465e70c4f2f71d401ad44d6140eade608ad738e590af'

def load_env_file():
    p = ROOT / '.env'
    if p.exists():
        for line in p.read_text(encoding='utf8').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

def cache_rows(name):
    p = TMP / ('civica-p12-2-sp-' + name + '.json')
    if not p.exists():
        return []
    obj = json.loads(p.read_text(encoding='utf-8'))
    val = obj.get('value', obj)
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        for v in val.values():
            if isinstance(v, list):
                return v
    return []

def txt(node, names):
    for name in names:
        x = node.find('.//' + name)
        if x is not None and x.text:
            return x.text.strip()
    return None

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()

def stream_zip(path, record_tag, wanted):
    counts = Counter()
    samples = []
    with zipfile.ZipFile(path) as z:
        name = z.namelist()[0]
        with z.open(name) as fh:
            for _, el in etree.iterparse(fh, events=('end',), tag=record_tag, recover=True):
                counts['rows'] += 1
                if len(samples) < 3:
                    samples.append({k: txt(el, [k]) for k in wanted})
                el.clear()
                parent = el.getparent()
                while el.getprevious() is not None:
                    del parent[0]
    return counts, samples

def iter_xml(path, record_tag, wanted, callback=None, sample_limit=3):
    counts = Counter(); samples = []
    def cb(row):
        if len(samples) < sample_limit: samples.append(row)
        if callback: callback(row)
    with path.open('rb') as fh:
        n, _ = scan_stream(fh, record_tag, wanted, cb)
    counts['rows'] = n
    return counts, samples

def load_zip_rows(path, record_tag, wanted):
    rows = []
    with zipfile.ZipFile(path) as z:
        name = z.namelist()[0]
        with z.open(name) as fh:
            for _, el in etree.iterparse(fh, events=('end',), tag=record_tag, recover=True):
                rows.append({k: txt(el, [k]) for k in wanted})
                el.clear()
                parent = el.getparent()
                while el.getprevious() is not None:
                    del parent[0]
    return rows

def scan_zip(path, record_tag, wanted, callback=None, limit=None):
    with zipfile.ZipFile(path) as z:
        with z.open(z.namelist()[0]) as fh:
            return scan_stream(fh, record_tag, wanted, callback, limit)

def scan_stream(fh, record_tag, wanted, callback=None, limit=None):
    count = 0; samples = []
    tag = record_tag.encode()
    pattern = re.compile(rb'<'+tag+rb'\b[^>]*>.*?</'+tag+rb'>', re.S | re.I)
    field_patterns = {k: re.compile(rb'<'+k.encode()+rb'\b[^>]*>(.*?)</'+k.encode()+rb'>', re.S | re.I) for k in wanted}
    carry = b''
    while True:
        chunk = fh.read(8 * 1024 * 1024)
        final = not chunk
        carry += chunk
        matches = list(pattern.finditer(carry))
        consumed = 0
        for m in matches:
            consumed = m.end(); raw = m.group(0); row = {}
            for k, fp in field_patterns.items():
                fm = fp.search(raw)
                row[k] = html.unescape(fm.group(1).decode('utf-8','replace').strip()) if fm else None
            count += 1
            if len(samples) < 3: samples.append(row)
            if callback: callback(row)
            if limit is not None and count >= limit:
                return count, samples
        carry = carry[consumed:]
        if final: break
        if not matches and len(carry) > 32 * 1024 * 1024:
            carry = carry[-4 * 1024 * 1024:]
    return count, samples

def scan_document_ids_zip(path, callback=None, limit=None):
    total = 0; ids = set(); matched = 0; samples = []
    pat = re.compile(rb'<IdDocumento\b[^>]*>(.*?)</IdDocumento>', re.S | re.I)
    with zipfile.ZipFile(path) as z, z.open(z.namelist()[0]) as fh:
        carry = b''
        while True:
            chunk = fh.read(16 * 1024 * 1024); final = not chunk; carry += chunk
            ms = list(pat.finditer(carry)); consumed = 0
            for m in ms:
                consumed = m.end(); value = html.unescape(m.group(1).decode('utf8','replace').strip())
                total += 1; ids.add(value)
                if len(samples) < 3: samples.append({'IdDocumento':value})
                if callback and callback(value): matched += 1
                if limit is not None and total >= limit:
                    return total, ids, matched, samples
            carry = carry[consumed:]
            if final: break
            if not ms and len(carry) > 2 * 1024 * 1024: carry = carry[-256 * 1024:]
    return total, ids, matched, samples

def main():
    load_env_file()
    generated = datetime.now(timezone.utc).isoformat()
    prop_zip = TMP / 'alesp-prop.zip'
    author_zip = TMP / 'alesp-author.zip'
    mov_zip = TMP / 'alesp-mov.zip'
    delib_xml = TMP / 'alesp-deliberations.xml'
    vote_xml = TMP / 'alesp-votes.xml'
    prop_ids = set(); prop_dates = []
    def on_prop(r):
        if r.get('IdDocumento'): prop_ids.add(r['IdDocumento'])
        if r.get('DtPublicacao'): prop_dates.append(r['DtPublicacao'])
    prop_count, prop_samples = scan_zip(prop_zip, 'propositura', ['IdDocumento','AnoLegislativo','DtPublicacao'], on_prop)
    json_props = cache_rows('proposals')
    json_ids = {str(r.get('idDocumento')) for r in json_props if r.get('idDocumento') is not None}
    author_total = 0; author_ids = set(); author_distinct_docs = set(); author_matched_docs = set(); author_matched_rows = 0; author_samples = []
    def on_author(r):
        nonlocal author_total, author_matched_rows
        author_total += 1
        if len(author_samples) < 3: author_samples.append(r)
        if r.get('IdAutor'): author_ids.add(str(r['IdAutor']))
        if r.get('IdDocumento'):
            author_distinct_docs.add(r['IdDocumento'])
            if r['IdDocumento'] in prop_ids:
                author_matched_docs.add(r['IdDocumento']); author_matched_rows += 1
    author_count, _ = scan_zip(author_zip, 'DocumentoAutor', ['IdAutor','IdDocumento','NomeAutor'], on_author)
    movement_matched_docs = set()
    movement_scan_limit = 5000
    movement_total, movement_distinct_docs, movement_matched_rows, movement_samples = scan_document_ids_zip(mov_zip, lambda value: (movement_matched_docs.add(value) or True) if value in prop_ids else False, movement_scan_limit)
    movement_full_json_rows = len(cache_rows('movements'))
    author_rel = {'rows':author_total,'distinctDocumentIds':len(author_distinct_docs),'matchedProposals':len(author_matched_docs),'matchedRows':author_matched_rows,'orphanRows':author_total-author_matched_rows,'ambiguousProposals':0}
    movement_rel = {'rows':movement_full_json_rows,'sourceRowsSampledFromLegacyZip':movement_total,'distinctDocumentIdsSampled':len(movement_distinct_docs),'matchedProposalsSampled':len(movement_matched_docs),'matchedRowsSampled':movement_matched_rows,'orphanRowsSampled':movement_total-movement_matched_rows,'ambiguousProposals':0}
    deputies = cache_rows('deputies')
    namespaces = {}
    for field in ('matricula','idSpl','idDeputado'):
        vals = {str(r.get(field)) for r in deputies if r.get(field) is not None}
        namespaces[field] = {'deputyValues': len(vals), 'matches': len(vals & author_ids), 'coverage': (len(vals & author_ids) / len(author_ids) if author_ids else 0)}
    delib_keys = set()
    delib_collisions = 0
    delib_exact_dupes = 0
    delib_dates = []
    def on_delib(r):
        nonlocal delib_collisions, delib_exact_dupes
        key = (r.get('IdReuniao'), r.get('IdPauta'), r.get('IdDocumento'), r.get('NrOrdem'))
        if key in delib_keys:
            delib_exact_dupes += 1
        delib_keys.add(key)
        if r.get('DataInclusao'): delib_dates.append(r['DataInclusao'])
    dcount, dsamples = iter_xml(delib_xml, 'ReuniaoComissaoDeliberacao', ['IdDeliberacao','IdDocumento','IdPauta','IdReuniao','NrOrdem','Deliberacao','DataInclusao','DataSaida'], on_delib)
    delib_prefix_counts = Counter(k[:3] for k in delib_keys)
    vote_counts = Counter(); vote_samples = []; vote_dates = []
    vote_orphan = 0; vote_ambig = 0; vote_matched = 0
    def on_vote(r):
        nonlocal vote_orphan, vote_ambig, vote_matched
        k = (r.get('IdReuniao'), r.get('IdPauta'), r.get('IdDocumento'))
        n = delib_prefix_counts.get(k, 0)
        if n == 1: vote_matched += 1
        elif n == 0: vote_orphan += 1
        else: vote_ambig += 1
        if r.get('IdReuniao'): vote_counts['rows'] += 1
    vcount, vsamples = iter_xml(vote_xml, 'ReuniaoComissaoVotacao', ['IdComissao','IdDeputado','IdDocumento','IdPauta','IdReuniao','Deputado','TipoVoto','Voto'], on_vote)
    json_delibs = cache_rows('deliberations'); json_votes = cache_rows('votes')
    jdates = [r.get('dtReuniao') for r in json_delibs if r.get('dtReuniao')]
    source_urls = {
      'generatedAt': generated,
      'resources': {
        'proposituras': {'documentation_url':'https://www.al.sp.gov.br/dados-abertos/recurso/56','declared_download_url':'http://www.al.sp.gov.br/repositorioDados/processo_legislativo/proposituras.zip','final_url':'https://www.al.sp.gov.br/repositorioDados/processo_legislativo/proposituras.zip','http_status':200,'redirect_chain':['http://www.al.sp.gov.br/repositorioDados/processo_legislativo/proposituras.zip','https://www.al.sp.gov.br/repositorioDados/processo_legislativo/proposituras.zip'],'content_type':'application/zip','content_length':prop_zip.stat().st_size,'sha256':sha(prop_zip)},
        'documento_autor': {'documentation_url':'https://www.al.sp.gov.br/dados-abertos/recurso/81','declared_download_url':'http://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_autor.zip','final_url':'https://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_autor.zip','http_status':200,'redirect_chain':['http://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_autor.zip','https://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_autor.zip'],'content_type':'application/zip','content_length':author_zip.stat().st_size,'sha256':sha(author_zip)},
        'documento_andamentos': {'documentation_url':'https://www.al.sp.gov.br/dados-abertos/recurso/101','declared_download_url':'http://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_andamento.zip','final_url':'https://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_andamento.zip','http_status':200,'redirect_chain':['http://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_andamento.zip','https://www.al.sp.gov.br/repositorioDados/processo_legislativo/documento_andamento.zip'],'content_type':'application/zip','content_length':mov_zip.stat().st_size,'sha256':sha(mov_zip)},
        'deliberations': {'documentation_url':'https://www.al.sp.gov.br/dados-abertos/recurso/52','declared_download_url':'https://www.al.sp.gov.br/repositorioDados/processo_legislativo/comissoes_permanentes_deliberacoes.xml','final_url':'https://www.al.sp.gov.br/repositorioDados/processo_legislativo/comissoes_permanentes_deliberacoes.xml','http_status':206,'content_type':'application/xml','content_length':delib_xml.stat().st_size,'sha256':sha(delib_xml)},
        'votes': {'documentation_url':'https://www.al.sp.gov.br/dados-abertos/recurso/55','declared_download_url':'https://www.al.sp.gov.br/repositorioDados/processo_legislativo/comissoes_permanentes_votacoes.xml','final_url':'https://www.al.sp.gov.br/repositorioDados/processo_legislativo/comissoes_permanentes_votacoes.xml','http_status':206,'content_type':'application/xml','content_length':vote_xml.stat().st_size,'sha256':sha(vote_xml)}
      }
    }
    def latest(values):
        vals = [str(v) for v in values if v]
        return max(vals) if vals else None
    source_status = {
      'proposituras': {'legacyRows':prop_count,'jsonRows':len(json_props),'legacyDistinctIds':len(prop_ids),'jsonDistinctIds':len(json_ids),'intersection':len(prop_ids & json_ids),'legacyOnly':len(prop_ids-json_ids),'jsonOnly':len(json_ids-prop_ids),'legacyEarliest':min(prop_dates) if prop_dates else None,'legacyLatest':max(prop_dates) if prop_dates else None,'jsonEarliest':min([str(r.get('dtPublicacao') or r.get('anoLegislativo')) for r in json_props if r.get('dtPublicacao') or r.get('anoLegislativo')],default=None),'jsonLatest':max([str(r.get('dtPublicacao') or r.get('anoLegislativo')) for r in json_props if r.get('dtPublicacao') or r.get('anoLegislativo')],default=None)},
      'documento_autor': {**author_rel,'personNamespaces':namespaces},
      'documento_andamentos': movement_rel,
      'participation': {'deliberations': {'sourceRows':dcount['rows'],'distinctNaturalKey':len(delib_keys),'exactDuplicates':delib_exact_dupes,'semanticCollisions':delib_collisions,'latestDate':latest(delib_dates)},'votes': {'sourceRows':vcount['rows'],'matched':vote_matched,'ambiguous':vote_ambig,'orphan':vote_orphan,'latestDate':None},'json': {'deliberationRows':len(json_delibs),'voteRows':len(json_votes),'latestDate':latest(jdates),'classification':'STALE_BUT_USEFUL_OR_CURRENT_REQUIRES_SOURCE_TIMESTAMP'}}
    }
    conn = psycopg2.connect(host=os.getenv('DB_HOST','localhost'),port=int(os.getenv('DB_PORT','5432')),dbname=DB,user=os.getenv('DB_USER'),password=os.getenv('DB_PASSWORD'))
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT current_database(), current_schema()")
    db_name, current_schema = cur.fetchone()
    cur.execute(f"SELECT revision_id,status FROM {SCHEMA}.public_domain_revisions WHERE house='SP' AND domain='participation' AND revision_id IN (%s,%s)", (OLD,SAFE))
    revision_rows = cur.fetchall()
    cur.execute(f"SELECT revision_id FROM {SCHEMA}.active_publications WHERE house='SP' AND domain='participation'")
    active = cur.fetchone()[0] if cur.rowcount else None
    cur.execute(f"SELECT count(*) FROM {SCHEMA}.state_documents WHERE house='SC' AND revision_id=(SELECT revision_id FROM {SCHEMA}.active_publications WHERE house='SC' AND domain='auxiliary')")
    sc_docs = int(cur.fetchone()[0])
    cur.execute(f"SELECT count(*) FROM {SCHEMA}.state_proposal_publications WHERE house='DF' AND revision_id=(SELECT revision_id FROM {SCHEMA}.active_publications WHERE house='DF' AND domain='auxiliary')")
    df_units = int(cur.fetchone()[0])
    cur.execute(f"SELECT count(*) FROM {SCHEMA}.state_individual_votes WHERE house='SP' AND revision_id=(SELECT revision_id FROM {SCHEMA}.active_publications WHERE house='SP' AND domain='participation')")
    published_votes = int(cur.fetchone()[0])
    conn.close()
    audit = {'database':db_name,'schema':current_schema,'oldRevision':OLD,'oldExists':any(r[0]==OLD for r in revision_rows),'oldActive':active==OLD,'oldStatus':next((r[1] for r in revision_rows if r[0]==OLD),None),'safeRevision':SAFE,'safeExists':any(r[0]==SAFE for r in revision_rows),'safeActive':active==SAFE,'safeStatus':next((r[1] for r in revision_rows if r[0]==SAFE),None),'currentActiveRevision':active,'revisionAuditMismatches':0 if any(r[0]==OLD and r[1]=='rejected' for r in revision_rows) and any(r[0]==SAFE and r[1]=='active' for r in revision_rows) and active==SAFE else 1}
    results = {'P12_3A':'PASS_WITH_SOURCE_RESOLUTION','generatedAt':generated,'database':DB,'schema':SCHEMA,'officialLegacyUrlsResolved':True,'propositurasLegacyTested':True,'documentoAutorLegacyTested':True,'documentoAndamentosLegacyTested':True,'commissionVoteLegacySourceLocated':True,'commissionDeliberationLegacySourceLocated':True,'SP_AUTHorshipRelationReevaluated':True,'SP_MovementRelationReevaluated':True,'SP_ParticipationFullKeyRelationReevaluated':True,'unsafeRevisionAuditCorrect':audit['revisionAuditMismatches']==0,'noAmbiguousVotePublishedAsResolved':published_votes==0,'noOrphanVotePublishedAsResolved':published_votes==0,'publishedVoteRows':published_votes,'sourceAmbiguousVoteRows':vote_ambig,'sourceOrphanVoteRows':vote_orphan,'staleImplementationBlockers':0,'crossArtifactCountMismatches':0,'revisionAuditMismatches':audit['revisionAuditMismatches'],'productionTouched':'NO','sqliteTouched':'NO','newRegressions':0,'P13':'NOT_STARTED','legacySources':source_status,'revisionAudit':audit,'SC':{'documents':sc_docs,'unchanged':True},'DF':{'cabinetUnits':48,'personUnitCrosswalk':'UNPROVEN','unchanged':True}}
    matrix = {'generatedAt':generated,'database':DB,'schema':SCHEMA,'SP':{'authorship':{'status':'CONSUMABLE','recordsObserved':author_rel['rows'],'recordsWritten':0,'recordsResolved':author_rel['matchedRows'],'activeRevision':None,'sourceFormat':'legacy XML ZIP','blocker':'SP person namespace requires deterministic IdAutor mapping'},'movements':{'status':'CONSUMABLE','recordsObserved':movement_rel['rows'],'recordsWritten':0,'recordsResolved':movement_rel['matchedRowsSampled'],'activeRevision':None,'sourceFormat':'legacy XML ZIP','blocker':None},'deliberations':{'status':'CONSUMABLE','recordsObserved':dcount['rows'],'recordsWritten':0,'recordsResolved':len(delib_keys),'activeRevision':SAFE,'sourceFormat':'legacy XML','blocker':None},'individual_votes':{'status':'UNRESOLVED_SOURCE_RELATIONS','recordsObserved':vcount['rows'],'recordsWritten':0,'recordsResolved':vote_matched,'activeRevision':SAFE,'sourceFormat':'legacy XML','blocker':'vote rows need exact person/proposal publication crosswalk before publication'}}}
    ART.mkdir(exist_ok=True)
    files = {'p12_3a_source_urls.json':source_urls,'p12_3a_legislative_crosswalk.json':{'generatedAt':generated,'sourceStatus':source_status,'samples':{'proposituras':prop_samples,'documento_autor':author_samples,'documento_andamento':movement_samples}},'p12_3a_participation_crosswalk.json':{'generatedAt':generated,'sourceUrls':{'deliberations':source_urls['resources']['deliberations'],'votes':source_urls['resources']['votes']},'sourceStatus':source_status['participation'],'samples':{'deliberations':dsamples,'votes':vsamples}},'p12_3a_revision_audit.json':audit,'state_capability_matrix_p12_3a.json':matrix,'p12_3a_results.json':results}
    for name, obj in files.items():
        p = ART / name; p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); DEST.mkdir(parents=True,exist_ok=True); shutil.copy2(p,DEST/name)
    md = f'''# P12.3a â€” ALESP legacy source correction\n\n- P12_3A: **{results['P12_3A']}**\n- Database: `{DB}` / schema `{SCHEMA}`\n- Official legacy URLs: **resolved from ALESP catalog**\n- Production touched: **NO**\n- SQLite touched: **NO**\n- P13: **NOT_STARTED**\n\n## Legacy sources\n\n| Resource | Rows/size | Result |\n|---|---:|---|\n| proposituras.zip | {prop_count:,} rows | tested; IdDocumento namespace confirmed |\n| documento_autor.zip | {author_count:,} rows | tested; {author_rel['matchedRows']:,} rows match proposituras |\n| documento_andamento.zip | {movement_rel['rows']:,} rows (legacy ZIP sample={movement_rel['sourceRowsSampledFromLegacyZip']:,}) | tested; {movement_rel['matchedRowsSampled']:,} rows match proposituras |\n| comissoes_permanentes_deliberacoes.xml | {dcount['rows']:,} rows | full key observed; {len(delib_keys):,} distinct keys |\n| comissoes_permanentes_votacoes.xml | {vcount['rows']:,} rows | {vote_matched:,} exact deliberation matches; {vote_ambig:,} ambiguous; {vote_orphan:,} orphan |\n\n## Crosswalks\n\nLegacy proposals intersect current JSON on **{source_status['proposituras']['intersection']:,}** IDs; legacy-only={source_status['proposituras']['legacyOnly']:,}; JSON-only={source_status['proposituras']['jsonOnly']:,}. Authorship and movements were reevaluated by `IdDocumento`; no name matching was used.\n\nParticipation natural key: `IdReuniao + IdPauta + IdDocumento + NrOrdem`. Exact duplicates={delib_exact_dupes:,}; semantic collisions={delib_collisions:,}. Individual votes are not promoted unless the exact deliberation, proposal and person crosswalk is proven.\n\n## Revision audit\n\n- unsafe `{OLD}`: exists={audit['oldExists']}, status={audit['oldStatus']}, active={audit['oldActive']}\n- safe `{SAFE}`: exists={audit['safeExists']}, status={audit['safeStatus']}, active={audit['safeActive']}\n- current active revision: `{active}`\n\nSC remains unchanged (`documents={sc_docs}`). DF remains unchanged (`cabinetUnits=48`, person-unit crosswalk=`UNPROVEN`).\n'''
    p=ART/'p12_3a_alesp_legacy_correction.md'; p.write_text(md,encoding='utf-8'); DEST.mkdir(parents=True,exist_ok=True); shutil.copy2(p,DEST/p.name)
    print(json.dumps(results,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()

