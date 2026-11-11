import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * TJRS — Tribunal de Justiça do Rio Grande do Sul (P14.27, 12º dos 27 TJs). Portal de transparência com URL
 * fixa por mês para cada anexo (`www.tjrs.jus.br/static/{ano}/{mes}/{YYYY-MM}-<relatorio>.csv`), descoberta
 * via a página de listagem de cada tema — mesmo padrão do TJES/TJGO (URL previsível por data), mas aqui em
 * CSV estruturado desde a origem (nunca precisou de Playwright nem de parser de PDF, só `fetch` puro).
 * Arquivos em `windows-1252` (Latin-1), não UTF-8 — confirmado ao vivo (acentos viravam "�" sem decodificar
 * explicitamente). "Relação de Contratados" (fornecedores) tem uma excentricidade real de exportação: cada
 * linha de dado vem com a linha INTEIRA entre aspas (não só os campos com vírgula), com aspas internas
 * duplicadas (`""`) — layout nunca visto nos 11 tribunais anteriores, exige desembrulhar antes de tratar como
 * CSV normal.
 */

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; text: string }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`TJRS download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), text: new TextDecoder('windows-1252').decode(buf) };
}

const parseBR = (s: string | undefined): number => {
  const t = (s ?? '').trim();
  if (!t || t === '-') return 0;
  return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
};
const splitSemi = (line: string): string[] => line.split(';').map(c => c.trim());

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

/** Anexo IV-A: CSV ";"-delimitado, linha por (carreira,padrão) — carreira SEMPRE repetida (sem carry-forward
 * por rowspan, diferente do TJPI). Carreiras com mais de 1 padrão terminam numa linha rollup ("** TOTALIZADOR
 * **" na Escolaridade, ou "**" no Padrão pra carreira de linha única) com os totais já somados daquela
 * carreira. Comparando a soma com/sem essas linhas de rollup contra "T O T A L  G E R A L" (a própria fonte
 * espaça cada letra, nunca "TOTAL GERAL" contíguo) descobri que as 2 somas têm regras DIFERENTES por coluna:
 * Estáveis/Não-Estáveis/Aposentados/Instituidores/Beneficiários batem exatamente somando SÓ as linhas de
 * DETALHE (rollup excluído — senão duplicaria, já que o rollup é a soma dos detalhes); já Vagos bate exatamente
 * somando TODAS as linhas sem filtro nenhum (a maior parte de Vagos só existe no rollup — vacância não é
 * atribuída a um padrão específico — mas uma fração pequena aparece em linhas de detalhe também, nenhuma
 * regra simples de "só rollup" cobre os 2 casos). Carreiras de linha única (ex. "Médico Judiciário") não têm
 * detalhe separado — por desenho da PRÓPRIA fonte ficam de fora da soma de Estáveis/etc. (confirmado: só
 * excluindo TODO rollup, sem exceção nenhuma, a soma bate exatamente com T O T A L GERAL). */
export function parseAnexoIVA(csv: string): PersonnelRow[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  let totalGeral: string[] | null = null;
  let afterHeader = false;
  const rows: { career: string; isRollup: boolean; cells: string[] }[] = [];
  for (const line of lines) {
    const cells = splitSemi(line);
    if (cells[0] === 'Carreira' && cells[1] === 'Padrão') { afterHeader = true; continue; }
    if (!afterHeader) continue;
    if (!cells[0] && /^TOTALGERAL$/i.test((cells[1] ?? '').replace(/\s+/g, ''))) { totalGeral = cells; continue; }
    const career = cells[0]!.trim();
    if (!career) continue;
    const isRollup = cells[2] === '** TOTALIZADOR **' || cells[1] === '**';
    rows.push({ career, isRollup, cells });
  }
  const field = (cells: string[], i: number) => parseBR(cells[i]);
  const sums = new Map<string, number[]>(); // career -> [estaveis,naoEstaveis,vagos,aposentados,instituidores,beneficiarios]
  const add = (career: string, vals: number[]) => {
    const cur = sums.get(career) ?? [0, 0, 0, 0, 0, 0];
    sums.set(career, cur.map((v, i) => v + vals[i]!));
  };
  for (const { career, isRollup, cells } of rows) {
    const estaveis = field(cells, 3), naoEstaveis = field(cells, 4), vagos = field(cells, 6), aposentados = field(cells, 8), instituidores = field(cells, 9), beneficiarios = field(cells, 11);
    add(career, isRollup ? [0, 0, vagos, 0, 0, 0] : [estaveis, naoEstaveis, vagos, aposentados, instituidores, beneficiarios]);
  }
  const out: PersonnelRow[] = [];
  for (const [career, [estaveis, naoEstaveis, vagos, aposentados, instituidores, beneficiarios]] of sums) {
    if (estaveis) out.push({ careerTrack: career, positionTitle: career, classLevel: null, status: 'ATIVO_ESTAVEL', headcount: estaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: career, positionTitle: career, classLevel: null, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: career, positionTitle: career, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_A' });
    if (aposentados) out.push({ careerTrack: career, positionTitle: career, classLevel: null, status: 'INATIVO_APOSENTADO', headcount: aposentados!, sourceAnnex: 'ANEXO_IV_A' });
    if (instituidores) out.push({ careerTrack: career, positionTitle: career, classLevel: null, status: 'INSTITUIDOR_PENSAO', headcount: instituidores!, sourceAnnex: 'ANEXO_IV_A' });
    if (beneficiarios) out.push({ careerTrack: career, positionTitle: career, classLevel: null, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios!, sourceAnnex: 'ANEXO_IV_A' });
  }
  if (!totalGeral) throw new Error('TJRS Anexo IV-A: linha TOTAL GERAL não encontrada — layout pode ter mudado');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { estaveis: sum('ATIVO_ESTAVEL'), naoEstaveis: sum('ATIVO_NAO_ESTAVEL'), vagos: sum('VAGO'), aposentados: sum('INATIVO_APOSENTADO'), instituidores: sum('INSTITUIDOR_PENSAO'), beneficiarios: sum('BENEFICIARIO_PENSAO') };
  const expected = { estaveis: parseBR(totalGeral[3]), naoEstaveis: parseBR(totalGeral[4]), vagos: parseBR(totalGeral[6]), aposentados: parseBR(totalGeral[8]), instituidores: parseBR(totalGeral[9]), beneficiarios: parseBR(totalGeral[11]) };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJRS Anexo IV-A: soma não bate com TOTAL GERAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

/** Anexo IV-B: CSV ";"-delimitado, 2 seções ("Cargos em Comissão"/"Funções de Confiança"), cada uma com 1
 * linha por código de cargo e terminando numa linha "Total" (soma da seção) — "Total Geral" confere a soma
 * de tudo. Mesmo layout de colunas (Optante/Integral/Subtotal/SemVínculo/Vagos/Total) e mesmo vocabulário de
 * status já usados no TJPA/TJPE/TJPI. */
export function parseAnexoIVB(csv: string): PersonnelRow[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  const out: PersonnelRow[] = [];
  let totalGeral: string[] | null = null;
  for (const line of lines) {
    const cells = splitSemi(line);
    if (!cells[0]) continue;
    if (/^total\s*geral/i.test(cells[0])) { totalGeral = cells; continue; }
    if (/^total/i.test(cells[0])) continue; // "Total" de seção — só conferência, pulada
    if (/^(Cargos em Comiss|Fun[çc][õo]es de Confian)/i.test(cells[0])) continue; // rótulo de seção, sem dado
    if (/^;?Ocupados|Com Vínculo|Optante|Cargo Efetivo/i.test(cells[0])) continue; // linhas de cabeçalho mesclado
    const [optante, integral, , semVinculo, vagos] = [1, 2, 3, 4, 5].map(i => parseBR(cells[i]));
    if (!optante && !integral && !semVinculo && !vagos) continue;
    const cargo = cells[0]!;
    if (optante) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante!, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral!, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo!, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_B' });
  }
  if (!totalGeral) throw new Error('TJRS Anexo IV-B: linha "Total Geral" não encontrada');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { optante: sum('OCUPADO_COM_VINCULO_OPTANTE'), integral: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  const expected = { optante: parseBR(totalGeral[1]), integral: parseBR(totalGeral[2]), semVinculo: parseBR(totalGeral[4]), vagos: parseBR(totalGeral[5]) };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJRS Anexo IV-B: soma não bate com Total Geral. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: CSV ";"-delimitado com 1 coluna por mês do ano (JAN..DEZ) + TOTAL + RAP — usa só a coluna do mês
 * de referência (índice fixo, confirmado contra "Período: DD/MM/AAAA" no cabeçalho do próprio arquivo).
 * Incisos como linhas de quebra ("Inciso N ..."), linha "TOTAL" por inciso usada pra conferência. */
export function parseAnexoI(csv: string, monthColumnIndex: number): FinanceRow[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  const out: FinanceRow[] = [];
  let inciso = '';
  let runningTotal = 0, fileTotal = 0;
  for (const line of lines) {
    const cells = splitSemi(line);
    if (/^Inciso\s/i.test(cells[0] ?? '')) { inciso = cells[0]!; continue; }
    if (cells[0] === 'Alínea') continue;
    if (/^total$/i.test(cells[0] ?? '')) { fileTotal += parseBR(cells[monthColumnIndex]); continue; }
    if (!/^[a-z]$/i.test(cells[0] ?? '')) continue;
    const [alinea, descricao] = cells;
    if (!alinea || !descricao) continue;
    const amount = parseBR(cells[monthColumnIndex]);
    out.push({ account: `${alinea} — ${descricao}`, category: inciso || 'Sem seção identificada', amountReais: amount });
    runningTotal += amount;
  }
  if (Math.abs(runningTotal - fileTotal) > 0.01) throw new Error(`TJRS Anexo I: soma das alíneas (${runningTotal}) não bate com soma dos TOTAL (${fileTotal})`);
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }
const MONTHS_PT = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const formatCnpj = (digits: string) => `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;

