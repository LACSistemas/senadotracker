import urllib.request, zipfile, io, zlib, re, sys, html
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
class RF(io.RawIOBase):
    def __init__(s,url):
        s.url=url; s.pos=0; r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA,'Range':'bytes=0-0'}),timeout=60); s.size=int(r.headers['Content-Range'].split('/')[1]); s.reqs=0; s.bytes=0
    def seekable(s): return True
    def readable(s): return True
    def tell(s): return s.pos
    def seek(s,o,w=0):
        s.pos = o if w==0 else (s.pos+o if w==1 else s.size+o); return s.pos
    def read(s,n=-1):
        if n<0 or s.pos+n>s.size: n=s.size-s.pos
        if n<=0: return b''
        r=urllib.request.urlopen(urllib.request.Request(s.url,headers={'User-Agent':UA,'Range':f'bytes={s.pos}-{s.pos+n-1}'}),timeout=120); d=r.read(); s.pos+=len(d); s.reqs+=1; s.bytes+=len(d); return d
    def readinto(s,b): d=s.read(len(b)); b[:len(d)]=d; return len(d)
def head(url, nbytes=400000):
    f=RF(url); z=zipfile.ZipFile(f); names=z.namelist()
    ss=[n for n in names if 'sharedStrings' in n]; sheets=[n for n in names if n.startswith('xl/worksheets/sheet')]
    wb=z.read('xl/workbook.xml').decode('utf8','ignore'); sheetnames=re.findall(r'<sheet [^>]*name="([^"]+)"',wb)
    strings=[]
    if ss:
        info=z.getinfo(ss[0]); f.seek(info.header_offset); hdr=f.read(30); nl,el=int.from_bytes(hdr[26:28],'little'),int.from_bytes(hdr[28:30],'little')
        raw=f.read(nl+el+min(nbytes,info.compress_size))[nl+el:]; d=zlib.decompressobj(-15).decompress(raw).decode('utf8','ignore')
        strings=[html.unescape(re.sub(r'<[^>]+>','',x)) for x in re.findall(r'<si>(.*?)</si>',d,re.S)][:200]
    info=z.getinfo(sheets[0]); f.seek(info.header_offset); hdr=f.read(30); nl,el=int.from_bytes(hdr[26:28],'little'),int.from_bytes(hdr[28:30],'little')
    raw=f.read(nl+el+min(nbytes,info.compress_size))[nl+el:]; x=zlib.decompressobj(-15).decompress(raw).decode('utf8','ignore')
    rows=re.findall(r'<row [^>]*>(.*?)</row>',x,re.S)[:6]
    out=[]
    for r in rows:
        cells=re.findall(r'<c [^>]*?(?:t="(\w+)")?[^>]*>(?:<f>.*?</f>)?<v>(.*?)</v></c>',r,re.S)
        out.append([strings[int(v)] if t=='s' and int(v)<len(strings) else v for t,v in cells])
    return {'size':f.size,'sheets':sheetnames,'n_sheet_parts':len(sheets),'rows':out,'range_requests':f.reqs,'bytes_read':f.bytes}
if __name__=='__main__':
    import json; print(json.dumps(head(sys.argv[1]),ensure_ascii=False)[:1800])
