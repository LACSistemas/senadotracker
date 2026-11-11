import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

/**
 * TJCE — Tribunal de Justiça do Ceará (P14.16, piloto de ponta a ponta do mapa em
 * `transparencia_judiciario.md`). TJCE é o único dos 27 TJs com API REST documentada
 * (`https://www.tjce.jus.br/transparencia/dados-abertos/`, tokens públicos por área) — escolhido
 * justamente por não depender de CAPTCHA nem de raspagem de HTML. A API devolve só um ÍNDICE de
 * arquivos mensais (pdf/xls/ods), nunca dado estruturado direto — confirmado ao vivo, não suposto a
 * partir da documentação. Pessoal vem em .xlsx (exceljs); financeiro vem em .ods/.xls (xlsx/SheetJS,
 * instalado a partir do CDN oficial do mantenedor por ter versão corrigida das 2 CVEs do pacote do
 * npm — aprovado pelo usuário).
 */
export const TJCE_TOKENS = {
  gestao: '520dfa67e2d0f1aaac7e1e1611b92257',
  remuneracao_pessoal: 'ef674ab6af490d6468567d3d34abaf17',
  produtividade: 'fb46e5355ffe1e8c8290235b39639c9f',
  cartorios: '7a64bed6fc3cb0f580c372ea4f9a8f9a',
} as const;
export type TjceArea = keyof typeof TJCE_TOKENS;

export const TJCE_ANNEX = {
  ANEXO_I: { area: 'gestao' as TjceArea, id: 69, label: 'Anexo I – Gestão Orçamentária e Financeira' },
  FORNECEDORES: { area: 'gestao' as TjceArea, id: 66, label: 'Pagamentos a Fornecedores' },
  CARGOS_EFETIVOS: { area: 'remuneracao_pessoal' as TjceArea, id: 99, label: 'Anexo IV A – Quantitativo de Cargos Efetivos' },
  CARGOS_COMISSAO: { area: 'remuneracao_pessoal' as TjceArea, id: 108, label: 'Anexo IV B – Quantitativo de Cargos de Comissão e Funções de Confiança' },
  TERCEIRIZADOS: { area: 'remuneracao_pessoal' as TjceArea, id: 123, label: 'Anexo VI – Empregados de Empresas Contratadas em Exercício nos Órgãos' },
} as const;
export type TjceAnnexKey = keyof typeof TJCE_ANNEX;

export interface TjceManifestEntry { anexo: string; data: string; pdf: string; xls: string; csv: string; ods: string }

/** Chama a API REST pública do TJCE. `limite` alto (o campo não documenta paginação; replicamos o
 * comportamento observado ao vivo: datas estreitas + limite alto cobrem um mês real sem ambiguidade). */
export async function fetchTjceManifest(annex: TjceAnnexKey, dataInicio: string, dataFim: string, limite = 50): Promise<TjceManifestEntry[]> {
  const def = TJCE_ANNEX[annex];
  const url = `https://www.tjce.jus.br/rest/?area=${def.area}&anexo=${def.id}&data_inicio=${dataInicio}&data_fim=${dataFim}&limite=${limite}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TJCE_TOKENS[def.area]}` } });
  if (!res.ok) throw new Error(`TJCE API HTTP ${res.status} para ${annex}`);
  const body = await res.json();
  return Array.isArray(body) ? body as TjceManifestEntry[] : [];
}

