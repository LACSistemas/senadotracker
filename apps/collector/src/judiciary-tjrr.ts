import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

/**
 * TJRR — Tribunal de Justiça de Roraima (P14.23, 8º dos 27 TJs). Portal Joomla com "gerenciador de
 * arquivos" — os links de download reais são gerados dinamicamente (clique em ano → clique em quadrimestre/
 * mês → só então aparece o `<a href>` real, com hash único por arquivo) — nunca uma URL previsível por
 * padrão como TJES/TJGO; precisa descobrir cada link via navegação real antes de baixar. Em compensação, o
 * dado em si é o mais rico já visto nesta série: Anexo I MENSAL (não quadrimestral), fornecedores com CNPJ
 * real E CPF já mascarado pela PRÓPRIA fonte (não precisa de lógica de mascaramento própria aqui), Anexo IV
 * completo (a-h).
 */
function readSpreadsheet(filePath: string): XLSX.WorkBook { return XLSX.read(readFileSync(filePath)); }
const asRows = (wb: XLSX.WorkBook): unknown[][] => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, defval: null }) as unknown[][];

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; httpStatus: number; contentType: string | null }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), httpStatus: res.status, contentType: res.headers.get('content-type') };
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

/** Anexo IV, alínea a (cargos efetivos): hierarquia de 3 níveis (Categoria/Carreira/Cargo), cada um só
 * preenchido na 1ª linha do grupo (carrega o último visto) — Nível (coluna 3) sempre presente. Rollups
 * aparecem em posições DIFERENTES conforme o nível ("TOTAL DE NÍVEL MÉDIO" na coluna do Cargo, "TOTAL DA
 * CATEGORIA GERAL" na coluna da Carreira, "TOTAL GERAL" na coluna da Categoria) — exclui se qualquer uma das
 * 3 primeiras colunas começar com "TOTAL". Confirmado ao vivo: Vagos (e as outras colunas) variam
 * genuinamente linha a linha — sem o bug de valor repetido por grupo já visto no TJCE/TJGO. */
export async function parseAnexoIVA(filePath: string): Promise<PersonnelRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const out: PersonnelRow[] = [];
  let categoria = '', carreira = '', cargo = '';
  for (let r = 10; r < rows.length; r++) {
    const row = rows[r]!;
    const c0 = String(row[0] ?? '').trim(), c1 = String(row[1] ?? '').trim(), c2 = String(row[2] ?? '').trim();
    if (/^total/i.test(c0) || /^total/i.test(c1) || /^total/i.test(c2)) continue;
    if (c0.startsWith('*')) continue; // nota de rodapé
    const nivel = String(row[3] ?? '').trim();
    if (!nivel) continue;
    if (c0) categoria = c0;
    if (c1) carreira = c1;
    if (c2) cargo = c2;
    const estaveis = Number(row[4]) || 0, naoEstaveis = Number(row[5]) || 0, vagos = Number(row[7]) || 0;
    const aposentados = Number(row[9]) || 0, instituidores = Number(row[10]) || 0, beneficiarios = Number(row[12]) || 0;
    const classLevel = [categoria || null, nivel].filter(Boolean).join(' / ') || null;
    if (estaveis) out.push({ careerTrack: carreira || null, positionTitle: cargo || null, classLevel, status: 'ATIVO_ESTAVEL', headcount: estaveis });
    if (naoEstaveis) out.push({ careerTrack: carreira || null, positionTitle: cargo || null, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis });
    if (vagos) out.push({ careerTrack: carreira || null, positionTitle: cargo || null, classLevel, status: 'VAGO', headcount: vagos });
    if (aposentados) out.push({ careerTrack: carreira || null, positionTitle: cargo || null, classLevel, status: 'INATIVO_APOSENTADO', headcount: aposentados });
    if (instituidores) out.push({ careerTrack: carreira || null, positionTitle: cargo || null, classLevel, status: 'INSTITUIDOR_PENSAO', headcount: instituidores });
    if (beneficiarios) out.push({ careerTrack: carreira || null, positionTitle: cargo || null, classLevel, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios });
  }
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: várias seções "Inciso N - <descrição>" (algumas repetem o bloco de metadado "ANEXO I/Sigla/Nome
 * do Órgão..." NO MEIO do arquivo, entre Incisos — artefato real de exportação paginada, inofensivo porque
 * essas linhas de metadado não batem o padrão de alínea e `inciso` só muda quando vê "Inciso" de verdade, não
 * se perde no meio). Linha de alínea = letra única na coluna 0; linha "Total" (rollup por Inciso) tem a
 * coluna 0 vazia e "Total" na coluna 6 — nunca confundida com uma alínea de verdade. Mesma convenção
 * `account`="letra — descrição" / `category`=texto do Inciso já usada no TJCE/TJAM. */
export async function parseAnexoI(filePath: string): Promise<FinanceRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const out: FinanceRow[] = [];
  let inciso = '';
  for (const row of rows) {
    const c0 = String(row[0] ?? '').trim();
    if (/^Inciso/i.test(c0)) { inciso = c0; continue; }
    if (!/^[a-z]$/i.test(c0)) continue;
    const label = String(row[2] ?? '').trim();
    const amount = Number(row[8]);
    if (!label || !Number.isFinite(amount) || !amount) continue;
    out.push({ account: `${c0} — ${label}`, category: inciso || 'Sem seção identificada', amountReais: amount });
  }
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** "Contratados Pagos": formato largo, 1 linha por credor×natureza, 1 coluna por mês (JAN/AAAA..DEZ/AAAA) +
 * linha final "Total" (rollup, excluída). Diferente de todos os tribunais anteriores: a PRÓPRIA fonte já
 * mascara CPF de pessoa física ("***.***.***-NN") — nunca precisa de lógica de mascaramento aqui, só
 * reconhecer CNPJ real (padrão `XX.XXX.XXX/XXXX-XX`) e descartar qualquer coisa com asterisco. Natureza de
 * despesa vem como CÓDIGO numérico (ex. "44905202"), sem descrição textual neste arquivo — gravado como
 * está, nunca decodificado sem uma tabela de referência real. */
export async function parseContratados(filePath: string): Promise<SupplierPaymentRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const header = (rows[1] ?? []).map(v => String(v ?? '').trim().toUpperCase());
  const monthCols: Array<{ col: number; month: number }> = [];
  for (let c = 3; c < header.length; c++) {
    const m = MONTHS.findIndex(mm => header[c]!.startsWith(mm));
    if (m >= 0) monthCols.push({ col: c, month: m + 1 });
  }
  const out: SupplierPaymentRow[] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r]!;
    const credor = String(row[0] ?? '').trim();
    if (!credor || /^total$/i.test(credor)) continue;
    const supplierCnpj = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(credor) ? credor : null;
    const supplierName = String(row[1] ?? '').trim();
    if (!supplierName) continue;
    const naturezaCode = String(row[2] ?? '').trim();
    for (const { col, month } of monthCols) {
      const amount = Number(row[col]);
      if (amount) out.push({ supplierName, supplierCnpj, expenseDescription: naturezaCode, month, amountReais: amount });
    }
  }
  return out;
}
