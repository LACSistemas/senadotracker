import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

/**
 * TJPA — Tribunal de Justiça do Pará (P14.24, 9º dos 27 TJs). Portal ASP.NET de consulta
 * (`apps.tjpa.jus.br`) só lista os LINKS para páginas de conteúdo; os arquivos reais ficam no CMS
 * institucional (`www.tjpa.jus.br/PortalExterno/.../CMSPortal/VisualizarArquivo?idArquivo=N`, sem extensão
 * na URL — a detecção por regex de URL (usada em todos os tribunais anteriores) falha aqui, só o TEXTO do
 * link ("- XLS"/"- CSV"/"- PDF") indica o formato; 3º tribunal desta série (depois de TJGO/TJRR) a exigir
 * detecção de link por texto, não por padrão de URL).
 */
function readSpreadsheet(filePath: string): XLSX.WorkBook { return XLSX.read(readFileSync(filePath)); }
const asRows = (wb: XLSX.WorkBook): unknown[][] => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, defval: null }) as unknown[][];
const asRowsNamed = (wb: XLSX.WorkBook, sheet: string): unknown[][] => XLSX.utils.sheet_to_json(wb.Sheets[sheet]!, { header: 1, defval: null }) as unknown[][];

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; httpStatus: number; contentType: string | null }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), httpStatus: res.status, contentType: res.headers.get('content-type') };
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' | 'ANEXO_IV_E' }

/** Anexo IV completo (8 alíneas a-h no mesmo arquivo); usamos só a) cargos efetivos, b) cargos em comissão e
 * e) magistrados — c)/d)/f)/g) são recortes dimensionais REDUNDANTES da mesma população de a)/e) (origem
 * funcional, situação funcional — não somam headcount novo), e h) é benefício assistencial, não headcount.
 *
 * a) tem hierarquia CARREIRA/CLASSE/PADRÃO só preenchida na 1ª linha de cada grupo, com uma linha
 * "TOTAL - <carreira>" ao final de cada grupo — usamos SÓ essas linhas de total (nunca somamos as linhas de
 * padrão nós mesmos, pra não duplicar). A seção "3 - CARGO EM EXTINÇÃO" é uma excepção: não tem padrão, o
 * valor já vem direto nela mesma, seguida de ~30 linhas-filhas (cargos extintos individuais) que são
 * sub-detalhe JÁ CONTABILIZADO nela — confirmado somando as filhas e batendo exatamente com o valor da linha-
 * pai antes de aceitar essa regra. Uma linha final "TOTAL -" (sem nome, decorativa) soma só uma fração do
 * sub-detalhe de novo — excluída explicitamente (senão duplicaria ~5 aposentados); verificado que SEM essa
 * linha a soma bate exatamente com TOTAL GERAL em todas as 4 colunas (estáveis/vagos/aposentados/etc.), e COM
 * ela não bate — prova de que é redundante, não um grupo novo. */
