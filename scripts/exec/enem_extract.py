"""
ENEM (P11.6): extrai, em streaming, participação e notas agregadas por município-da-escola/UF/Brasil x rede x
disciplina, a partir do CSV de resultados oficial dentro do ZIP original. Nunca grava NU_INSCRICAO, CO_ESCOLA ou
qualquer linha individual; a saída é só os agregados definidos no dicionário real (ver
docs/executivo-collector-plan/educacao-p111-validacao-enem/DICIONARIO_REAL_2023_2025.csv).

Uso: python enem_extract.py --edition 2024 --zip D:/Civica/raw/inep/enem/2024/microdados_enem_2024.zip \
       --inner "microdados_enem_2024/DADOS/RESULTADOS_2024.csv" --out D:/Civica/staging/educacao/enem_2024.jsonl

O ZIP de 2025 usa Deflate64, que o módulo zipfile do Python não lê; por isso a extração roda via `unzip -p` em
subprocesso (streaming, nunca grava o CSV inteiro em disco) em vez de zipfile, uniformemente nas três edições.
"""
from __future__ import annotations
import argparse, csv, json, math, subprocess, sys
from collections import defaultdict

SUBJECT_COLS = {'CN': ('TP_PRESENCA_CN', 'NU_NOTA_CN'), 'CH': ('TP_PRESENCA_CH', 'NU_NOTA_CH'), 'LC': ('TP_PRESENCA_LC', 'NU_NOTA_LC'), 'MT': ('TP_PRESENCA_MT', 'NU_NOTA_MT')}
NETWORK_CODES = {1, 2, 3, 4}


def to_int(s: str | None) -> int | None:
    s = (s or '').strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def to_score(s: str | None) -> float | None:
    s = (s or '').strip()
    if not s:
        return None
    try:
        v = float(s.replace(',', '.'))
    except ValueError:
        return None
    return v if v >= 0 else None


def percentile(hist: dict[int, int], p: float) -> float | None:
    """Mesma interpolação linear do `percentile_cont` do Postgres, sobre o histograma (bucket = nota x10, resolução nativa de 1 decimal)."""
    total = sum(hist.values())
    if total == 0:
        return None
    rank = p * (total - 1)
    lo, hi = math.floor(rank), math.ceil(rank)
    keys = sorted(hist.keys())
    cum = 0
    v_lo = v_hi = None
    for k in keys:
        nxt = cum + hist[k]
        if v_lo is None and lo < nxt:
            v_lo = k
        if v_hi is None and hi < nxt:
            v_hi = k
        cum = nxt
        if v_lo is not None and v_hi is not None:
            break
    if v_lo is None:
        v_lo = keys[-1]
    if v_hi is None:
        v_hi = keys[-1]
    frac = rank - lo
    return (v_lo + (v_hi - v_lo) * frac) / 10.0


class Cell:
    __slots__ = ('registrants', 'all_four_present', 'essay_valid', 'subj_n', 'subj_sum', 'subj_hist')

    def __init__(self) -> None:
        self.registrants = 0
        self.all_four_present = 0
        self.essay_valid = 0
        self.subj_n: dict[str, int] = defaultdict(int)
        self.subj_sum: dict[str, float] = defaultdict(float)
        self.subj_hist: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))