/** "Relação de Contratados": cada linha de DADO (nunca o cabeçalho) vem com a linha INTEIRA entre aspas, com
 * aspas internas duplicadas (`""value""`) — excentricidade de exportação nunca vista nos 11 tribunais
 * anteriores desta série. Desembrulhada removendo as aspas externas e desfazendo o escape antes de tratar
 * como CSV normal (aí sim os valores monetários — que têm vírgula decimal — ficam corretamente entre aspas
 * simples, splitáveis com segurança). DOCUMENTO em dígitos crus: 14 = CNPJ (reformatado), 11 = CPF de pessoa
 * física (nunca armazenado, nem mascarado — mesma regra do TJBA/TJPA/TJPE). */
export function parseContratados(csv: string): SupplierPaymentRow[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  const header = splitCsvLine(lines[0]!).map(c => c.toUpperCase());
  const monthCols: Array<{ col: number; month: number }> = [];
  for (let c = 0; c < header.length; c++) {
    const m = MONTHS_PT.findIndex(mm => header[c]!.includes(mm));
    if (m >= 0) monthCols.push({ col: c, month: m + 1 });
  }
  if (!monthCols.length) throw new Error('TJRS Contratados: nenhuma coluna de mês reconhecida no cabeçalho');
  const out: SupplierPaymentRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    let line = lines[i]!.trim();
    if (line.startsWith('"') && line.endsWith('"')) line = line.slice(1, -1).replace(/""/g, '"');
    const cells = splitCsvLine(line);
    const docDigits = (cells[0] ?? '').replace(/\D/g, '');
    const supplierName = (cells[1] ?? '').trim();
    if (!supplierName || !docDigits) continue;
    const supplierCnpj = docDigits.length === 14 ? formatCnpj(docDigits) : null; // 11 dígitos = CPF, nunca armazenado
    const expenseDescription = (cells[4] ?? '').trim();
    for (const { col, month } of monthCols) {
      const amount = parseBR(cells[col]);
      if (amount) out.push({ supplierName, supplierCnpj, expenseDescription, month, amountReais: amount });
    }
  }
  return out;
}

/** Split de CSV simples respeitando aspas (só precisa lidar com vírgula dentro de campo entre aspas — não
 * há aspas aninhadas depois do desembrulho da linha inteira em `parseContratados`). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}
