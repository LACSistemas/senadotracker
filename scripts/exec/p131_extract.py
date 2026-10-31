import json, math, re
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(r"D:\Civica\staging\infraestrutura\sinisa\2024")
OUT = ROOT / "parsed"
OUT.mkdir(parents=True, exist_ok=True)

def text(v):
    return "" if v is None else str(v).strip()

def num(v):
    if v is None or isinstance(v, bool): return None
    if isinstance(v, (int,float)):
        return float(v) if math.isfinite(float(v)) else None
    s = text(v).replace("\xa0", " ").strip()
    if not s or s.lower() in {"não calculado", "não calc.", "não se aplica", "n/a", "na", "-"}: return None
    if "não calc" in s.lower() or "não informado" in s.lower() or "div/0" in s.lower(): return None
    s = s.replace("%", "").replace(".", "").replace(",", ".") if re.fullmatch(r"[-+]?\d{1,3}(\.\d{3})*(,\d+)?", s) else s.replace(",", ".")
    try: return float(s)
    except Exception: return None

def ibge(v):
    if v is None: return None
    s = re.sub(r"\D", "", str(v))
    if len(s) >= 7: return s[-7:]
    return s.zfill(7) if s else None

def load(path, sheet, code_row, start_row, label_row=None, unit_row=None):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet] if sheet in wb.sheetnames else wb[wb.sheetnames[0]]
    rows = ws.iter_rows(values_only=True)
    allrows = list(rows)
    codes = [text(x).rstrip('*').strip() for x in allrows[code_row-1]]
    labels = [text(x) for x in allrows[(label_row or code_row-2)-1]] if (label_row or code_row-2) >= 1 else [""]*len(codes)
    units = [text(x) for x in allrows[(unit_row or code_row-1)-1]] if (unit_row or code_row-1) >= 1 else [""]*len(codes)
    return ws, allrows, codes, labels, units, start_row

def records(path, sheet, code_row, start_row, selected, family, municipal=True, id_col=0, uf_col=None, name_col=None, respondent_col=None, label_row=None, unit_row=None):
    _, rows, codes, labels, units, _ = load(path, sheet, code_row, start_row, label_row, unit_row)
    idx = {c:i for i,c in enumerate(codes) if c}
    out=[]
    for rn,row in enumerate(rows[start_row-1:], start_row):
        if not row or all(x is None for x in row): continue
        code_id = ibge(row[id_col] if id_col < len(row) else None)
        if not code_id: continue
        uf = text(row[uf_col]) if uf_col is not None and uf_col < len(row) else ""
        name = text(row[name_col]) if name_col is not None and name_col < len(row) else ""
        respondent = text(row[respondent_col]) if respondent_col is not None and respondent_col < len(row) else None
        vals=[]
        for c in selected:
            if c not in idx: continue
            i=idx[c]; raw = row[i] if i < len(row) else None
            vals.append({"code":c,"label":labels[i],"unit":units[i],"raw":text(raw),"value":num(raw),"column":i+1})
        out.append({"source_row":rn,"ibge7":code_id,"uf":uf,"name":name,"respondent":respondent,"values":vals})
    return out, {c:{"label":labels[idx[c]],"unit":units[idx[c]],"column":idx[c]+1} for c in selected if c in idx}

def aggregate(path, selected, family):
    cr = 12 if family=="water" else 11; sr = 13 if family=="water" else 12
    _, rows, codes, labels, units, _ = load(path, "Indicadores de Gestão" if family=="water" else "Indicadores - Esgoto", cr, sr, 10 if family=="water" else 9, 11 if family=="water" else 10)
    code_idx={c:i for i,c in enumerate(codes)}
    out=[]
    start=13 if family=="water" else 12
    for rn,row in enumerate(rows[start-1:],start):
        if not row or not row[0]: continue
        entity=text(row[0]); sigla=text(row[1] if len(row)>1 else "")
        if entity in {"Norte","Nordeste","Sudeste","Sul","Centro-Oeste"}: continue
        vals=[]
        for c in selected:
            if c not in code_idx: continue
            i=code_idx[c]; vals.append({"code":c,"label":labels[i],"unit":units[i],"raw":text(row[i] if i<len(row) else None),"value":num(row[i] if i<len(row) else None),"column":i+1})
        out.append({"entity":entity,"sigla":sigla,"source_row":rn,"values":vals})
    return out, {c:{"label":labels[code_idx[c]],"unit":units[code_idx[c]],"column":code_idx[c]+1} for c in selected if c in code_idx}

def main():
    water = next(ROOT.rglob("*SINISA_AGUA_Indicadores_Base Municipal*2024*.xlsx"))
    sewage = next(ROOT.rglob("*SINISA_ESGOTO_Indicadores_Base Municipal*2024*.xlsx"))
    waste = next(ROOT.rglob("SINISA_RESIDUOS_Indicadores_2024.xlsx"))
    drainage = next(ROOT.rglob("SINISA_AGUASPLUVIAIS_Indicadores_AP2024.xlsx"))
    management = ROOT / "management_2024.xlsx"
    payload={"reference_year":2024,"source_root":str(ROOT),"families":{}}
    specs=[
        ("water",water,"Indicadores de Gestão",12,13,["IAG0001","IAG0002","IAG2006","IAG2013"],0,3,2,None,10,11),
      ("sewage",sewage,"Indicadores - Esgoto",11,12,["IES0001","IES0002","IES0007","IES0008"],0,3,2,None,9,10),
      ("waste",waste,waste.stem,11,14,["IRS0001","IRS0002","IRS0005","IRS3002"],1,3,2,0,12,13),
      ("drainage",drainage,"Indicadores por município",11,12,["IAP0001","IAP0002","IGR0001","IGR0002"],0,2,1,None,8,10),
      ("management",management,"GM",11,15,["OGM3004","OGM3013","OGM3201","OGM3301"],1,3,2,None,12,13),
    ]
    for fam,path,sheet,cr,sr,sel,idc,ufc,nc,repc,label_row,unit_row in specs:
        rs,defs=records(path,sheet,cr,sr,sel,fam,id_col=idc,uf_col=ufc,name_col=nc,respondent_col=repc,label_row=label_row,unit_row=unit_row)
        payload["families"][fam]={"file":str(path),"sheet":sheet,"records":rs,"definitions":defs,"municipal_rows":len(rs)}
    for fam, path, sel in [("water",next(ROOT.rglob("*SINISA_AGUA_Indicadores_UF_MR_BR_2024.xlsx")),["IAG0001","IAG0002","IAG2006","IAG2013"]),("sewage",next(ROOT.rglob("*SINISA_ESGOTO_Indicadores_UF_MR_BR_2024.xlsx")),["IES0001","IES0002","IES0007","IES0008"])]:
        rs,defs=aggregate(path,sel,fam)
        payload["families"][fam]["aggregate_file"]=str(path); payload["families"][fam]["aggregates"]=rs; payload["families"][fam]["aggregate_rows"]=len(rs); payload["families"][fam]["aggregate_definitions"]=defs
    (OUT/"sinisa_2024.json").write_text(json.dumps(payload,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({k:{"municipal_rows":v.get("municipal_rows"),"aggregate_rows":v.get("aggregate_rows"),"defs":list(v.get("definitions",{}))} for k,v in payload["families"].items()},ensure_ascii=False,indent=2))

if __name__ == "__main__": main()
