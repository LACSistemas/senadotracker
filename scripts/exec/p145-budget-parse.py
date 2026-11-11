import json,re,os
from decimal import Decimal
from pypdf import PdfReader
ROOT=r'D:\Civica\judiciario\financeiro\stj\orcamento'
def text(p): return '\n'.join((x.extract_text() or '') for x in PdfReader(p).pages)
def dec(s): return Decimal(s.replace('.','').replace(',','.'))
def cents(v): return int((v*100).quantize(Decimal('1')))
facts=[]
p=os.path.join(ROOT,'Anexo-I-Janeiro-2025.pdf'); t=text(p)
for label,stage,pat in [
 ('PERSONNEL_TOTAL','EXPENSE_REPORTED',r'TOTAL\s+([\d\.]+,\d{2})\s+Alínea Discrimina'),
 ('OPERATING_TOTAL','EXPENSE_REPORTED',r'demais despesas de custeio\s+([\d\.]+,\d{2}).*?TOTAL\s+([\d\.]+,\d{2})'),
]:
 m=re.search(pat,t,re.S)
 if m:
  val=m.group(2) if label=='OPERATING_TOTAL' else m.group(1)
  facts.append({'year':2025,'month':1,'account':label,'budget_stage':stage,'amount_cents':cents(dec(val)),'record_count':1,'document_id':os.path.basename(p)})
p=os.path.join(ROOT,'AnexoII-Janeiro-2026.pdf'); t=text(p)
m=re.search(r'0033\s+([\d\.]+,\d{2})\s+0,00\s+0,00\s+0,00\s+([\d\.]+,\d{2})\s+(-?[\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+[\d,]+\s+([\d\.]+,\d{2})\s+[\d,]+\s+([\d\.]+,\d{2})',t)
if m:
 vals=list(m.groups())
 for account,idx,stage in [('DOTACAO_INICIAL',0,'AUTHORIZED_BUDGET'),('DOTACAO_AUTORIZADA',1,'AUTHORIZED_BUDGET'),('DESTAQUE_LIQUIDO',2,'AUTHORIZED_BUDGET'),('DOTACAO_LIQUIDA',3,'AUTHORIZED_BUDGET'),('EMPENHADO',4,'COMMITTED'),('LIQUIDADO',5,'LIQUIDATED'),('PAGO',6,'PAID')]:
  facts.append({'year':2026,'month':1,'account':account,'budget_stage':stage,'amount_cents':cents(dec(vals[idx])),'record_count':1,'document_id':os.path.basename(p)})
p=os.path.join(ROOT,'Ordem_Cronologica_PagamentosJan2026.pdf'); t=text(p)
vals=re.findall(r'\d{2}/\d{2}/\d{4}\s+\d{2}/\d{2}/\d{4}\s+([\d\.]+,\d{2})',t)
if vals:
 facts.append({'year':2026,'month':1,'account':'PAYMENT_CHRONOLOGY_NET_TOTAL','budget_stage':'PAID','amount_cents':sum(cents(dec(v)) for v in vals),'record_count':len(vals),'document_id':os.path.basename(p)})
result={'facts':facts,'source_files':[os.path.join(ROOT,x) for x in os.listdir(ROOT) if x.lower().endswith('.pdf')]}
with open(os.path.join(ROOT,'budget_facts.json'),'w',encoding='utf-8') as f: json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps(result,ensure_ascii=False))
