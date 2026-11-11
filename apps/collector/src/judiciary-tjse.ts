import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

/**
 * TJSE — Tribunal de Justiça de Sergipe (P14.30, 15º dos 27 TJs). Pessoal: página HTML server-renderizada
 * (`www.tjse.jus.br/csp/tjse/cnj/anexoivTJSE.csp`, app legado InterSystems Caché/CSP) — parece um widget JS
 * ("ActiveWidgets Grid") à primeira vista, mas essa parte do script NUNCA é usada pra Seção A/B: os dados já
 * vêm embutidos como `<table>` estático no HTML da resposta, delimitados por comentários
 * (`<!--Anexo iva-->`...`<!--Final Anexo iva-->`, idem "ivb") — um GET simples (sem sessão/form) já devolve o
 * quadrimestre mais recente fechado (confirmado: `<option ... selected>` na própria página aponta pro período
 * certo sem precisar POSTar nada). Financeiro e fornecedores: XLSX mensal limpo, 1 arquivo por mês, estrutura
 * em linha por Inciso/Alínea com coluna "Total" CUMULATIVA (soma corrida até aquela linha, não por categoria) —
 * a mais limpa de toda a série até aqui (nunca precisou de PDF nem geometria posicional).
 *
 * **Bug real confirmado na própria fonte (não é erro de parsing)**: a linha "TOTAL - GERAL" da Seção A relata
 * Subtotal=2390/Total=2519, mas Estáveis(2105)+Não-Estáveis(155)=2260≠2390 — a PRÓPRIA linha de total é
 * internamente inconsistente (dif. de exatamente 130, que é o valor de Não-Estáveis da carreira "Técnico
 * Judiciário" — parece um bug de cache/agregação no backend do TJSE). Confirmado 2x via parsing estruturado
 * (não é artefato de extração de texto). Por isso a verificação usa SÓ os campos independentes e corretos
 * (Estáveis/Não-Estáveis/Vagos/Aposentados/Instituidores/Beneficiários — que todos batem exatamente), igual ao
 * padrão já usado em todo tribunal anterior da série (nenhum collector desta série jamais verificou contra
 * Subtotal/Total, só contra os campos "reais" independentes — aqui essa escolha se mostrou decisiva).
 *
 * **Arquivo mensal de fornecedores é cumulativo, não isolado**: cada arquivo publicado (`pag_forn_tjse_tjse_AAAA-MM.xls`)
 * traz 12 colunas de mês (JAN..DEZ) do ANO INTEIRO, mas só preenche as colunas até o mês da publicação — ex.:
 * o arquivo "2026-09" tem JAN..SET preenchidos e OUT..DEZ zerados (confirmado comparando com o arquivo "2026-01",
 * que só tinha JAN preenchido). Logo só o arquivo MAIS RECENTE publicado no ano precisa ser baixado — ele já
 * contém todos os meses anteriores.
 */

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; text: string; buf: Buffer }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`TJSE download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), text: buf.toString('utf8'), buf };
}

/** O XLSX de fornecedores NÃO tem formatação brasileira aplicada na célula (sem vírgula decimal) — vem como
 * número puro renderizado pelo `xlsx` com ponto decimal (ex. "17816.15"), diferente do Anexo I, que tem
 * formatação brasileira de verdade na própria planilha (ex. "50.369.057,58"). Distinguir pela presença de
 * vírgula: com vírgula = formato brasileiro (ponto milhar, vírgula decimal); sem vírgula = número puro
 * (ponto já é decimal, nunca milhar — confirmado contra a fonte: `xlsx` nunca insere separador de milhar). */
const parseBR = (s: string | undefined): number => {
  const t = (s ?? '').trim();
  if (!t) return 0;
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(t) || 0;
};

function extractBetween(html: string, startMarker: string, endMarker: string): string {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker, s);
  if (s < 0 || e < 0) throw new Error(`TJSE Anexo IV: marcador não encontrado (${startMarker} / ${endMarker}) — layout pode ter mudado`);
  return html.slice(s, e);
}

/** Cada "linha lógica" do HTML é o texto entre um `<tr...>` e o próximo — nunca depende de `</tr>` estar bem
 * formado (a própria fonte tem pelo menos 1 linha com `</tr>` faltando, ex. "TOTAL - CC" na Seção B). */
function htmlRows(segment: string): string[][] {
  const chunks = segment.split(/<tr[^>]*>/i).slice(1);
  return chunks.map(chunk => [...chunk.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]!.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()));
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

/** Seção A (cargos efetivos): 1 linha "TOTAL - <carreira>" por carreira com 9 colunas — Estáveis,Não-Estáveis,
 * Subtotal,Vagos,Total,Aposentados,Instituidores de Pensão,Total,Beneficiários de Pensão. Só as linhas TOTAL
 * por carreira são usadas (as linhas "Classe: X Padrão: Y" entre elas são detalhe redundante, mesmo nível de
 * granularidade já usado em todo tribunal anterior da série). */
export function parseAnexoIVA(html: string): PersonnelRow[] {
  const seg = extractBetween(html, '<!--Anexo iva-->', '<!--Final Anexo iva-->');
  const rows = htmlRows(seg);
  let totalGeral: number[] | null = null;
  const careerTotals: Array<{ label: string; vals: number[] }> = [];
  for (const r of rows) {
    if (!r[0] || !/^TOTAL - /i.test(r[0])) continue;
    const vals = r.slice(1).map(parseBR);
    if (/^TOTAL - GERAL$/i.test(r[0])) { totalGeral = vals; continue; }
    careerTotals.push({ label: r[0].replace(/^TOTAL - /i, '').trim(), vals });
  }
  if (!totalGeral) throw new Error('TJSE Anexo IV-a: linha "TOTAL - GERAL" não encontrada — layout pode ter mudado');
  if (!careerTotals.length) throw new Error('TJSE Anexo IV-a: nenhuma linha de carreira encontrada — layout pode ter mudado');

  const out: PersonnelRow[] = [];
  for (const { label, vals } of careerTotals) {
    const [estaveis, naoEstaveis, , vagos, , aposentados, instituidores, , beneficiarios] = vals;
    if (estaveis) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'ATIVO_ESTAVEL', headcount: estaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_A' });
    if (aposentados) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'INATIVO_APOSENTADO', headcount: aposentados!, sourceAnnex: 'ANEXO_IV_A' });
    if (instituidores) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'INSTITUIDOR_PENSAO', headcount: instituidores!, sourceAnnex: 'ANEXO_IV_A' });
    if (beneficiarios) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios!, sourceAnnex: 'ANEXO_IV_A' });
  }
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { estaveis: sum('ATIVO_ESTAVEL'), naoEstaveis: sum('ATIVO_NAO_ESTAVEL'), vagos: sum('VAGO'), aposentados: sum('INATIVO_APOSENTADO'), instituidores: sum('INSTITUIDOR_PENSAO'), beneficiarios: sum('BENEFICIARIO_PENSAO') };
  const [gEstaveis, gNaoEstaveis, , gVagos, , gAposentados, gInstituidores, , gBeneficiarios] = totalGeral;
  const expected = { estaveis: gEstaveis, naoEstaveis: gNaoEstaveis, vagos: gVagos, aposentados: gAposentados, instituidores: gInstituidores, beneficiarios: gBeneficiarios };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJSE Anexo IV-a: soma não bate com TOTAL GERAL (campos independentes). calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

/** Seção B (cargos em comissão/função de confiança): 1 linha por código de cargo (CCE-N, FC-N, FCE-NN...), 6
 * colunas — Optante,Integral,Subtotal,SemVínculo,Vagos,Total. Linhas "TOTAL - CC"/"TOTAL - FC" são só subtotal
 * de seção (puladas); "TOTAL - GERAL" é a conferência final. */
export function parseAnexoIVB(html: string): PersonnelRow[] {
  const seg = extractBetween(html, '<!--Anexo ivb-->', '<!--Final Anexo ivb-->');
  const rows = htmlRows(seg);
  let totalGeral: number[] | null = null;
  const cargoRows: Array<{ label: string; vals: number[] }> = [];
  for (const r of rows) {
    if (!r[0]) continue;
    if (/^TOTAL - GERAL$/i.test(r[0])) { totalGeral = r.slice(1).map(parseBR); continue; }
    if (/^TOTAL - (CC|FC)$/i.test(r[0])) continue;
    if (/^(Cargo|Optante|Com V|Ocupados)/i.test(r[0])) continue;
    if (r.length < 7) continue;
    cargoRows.push({ label: r[0], vals: r.slice(1, 7).map(parseBR) });
  }
  if (!totalGeral) throw new Error('TJSE Anexo IV-b: linha "TOTAL - GERAL" não encontrada — layout pode ter mudado');
  if (!cargoRows.length) throw new Error('TJSE Anexo IV-b: nenhuma linha de cargo encontrada — layout pode ter mudado');

  const out: PersonnelRow[] = [];
  for (const { label, vals } of cargoRows) {
    const [optante, integral, , semVinculo, vagos] = vals;
    if (optante) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante!, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral!, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo!, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_B' });
  }
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { optante: sum('OCUPADO_COM_VINCULO_OPTANTE'), integral: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  const [gOptante, gIntegral, , gSemVinculo, gVagos] = totalGeral;
  const expected = { optante: gOptante, integral: gIntegral, semVinculo: gSemVinculo, vagos: gVagos };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJSE Anexo IV-b: soma não bate com TOTAL GERAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: XLSX já em linha por Inciso/Alínea, 1 arquivo por mês, com coluna "Valores em R$" (valor isolado da
 * alínea) e "Total" (soma CORRIDA — cumulativa linha a linha, alcança o total geral só na última linha). */
export function parseAnexoI(buf: Buffer): FinanceRow[] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: false });
  const header = rows[0]!.map(h => (h ?? '').toString().trim());
  const incisoIdx = header.indexOf('Descrição Modelo');
  const alineaIdx = header.indexOf('Alínea');
  const descIdx = header.indexOf('Descrição');
  const valorIdx = header.indexOf('Valores em R$');
  const totalIdx = header.indexOf('Total');
  if ([incisoIdx, alineaIdx, descIdx, valorIdx, totalIdx].some(i => i < 0)) throw new Error('TJSE Anexo I: colunas esperadas não encontradas — layout pode ter mudado');

  const out: FinanceRow[] = [];
  let runningTotal = 0, lastCumulative = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[alineaIdx]) continue;
    const inciso = (r[incisoIdx] ?? '').toString().trim();
    const alinea = (r[alineaIdx] ?? '').toString().trim();
    const descricao = (r[descIdx] ?? '').toString().trim();
    const amount = parseBR(r[valorIdx]);
    lastCumulative = parseBR(r[totalIdx]);
    out.push({ account: `${alinea} — ${descricao}`, category: inciso, amountReais: amount });
    runningTotal += amount;
  }
  if (!out.length) throw new Error('TJSE Anexo I: nenhuma linha de alínea encontrada — layout pode ter mudado');
  if (Math.abs(runningTotal - lastCumulative) > 0.01) throw new Error(`TJSE Anexo I: soma das alíneas (${runningTotal}) não bate com o TOTAL acumulado da última linha (${lastCumulative})`);
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }
const formatCnpj = (digits: string) => `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
const MONTH_HEADER_RE = /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4})$/i;
const MONTH_ORDER = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** "Contratados Pagos LDO": XLS mensal, mas CUMULATIVO pro ano inteiro (colunas JAN..DEZ, preenchidas só até o
 * mês de publicação — confirmado comparando o arquivo de setembro, que já tinha jan..set preenchidos, com o de
 * janeiro, que só tinha jan). Por isso só o arquivo MAIS RECENTE do ano é baixado. Linha "Total" por coluna
 * usada pra conferência (uma verificação por mês, não só uma soma geral). */
