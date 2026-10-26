import csv
import hashlib
import json
import sys
import zipfile
from decimal import Decimal, InvalidOperation

def norm(v):
    return '' if v is None else str(v).strip()

def cents(v):
    s = norm(v).replace('.', '').replace(',', '.')
    try:
        return int((Decimal(s) * 100).quantize(Decimal('1')))
    except (InvalidOperation, ValueError):
        return None

zip_path, out_path = sys.argv[1:3]
with zipfile.ZipFile(zip_path) as z:
    name = z.namelist()[0]
    with z.open(name) as f, open(out_path, 'w', encoding='utf-8') as out:
        reader = csv.DictReader((line.decode('cp1252', errors='replace') for line in f), delimiter=';')
        rows = []
        for raw in reader:
            action = norm(raw.get('AÇÃO'))
            function = norm(raw.get('CÓDIGO FUNÇÃO'))
            if function != '12' or action not in {'0515', '00PI', '0969', '00SB'}:
                continue
            amount = cents(raw.get('VALOR TRANSFERIDO'))
            if amount is None:
                continue
            item = {
                'competence': int(norm(raw.get('ANO / MÊS')) or 0),
                'uf': norm(raw.get('UF')),
                'municipality_siafi': norm(raw.get('CÓDIGO MUNICÍPIO SIAFI')) or None,
                'municipality_name': norm(raw.get('NOME MUNICÍPIO')) or None,
                'beneficiary_type': norm(raw.get('TIPO FAVORECIDO')) or None,
                'beneficiary_code': norm(raw.get('CÓDIGO FAVORECIDO')) or None,
                'beneficiary_name': norm(raw.get('NOME FAVORECIDO')) or None,
                'program_code': action,
                'program_name': norm(raw.get('NOME AÇÃO')),
                'transfer_type': norm(raw.get('TIPO TRANSFERÊNCIA')),
                'plan': norm(raw.get('CÓDIGO PLANO ORÇAMENTÁRIO')) or None,
                'function': function,
                'subfunction': norm(raw.get('CÓDIGO SUBFUNÇÃO')) or None,
                'amount_cents': amount,
            }
            rows.append(item)
        rows.sort(key=lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True))
        seen = {}
        for item in rows:
            base = json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
            n = seen.get(base, 0)
            seen[base] = n + 1
            item['occurrence'] = n
            item['raw_id'] = hashlib.sha256((base + '|' + str(n)).encode()).hexdigest()
            out.write(json.dumps(item, ensure_ascii=False) + '\n')
print(json.dumps({'rows': len(rows), 'output': out_path}))