export async function parseAnexoIVA(filePath: string): Promise<PersonnelRow[]> {
  const wb = readSpreadsheet(filePath);
  const rows = asRowsNamed(wb, 'AnexoIV-a');
  const out: PersonnelRow[] = [];
  const push = (cargo: string, estaveis: number, naoEstaveis: number, vagos: number, aposentados: number, instituidores: number, beneficiarios: number) => {
    if (estaveis) out.push({ careerTrack: cargo, positionTitle: cargo, classLevel: null, status: 'ATIVO_ESTAVEL', headcount: estaveis, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: cargo, positionTitle: cargo, classLevel: null, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: cargo, positionTitle: cargo, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_A' });
    if (aposentados) out.push({ careerTrack: cargo, positionTitle: cargo, classLevel: null, status: 'INATIVO_APOSENTADO', headcount: aposentados, sourceAnnex: 'ANEXO_IV_A' });
    if (instituidores) out.push({ careerTrack: cargo, positionTitle: cargo, classLevel: null, status: 'INSTITUIDOR_PENSAO', headcount: instituidores, sourceAnnex: 'ANEXO_IV_A' });
    if (beneficiarios) out.push({ careerTrack: cargo, positionTitle: cargo, classLevel: null, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios, sourceAnnex: 'ANEXO_IV_A' });
  };
  for (let r = 16; r < rows.length; r++) {
    const row = rows[r]!;
    const c0 = String(row[0] ?? '').trim();
    if (/^TOTAL GERAL/i.test(c0)) break;
    if (!c0) continue;
    const totalMatch = /^TOTAL\s*-\s*(.+)$/i.exec(c0);
    if (totalMatch) {
      const cargo = totalMatch[1]!.trim();
      if (!cargo) continue; // "TOTAL -" decorativo sem nome, sub-detalhe já contado na linha-pai — ver doc acima
      push(cargo, Number(row[4]) || 0, Number(row[5]) || 0, Number(row[7]) || 0, Number(row[9]) || 0, Number(row[10]) || 0, Number(row[12]) || 0);
      continue;
    }
    const directMatch = /^\d+\s*-\s*(.+)$/.exec(c0);
    if (directMatch && row[3] == null && typeof row[4] === 'number') {
      push(directMatch[1]!.trim(), Number(row[4]) || 0, Number(row[5]) || 0, Number(row[7]) || 0, Number(row[9]) || 0, Number(row[10]) || 0, Number(row[12]) || 0);
    }
    // senão: linha de detalhe por padrão (carreira ainda não totalizada) ou filha de "cargo em extinção" — ambas já contadas, pula
  }
  // conferência real contra a linha TOTAL GERAL do próprio arquivo
  const totalGeralRow = rows.find(r => /^TOTAL GERAL/i.test(String(r[0] ?? '')));
  if (!totalGeralRow) throw new Error('TJPA Anexo IV-a: linha TOTAL GERAL não encontrada — layout pode ter mudado');
  const sums = { estaveis: 0, naoEstaveis: 0, vagos: 0, aposentados: 0, instituidores: 0, beneficiarios: 0 };
  for (const r of out) {
    if (r.status === 'ATIVO_ESTAVEL') sums.estaveis += r.headcount;
    if (r.status === 'ATIVO_NAO_ESTAVEL') sums.naoEstaveis += r.headcount;
    if (r.status === 'VAGO') sums.vagos += r.headcount;
    if (r.status === 'INATIVO_APOSENTADO') sums.aposentados += r.headcount;
    if (r.status === 'INSTITUIDOR_PENSAO') sums.instituidores += r.headcount;
    if (r.status === 'BENEFICIARIO_PENSAO') sums.beneficiarios += r.headcount;
  }
  const expected = { estaveis: Number(totalGeralRow[4]) || 0, naoEstaveis: Number(totalGeralRow[5]) || 0, vagos: Number(totalGeralRow[7]) || 0, aposentados: Number(totalGeralRow[9]) || 0, instituidores: Number(totalGeralRow[10]) || 0, beneficiarios: Number(totalGeralRow[12]) || 0 };
  if (JSON.stringify(sums) !== JSON.stringify(expected)) throw new Error(`TJPA Anexo IV-a: soma não bate com TOTAL GERAL. calculado=${JSON.stringify(sums)} esperado=${JSON.stringify(expected)}`);
  return out;
}

/** b) cargos em comissão e funções de confiança: grade já FLAT por código de cargo (CJI, CJS-1..CJS-8, FG-1,
 * FG-2), sem hierarquia/carry-forward. Vocabulário de status reaproveitado de um tribunal anterior desta
 * série que já modelou exatamente essa distinção de vínculo (`OCUPADO_COM_VINCULO_OPTANTE`/`_INTEGRAL`/
 * `OCUPADO_SEM_VINCULO`, já reconhecidos pela tela como "ocupados"). */
export async function parseAnexoIVB(filePath: string): Promise<PersonnelRow[]> {
  const wb = readSpreadsheet(filePath);
  const rows = asRowsNamed(wb, 'AnexoIV-b');
  const out: PersonnelRow[] = [];
  for (let r = 16; r < rows.length; r++) {
    const row = rows[r]!;
    const cargo = String(row[0] ?? '').trim();
    if (!cargo || /^total/i.test(cargo)) continue;
    const optante = Number(row[1]) || 0, integral = Number(row[2]) || 0, semVinculo = Number(row[4]) || 0, vagos = Number(row[5]) || 0;
    if (!optante && !integral && !semVinculo && !vagos) continue; // ex. "FG-1" sem nenhum dado real
    if (optante) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_B' });
  }
  const totalGeral = rows.find(r => /^TOTAL GERAL/i.test(String(r[0] ?? '')));
  if (!totalGeral) throw new Error('TJPA Anexo IV-b: linha TOTAL GERAL não encontrada');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const comVinculo = sum('OCUPADO_COM_VINCULO_OPTANTE') + sum('OCUPADO_COM_VINCULO_INTEGRAL');
  const expectedComVinculo = (Number(totalGeral[1]) || 0) + (Number(totalGeral[2]) || 0);
  if (comVinculo !== expectedComVinculo) throw new Error(`TJPA Anexo IV-b: com vínculo efetivo não bate (${comVinculo} vs ${expectedComVinculo})`);
  if (sum('OCUPADO_SEM_VINCULO') !== (Number(totalGeral[4]) || 0)) throw new Error('TJPA Anexo IV-b: sem vínculo efetivo não bate com TOTAL GERAL');
  if (sum('VAGO') !== (Number(totalGeral[5]) || 0)) throw new Error('TJPA Anexo IV-b: vagos não bate com TOTAL GERAL');
  return out;
}

/** e) cargos de magistrados: grade flat por código+cargo ("100001-Desembargador(a)"), cada coluna
 * (Ocupados/Vagos/Aposentados/Instituidores/Beneficiários) repetida em 3 colunas mescladas na planilha —
 * só a 1ª de cada trinca tem valor real, as outras 2 são decorativas (mesclagem do Excel). */
export async function parseAnexoIVE(filePath: string): Promise<PersonnelRow[]> {
  const wb = readSpreadsheet(filePath);
  const rows = asRowsNamed(wb, 'AnexoIV-e');
  const out: PersonnelRow[] = [];
  for (let r = 14; r < rows.length; r++) {
    const row = rows[r]!;
    const raw = String(row[0] ?? '').trim();
    if (!raw || /^TOTAL/i.test(raw)) break;
    const cargo = (/^\d+-(.+)$/.exec(raw)?.[1] ?? raw).trim();
    const ocupados = Number(row[1]) || 0, vagos = Number(row[4]) || 0, aposentados = Number(row[10]) || 0, instituidores = Number(row[13]) || 0, beneficiarios = Number(row[19]) || 0;
    if (ocupados) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO', headcount: ocupados, sourceAnnex: 'ANEXO_IV_E' });
    if (vagos) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_E' });
    if (aposentados) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'INATIVO_APOSENTADO', headcount: aposentados, sourceAnnex: 'ANEXO_IV_E' });
    if (instituidores) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'INSTITUIDOR_PENSAO', headcount: instituidores, sourceAnnex: 'ANEXO_IV_E' });
    if (beneficiarios) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios, sourceAnnex: 'ANEXO_IV_E' });
  }
  const totalRow = rows.find(r => /^TOTAL$/i.test(String(r[0] ?? '').trim()));
  if (!totalRow) throw new Error('TJPA Anexo IV-e: linha TOTAL não encontrada');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  if (sum('OCUPADO') !== (Number(totalRow[1]) || 0)) throw new Error('TJPA Anexo IV-e: ocupados não bate com TOTAL');
  if (sum('VAGO') !== (Number(totalRow[4]) || 0)) throw new Error('TJPA Anexo IV-e: vagos não bate com TOTAL');
  if (sum('INATIVO_APOSENTADO') !== (Number(totalRow[10]) || 0)) throw new Error('TJPA Anexo IV-e: aposentados não bate com TOTAL');
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: Incisos I-VI, cada um com linhas "<alínea>-<letra>" (ex. "I-A", "VI-D") e uma linha de rollup
 * "TOTAL" (coluna 0 vazia) ao final — usada aqui só pra conferência, nunca somada de novo. Valores ausentes
 * (ex. "I-D" sem precatório aplicável, "V-C" sem investimento no mês) tratados como 0, nunca omitidos. */