export function parseContratadosPagos(buf: Buffer): SupplierPaymentRow[] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: false });
  const headerRowIdx = rows.findIndex(r => (r[0] ?? '').toString().trim().startsWith('CPF/CNPJ'));
  if (headerRowIdx < 0) throw new Error('TJSE Contratados Pagos: linha de cabeçalho não encontrada — layout pode ter mudado');
  const header = rows[headerRowIdx]!.map(h => (h ?? '').toString().trim());
  const monthCols: Array<{ col: number; month: number }> = [];
  header.forEach((h, col) => { const m = MONTH_HEADER_RE.exec(h); if (m) monthCols.push({ col, month: MONTH_ORDER.indexOf(m[1]!.toUpperCase()) + 1 }); });
  if (!monthCols.length) throw new Error('TJSE Contratados Pagos: nenhuma coluna de mês reconhecida no cabeçalho');
  const natIdx = header.findIndex(h => /Natureza Despesa/i.test(h));

  const out: SupplierPaymentRow[] = [];
  const monthSums = new Map<number, number>();
  const expectedMonthTotals = new Map<number, number>();
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    if (/^total$/i.test(r[0]!.toString().trim())) { monthCols.forEach(({ col, month }) => expectedMonthTotals.set(month, parseBR(r[col]))); continue; }
    const docDigits = (r[0] ?? '').toString().replace(/\D/g, '');
    const supplierName = (r[1] ?? '').toString().trim();
    if (!supplierName || !docDigits) continue;
    const supplierCnpj = docDigits.length === 14 ? formatCnpj(docDigits) : null; // menos de 14 dígitos nunca é CNPJ válido — nunca forçado
    const expenseDescription = natIdx >= 0 ? (r[natIdx] ?? '').toString().trim() : '';
    for (const { col, month } of monthCols) {
      const amount = parseBR(r[col]);
      if (amount) { out.push({ supplierName, supplierCnpj, expenseDescription, month, amountReais: amount }); monthSums.set(month, (monthSums.get(month) ?? 0) + amount); }
    }
  }
  if (!out.length) throw new Error('TJSE Contratados Pagos: nenhuma linha de pagamento encontrada — layout pode ter mudado');
  for (const [month, expected] of expectedMonthTotals) {
    const got = monthSums.get(month) ?? 0;
    if (Math.abs(got - expected) > 0.5) throw new Error(`TJSE Contratados Pagos: soma do mês ${month} (${got}) não bate com a linha Total (${expected})`);
  }
  return out;
}
