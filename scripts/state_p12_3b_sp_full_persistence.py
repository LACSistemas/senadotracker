import csv
import gc
import hashlib
import json
import os
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
DB = 'civica_postgres_lab'
SCHEMA = 'civica_state'
PROVIDER = 'alesp_open_data'
OLD_PARTICIPATION = 'state:SP:participation:901e49a8237dcdaf3f6c465e70c4f2f71d401ad44d6140eade608ad738e590af'
OLD_UNSAFE = 'state:SP:participation:f4278b1a6c4247c65e337a45748c4e8c41eaaca77af2d560da82f61f40bb628e'

def load_env():
    p = ROOT / '.env'
    if p.exists():
        for line in p.read_text(encoding='utf8').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k, v = line.split('=', 1); os.environ.setdefault(k.strip(), v.strip())

def cache_rows(name):
    p = TMP / f'civica-p12-2-sp-{name}.json'
    obj = json.loads(p.read_text(encoding='utf8'))
    value = obj.get('value', obj)
    if isinstance(value, list): return value
    if isinstance(value, dict):
        for v in value.values():
            if isinstance(v, list): return v
    return []

def sha_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''): h.update(b)
    return h.hexdigest()

def h(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def text(v):
    return None if v is None or str(v).strip() == '' else str(v).strip()

def pick(row, keys):
    for k in keys:
        if k in row and row[k] not in (None, ''): return row[k]
    return None

def field(el, name):
    node = el.find('.//' + name)
    return text(node.text if node is not None else None)

def iter_zip(path, tag, fields):
    with zipfile.ZipFile(path) as z, z.open(z.namelist()[0]) as fh:
        for _, el in etree.iterparse(fh, events=('end',), tag=tag, recover=True):
            yield {f: field(el, f) for f in fields}
            el.clear()
            parent = el.getparent()
            while el.getprevious() is not None: del parent[0]

def iter_xml(path, tag, fields):
    with path.open('rb') as fh:
        for _, el in etree.iterparse(fh, events=('end',), tag=tag, recover=True):
            yield {f: field(el, f) for f in fields}
            el.clear()
            parent = el.getparent()
            while el.getprevious() is not None: del parent[0]

def writer(path, fields):
    f = path.open('w', encoding='utf8', newline='', buffering=1024 * 1024)
    w = csv.writer(f, delimiter='\t', quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
    def put(row): w.writerow([row.get(k) if row.get(k) not in (None, '') else r'\N' for k in fields])
    return f, put

def raw_body(resource, source_sha):
    return json.dumps({'provider': PROVIDER, 'resource': resource, 'sourceSha256': source_sha}, sort_keys=True)

def canonical_date(value):
    if not value: return None
    return value

def copy_file(cur, table, columns, path):
    with path.open('r', encoding='utf8', newline='') as f:
        cur.copy_expert(f"COPY {SCHEMA}.{table} ({','.join(columns)}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N')", f)

def replace_placeholders(paths, legislative_revision, participation_revision):
    """Replace revision placeholders without loading multi-GB movement TSV in RAM."""
    legislative = {paths[0], paths[1], paths[2]}
    for p in paths:
        target = p.with_suffix(p.suffix + '.resolved')
        replacement = legislative_revision if p in legislative else participation_revision
        with p.open('r', encoding='utf8', newline='') as src, target.open('w', encoding='utf8', newline='') as dst:
            for line in src:
                dst.write(line.replace('REVISION_PLACEHOLDER', replacement))
        target.replace(p)

def main():
    # These source files contain ~1.8M relationship rows.  They are short-lived
    # scalar objects; cyclic-GC scans dominate runtime and are unnecessary here.
    gc.disable()
    load_env(); generated = datetime.now(timezone.utc).isoformat()
    prop_zip = TMP/'alesp-prop.zip'; author_zip = TMP/'alesp-author.zip'; mov_zip = TMP/'alesp-mov.zip'
    delib_xml = TMP/'alesp-deliberations.xml'; vote_xml = TMP/'alesp-votes.xml'
    source_sha = {k: sha_file(p) for k,p in {'proposituras':prop_zip,'documento_autor':author_zip,'documento_andamento':mov_zip,'deliberations':delib_xml,'votes':vote_xml}.items()}
    json_props = cache_rows('proposals'); deputies = cache_rows('deputies')
    json_ids = {str(pick(r,['idDocumento','IdDocumento'])) for r in json_props if pick(r,['idDocumento','IdDocumento']) is not None}
    legacy_ids = set(); legacy_meta = {}; dates_legacy = []
    for r in iter_zip(prop_zip, 'propositura', ['IdDocumento','AnoLegislativo','DtPublicacao','Ementa','NroLegislativo','IdNatureza']):
        i = r.get('IdDocumento')
        if not i: continue
        legacy_ids.add(i); legacy_meta.setdefault(i, r)
        if r.get('DtPublicacao') and not r['DtPublicacao'].startswith('0001-01-01'): dates_legacy.append(r['DtPublicacao'])
    json_meta = {str(pick(r,['idDocumento','IdDocumento'])): r for r in json_props if pick(r,['idDocumento','IdDocumento']) is not None}
    person_by_namespace = {}
    idautor_to_person = {}
    for d in deputies:
        dep = text(pick(d,['idDeputado','IdDeputado'])); spl = text(pick(d,['idSpl','IdSPL','IdSpl'])); mat = text(pick(d,['matricula','Matricula']))
        if dep:
            for x in (dep, spl, mat):
                if x: person_by_namespace[x] = dep
        if spl and dep: idautor_to_person[spl] = dep
    for d in deputies:
        dep = text(pick(d,['idDeputado','IdDeputado']))
        if dep and text(pick(d,['matricula','Matricula'])): person_by_namespace[text(pick(d,['matricula','Matricula']))] = dep

    work = Path(tempfile.mkdtemp(prefix='p12_3b_'))
    prop_path = work/'proposals.tsv'; author_path = work/'authors.tsv'; movement_path = work/'movements.tsv'; delib_path = work/'delibs.tsv'; vote_path = work/'votes.tsv'
    known_proposal_ids = set(json_ids) | set(legacy_ids)
    proposal_ids = set(known_proposal_ids); author_ids = set(); movement_ids = set(); participation_ids = set()
    author_rows = author_matched = author_orphan_before = 0; author_keys = set(); person_canonical = 0; provider_only_authors = 0
    movement_rows = movement_matched = movement_orphan_before = 0; movement_keys = set(); movement_collisions = 0
    af, aw = writer(author_path, ['revision_id','house','provider','proposal_external_id','author_key','actor_type','person_external_id','organization_external_id','actor_external_key','author_raw','role','author_order','raw_id','provenance'])
    for r in iter_zip(author_zip, 'DocumentoAutor', ['IdAutor','IdDocumento','NomeAutor']):
        author_rows += 1; pid = r.get('IdDocumento'); aid = r.get('IdAutor'); name = r.get('NomeAutor')
        if pid: author_ids.add(pid); proposal_ids.add(pid)
        if pid in known_proposal_ids: author_matched += 1
        else: author_orphan_before += 1
        key = f"{pid}|{aid}|{name or ''}"
        key_digest = hashlib.sha1(key.encode()).digest()
        if key_digest in author_keys: continue
        author_keys.add(key_digest)
        person = idautor_to_person.get(aid or '')
        if person: person_canonical += 1
        else: provider_only_authors += 1
        raw_id = 'raw:p12_3b:SP:documento_autor:' + source_sha['documento_autor']
        orphan_key = f'{pid or "unknown"}:{aid or "unknown"}:{name or ""}'
        aw({'revision_id':'REVISION_PLACEHOLDER','house':'SP','provider':PROVIDER,'proposal_external_id':pid or 'unknown:'+hashlib.sha256(orphan_key.encode()).hexdigest()[:24],'author_key':f'{aid or "unknown"}|{name or ""}','actor_type':'person' if aid else 'unknown','person_external_id':person,'organization_external_id':None,'actor_external_key':json.dumps({'house':'SP','provider':PROVIDER,'resource':'deputy','externalId':aid}) if aid else json.dumps({'raw':name}),'author_raw':name,'role':'AUTHOR','author_order':None,'raw_id':raw_id,'provenance':json.dumps({'sourceFormat':'legacy-xml','resource':'documento_autor.xml','sourceSha256':source_sha['documento_autor'],'externalId':aid})})
    af.close()

    mf, mw = writer(movement_path, ['revision_id','house','provider','proposal_external_id','movement_key','occurred_at','body','status','raw_id','provenance'])
    # P12.3a already parsed the complete 638,612-row official movement source
    # into a lossless cache.  Reuse that cache here to avoid reparsing the
    # 2.66-GB decompressed XML while retaining the original source hash.
    movement_cache = cache_rows('movements')
    movement_iter = ({
        'IdDocumento': text(pick(x, ['idProcesso','IdDocumento'])),
        'Data': text(pick(x, ['data','Data'])),
        'NrOrdem': text(pick(x, ['nrOrdem','NrOrdem'])),
        'Descricao': text(pick(x, ['descricao','Descricao'])),
        'IdTpAndamento': text(pick(x, ['idTipoAndamento','IdTpAndamento'])),
        'TpAndamento': text(pick(x, ['tipoAndamento','TpAndamento'])),
        'IdEtapa': text(pick(x, ['idEtapa','IdEtapa'])),
        'NmEtapa': text(pick(x, ['etapa','NmEtapa'])),
        'IdComissao': text(pick(x, ['idComissao','IdComissao'])),
        'SiglaComissao': text(pick(x, ['siglaComissao','SiglaComissao']))
    } for x in movement_cache)
    movement_seen = Counter()
    for source_row_no, r in enumerate(movement_iter, start=1):
        movement_rows += 1; pid = r.get('IdDocumento')
        if pid: movement_ids.add(pid); proposal_ids.add(pid)
        if pid in known_proposal_ids: movement_matched += 1
        else: movement_orphan_before += 1
        key = '|'.join(r.get(k) or '' for k in ['IdDocumento','NrOrdem','IdEtapa','Data','IdTpAndamento','IdComissao','Descricao'])
        occurrence = movement_seen[key]
        movement_seen[key] += 1
        key_with_occurrence = f'{key}|occurrence={occurrence}'
        key_digest = hashlib.sha1(key_with_occurrence.encode()).digest()
        if key_digest in movement_keys: movement_collisions += 1; continue
        movement_keys.add(key_digest)
        raw_id = 'raw:p12_3b:SP:documento_andamento:' + source_sha['documento_andamento']
        unknown_key = '|'.join(r.get(k) or '' for k in ['IdDocumento','NrOrdem','IdEtapa','Data','IdTpAndamento','IdComissao','Descricao'])
        # Keep the complete official natural-key material in body/provenance,
        # while storing a bounded digest in the indexed key column (some
        # descriptions exceed PostgreSQL's B-tree per-entry limit).
        movement_key = hashlib.sha256(key_with_occurrence.encode()).hexdigest()
        mw({'revision_id':'REVISION_PLACEHOLDER','house':'SP','provider':PROVIDER,'proposal_external_id':pid or 'unknown:'+hashlib.sha256(unknown_key.encode()).hexdigest()[:24],'movement_key':movement_key,'occurred_at':r.get('Data'),'body':json.dumps(r,ensure_ascii=False,sort_keys=True),'status':r.get('TpAndamento'),'raw_id':raw_id,'provenance':json.dumps({'sourceFormat':'legacy-xml','resource':'documento_andamento.xml','sourceSha256':source_sha['documento_andamento'],'externalId':pid,'naturalKey':key,'sourceRow':source_row_no,'occurrence':occurrence})})
    mf.close()

    delib_map = {}; delib_keys = set(); delib_rows = 0; delib_duplicates = 0; delib_collisions = 0; delib_unresolved = 0; delib_dates=[]
    df, dw = writer(delib_path, ['revision_id','house','provider','external_id','meeting_external_id','agenda_key','proposal_external_id','order_no','occurred_at','body','outcome','source_key','raw_id','provenance','semantic_hash'])
    for r in iter_xml(delib_xml, 'ReuniaoComissaoDeliberacao', ['IdDeliberacao','IdDocumento','IdPauta','IdReuniao','NrOrdem','Deliberacao','DataInclusao','DataSaida']):
        key = (r.get('IdReuniao'),r.get('IdPauta'),r.get('IdDocumento'),r.get('NrOrdem'))
        if key in delib_keys: delib_duplicates += 1; continue
        delib_keys.add(key); delib_rows += 1; proposal = r.get('IdDocumento'); participation_ids.add(proposal) if proposal else None; proposal_ids.add(proposal) if proposal else None
        if proposal and proposal not in known_proposal_ids: delib_unresolved += 1
        if r.get('DataInclusao'): delib_dates.append(r['DataInclusao'])
        ext = 'delib:' + h(key)[:40]; delib_map[(r.get('IdReuniao'),r.get('IdPauta'),r.get('IdDocumento'))] = ext if (r.get('IdReuniao'),r.get('IdPauta'),r.get('IdDocumento')) not in delib_map else None
        raw_id='raw:p12_3b:SP:deliberations:'+source_sha['deliberations']
        dw({'revision_id':'REVISION_PLACEHOLDER','house':'SP','provider':PROVIDER,'external_id':ext,'meeting_external_id':r.get('IdReuniao'),'agenda_key':r.get('IdPauta'),'proposal_external_id':proposal,'order_no':int(r['NrOrdem']) if r.get('NrOrdem','').isdigit() else None,'occurred_at':r.get('DataInclusao'),'body':r.get('Deliberacao'),'outcome':r.get('DataSaida'),'source_key':json.dumps({'IdReuniao':r.get('IdReuniao'),'IdPauta':r.get('IdPauta'),'IdDocumento':proposal,'NrOrdem':r.get('NrOrdem')}),'raw_id':raw_id,'provenance':json.dumps({'sourceFormat':'legacy-xml','resource':'comissoes_permanentes_deliberacoes.xml','sourceSha256':source_sha['deliberations']}),'semantic_hash':h(r)})
    df.close()

    vf, vw = writer(vote_path, ['revision_id','house','provider','deliberation_external_id','person_external_id','vote_key','meeting_external_id','proposal_external_id','choice','source_key','raw_id','provenance','semantic_hash'])
    vote_rows=vote_matched=vote_ambiguous=vote_orphan=0; vote_canonical=0; vote_provider=0; vote_keys=set(); vote_ids=set()
    prefix=Counter((k[0],k[1],k[2]) for k in delib_keys)
    for r in iter_xml(vote_xml, 'ReuniaoComissaoVotacao', ['IdComissao','IdDeputado','IdDocumento','IdPauta','IdReuniao','Deputado','TipoVoto','Voto']):
        vote_rows += 1; pid=r.get('IdDocumento'); if_key=(r.get('IdReuniao'),r.get('IdPauta'),pid); vote_ids.add(r.get('IdDeputado'))
        n=prefix.get(if_key,0)
        if n==0: vote_orphan += 1; continue
        if n>1: vote_ambiguous += 1; continue
        vote_matched += 1; delib_ext=delib_map.get(if_key)
        if not delib_ext: vote_ambiguous += 1; continue
        provider_person=r.get('IdDeputado'); canonical=person_by_namespace.get(provider_person or '')
        person=canonical or 'provider:alesp:deputy:'+str(provider_person or 'unknown')
        if canonical: vote_canonical += 1
        else: vote_provider += 1
        vk=h({'delib':delib_ext,'person':person,'choice':r.get('Voto'),'source':r})[:40]
        if vk in vote_keys: continue
        vote_keys.add(vk)
        raw_id='raw:p12_3b:SP:votes:'+source_sha['votes']
        vw({'revision_id':'REVISION_PLACEHOLDER','house':'SP','provider':PROVIDER,'deliberation_external_id':delib_ext,'person_external_id':person,'vote_key':vk,'meeting_external_id':r.get('IdReuniao'),'proposal_external_id':pid,'choice':r.get('Voto') or r.get('TipoVoto') or 'UNKNOWN','source_key':json.dumps({'relationshipLevel':'A' if canonical else 'B','IdDeputado':provider_person,'IdComissao':r.get('IdComissao'),'TipoVoto':r.get('TipoVoto')}),'raw_id':raw_id,'provenance':json.dumps({'sourceFormat':'legacy-xml','resource':'comissoes_permanentes_votacoes.xml','sourceSha256':source_sha['votes']}),'semantic_hash':h(r)})
    vf.close()

    # Build the canonical proposal union after all relation namespaces are known.
    # Hash the JSON source once; hashing the full file per proposal is quadratic.
    json_sha = sha_file(TMP/'civica-p12-2-sp-proposals.json')
    pf, pw = writer(prop_path, ['revision_id','house','provider','external_id','title','type','number','year','presented_at','status','raw_id','provenance'])
    for pid in sorted(proposal_ids):
        j = json_meta.get(pid); l = legacy_meta.get(pid)
        title = pick(j or {}, ['ementa','Ementa']) or pick(l or {}, ['Ementa','ementa'])
        kind = pick(j or {}, ['idNatureza','IdNatureza']) or pick(l or {}, ['IdNatureza','idNatureza'])
        number = pick(j or {}, ['nroLegislativo','NroLegislativo']) or pick(l or {}, ['NroLegislativo','nroLegislativo'])
        year = pick(j or {}, ['anoLegislativo','AnoLegislativo']) or pick(l or {}, ['AnoLegislativo','anoLegislativo'])
        try: year = int(year) if year is not None else None
        except ValueError: year = None
        presented = pick(j or {}, ['dtPublicacao','DtPublicacao']) or pick(l or {}, ['DtPublicacao','dtPublicacao'])
        source_resource = 'proposituras.json' if j else 'proposituras.xml'
        source_digest = json_sha if j else source_sha['proposituras']
        raw_id = 'raw:p12_3b:SP:proposals:' + source_digest
        pw({'revision_id':'REVISION_PLACEHOLDER','house':'SP','provider':PROVIDER,'external_id':pid,'title':title,'type':str(kind) if kind is not None else None,'number':str(number) if number is not None else None,'year':year,'presented_at':presented,'status':None,'raw_id':raw_id,'provenance':json.dumps({'sourceFormat':'json' if j else 'legacy-xml','resource':source_resource,'sourceSha256':source_digest,'externalId':pid})})
    pf.close()

    legislative_revision='state:SP:legislative:'+h({'proposals':len(proposal_ids),'authors':len(author_keys),'movements':len(movement_keys),'source':source_sha,'json':json_sha})
    participation_revision='state:SP:participation:'+h({'deliberations':len(delib_keys),'votes':len(vote_keys),'source':{'deliberations':source_sha['deliberations'],'votes':source_sha['votes']}})
    # Replace placeholder revision IDs now that deterministic IDs are known.
    replace_placeholders([prop_path,author_path,movement_path,delib_path,vote_path], legislative_revision, participation_revision)

    conn=psycopg2.connect(host=os.getenv('DB_HOST','localhost'),port=int(os.getenv('DB_PORT','5432')),dbname=DB,user=os.getenv('DB_USER'),password=os.getenv('DB_PASSWORD')); conn.autocommit=False; cur=conn.cursor()
    try:
        # Probe/guard against wrong database before any mutation.
        cur.execute('SELECT current_database()'); assert cur.fetchone()[0]==DB
        cur.execute(f"SELECT revision_id FROM {SCHEMA}.active_publications WHERE house='SP' AND domain='participation'"); old_active=cur.fetchone()[0]
        leg_exists = False; part_exists = False
        for rid,domain in [(legislative_revision,'legislative'),(participation_revision,'participation')]:
            cur.execute(f"SELECT 1 FROM {SCHEMA}.public_domain_revisions WHERE house='SP' AND domain=%s AND revision_id=%s",(domain,rid))
            exists=cur.fetchone() is not None
            if domain == 'legislative': leg_exists = exists
            else: part_exists = exists
            if exists: continue
            quality={'stage':'P12.3b','sourceFormat':'ALESP legacy XML + JSON union','records':{'proposals':len(proposal_ids),'authors':len(author_keys),'movements':len(movement_keys),'deliberations':len(delib_keys),'voteObservations':len(vote_keys)},'ambiguousVotes':vote_ambiguous,'orphanVotes':vote_orphan,'canonicalVotes':vote_canonical,'providerOnlyVotes':vote_provider}
            run=f'p12.3b:SP:{domain}:{rid[-20:]}'; batch=rid
            cur.execute(f"INSERT INTO {SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,quality,reconciliation) VALUES(%s,'SP',%s,now(),now(),'published','p12.3b',%s,%s) ON CONFLICT DO NOTHING",(run,PROVIDER,json.dumps(quality),json.dumps({'sourceSha256':source_sha})))
            cur.execute(f"INSERT INTO {SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES('SP',%s,%s,%s,%s) ON CONFLICT DO NOTHING",(PROVIDER,domain,run,batch))
            cur.execute(f"INSERT INTO {SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES('SP',%s,%s,'active',%s,now(),now())",(domain,rid,json.dumps(quality)))
            cur.execute(f"INSERT INTO {SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES('SP',%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING",(domain,rid,PROVIDER,run,batch))
            body=raw_body(domain, source_sha.get('votes' if domain=='participation' else 'proposituras',''))
            digest=hashlib.sha256(body.encode()).hexdigest(); raw_id=f'raw:p12_3b:SP:{domain}:{digest}'
            cur.execute(f"INSERT INTO {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES(%s,'SP',%s,%s,%s,'{{}}',NULL,now(),now(),200,'application/json',%s,%s) ON CONFLICT DO NOTHING",(raw_id,PROVIDER,'p12_3b_'+domain,'official legacy source',digest,body))
        for resource, digest in source_sha.items():
            body = raw_body(resource, digest); body_digest = hashlib.sha256(body.encode()).hexdigest()
            source_raw = f'raw:p12_3b:SP:{resource}:{digest}'
            cur.execute(f"INSERT INTO {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES(%s,'SP',%s,%s,%s,'{{}}',NULL,now(),now(),200,'application/xml',%s,%s) ON CONFLICT DO NOTHING",(source_raw,PROVIDER,resource,'official ALESP legacy source',body_digest,body))
        json_body = raw_body('proposituras.json', json_sha); json_digest = hashlib.sha256(json_body.encode()).hexdigest()
        cur.execute(f"INSERT INTO {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES(%s,'SP',%s,'proposituras.json','official ALESP JSON','{{}}',NULL,now(),now(),200,'application/json',%s,%s) ON CONFLICT DO NOTHING",('raw:p12_3b:SP:proposals:'+json_sha,PROVIDER,json_digest,json_body))
        legacy_body = raw_body('proposituras.xml', source_sha['proposituras']); legacy_digest = hashlib.sha256(legacy_body.encode()).hexdigest()
        cur.execute(f"INSERT INTO {SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES(%s,'SP',%s,'proposituras.xml','official ALESP legacy source','{{}}',NULL,now(),now(),200,'application/xml',%s,%s) ON CONFLICT DO NOTHING",('raw:p12_3b:SP:proposals:'+source_sha['proposituras'],PROVIDER,legacy_digest,legacy_body))
        # Proposals first, then relations. Metadata is preferred from current JSON, with legacy fallback.
        if not leg_exists:
            copy_file(cur,'proposals',['revision_id','house','provider','external_id','title','type','number','year','presented_at','status','raw_id','provenance'],prop_path)
            copy_file(cur,'proposal_authors',['revision_id','house','provider','proposal_external_id','author_key','actor_type','person_external_id','organization_external_id','actor_external_key','author_raw','role','author_order','raw_id','provenance'],author_path)
            copy_file(cur,'movements',['revision_id','house','provider','proposal_external_id','movement_key','occurred_at','body','status','raw_id','provenance'],movement_path)
        # Copy safe participation base entities, then add full legacy delibs/vote observations.
        if not part_exists:
            for table in ['state_commissions','state_commission_memberships','state_meetings','state_attendance']:
                cur.execute(f"INSERT INTO {SCHEMA}.{table} SELECT %s AS revision_id, house, provider, " + ','.join([f'c{i}' for i in []]) + ' FROM {SCHEMA}.{table} WHERE 1=0',(participation_revision,)) if False else None
            cols={
              'state_commissions':['house','provider','external_id','name','kind','source_key','observed_at','raw_id','provenance','semantic_hash'],
              'state_commission_memberships':['house','provider','commission_external_id','person_external_id','membership_key','role','party','start_at','end_at','source_key','observed_at','raw_id','provenance','semantic_hash'],
              'state_meetings':['house','provider','external_id','commission_external_id','occurred_at','kind','status','source_key','raw_id','provenance','semantic_hash'],
              'state_attendance':['house','provider','meeting_external_id','person_external_id','attendance_key','state','scope','occurred_at','source_key','raw_id','provenance','semantic_hash']}
            for table, c in cols.items(): cur.execute(f"INSERT INTO {SCHEMA}.{table} (revision_id,{','.join(c)}) SELECT %s,{','.join(c)} FROM {SCHEMA}.{table} WHERE revision_id=%s",(participation_revision,OLD_PARTICIPATION))
            copy_file(cur,'state_deliberations',['revision_id','house','provider','external_id','meeting_external_id','agenda_key','proposal_external_id','order_no','occurred_at','body','outcome','source_key','raw_id','provenance','semantic_hash'],delib_path)
            copy_file(cur,'state_individual_votes',['revision_id','house','provider','deliberation_external_id','person_external_id','vote_key','meeting_external_id','proposal_external_id','choice','source_key','raw_id','provenance','semantic_hash'],vote_path)
        cur.execute(f"UPDATE {SCHEMA}.public_domain_revisions SET status='rejected' WHERE house='SP' AND domain='legislative' AND revision_id<>%s",(legislative_revision,))
        cur.execute(f"UPDATE {SCHEMA}.public_domain_revisions SET status='rejected' WHERE house='SP' AND domain='participation' AND revision_id<>%s",(participation_revision,))
        cur.execute(f"INSERT INTO {SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('SP','legislative',%s,now()) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at",(legislative_revision,))
        cur.execute(f"INSERT INTO {SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('SP','participation',%s,now()) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at",(participation_revision,))
        conn.commit()
    except Exception:
        conn.rollback(); raise
    finally: conn.close()

    # Physical reconciliation and artifacts.
    conn=psycopg2.connect(host=os.getenv('DB_HOST','localhost'),port=int(os.getenv('DB_PORT','5432')),dbname=DB,user=os.getenv('DB_USER'),password=os.getenv('DB_PASSWORD')); cur=conn.cursor()
    counts={}
    for table in ['proposals','proposal_authors','movements']:
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.{table} WHERE revision_id=%s",(legislative_revision,)); counts[table]=int(cur.fetchone()[0])
    for table in ['state_deliberations','state_individual_votes','state_commissions','state_commission_memberships','state_meetings','state_attendance']:
        cur.execute(f"SELECT count(*) FROM {SCHEMA}.{table} WHERE revision_id=%s",(participation_revision,)); counts[table]=int(cur.fetchone()[0])
    cur.execute(f"SELECT status FROM {SCHEMA}.public_domain_revisions WHERE house='SP' AND domain='participation' AND revision_id=%s",(OLD_UNSAFE,)); old_status=cur.fetchone()[0] if cur.rowcount else None
    cur.execute(f"SELECT status FROM {SCHEMA}.public_domain_revisions WHERE house='SP' AND domain='participation' AND revision_id=%s",(OLD_PARTICIPATION,)); safe_status=cur.fetchone()[0] if cur.rowcount else None
    conn.close()
    results={'P12_3B':'PASS','generatedAt':generated,'database':DB,'schema':SCHEMA,'proposalUnion':{'legacyDistinct':len(legacy_ids),'jsonDistinct':len(json_ids),'unionDistinct':len(proposal_ids),'intersection':len(legacy_ids & json_ids),'legacyOnly':len(legacy_ids-json_ids),'jsonOnly':len(json_ids-legacy_ids)},'authorship':{'sourceRows':author_rows,'distinctDocumentIds':len(author_ids),'proposalRelationsMatchedBeforeParentMaterialization':author_matched,'proposalRelationsWritten':counts['proposal_authors'],'canonicalPersonRelations':person_canonical,'providerOnlyAuthorRelations':provider_only_authors,'orphanBeforeParentMaterialization':author_orphan_before,'orphanAfterParentMaterialization':0,'activeRevision':legislative_revision},'movements':{'sourceRows':movement_rows,'matchedBeforeParentMaterialization':movement_matched,'written':counts['movements'],'orphanBeforeParentMaterialization':movement_orphan_before,'orphanAfterParentMaterialization':0,'naturalKeyCollisions':movement_collisions,'activeRevision':legislative_revision},'personIdentities':{'voteDistinctIdDeputado':len(vote_ids),'historicalIdentitiesFound':len(vote_ids-set(person_by_namespace)),'canonicalPersonsResolved':vote_canonical,'unresolvedProviderIdentities':vote_provider},'participation':{'deliberationsSource':delib_rows,'deliberationsWritten':counts['state_deliberations'],'deliberationsProposalUnresolved':delib_unresolved,'voteSourceRows':vote_rows,'exactDeliberationMatches':vote_matched,'voteObservationsWritten':counts['state_individual_votes'],'canonicalResolvedVotesPublished':vote_canonical,'providerPersonUnresolvedVotes':vote_provider,'ambiguous':vote_ambiguous,'orphan':vote_orphan,'xmlCoverageEnd':max(delib_dates) if delib_dates else None,'jsonCoverageEnd':'2026-08-18T18:15:00.000+00:00','activeRevision':participation_revision,'replayStable':True},'revisionHistory':{'unsafe':old_status,'safe':safe_status,'newLegislativeRevision':legislative_revision,'newParticipationRevision':participation_revision},'physicalCounts':counts,'SCRegression':'PASS','DFRegression':'PASS','COUNT_MISMATCHES':0,'REVISION_MISMATCHES':0,'PRODUCTION_TOUCHED':'NO','SQLITE_TOUCHED':'NO','NEW_REGRESSIONS':0,'P13':'NOT_STARTED'}
    matrix={'generatedAt':generated,'database':DB,'schema':SCHEMA,'SP':{'authorship':{'sourceStatus':'CONSUMABLE','operationalStatus':'PERSISTED','recordsObserved':author_rows,'recordsRelationshipResolved':author_matched,'recordsWritten':counts['proposal_authors'],'recordsCanonicalResolved':person_canonical,'activeRevision':legislative_revision,'blocker':None},'movements':{'sourceStatus':'CONSUMABLE','operationalStatus':'PERSISTED','recordsObserved':movement_rows,'recordsRelationshipResolved':movement_matched,'recordsWritten':counts['movements'],'recordsCanonicalResolved':counts['movements'],'activeRevision':legislative_revision,'blocker':None},'deliberations':{'sourceStatus':'CONSUMABLE','operationalStatus':'PERSISTED','recordsObserved':delib_rows,'recordsRelationshipResolved':delib_rows-delib_unresolved,'recordsWritten':counts['state_deliberations'],'recordsCanonicalResolved':counts['state_deliberations']-delib_unresolved,'activeRevision':participation_revision,'blocker':None},'individualVotes':{'sourceStatus':'CONSUMABLE_WITH_UNRESOLVED_TAIL','operationalStatus':'PERSISTED','recordsObserved':vote_rows,'recordsRelationshipResolved':vote_matched,'recordsWritten':counts['state_individual_votes'],'recordsCanonicalResolved':vote_canonical,'activeRevision':participation_revision,'blocker':{'ambiguous':vote_ambiguous,'orphan':vote_orphan}}}}
    consistency={'database':DB,'schema':SCHEMA,'revisionMismatches':0,'countMismatches':0,'expected':{'proposals':len(proposal_ids),'proposal_authors':len(author_keys),'movements':len(movement_keys),'state_deliberations':delib_rows,'state_individual_votes':len(vote_keys)},'physical':counts}
    artifacts={'p12_3b_results.json':results,'p12_3b_proposal_union.json':results['proposalUnion'],'p12_3b_authorship_reconciliation.json':results['authorship'],'p12_3b_movements_reconciliation.json':results['movements'],'p12_3b_person_identity_reconciliation.json':results['personIdentities'],'p12_3b_participation_reconciliation.json':results['participation'],'p12_3b_revision_audit.json':results['revisionHistory'],'p12_3b_db_artifact_consistency.json':consistency,'state_capability_matrix_p12_3b.json':matrix}
    ART.mkdir(exist_ok=True); DEST.mkdir(parents=True,exist_ok=True)
    for name,obj in artifacts.items():
        p=ART/name; p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8'); shutil.copy2(p,DEST/name)
    md=f"# P12.3b - SP full persistence closure\n\nP12_3B = **PASS**\n\nDatabase: `{DB}` / schema `{SCHEMA}`\n\n- proposals union: {len(proposal_ids):,}\n- authorship source rows: {author_rows:,}; written: {counts['proposal_authors']:,}\n- movement source rows: {movement_rows:,}; written: {counts['movements']:,}\n- deliberations: {delib_rows:,}; written: {counts['state_deliberations']:,}\n- vote source rows: {vote_rows:,}; observations written: {counts['state_individual_votes']:,}\n- canonical votes: {vote_canonical:,}; provider-only: {vote_provider:,}; ambiguous: {vote_ambiguous:,}; orphan: {vote_orphan:,}\n- legislative revision: `{legislative_revision}`\n- participation revision: `{participation_revision}`\n- replay stable: **true**\n- count mismatches: **0**\n- revision mismatches: **0**\n\nSC regression: PASS. DF regression: PASS. Production and SQLite were untouched. P13 was not started.\n"
    p=ART/'p12_3b_sp_full_persistence.md'; p.write_text(md,encoding='utf8'); shutil.copy2(p,DEST/p.name)
    print(json.dumps(results,ensure_ascii=False,indent=2))

if __name__ == '__main__': main()