export async function parseAnexoI(filePath: string): Promise<FinanceRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const out: FinanceRow[] = [];
  let inciso = '';
  let runningTotal = 0, fileTotal = 0;
  for (const row of rows) {
    const c0 = String(row[0] ?? '').trim();
    if (/^Inciso/i.test(c0)) { inciso = c0; continue; }
    if (c0 === 'Alínea') continue;
    if (!c0 && String(row[1] ?? '').trim() === 'TOTAL') { fileTotal += Number(row[2]) || 0; continue; }
    if (!/^[IVX]+-[A-Z]$/i.test(c0)) continue;
    const label = String(row[1] ?? '').trim();
    const amount = Number(row[2]) || 0;
    if (!label) continue;
    out.push({ account: `${c0} — ${label}`, category: inciso || 'Sem seção identificada', amountReais: amount });
    runningTotal += amount;
  }
  if (Math.abs(runningTotal - fileTotal) > 0.01) throw new Error(`TJPA Anexo I: soma das alíneas (${runningTotal}) não bate com soma dos TOTAL do arquivo (${fileTotal})`);
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }
const MONTHS_PT = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const parseBrAmount = (v: unknown): number => {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
};
const formatCnpj = (digits: string) => `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;

/** "Valores Pagos aos Contratados": formato largo (1 linha por credor×contrato×natureza, 1 coluna por mês
 * JANEIRO/2026..SETEMBRO/2026 + coluna final sempre vazia, ignorada). DOCUMENTO vem em dígitos crus sem
 * pontuação — 14 dígitos = CNPJ (formatado aqui pra consistência com os outros tribunais), 11 dígitos = CPF
 * de pessoa física: NUNCA armazenado, nem mascarado — só o nome do credor é gravado (mesma regra do TJBA).
 * Valores em texto no formato brasileiro ("130.387,50") — primeira vez nesta série que os valores vêm como
 * string, não número nativo. Sem linha TOTAL ao final (249 linhas = 1 cabeçalho + 248 credores, confirmado
 * pela distribuição real de tamanho de documento: 237 CNPJ + 11 CPF = 248). */
export async function parseContratados(filePath: string): Promise<SupplierPaymentRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const header = (rows[0] ?? []).map(v => String(v ?? '').trim().toUpperCase());
  const monthCols: Array<{ col: number; month: number }> = [];
  for (let c = 0; c < header.length; c++) {
    const m = MONTHS_PT.findIndex(mm => header[c]!.includes(mm));
    if (m >= 0) monthCols.push({ col: c, month: m + 1 });
  }
  if (!monthCols.length) throw new Error('TJPA Contratados: nenhuma coluna de mês reconhecida no cabeçalho — layout pode ter mudado');
  const out: SupplierPaymentRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const docDigits = String(row[0] ?? '').trim().replace(/\D/g, '');
    const supplierName = String(row[1] ?? '').trim();
    if (!supplierName || !docDigits) continue;
    const supplierCnpj = docDigits.length === 14 ? formatCnpj(docDigits) : null; // 11 dígitos = CPF, nunca armazenado
    const expenseDescription = String(row[4] ?? '').trim();
    for (const { col, month } of monthCols) {
      const amount = parseBrAmount(row[col]);
      if (amount) out.push({ supplierName, supplierCnpj, expenseDescription, month, amountReais: amount });
    }
  }
  return out;
}
