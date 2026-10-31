import json, hashlib
from pathlib import Path
import pyarrow.parquet as pq

ROOT = Path(r'D:\Civica\raw\infraestrutura\energia_expandida')
STAGE = Path(r'D:\Civica\staging\infraestrutura\energia_expandida')
STAGE.mkdir(parents=True, exist_ok=True)

def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def dump(name,obj): (STAGE/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def prepare_mmgd():
    p=ROOT/'aneel/mmgd/empreendimento-geracao-distribuida.parquet'
    cols=['DatGeracaoConjuntoDados','SigAgente','NomAgente','SigUF','CodMunicipioIbge','NomMunicipio','CodEmpreendimento','SigTipoGeracao','DscFonteGeracao','MdaPotenciaInstaladaKW']
    t=pq.read_table(p,columns=cols).to_pandas(); t['CodEmpreendimento']=t['CodEmpreendimento'].astype(str); before=len(t)
    t=t[t['CodEmpreendimento'].notna() & (t['CodEmpreendimento']!='None')].drop_duplicates('CodEmpreendimento',keep='last')
    dup=before-len(t); t['CodMunicipioIbge']=t['CodMunicipioIbge'].astype(str).str.replace(r'\.0$','',regex=True); t['MdaPotenciaInstaladaKW']=t['MdaPotenciaInstaladaKW'].fillna(0).astype(float)
    t['municipality_valid']=t['CodMunicipioIbge'].str.fullmatch(r'\d{6,7}').fillna(False)
    invalid=int((~t['municipality_valid']).sum()); t=t[t['municipality_valid']].copy(); t['ibge7']=t['CodMunicipioIbge'].astype(int)
    t['solar']=((t['DscFonteGeracao'].fillna('').astype(str)+' '+t['SigTipoGeracao'].fillna('').astype(str)).str.lower().str.contains('solar|fotovolta',regex=True))
    mg=t.groupby(['ibge7','SigUF','NomMunicipio'],dropna=False).agg(enterprise_count=('CodEmpreendimento','count'),total_installed_kw=('MdaPotenciaInstaladaKW','sum'),solar_enterprise_count=('solar','sum'),solar_installed_kw=('MdaPotenciaInstaladaKW',lambda s: float(s[t.loc[s.index,'solar']].sum())),source_rows=('CodEmpreendimento','count')).reset_index()
    mg=mg.rename(columns={'SigUF':'uf','NomMunicipio':'municipality'}); mg.insert(0,'competence',202610); mg=mg.fillna({'uf':'','municipality':''})
    sg=t.groupby(['SigAgente','NomAgente'],dropna=False).agg(enterprise_count=('CodEmpreendimento','count'),installed_kw=('MdaPotenciaInstaladaKW','sum'),source_rows=('CodEmpreendimento','count')).reset_index().rename(columns={'SigAgente':'source_code','NomAgente':'source_name'}); sg.insert(0,'competence',202610); sg=sg.fillna({'source_code':'','source_name':''})
    dump('mmgd.json',{'source_file':str(p),'source_sha256':sha(p),'source_rows':int(pq.ParquetFile(p).metadata.num_rows),'unique_enterprises':len(t),'duplicate_enterprise_rows':dup,'invalid_municipality_rows':invalid,'municipal_rows':mg.to_dict('records'),'source_rows_by_distributor':sg.to_dict('records')})
    return len(t),len(mg),len(sg)

def prepare_tariffs():
    p=ROOT/'aneel/tarifas/tarifas.parquet'; t=pq.read_table(p).to_pandas(); fields=['DscREH','SigAgente','NumCNPJDistribuidora','DatInicioVigencia','DatFimVigencia','DscBaseTarifaria','DscSubGrupo','DscModalidadeTarifaria','DscClasse','DscSubClasse','DscDetalhe','NomPostoTarifario','DscUnidadeTerciaria','SigAgenteAcessante','VlrTUSD','VlrTE']; rows=[]; seen=set()
    for _,r in t.iterrows():
        vals=[None if r.get(f) is None else str(r.get(f)) for f in fields]; key=hashlib.sha256('|'.join('' if v is None else v for v in vals).encode()).hexdigest()
        if key in seen: continue
        seen.add(key); rows.append({'source_key':key,'sig_agente':vals[1],'cnpj_distribuidora':vals[2],'reh':vals[0],'valid_from':vals[3],'valid_to':vals[4],'base_tarifaria':vals[5],'sub_group':vals[6],'modality':vals[7],'tariff_class':vals[8],'tariff_subclass':vals[9],'detail':vals[10],'tariff_post':vals[11],'tertiary_unit':vals[12],'sig_agente_acessante':vals[13],'tusd':float(r['VlrTUSD']) if str(r['VlrTUSD']) not in ('nan','None') else None,'te':float(r['VlrTE']) if str(r['VlrTE']) not in ('nan','None') else None})
    dump('tariffs.json',{'source_file':str(p),'source_sha256':sha(p),'source_rows':int(pq.ParquetFile(p).metadata.num_rows),'rows':rows,'unique_rows':len(rows),'distributors':len(set(x['sig_agente'] for x in rows))}); return len(rows)

def prepare_anp(typ, directory, filename, totalpages):
    out=[]; pages=[]
    for f in sorted(directory.glob('page-*.json')):
        try:
            d=json.loads(f.read_text(encoding='utf-8-sig')); sf=d.get('searchPageFilter',{}); pages.append({'file':str(f),'sha256':sha(f),'bytes':f.stat().st_size,'page':sf.get('numeroPagina'),'rows':len(d.get('data',[])),'total':sf.get('totalRegistro'),'total_pages':sf.get('totalPagina')}); out += d.get('data',[])
        except Exception as e: pages.append({'file':str(f),'error':str(e)})
    rows=[]; seen=set()
    for r in out:
        k=str(r.get('codigoSIMP') or r.get('autorizacao') or '')
        if not k or k in seen: continue
        seen.add(k); rows.append({'source_key':k,'uf':r.get('uf'),'municipality':r.get('municipio'),'establishment_type':typ,'source_status':r.get('statusSIGAF') or r.get('validacao') or None})
    dump(filename,{'source':'ANP revendedoresapi official','pages':pages,'rows':rows,'unique_rows':len(rows),'complete':len(pages)==totalpages and all(x.get('rows',0)>0 for x in pages),'expected_total':pages[0].get('total') if pages else None}); return len(rows),len(pages)

if __name__=='__main__':
 print('MMGD',prepare_mmgd()); print('TARIFF',prepare_tariffs()); print('POSTOS',prepare_anp('POSTO',ROOT/'anp/postos','anp_postos.json',10)); print('GLP',prepare_anp('GLP',ROOT/'anp/glp','anp_glp.json',12));
 files=[{'path':str(f),'bytes':f.stat().st_size,'sha256':sha(f)} for f in ROOT.rglob('*') if f.is_file()]; dump('manifest.json',{'root':str(ROOT),'files':files}); print('MANIFEST',len(files))
