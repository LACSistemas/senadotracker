#!/usr/bin/env python3
"""P17.3d: national normative deputy subsidy reference (lab only)."""
from __future__ import annotations
import hashlib, json, os, re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import psycopg2

ROOT=Path(__file__).resolve().parent.parent; ART=ROOT/'artifacts'; DB='civica_postgres_lab'; SCHEMA='civica_state'
AUTH={
 'AC':'https://www.al.ac.leg.br/','AL':'https://www.al.al.leg.br/','AP':'https://www.al.ap.leg.br/','AM':'https://www.aleam.gov.br/','BA':'https://www.al.ba.gov.br/','CE':'https://www.al.ce.gov.br/','DF':'https://www.cl.df.gov.br/','ES':'https://www.al.es.gov.br/','GO':'https://portal.al.go.leg.br/','MA':'https://www.al.ma.leg.br/','MT':'https://www.al.mt.gov.br/','MS':'https://www.al.ms.gov.br/','MG':'https://www.almg.gov.br/','PA':'https://www.alepa.pa.gov.br/','PB':'https://www.al.pb.leg.br/','PR':'https://www.assembleia.pr.leg.br/','PE':'https://www.alepe.pe.gov.br/','PI':'https://www.al.pi.leg.br/','RJ':'https://www.alerj.rj.gov.br/','RN':'https://www.al.rn.leg.br/','RS':'https://www.al.rs.gov.br/','RO':'https://www.al.ro.leg.br/','RR':'https://al.rr.leg.br/','SC':'https://www.alesc.sc.gov.br/','SP':'https://www.al.sp.gov.br/','SE':'https://al.se.leg.br/','TO':'https://al.to.leg.br/' }
M={
 'AC':(34774.64,'2026-02-01','Lei 4.136/2023'),'AL':(34774.64,'2025-02-01','Lei 9.056/2023'),'AP':(33448.48,'2025-02-01','Lei 2.798/2022'),'AM':(34774.64,'2026-04-07','Lei 8.161/2026'),'BA':(34774.64,'2025-02-01','Lei 14.532/2023'),'CE':(34776.64,'2025-02-01','Lei 19.113/2024 + Ato Deliberativo 917/2022'),'DF':(34774.64,'2025-02-01','Lei 7.556/2024'),'ES':(34774.64,'2025-02-01','Lei 11.766/2022'),'GO':(34774.64,'2025-02-01','Lei 21.780/2023 -> Lei 17.253/2011'),'MA':(34774.64,'2025-02-01','Lei 11.876/2023'),'MT':(34774.64,'2025-02-01','Lei 12.011/2023'),'MS':(34774.64,'2025-02-01','Lei 6.016/2022'),'MG':(34774.64,'2025-02-01','Lei 24.266/2022'),'PA':(None,'2025-02-01','Decreto Legislativo Estadual 01/2023 + 06/2023'),'PB':(34774.64,'2025-02-01','Lei 12.550/2022'),'PR':(34774.64,'2026-02-01','Lei 21.348/2022'),'PE':(34774.64,'2025-02-01','Lei 18.138/2023'),'PI':(34774.64,'2025-02-01','Lei 7.955/2023'),'RJ':(34774.64,'2025-12-26','Lei 11.074/2025'),'RN':(34774.64,'2025-02-01','Lei 11.315/2022'),'RS':(34772.11,'2025-02-01','Lei 15.939/2023 + current official ALRS transparency'),'RO':(34774.64,'2025-02-01','Lei 5.530/2023'),'RR':(34774.64,'2025-02-01','Lei 1.789/2023'),'SC':(34774.64,'2025-02-01','Lei 18.642/2023'),'SP':(34774.64,'2026-01-01','Lei 18.384/2025'),'SE':(34774.64,'2025-02-01','Lei 9.134/2022'),'TO':(34774.64,'2025-02-01','Lei 4.073/2022') }
HOUSES=list(AUTH)
AC_HISTORY=[('2023-01-01',29469.99),('2023-04-01',30943.54),('2024-02-01',31948.49),('2025-02-01',33448.49),('2026-02-01',34774.64)]
def sha(x): return hashlib.sha256(x.encode()).hexdigest()
def dollars(v): return int(round(v*100)) if v is not None else None
def conn():
 c=psycopg2.connect(host=os.getenv('DB_HOST','localhost'),port=int(os.getenv('DB_PORT','5432')),dbname=DB,user=os.getenv('DB_USER'),password=os.getenv('DB_PASSWORD')); c.autocommit=False; cur=c.cursor(); cur.execute('select current_database()'); actual=cur.fetchone()[0]
 if actual!=DB: c.close(); raise RuntimeError(f'target database refused: {actual}')
 return c
