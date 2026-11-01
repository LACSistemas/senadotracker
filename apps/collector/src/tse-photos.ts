import { inflateRawSync } from 'node:zlib';

/**
 * Extrai uma foto de candidato de dentro do ZIP por UF/ano que o TSE publica (não há URL individual por
 * candidato — só o ZIP inteiro, ~20 MB, com milhares de entradas). Em vez de baixar o ZIP inteiro por
 * retrato, lê só o que precisa via HTTP Range: o fim do arquivo (End Of Central Directory), o diretório
 * central (lista de entradas) e, por fim, os bytes comprimidos de UMA entrada. Validado contra o CDN real
 * (bytes extraídos remotamente idênticos aos extraídos do arquivo baixado por inteiro).
 *
 * Nome do arquivo dentro do ZIP: `F{UF}{SQ_CANDIDATO}_div.{jpg|jpeg}` (confirmado). Nos exemplares
 * inspecionados o método de compressão é 0 (sem compressão) — `inflateRawSync` cobre o caso 8 (deflate)
 * por generalidade, mas não foi exercitado por falta de exemplar comprimido.
 */
const USER_AGENT = 'Civica/0.1 (official-data-research; tse-photo-extract)';
const EOCD_SIGNATURE = 0x06054b50, CENTRAL_SIGNATURE = 0x02014b50, LOCAL_SIGNATURE = 0x04034b50;
const MAX_EOCD_COMMENT = 65557; // 22 (EOCD mínimo) + até 65535 de comentário

export function tseFotoZipUrl(year: number, uf: string): string {
  return `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes${year}/fotos/foto_cand${year}_${uf.toUpperCase()}_div.zip`;
}
export function tsePhotoSourceUrl(year: number, uf: string, sqCandidato: string): string {
  return `${tseFotoZipUrl(year, uf)}?sq=${sqCandidato}`;
}

interface CentralEntry { localHeaderOffset: number; compressedSize: number; method: number }

async function fetchRange(url: string, start: number, end: number): Promise<{ status: number; body: Buffer }> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(20_000) });
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()) };
}

async function fetchContentLength(url: string): Promise<number | null> {
  const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const len = Number(res.headers.get('content-length'));
  return Number.isFinite(len) && len > 0 ? len : null;
}

function parseCentralDirectory(cdBuffer: Buffer): Map<string, CentralEntry> {
  const entries = new Map<string, CentralEntry>();
  let p = 0;
  while (p < cdBuffer.length) {
    const sig = cdBuffer.readUInt32LE(p);
    if (sig !== CENTRAL_SIGNATURE) break;
    const method = cdBuffer.readUInt16LE(p + 10);
    const compressedSize = cdBuffer.readUInt32LE(p + 20);
    const nameLen = cdBuffer.readUInt16LE(p + 28);
    const extraLen = cdBuffer.readUInt16LE(p + 30);
    const commentLen = cdBuffer.readUInt16LE(p + 32);
    const localHeaderOffset = cdBuffer.readUInt32LE(p + 42);
    const name = cdBuffer.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { localHeaderOffset, compressedSize, method });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const centralDirCache = new Map<string, Promise<Map<string, CentralEntry> | null>>();

async function loadCentralDirectory(zipUrl: string): Promise<Map<string, CentralEntry> | null> {
  const cached = centralDirCache.get(zipUrl);
  if (cached) return cached;
  const promise = (async () => {
    const totalSize = await fetchContentLength(zipUrl);
    if (totalSize == null) return null;
    const tailSize = Math.min(totalSize, MAX_EOCD_COMMENT);
    const tail = await fetchRange(zipUrl, totalSize - tailSize, totalSize - 1);
    if (tail.status !== 206 && tail.status !== 200) return null;
    let eocdOffsetInTail = -1;
    for (let i = tail.body.length - 22; i >= 0; i--) {
      if (tail.body.readUInt32LE(i) === EOCD_SIGNATURE) { eocdOffsetInTail = i; break; }
    }
    if (eocdOffsetInTail < 0) throw new Error(`EOCD não encontrado em ${zipUrl}`);
    const cdSize = tail.body.readUInt32LE(eocdOffsetInTail + 12);
    const cdOffset = tail.body.readUInt32LE(eocdOffsetInTail + 16);
    // o diretório central às vezes já está contido no próprio tail buscado; evita um 2º round-trip quando dá
    const tailStart = totalSize - tailSize;
    let cdBuffer: Buffer;
    if (cdOffset >= tailStart) {
      cdBuffer = tail.body.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize);
    } else {
      const cd = await fetchRange(zipUrl, cdOffset, cdOffset + cdSize - 1);
      if (cd.status !== 206 && cd.status !== 200) throw new Error(`HTTP ${cd.status} ao buscar diretório central de ${zipUrl}`);
      cdBuffer = cd.body;
    }
    return parseCentralDirectory(cdBuffer);
  })();
  centralDirCache.set(zipUrl, promise);
  return promise;
}

