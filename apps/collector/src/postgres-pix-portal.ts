import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { amendmentCodeOf, foldName, parseBrDecimal, SPECIAL_TRANSFER_KIND, ufSigla } from '@senadotracker/domain';
import type { PortalAmendmentRow, PortalPaymentRow } from '@senadotracker/db';

/**
 * Portal da Transparência — download público "Emendas parlamentares / UNICO" (sem a API REST, que exige chave).
 * ZIP com 3 CSVs (windows-1252, `;`): `EmendasParlamentares` (valores por emenda), `PorFavorecido` (pagamentos por favorecido/mês),
 * `Convenios` (ignorado: não cobre Transferências Especiais). Só entram as "Emenda Individual - Transferências Especiais".
 */
export const PORTAL_URL = 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO';

export function* csvRows(text: string, delimiter = ';'): Generator<string[]> {
  let field = '', row: string[] = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c; }
    else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); yield row; row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); yield row; }
}

const header = (names: string[]) => { const folded = names.map(foldName); return (start: string) => { const i = folded.findIndex(n => n.startsWith(foldName(start))); if (i < 0) throw new Error(`Coluna ausente no Portal: ${start}`); return i; }; };
const textOrNull = (v: string | undefined) => { const s = (v ?? '').trim(); return s ? s : null; };

export interface PortalParseResult {
  amendments: PortalAmendmentRow[]; payments: PortalPaymentRow[];
  meta: { amendmentRowsByKind: Record<string, number>; specialAmendmentRows: number; specialPaymentRows: number; duplicateAmendmentRows: number; files: string[] };
}

export function parsePortalAmendmentsCsv(text: string) {
  const rows = csvRows(text); const head = rows.next().value as string[] | undefined; if (!head) throw new Error('CSV de emendas vazio');
  const col = header(head);
  const c = { code: col('Código da Emenda'), year: col('Ano da Emenda'), kind: col('Tipo de Emenda'), author: col('Código do Autor'), name: col('Nome do Autor'), location: col('Localidade'), ibge: col('Código Município IBGE'), uf: col('UF'), fn: col('Nome Função'), sub: col('Nome Subfunção'), committed: col('Valor Empenhado'), liquidated: col('Valor Liquidado'), paid: col('Valor Pago'), rap: col('Valor Restos A Pagar Inscritos'), rapCancelled: col('Valor Restos A Pagar Cancelados'), rapPaid: col('Valor Restos A Pagar Pagos') };
  const byKind: Record<string, number> = {}; const byCode = new Map<string, PortalAmendmentRow>(); let duplicates = 0;
  const add = (a: number | null, b: number | null) => a === null && b === null ? null : (a ?? 0) + (b ?? 0);
  for (const r of rows) {
    if (r.length < head.length) continue;
    byKind[r[c.kind]!] = (byKind[r[c.kind]!] ?? 0) + 1;
    if (r[c.kind] !== SPECIAL_TRANSFER_KIND) continue;
    const code = amendmentCodeOf(r[c.code]); if (!code) throw new Error(`Código de emenda inválido no Portal: ${r[c.code]}`);
    const row: PortalAmendmentRow = { amendmentCode: code, year: Number(r[c.year]), authorCode: String(r[c.author]).trim(), authorName: r[c.name]!.trim(), kind: SPECIAL_TRANSFER_KIND,
      uf: ufSigla(r[c.uf]), location: textOrNull(r[c.location]), ibgeCode: /^\d{7}$/.test((r[c.ibge] ?? '').trim()) ? r[c.ibge]!.trim() : null, functionName: textOrNull(r[c.fn]), subfunctionName: textOrNull(r[c.sub]),
      committed: parseBrDecimal(r[c.committed]), liquidated: parseBrDecimal(r[c.liquidated]), paid: parseBrDecimal(r[c.paid]), outstanding: parseBrDecimal(r[c.rap]), outstandingCancelled: parseBrDecimal(r[c.rapCancelled]), outstandingPaid: parseBrDecimal(r[c.rapPaid]) };
    const cur = byCode.get(code);
    if (cur) { duplicates++; for (const k of ['committed','liquidated','paid','outstanding','outstandingCancelled','outstandingPaid'] as const) cur[k] = add(cur[k], row[k]); }
    else byCode.set(code, row);
  }
  return { amendments: [...byCode.values()], byKind, duplicates };
}

export function parsePortalPaymentsCsv(text: string): PortalPaymentRow[] {
  const rows = csvRows(text); const head = rows.next().value as string[] | undefined; if (!head) throw new Error('CSV por favorecido vazio');
  const col = header(head);
  const c = { code: col('Código da Emenda'), kind: col('Tipo de Emenda'), month: col('Ano/Mês'), favored: col('Código do Favorecido'), name: col('Favorecido'), nature: col('Natureza Jurídica'), type: col('Tipo Favorecido'), uf: col('UF Favorecido'), city: col('Município Favorecido'), value: col('Valor Recebido') };
  const out: PortalPaymentRow[] = [];
  for (const r of rows) {
    if (r.length < head.length || r[c.kind] !== SPECIAL_TRANSFER_KIND) continue;
    const code = amendmentCodeOf(r[c.code]); if (!code) throw new Error(`Código de emenda inválido no Portal (favorecido): ${r[c.code]}`);
    const amount = parseBrDecimal(r[c.value]); if (amount === null) throw new Error(`Valor inválido no Portal (favorecido) ${code}`);
    out.push({ amendmentCode: code, month: r[c.month]!.trim(), favoredCode: r[c.favored]!.trim() || 'sem-codigo', favoredName: textOrNull(r[c.name]), legalNature: textOrNull(r[c.nature]), favoredType: textOrNull(r[c.type]), uf: textOrNull(r[c.uf]), municipality: textOrNull(r[c.city]), amount });
  }
  return out;
}

export function parsePortalZip(bytes: Uint8Array): PortalParseResult & { sha256: string; zipModifiedAt: string | null } {
  const files = unzipSync(bytes, { filter: f => /\.csv$/i.test(f.name) });
  const decode = (name: string) => { const data = Object.entries(files).find(([n]) => n.toLowerCase() === name.toLowerCase())?.[1]; if (!data) throw new Error(`Arquivo ausente no ZIP do Portal: ${name}`); return new TextDecoder('windows-1252').decode(data); };
  const a = parsePortalAmendmentsCsv(decode('EmendasParlamentares.csv'));
  const payments = parsePortalPaymentsCsv(decode('EmendasParlamentares_PorFavorecido.csv'));
  return { amendments: a.amendments, payments, meta: { amendmentRowsByKind: a.byKind, specialAmendmentRows: a.amendments.length, specialPaymentRows: payments.length, duplicateAmendmentRows: a.duplicates, files: Object.keys(files) }, sha256: createHash('sha256').update(bytes).digest('hex'), zipModifiedAt: null };
}

export async function downloadPortalZip(options: { fetch?: typeof fetch | undefined; url?: string | undefined } = {}): Promise<{ bytes: Uint8Array; fetchedAt: string; url: string; lastModified: string | null }> {
  const url = options.url ?? PORTAL_URL;
  const response = await (options.fetch ?? fetch)(url, { headers: { 'User-Agent': 'Civica/0.1 (official-data-research)' } });
  if (response.status !== 200) throw new Error(`Portal da Transparência: HTTP ${response.status}`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), fetchedAt: new Date().toISOString(), url, lastModified: response.headers.get('last-modified') };
}
