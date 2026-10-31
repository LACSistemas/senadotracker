import json
from pathlib import Path
from openpyxl import load_workbook

src=Path(r'D:\Civica\raw\infraestrutura\urbano_habitacao\fjp\fjp_deficit_2024.xlsx')
out=src.with_name('fjp_deficit_2024_compact.json')
uf_order=[11,12,13,14,15,16,17,21,22,23,24,25,26,27,28,29,31,32,33,35,41,42,43,50,51,52,53]
region_names={'Norte','Nordeste','Sudeste','Sul','Centro-Oeste','Brasil'}
wb=load_workbook(src,read_only=True,data_only=True); ws=wb['Deficit_habitacional']; rows=[]
uf_index=0
for r in ws.iter_rows(min_row=2,values_only=True):
    name=str(r[1]).strip() if r[1] is not None else ''
    if name=='Brasil': code=None
    elif name in region_names or name.startswith('RM ') or name.startswith(' RM '): continue
    elif uf_index < len(uf_order): code=uf_order[uf_index]; uf_index += 1
    else: continue
    deficit=float(r[4]); relative=float(r[5])
    rows += [{'uf':code,'indicator':9951,'value':deficit,'denominator':None},{'uf':code,'indicator':9952,'value':relative,'denominator':None}]
json.dump(rows,open(out,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print(out, out.stat().st_size, len(rows))