/** Devolve os bytes do JPEG de um candidato, ou null se o ZIP do ano/UF não existir ou a entrada não estiver nele. */
export async function fetchTsePhotoBytes(year: number, uf: string, sqCandidato: string): Promise<Buffer | null> {
  const zipUrl = tseFotoZipUrl(year, uf);
  const entries = await loadCentralDirectory(zipUrl);
  if (!entries) return null;
  const entry = [`F${uf.toUpperCase()}${sqCandidato}_div.jpg`, `F${uf.toUpperCase()}${sqCandidato}_div.jpeg`]
    .map(n => entries.get(n)).find(Boolean);
  if (!entry) return null;

  const probe = await fetchRange(zipUrl, entry.localHeaderOffset, entry.localHeaderOffset + 511);
  if (probe.status !== 206 && probe.status !== 200) throw new Error(`HTTP ${probe.status} ao buscar cabeçalho local em ${zipUrl}`);
  if (probe.body.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new Error(`cabeçalho local inválido em ${zipUrl} offset ${entry.localHeaderOffset}`);
  const nameLen = probe.body.readUInt16LE(26), extraLen = probe.body.readUInt16LE(28);
  const dataStartInProbe = 30 + nameLen + extraLen;

  let compressed: Buffer;
  if (dataStartInProbe + entry.compressedSize <= probe.body.length) {
    compressed = probe.body.subarray(dataStartInProbe, dataStartInProbe + entry.compressedSize);
  } else {
    const dataStart = entry.localHeaderOffset + dataStartInProbe;
    const data = await fetchRange(zipUrl, dataStart, dataStart + entry.compressedSize - 1);
    if (data.status !== 206 && data.status !== 200) throw new Error(`HTTP ${data.status} ao buscar dados de ${zipUrl}`);
    compressed = data.body;
  }

  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRawSync(compressed);
  throw new Error(`método de compressão não suportado (${entry.method}) em ${zipUrl}`);
}

export type FetchLike = (input: URL, init: { redirect: 'manual'; signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>;
const ZIP_URL_RE = /\/eleicoes(\d{4})\/fotos\/foto_cand\d{4}_([A-Z]{2})_div\.zip$/i;

/** Adaptador `FetchLike` compatível com `mirrorPortrait` (packages/db/src/portrait-mirror.ts): a URL de
 * origem é a URL real do ZIP do TSE com `?sq=SQ_CANDIDATO`; o adaptador extrai só aquela foto. */
export function createTsePhotoFetchImpl(): FetchLike {
  return async (url: URL) => {
    const m = ZIP_URL_RE.exec(url.pathname);
    const sq = url.searchParams.get('sq');
    if (!m || !sq) return new Response(null, { status: 400 });
    try {
      const bytes = await fetchTsePhotoBytes(Number(m[1]), m[2]!, sq);
      if (!bytes) return new Response(null, { status: 404 });
      return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': String(bytes.length) } });
    } catch (error) {
      return new Response(null, { status: 502, statusText: error instanceof Error ? error.message : String(error) });
    }
  };
}