def open_results_stream(zip_path: str, inner_path: str):
    proc = subprocess.Popen(['unzip', '-p', zip_path, inner_path], stdout=subprocess.PIPE, bufsize=1024 * 1024)
    import io
    text = io.TextIOWrapper(proc.stdout, encoding='latin-1', newline='')
    return proc, text


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--edition', type=int, required=True)
    ap.add_argument('--zip', required=True)
    ap.add_argument('--inner', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    proc, text = open_results_stream(args.zip, args.inner)
    reader = csv.reader(text, delimiter=';')
    header = next(reader)
    idx = {name: i for i, name in enumerate(header)}

    def col(row: list[str], name: str) -> str | None:
        i = idx.get(name)
        return row[i] if i is not None and i < len(row) else None

    cells: dict[tuple[int, str, int], Cell] = defaultdict(Cell)
    rows = 0
    for row in reader:
        rows += 1
        muni = to_int(col(row, 'CO_MUNICIPIO_ESC'))
        uf = (col(row, 'SG_UF_ESC') or '').strip().upper() or None
        net = to_int(col(row, 'TP_DEPENDENCIA_ADM_ESC'))
        net = net if net in NETWORK_CODES else None

        presences = {s: to_int(col(row, pcol)) for s, (pcol, _) in SUBJECT_COLS.items()}
        all_four = all(presences[s] == 1 for s in SUBJECT_COLS)
        essay_status = to_int(col(row, 'TP_STATUS_REDACAO'))
        essay_valid = essay_status == 1
        essay_score = to_score(col(row, 'NU_NOTA_REDACAO')) if essay_valid else None

        scopes: list[tuple[int, str]] = [(1, 'BR')]
        if uf:
            scopes.append((3, uf))
        if muni:
            scopes.append((4, str(muni)))

        for scope, key in scopes:
            for network in ({0} | ({net} if net is not None else set())):
                c = cells[(scope, key, network)]
                c.registrants += 1
                if all_four:
                    c.all_four_present += 1
                for subj, (pcol, ncol) in SUBJECT_COLS.items():
                    score = to_score(col(row, ncol))
                    if presences[subj] == 1 and score is not None:
                        c.subj_n[subj] += 1
                        c.subj_sum[subj] += score
                        c.subj_hist[subj][round(score * 10)] += 1
                if essay_valid:
                    c.essay_valid += 1
                    if essay_score is not None:
                        c.subj_n['ESSAY'] += 1
                        c.subj_sum['ESSAY'] += essay_score
                        c.subj_hist['ESSAY'][round(essay_score * 10)] += 1

    proc.stdout.close()
    ret = proc.wait()
    if ret != 0:
        print(json.dumps({'error': f'unzip exited {ret}'}), file=sys.stderr)
        sys.exit(1)

    br0 = cells.get((1, 'BR', 0))
    math_valid = br0.subj_n.get('MT', 0) if br0 else 0
    essay_valid_total = br0.subj_n.get('ESSAY', 0) if br0 else 0

    with open(args.out, 'w', encoding='utf-8') as out:
        for (scope, key, network), c in cells.items():
            out.write(json.dumps({'type': 'territory', 'edition': args.edition, 'scope': scope, 'scope_key': key, 'network': network,
                                   'registrants': c.registrants, 'all_four_present': c.all_four_present, 'essay_valid': c.essay_valid}) + '\n')
            for subj in SUBJECT_COLS:
                n = c.subj_n.get(subj, 0)
                if n == 0:
                    continue
                mean = c.subj_sum[subj] / n
                out.write(json.dumps({'type': 'subject', 'edition': args.edition, 'scope': scope, 'scope_key': key, 'network': network, 'subject': subj,
                                       'valid_n': n, 'mean': round(mean, 2), 'median': percentile(c.subj_hist[subj], 0.5),
                                       'p25': percentile(c.subj_hist[subj], 0.25), 'p75': percentile(c.subj_hist[subj], 0.75)}) + '\n')
            n = c.subj_n.get('ESSAY', 0)
            if n > 0:
                mean = c.subj_sum['ESSAY'] / n
                out.write(json.dumps({'type': 'subject', 'edition': args.edition, 'scope': scope, 'scope_key': key, 'network': network, 'subject': 'ESSAY',
                                       'valid_n': n, 'mean': round(mean, 2), 'median': percentile(c.subj_hist['ESSAY'], 0.5),
                                       'p25': percentile(c.subj_hist['ESSAY'], 0.25), 'p75': percentile(c.subj_hist['ESSAY'], 0.75)}) + '\n')
        out.write(json.dumps({'type': 'coverage', 'edition': args.edition, 'registrants': br0.registrants if br0 else 0,
                               'all_four_present': br0.all_four_present if br0 else 0, 'math_valid': math_valid, 'essay_valid': essay_valid_total}) + '\n')

    print(json.dumps({'rows': rows, 'cells': len(cells), 'registrants': br0.registrants if br0 else 0}))


if __name__ == '__main__':
    main()
