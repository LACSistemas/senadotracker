import csv, json, os, hashlib
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

ROOT = r"D:\Civica\judiciario\financeiro\stj"
src = os.path.join(ROOT, "folhadepagamento.csv")
stage = os.path.join(ROOT, "staging")
os.makedirs(stage, exist_ok=True)
out = os.path.join(stage, "payroll_aggregate_2025_2026.csv")
stats_out = os.path.join(stage, "payroll_aggregate_stats.json")

def cents(v):
    if v is None: return 0
    s = str(v).strip().replace('R$','').replace(' ','')
    if not s: return 0
    try:
        if ',' in s:
            s = s.replace('.', '').replace(',', '.')
        return int((Decimal(s).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) * 100))
    except (InvalidOperation, ValueError):
        return 0

fields = {
    'Remuneração Paradigma':'remuneracao_paradigma_cents',
    'Vantagens Pessoais':'vantagens_pessoais_cents',
    'Subsídio, Diferença de Subsídio, Função de Confiança ou Cargo em Comissão':'subsidio_funcao_cents',
    'Indenizações':'indenizacoes_cents',
    'Vantagens Eventuais':'vantagens_eventuais_cents',
    'Gratificações':'gratificacoes_cents',
    'Previdência Pública':'previdencia_publica_cents',
    'Imposto de Renda':'imposto_renda_cents',
    'Descontos Diversos':'descontos_diversos_cents',
    'Retenção por Teto Constitucional':'retencao_teto_cents',
    'Diárias':'diarias_cents',
    'Total de Créditos':'total_creditos_cents',
    'Total de Débitos':'total_debitos_cents',
    'Rendimento Líquido':'rendimento_liquido_cents',
    'Remuneração do Órgão de Origem':'remuneracao_orgao_origem_cents',
}

groups = defaultdict(lambda: {'record_count':0, **{x:0 for x in fields.values()}})
source_rows = parsed_rows = rejected_rows = 0
months = set()
with open(src, 'r', encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        source_rows += 1
        year = (row.get('AnoReferencia') or '').strip()
        if year not in {'2025','2026'}: continue
        month = (row.get('MesReferencia') or '').strip()
        if not month.isdigit(): rejected_rows += 1; continue
        month = int(month)
        key = (int(year), month, (row.get('TipoServidor') or '').strip() or None,
               (row.get('CategoriaVinculo') or '').strip() or None,
               (row.get('Situacao') or '').strip() or None)
        g = groups[key]
        g['record_count'] += 1; parsed_rows += 1; months.add((int(year),month))
        for source, target in fields.items(): g[target] += cents(row.get(source))

headers = ['reference_year','reference_month','tipo_servidor','categoria_vinculo','situacao','record_count',*fields.values()]
with open(out, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=headers); w.writeheader()
    for key in sorted(groups):
        y,m,t,c,s = key; row={'reference_year':y,'reference_month':m,'tipo_servidor':t or '', 'categoria_vinculo':c or '', 'situacao':s or '', **groups[key]}; w.writerow(row)

h=hashlib.sha256();
with open(out,'rb') as f:
    for b in iter(lambda:f.read(1024*1024), b''): h.update(b)
result={'source':src,'aggregate':out,'source_rows':source_rows,'parsed_rows':parsed_rows,'rejected_rows':rejected_rows,'aggregate_rows':len(groups),'months':[f'{y:04d}-{m:02d}' for y,m in sorted(months)],'sha256':h.hexdigest()}
with open(stats_out,'w',encoding='utf-8') as f: json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps(result,ensure_ascii=False))