/** Baixa um arquivo pra D: (nunca pro banco) com hash e metadados — mesmo padrão já usado no piloto do STJ (P14.5). */
export async function downloadToD(url: string, destDir: string): Promise<{ path: string; bytes: number; sha256: string; httpStatus: number; contentType: string | null }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia)' } });
  if (!res.ok) throw new Error(`download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const fileName = decodeURIComponent(url.split('/').pop() ?? 'arquivo').replace(/[^\w.\-]/g, '_');
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), httpStatus: res.status, contentType: res.headers.get('content-type') };
}

/** "31-12-2025" (DD-MM-YYYY, formato da API) → {year, month}. */
export function parseTjceDate(d: string): { year: number; month: number } {
  const [dd, mm, yyyy] = d.split('-').map(Number);
  if (!dd || !mm || !yyyy) throw new Error(`data TJCE inesperada: ${d}`);
  return { year: yyyy, month: mm };
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

const cellStr = (v: unknown): string => v == null ? '' : typeof v === 'object' && 'text' in (v as any) ? String((v as any).text) : typeof v === 'object' && 'result' in (v as any) ? String((v as any).result) : String(v).trim();
const cellNum = (v: unknown): number | null => { const s = cellStr(v).replace(/\./g, '').replace(',', '.'); const n = Number(s); return Number.isFinite(n) && s !== '' ? n : (typeof v === 'number' ? v : null); };

async function readXlsxRows(filePath: string): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0]!; const rows: unknown[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) { const vals: unknown[] = []; ws.getRow(r).eachCell({ includeEmpty: true }, c => vals.push(c.value)); rows.push(vals); }
  return rows;
}

/** Anexo IV A — cargos efetivos: Carreira | Cargo | Classe | Escolaridade | Padrão | Estáveis | Não-Estáveis | Subtotal | Vagos | Extinto | Total | Aposentados | Total.
 * Linhas de dado têm número em pelo menos uma das colunas 5-12; linhas de rodapé (notas "*...") não.
 * Achado real (confirmado comparando linhas do mesmo cargo): "Aposentados" é um total por CARGO, repetido
 * sem variação em cada linha de classe/padrão daquele cargo — é a fonte que não varia inativos por padrão
 * salarial, não um erro de leitura. Somar por linha, como os outros status, multiplicaria o total de
 * aposentados pelo número de padrões do cargo (ex.: 12.643 em vez de algo plausível). Por isso o valor de
 * aposentados é coletado uma vez por (carreira,cargo), fora do loop por linha de padrão. */
export async function parseCargosEfetivos(filePath: string): Promise<PersonnelRow[]> {
  const rows = await readXlsxRows(filePath); const out: PersonnelRow[] = []; const aposentadosPorCargo = new Map<string, number>();
  for (const r of rows) {
    const career = cellStr(r[0]); const cargo = cellStr(r[1]); const classe = cellStr(r[2]);
    if (!career || !cargo || career.startsWith('*') || /^(carreira|cargos em comiss)/i.test(career)) continue;
    const estaveis = cellNum(r[5]), naoEstaveis = cellNum(r[6]), vagos = cellNum(r[8]), extinto = cellNum(r[9]), aposentados = cellNum(r[11]);
    if (estaveis == null && naoEstaveis == null && vagos == null) continue;
    const padrao = cellStr(r[4]) || null; const classLevel = [classe, padrao].filter(Boolean).join(' / ') || null;
    if (estaveis) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'ATIVO_ESTAVEL', headcount: estaveis });
    if (naoEstaveis) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis });
    if (vagos) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'VAGO', headcount: vagos });
    if (extinto) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'EXTINTO', headcount: extinto });
    if (aposentados) aposentadosPorCargo.set(`${career}|${cargo}`, aposentados);
  }
  for (const [key, headcount] of aposentadosPorCargo) { const [careerTrack, positionTitle] = key.split('|'); out.push({ careerTrack: careerTrack!, positionTitle: positionTitle!, classLevel: null, status: 'INATIVO_APOSENTADO', headcount }); }
  return out;
}

/** Anexo IV B — cargos em comissão: Denominação/Nível | Com Vínculo (Optante, Integral, Subtotal) | Sem Vínculo | Vagos | Total. */
export async function parseCargosComissao(filePath: string): Promise<PersonnelRow[]> {
  const rows = await readXlsxRows(filePath); const out: PersonnelRow[] = [];
  for (const r of rows) {
    const nivel = cellStr(r[0]);
    if (!nivel || /^(denomina|cargos em comiss)/i.test(nivel)) continue;
    const optante = cellNum(r[1]), integral = cellNum(r[2]), semVinculo = cellNum(r[4]), vagos = cellNum(r[5]);
    if (optante == null && integral == null && semVinculo == null && vagos == null) continue;
    if (optante) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante });
    if (integral) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo });
    if (vagos) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'VAGO', headcount: vagos });
  }
  return out;
}

/** Anexo VI — terceirizados: lista NOMINAL (Nome, Empresa, CNPJ, Lotação, Cargo). Agregamos por empresa+cargo
 * — nunca publicamos o nome individual: o pedido é "quantas pessoas", a Anexo VI em si já é o quadro, não a folha. */
export async function parseTerceirizados(filePath: string): Promise<PersonnelRow[]> {
  const rows = await readXlsxRows(filePath); const counts = new Map<string, { empresa: string; cargo: string; n: number }>();
  for (const r of rows) {
    const nome = cellStr(r[0]); const empresa = cellStr(r[1]); const cargo = cellStr(r[4]);
    if (!nome || !empresa || /^nome$/i.test(nome)) continue;
    const key = `${empresa}|${cargo}`; const e = counts.get(key) ?? { empresa, cargo, n: 0 }; e.n++; counts.set(key, e);
  }
  return [...counts.values()].map(e => ({ careerTrack: e.empresa, positionTitle: e.cargo || null, classLevel: null, status: 'TERCEIRIZADO_ATIVO', headcount: e.n }));
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: seções "Inciso N - ..." seguidas de linhas Alínea|Discriminação|Tesouro|Fermoju|Funseg|Fecdoj|Total.
 * Só o nível de alínea-letra (a, b, c...) é capturado — os subitens numerados (a.1, a.2...) do arquivo
 * já somam para a letra-mãe; guardar os dois níveis sem marcação de hierarquia dobraria a conta se
 * alguém somar "todas as linhas do mês" às cegas, então o piloto fica só no nível que não tem esse risco. */
/** `XLSX.readFile` (caminho em disco) falha na build ESM do pacote no Windows ("Cannot access file"),
 * achado real e reproduzido isolando CJS vs ESM — `XLSX.read` a partir de um Buffer já lido pelo `fs`
 * usa outro caminho interno e funciona nos dois. */
function readSpreadsheet(filePath: string): XLSX.WorkBook { return XLSX.read(readFileSync(filePath)); }

export function parseAnexoI(filePath: string): FinanceRow[] {
  const wb = readSpreadsheet(filePath); const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });
  const out: FinanceRow[] = []; let category = '';
  for (const r of rows) {
    const col0 = String(r?.[0] ?? '').trim();
    if (/^Inciso/i.test(col0)) { category = col0; continue; }
    if (!/^[a-z]$/.test(col0)) continue; // só alínea-letra única (a, b, c, d, e), nunca "a.1"
    const label = String(r?.[1] ?? '').trim(); const total = Number(r?.[6]);
    if (!label || !Number.isFinite(total)) continue;
    out.push({ account: `${col0} — ${label}`, category: category || 'Sem seção identificada', amountReais: total });
  }
  return out;
}

export interface SupplierPaymentRow { fundingSource: string; documentNumber: string | null; supplierName: string; biddingType: string | null; processNumber: string | null; description: string | null; amountReais: number }

/** Pagamentos a fornecedores: 1 aba por fundo (FERMOJU/TESOURO/FUNSEG), mesmas colunas em cada.
 * FONTE | NÚMERO DO DOCUMENTO | FORNECEDOR | TIPO DE LICITAÇÃO | PROCESSO | DESCRIÇÃO | VALOR DO PAGAMENTO.
 * Confirmado ao vivo: este arquivo do TJCE não publica CNPJ, só a razão social — campo fica de fora. */
export function parseFornecedores(filePath: string): SupplierPaymentRow[] {
  const wb = readSpreadsheet(filePath); const out: SupplierPaymentRow[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]!; const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });
    for (const r of rows) {
      const fonte = String(r?.[0] ?? '').trim(); const fornecedor = String(r?.[2] ?? '').trim(); const valor = Number(r?.[6]);
      if (!fonte || !fornecedor || !Number.isFinite(valor) || /^fonte$/i.test(fonte)) continue;
      out.push({ fundingSource: fonte, documentNumber: String(r?.[1] ?? '').trim() || null, supplierName: fornecedor, biddingType: String(r?.[3] ?? '').trim() || null, processNumber: String(r?.[4] ?? '').trim() || null, description: String(r?.[5] ?? '').trim() || null, amountReais: valor });
    }
  }
  return out;
}
