"""P10/G2 — lista o conteúdo de um ZIP remoto SEM baixá-lo: lê só o diretório central via HTTP Range (cauda do arquivo).
Uso: python -I zip_remote_listing.py <url> [<url> ...]  -> JSON com nome, bytes compactados e descompactados de cada entrada.
Opcional: --read <nome_da_entrada> <n_bytes> imprime os primeiros n bytes (descomprimidos) de UMA entrada, lendo só o trecho necessário."""
import io, json, sys, urllib.request, zipfile, zlib, struct

UA = 'civica-exec/1.0 (pesquisa de dados abertos)'

class RangeFile(io.RawIOBase):
    def __init__(self, url):
        self.url = url; self.pos = 0; self.calls = 0; self.bytes = 0
        import time
        for attempt in range(1, 6):
            try:
                req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=60) as r: self.size = int(r.headers['Content-Length'])
                break
            except Exception:
                if attempt == 5: raise
                time.sleep(2 * attempt)
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
        req = urllib.request.Request(self.url, headers={'User-Agent': UA, 'Range': f'bytes={self.pos}-{self.pos + n - 1}'})
        import time
        for attempt in range(1, 6):   # o host às vezes derruba a conexão (WinError 10054): espera crescente e tenta de novo
            try:
                with urllib.request.urlopen(req, timeout=120) as r: data = r.read()
                break
            except Exception:
                if attempt == 5: raise
                time.sleep(2 * attempt)
        self.pos += len(data); self.calls += 1; self.bytes += len(data)
        return data
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)

def listing(url):
    rf = RangeFile(url); br = io.BufferedReader(rf, buffer_size=1 << 20)
    with zipfile.ZipFile(br) as z:
        ents = [{'nome': i.filename, 'compactado': i.compress_size, 'descompactado': i.file_size} for i in z.infolist()]
    return {'url': url, 'tamanho_zip': rf.size, 'chamadas_range': rf.calls, 'bytes_lidos': rf.bytes, 'entradas': ents}

def read_entry(url, name, nbytes):
    rf = RangeFile(url); br = io.BufferedReader(rf, buffer_size=1 << 16)
    with zipfile.ZipFile(br) as z:
        with z.open(name) as fh: data = fh.read(nbytes)
    return {'entrada': name, 'bytes_lidos_da_rede': rf.bytes, 'chamadas': rf.calls, 'texto': data.decode('latin-1')}

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == '--read':
        print(json.dumps(read_entry(a[3], a[1], int(a[2])), ensure_ascii=False))
    else:
        res = []
        for u in a:
            try: res.append(listing(u))
            except Exception as e: res.append({'url': u, 'erro': repr(e)[:200]})
        print(json.dumps(res, ensure_ascii=False, indent=1))
