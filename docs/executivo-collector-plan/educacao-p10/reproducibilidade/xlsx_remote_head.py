"""P10/G6 — lê as primeiras linhas de um XLSX que está DENTRO de um ZIP remoto, sem baixar o ZIP: a entrada do ZIP externo é STORED (compactado == tamanho),
então os offsets do XLSX interno mapeiam 1:1 para Range no arquivo externo; só o diretório central do XLSX, o início de sharedStrings e o início da planilha são lidos.
Uso: python -I -X utf8 xlsx_remote_head.py <url_zip> <trecho_nome_xlsx> <n_linhas> [<saida.json>]"""
import io, json, re, struct, sys, os, zipfile, zlib
sys.path.insert(0, os.path.dirname(__file__))
from zip_remote_listing import RangeFile

class Nested(io.RawIOBase):
    def __init__(self, outer: RangeFile, base: int, size: int): self.o = outer; self.base = base; self.size = size; self.pos = 0
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off; return self.pos
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0: return b''
        self.o.pos = self.base + self.pos; d = self.o.read(n); self.pos += len(d); return d
    def readinto(self, b): d = self.read(len(b)); b[:len(d)] = d; return len(d)

def partial_inflate(z: zipfile.ZipFile, info: zipfile.ZipInfo, limit: int) -> bytes:
    """Descomprime só o começo de uma entrada deflate (limit bytes de saída), lendo o mínimo necessário."""
    f = z.fp; f.seek(info.header_offset); h = f.read(30)
    n, m = struct.unpack('<HH', h[26:30]); f.seek(info.header_offset + 30 + n + m)
    if info.compress_type == 0: return f.read(min(limit, info.file_size))
    d = zlib.decompressobj(-15); out = b''
    while len(out) < limit:
        chunk = f.read(65536)
        if not chunk: break
        out += d.decompress(chunk, limit - len(out))
        if d.eof: break
    return out

def head(url, needle, nrows):
    outer = RangeFile(url); br = io.BufferedReader(outer, buffer_size=1 << 16)
    with zipfile.ZipFile(br) as z:
        info = next(i for i in z.infolist() if needle in i.filename and i.filename.endswith('.xlsx'))
        # offset do conteúdo do XLSX interno dentro do ZIP externo
        outer.seek(info.header_offset); h = outer.read(30); n, m = struct.unpack('<HH', h[26:30]); base = info.header_offset + 30 + n + m
        assert info.compress_type == 0, 'XLSX interno não está STORED'
    inner = io.BufferedReader(Nested(outer, base, info.file_size), buffer_size=1 << 16)
    with zipfile.ZipFile(inner) as x:
        names = {i.filename: i for i in x.infolist()}
        sheets = sorted(k for k in names if k.startswith('xl/worksheets/sheet'))
        shared_xml = partial_inflate(x, names['xl/sharedStrings.xml'], 3_000_000).decode('utf-8', 'ignore')
        shared = [re.sub(r'<[^>]+>', '', s) for s in re.findall(r'<si>(.*?)</si>', shared_xml, flags=re.S)]
        wb = x.read('xl/workbook.xml').decode('utf-8'); sheet_names = re.findall(r'<sheet [^>]*name="([^"]+)"', wb)
        out = {}
        for idx, sh in enumerate(sheets[:3]):
            xml = partial_inflate(x, names[sh], 900_000).decode('utf-8', 'ignore')
            rows = []
            for r in re.findall(r'<row[^>]*>(.*?)</row>', xml, flags=re.S)[:nrows]:
                cells = {}
                for c in re.findall(r'<c ([^>]*?)(?:/>|>(.*?)</c>)', r, flags=re.S):
                    attrs, body = c; ref = re.search(r'r="([A-Z]+)\d+"', attrs).group(1); t = re.search(r't="(\w+)"', attrs); v = re.search(r'<v>(.*?)</v>', body or '')
                    if v is None: continue
                    cells[ref] = shared[int(v.group(1))] if t and t.group(1) == 's' else v.group(1)
                rows.append(cells)
            out[sheet_names[idx] if idx < len(sheet_names) else sh] = rows
    return {'zip': url, 'xlsx': info.filename, 'tamanho_xlsx': info.file_size, 'bytes_de_rede': outer.bytes, 'chamadas': outer.calls, 'abas_lidas': out}

if __name__ == '__main__':
    r = head(sys.argv[1], sys.argv[2], int(sys.argv[3]))
    if len(sys.argv) > 4: json.dump(r, open(sys.argv[4], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(r['xlsx'], 'bytes de rede', r['bytes_de_rede'], 'chamadas', r['chamadas'], {k: len(v) for k, v in r['abas_lidas'].items()})