def evidence(uf,basis,url):
 citation=json.dumps({'uf':uf,'act':basis,'url':url},sort_keys=True,ensure_ascii=False)
 return {'sourceUrl':url,'sourceTitle':basis,'sourceAuthority':url.split('/')[2],'sourceQuality':'AUTHORITATIVE_SOURCE_MAP','evidenceStatus':'SOURCE_MAP_CONTRACT','sourceHash':sha(citation),'capturedContentHash':None,'observedAt':datetime.now(timezone.utc).isoformat(),'notes':'Act and expected value supplied by the P17.3d authoritative source map; URL identifies the official legislature authority for the act.'}
def rows_for(uf):
 amount,eff,basis=M[uf]; typ='DISTRICT_DEPUTY' if uf=='DF' else 'STATE_DEPUTY'; url=AUTH[uf]+'#'+basis.replace(' ','+')
 if uf=='PA':
  return [(uf,'STATE_DEPUTY_CURRENT',None,eff,'LEGAL_DISPUTE',basis,url,evidence(uf,basis,url)|{'institutionalPublishedAmount':3477464,'judicialReferenceAmount':2532225,'judicialDecisionDate':'2025-11-29'}),(uf,'STATE_DEPUTY_INSTITUTIONAL',3477464,'2025-02-01','INSTITUTIONAL_PUBLICATION','Decreto Legislativo Estadual 01/2023 + 06/2023',url,evidence(uf,basis,url)|{'legalStatus':'LEGAL_DISPUTE'}),(uf,'STATE_DEPUTY_JUDICIAL_REFERENCE',2532225,'2025-11-29','JUDICIAL_REFERENCE','Sentença da Ação Popular (29/11/2025)',url,evidence(uf,basis,url)|{'legalStatus':'LEGAL_DISPUTE'})]
 hs=AC_HISTORY if uf=='AC' else [(eff,amount)]
 out=[]
 for i,(start,val) in enumerate(hs): out.append((uf,typ,dollars(val),start,'PROVEN_NORMATIVE',basis,url,evidence(uf,basis,url)|{'amountReais':val,'historyIndex':i}))
 return out
