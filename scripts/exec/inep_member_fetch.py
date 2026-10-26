"""P10.1 — copia para o RAW só as entradas necessárias de um ZIP remoto do INEP, por HTTP Range (entradas STORED), sem baixar o ZIP inteiro.
Motivo: o ZIP de 2025 (537 MB) traz também as tabelas de Gestor e Docente; a P10.1 não as grava nem as lê (minimização, G7).
Uso: python -I -X utf8 inep_member_fetch.py <url> <pasta_saida> <regex_entrada> [<regex_entrada> ...]
Saída (stdout): JSON {zipBytes, lastModified, members:[{name, file, bytes, crc32, sha256, resumed}]}. Cada entrada é conferida contra o CRC-32 do diretório central."""
import hashlib, io, json, os, re, struct, sys, time, urllib.request, zipfile, zlib

UA = 'civica-exec/1.0 (pesquisa de dados abertos)'


def http(url, method='GET', rng=None, tries=6):
    for n in range(1, tries + 1):
        try:
            h = {'User-Agent': UA}
            if rng: h['Range'] = f'bytes={rng[0]}-{rng[1]}'
            return urllib.request.urlopen(urllib.request.Request(url, method=method, headers=h), timeout=120)
        except Exception:
            if n == tries: raise
            time.sleep(min(3 * n, 20))


class RangeFile(io.RawIOBase):
    def __init__(self, url):
        self.url = url; self.pos = 0
        with http(url, 'HEAD') as r: self.size = int(r.headers['Content-Length']); self.modified = r.headers.get('Last-Modified')
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def read(self, n=-1):
        if n < 0: n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0: return b''
        with http(self.url, 'GET', (self.pos, self.pos + n - 1)) as r: d = r.read()
        self.pos += len(d); return d
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)


def main():
    url, outdir, pats = sys.argv[1], sys.argv[2], [re.compile(p) for p in sys.argv[3:]]
    os.makedirs(outdir, exist_ok=True)
    rf = RangeFile(url); z = zipfile.ZipFile(io.BufferedReader(rf, buffer_size=1 << 16))
    out = {'zipBytes': rf.size, 'lastModified': rf.modified, 'members': []}
    for info in z.infolist():
        if not any(p.search(info.filename) for p in pats): continue
        if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED): raise SystemExit(f'entrada {info.filename}: método {info.compress_type} não suportado')
        deflated = info.compress_type == zipfile.ZIP_DEFLATED
        # cabeçalho local: 30 bytes + nome + extra
        hdr = http(url, 'GET', (info.header_offset, info.header_offset + 29)).read()
        nlen, elen = struct.unpack('<HH', hdr[26:30]); start = info.header_offset + 30 + nlen + elen; end = start + (info.compress_size if deflated else info.file_size) - 1
        dest = os.path.join(outdir, os.path.basename(info.filename)); part = dest + '.part'
        if os.path.exists(dest) and os.path.getsize(dest) == info.file_size:   # já copiada e íntegra
            crc = 0; sha = hashlib.sha256()
            with open(dest, 'rb') as f:
                for b in iter(lambda: f.read(1 << 20), b''): crc = zlib.crc32(b, crc); sha.update(b)
            if crc == info.CRC: out['members'].append({'name': info.filename, 'file': dest, 'bytes': info.file_size, 'crc32': f'{crc:08x}', 'sha256': sha.hexdigest(), 'resumed': True}); continue
        have = os.path.getsize(part) if os.path.exists(part) and not deflated else 0   # entradas DEFLATE recomeçam do zero (sem retomada)
        if deflated and os.path.exists(part): os.remove(part)
        CH = 8 << 20
        dec = zlib.decompressobj(-15) if deflated else None
        with open(part, 'ab') as f:
            pos = start + have
            while pos <= end:
                hi = min(pos + CH - 1, end)
                with http(url, 'GET', (pos, hi)) as r: d = r.read()
                if len(d) != hi - pos + 1: raise SystemExit(f'leitura parcial em {pos}')
                f.write(dec.decompress(d) if deflated else d); pos = hi + 1
            if deflated: f.write(dec.flush())
        crc = 0; sha = hashlib.sha256()
        with open(part, 'rb') as f:
            for b in iter(lambda: f.read(1 << 20), b''): crc = zlib.crc32(b, crc); sha.update(b)
        if crc != info.CRC or os.path.getsize(part) != info.file_size:
            os.remove(part); raise SystemExit(f'CRC divergente em {info.filename}: arquivo descartado')
        os.replace(part, dest)
        out['members'].append({'name': info.filename, 'file': dest, 'bytes': info.file_size, 'crc32': f'{crc:08x}', 'sha256': sha.hexdigest(), 'resumed': have > 0})
    if not out['members']: raise SystemExit('nenhuma entrada casou')
    print(json.dumps(out, ensure_ascii=False))


main()