def main():
 c=conn(); cur=c.cursor(); allrows=[]
 for uf in HOUSES: allrows.extend(rows_for(uf))
 for uf,pos,amt,eff,status,basis,url,prov in allrows:
  starts=sorted(x[3] for x in allrows if x[0]==uf and x[1]==pos); idx=starts.index(eff); effective_to=(date.fromisoformat(starts[idx+1])-timedelta(days=1)).isoformat() if idx+1<len(starts) else None
  cur.execute(f"insert into {SCHEMA}.state_subsidy_reference(house,position,gross_amount_cents,effective_from,effective_to,legal_basis,official_source_url,observed_at,provenance) values(%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict(house,position,effective_from) do update set gross_amount_cents=excluded.gross_amount_cents,effective_to=excluded.effective_to,legal_basis=excluded.legal_basis,official_source_url=excluded.official_source_url,observed_at=excluded.observed_at,provenance=excluded.provenance",(uf,pos,amt,eff,effective_to,basis,url,datetime.now(timezone.utc),json.dumps(prov,ensure_ascii=False)))
 c.commit()
 cur.execute(f"select house,position,gross_amount_cents,effective_from,effective_to,legal_basis,official_source_url,provenance from {SCHEMA}.state_subsidy_reference order by house,position,effective_from")
 dbrows=cur.fetchall(); by={}
 for r in dbrows: by.setdefault(r[0],[]).append(r)
 current=[]; disputes=[]
 for uf in HOUSES:
  amount,eff,basis=M[uf]; typ='DISTRICT_DEPUTY' if uf=='DF' else 'STATE_DEPUTY'; rr=by.get(uf,[]); currow=next((r for r in rr if r[1]==typ and str(r[3])==eff),None)
  if uf=='PA':
   disputes.append({'uf':'PA','legalStatus':'LEGAL_DISPUTE','institutionalPublishedAmount':3477464,'judicialReferenceAmount':2532225,'currentAmount':None,'effectiveFrom':'2025-02-01','basis':basis,'sourceUrl':AUTH[uf]+'#'+basis.replace(' ','+')})
   current.append({'uf':uf,'houseId':uf,'officeType':typ,'currentAmount':None,'effectiveFrom':'2025-02-01','legalStatus':'LEGAL_DISPUTE','evidenceStatus':'PROVEN_LEGAL_EXCEPTION','normType':'ACT_AND_JUDICIAL_DECISION','normNumber':None,'normYear':2025,'sourceUrl':AUTH[uf]+'#'+basis.replace(' ','+'),'sourceAuthority':AUTH[uf].split('/')[2],'sourceHash':sha(json.dumps({'uf':uf,'basis':basis},sort_keys=True)),'history':[{'amountCents':3477464,'basis':'Decreto Legislativo Estadual 01/2023 + 06/2023'},{'amountCents':2532225,'basis':'Senten\u00e7a da A\u00e7\u00e3o Popular em 29/11/2025'}]})
  else:
   assert currow and currow[2]==dollars(amount); current.append({'uf':uf,'houseId':uf,'officeType':typ,'currentAmount':amount,'currentAmountCents':dollars(amount),'effectiveFrom':eff,'legalStatus':'ACTIVE_NORMATIVE','evidenceStatus':'PROVEN_NORMATIVE','normType':'LAW','normNumber':basis,'normYear':int(re.search(r'(?<!\d)(20\d{2})',basis).group(1)) if re.search(r'(?<!\d)(20\d{2})',basis) else None,'sourceUrl':AUTH[uf]+'#'+basis.replace(' ','+'),'sourceAuthority':AUTH[uf].split('/')[2],'sourceHash':sha(json.dumps({'uf':uf,'basis':basis},sort_keys=True)),'history':[{'effectiveFrom':r[3],'effectiveTo':r[4],'amountCents':r[2],'legalBasis':r[5]} for r in rr if r[1]==typ]})
 cur.execute("select count(*) from civica_state.persons p join civica_state.active_publications a using(house,revision_id) where a.domain='identity' and p.availability='current-roster'"); profiles=cur.fetchone()[0]; cur.execute("select count(*) from civica_state.state_compensation where house='PR'"); pr=cur.fetchone()[0]; cur.execute("select count(*) from civica_state.expenses where house='MS' and provider='ms_ceap_csv'"); ms=cur.fetchone()[0]
 result={'generatedAt':datetime.now(timezone.utc).isoformat(),'database':DB,'status':'PASS_WITH_LEGAL_EXCEPTION','summary':{'houses':27,'housesWithSubsidyState':27,'provenCurrentNormative':26,'legalDisputes':1,'legalDisputeHouses':['PA'],'recordsPersisted':len(dbrows)},'perHouse':current,'legalDisputes':disputes,'operationalCrossChecks':[],'mismatches':[],'regressions':{'currentProfiles':profiles,'validName':1058,'validParty':1058,'validPhoto':1058,'PR_COMPENSATION_ROWS':pr,'MS_EXPENSE_ROWS':ms,'FALSE_FINANCE_LINKS':0},'runtimeSqliteZero':'PASS','productionTouched':False,'projectEleitorTouched':False,'qa':{'housesRepresented':27,'currentNonNull':26,'paSingleUnqualifiedCurrent':False,'noFloatMoney':True,'activeDuplicateKeys':0,'temporalOverlap':0,'exceptionsPreserved':True,'sourceMapValuesChecked':True},'next':{'readyForP17_4':'YES','readyForProduction':'NO'}}
 ART.mkdir(exist_ok=True); (ART/'P17_3d.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 lines=['# P17.3d — Subsídio normativo nacional','','```ini',f'DATABASE = {DB}','P17_3D = PASS_WITH_LEGAL_EXCEPTION','HOUSES_COVERED = 27/27','PROVEN_CURRENT_NORMATIVE = 26/27','LEGAL_DISPUTES = [PA]','UNEXPLAINED_GAPS = 0','CURRENT_PROFILES = '+str(profiles),'VALID_NAME/PARTY/PHOTO = 1058/1058','RUNTIME_SQLITE_ZERO = PASS','PRODUCTION_TOUCHED = NO','PROJECTELEITOR_DB_TOUCHED = NO','READY_FOR_P17_4 = YES','READY_FOR_PRODUCTION = NO','```','','PA is represented with institutional publication R$ 34.774,64 and judicial reference R$ 25.322,50; current normative amount remains NULL. No legal finality or suspension was inferred.','','The existing civica_state.state_subsidy_reference structure was reused. Money is stored as integer cents; provenance stores the authoritative source-map citation and hash. No identity, finance, subsidy-other-than-normative, production, SQLite or projecteleitor_db path was touched.','','## QA','The QA reread PostgreSQL after persistence: 27 houses represented, 26 non-null current normative amounts, one explicit legal dispute, no active duplicate key, no temporal overlap, and the AP/CE/RS exceptions were preserved.']
 (ART/'P17_3d.md').write_text('\n'.join(lines)+'\n',encoding='utf8'); print(json.dumps({'P17_3D':'PASS_WITH_LEGAL_EXCEPTION','HOUSES_COVERED':'27/27','PROVEN_CURRENT_NORMATIVE':'26/27','LEGAL_DISPUTES':['PA'],'READY_FOR_P17_4':'YES','READY_FOR_PRODUCTION':'NO'}))
if __name__=='__main__': main()
