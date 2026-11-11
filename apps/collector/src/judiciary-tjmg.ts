/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';
import { chromium } from 'playwright';

/**
 * TJMG — Tribunal de Justiça de Minas Gerais (P14.28, 13º dos 27 TJs). Pessoal (Anexo IV-A/B) em PDF real,
 * uma única página flat (sem padrão/nível por carreira, diferente de quase todo tribunal anterior — carreiras
 * já vêm pré-agregadas pela própria fonte). Financeiro (Anexo I) é um app JSF (`www8.tjmg.jus.br/transparencia/
 * relatorios/execucaoOrcamentaria.jsf`) que devolve o ANO INTEIRO (Jan-mês corrente) numa única consulta —
 * usa só a coluna do mês mais recente, igual aos tribunais anteriores. Fornecedores (`despesaFornecedores.jsf`)
 * exige CNPJ ou nome específico pra consultar (sem opção de listar todos) — TJMG fica sem essa camada, mesma
 * decisão já tomada pro TJPI/TJPE quando a fonte não permite listagem em massa.
 */

async function downloadBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`TJMG download HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string }> {
  await fs.mkdir(destDir, { recursive: true });
  const buf = await downloadBuf(url);
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

const parseBR = (s: string | undefined): number => {
  const t = (s ?? '').trim();
  if (!t || t === '-' || t === '--') return 0;
  return Number(t.replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')) || 0;
};

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

/** Anexo IV-a: PDF de 1 página só, já pré-agregado por carreira (sem padrão/nível individual, diferente de
 * quase todo tribunal anterior) — cada linha de carreira tem os 9 números direto, linha "TOTAL" só pra
 * conferência. */
export async function parseAnexoIVA(pdfPath: string): Promise<PersonnelRow[]> {
  const parser = new PDFParse({ data: readFileSync(pdfPath) });
  const text = (await parser.getText()).text;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: PersonnelRow[] = [];
  let totalRow: number[] | null = null;
  const lineRe = /^(.+?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)\s+([\d.,]+|--?)$/;
  for (const line of lines) {
    const m = lineRe.exec(line);
    if (!m) continue;
    const label = m[1]!.trim();
    const nums = m.slice(2, 11).map(parseBR);
    if (/^TOTAL$/i.test(label)) { totalRow = nums; continue; }
    if (!label || label === 'CARREIRA / CLASSE' || /^Estáveis/i.test(label)) continue;
    const [estaveis, naoEstaveis, , vagos, , aposentados, instituidores, , beneficiarios] = nums;
    if (estaveis) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'ATIVO_ESTAVEL', headcount: estaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_A' });
    if (aposentados) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'INATIVO_APOSENTADO', headcount: aposentados!, sourceAnnex: 'ANEXO_IV_A' });
    if (instituidores) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'INSTITUIDOR_PENSAO', headcount: instituidores!, sourceAnnex: 'ANEXO_IV_A' });
    if (beneficiarios) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios!, sourceAnnex: 'ANEXO_IV_A' });
  }
  if (!totalRow) throw new Error('TJMG Anexo IV-a: linha TOTAL não encontrada — layout pode ter mudado');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { estaveis: sum('ATIVO_ESTAVEL'), naoEstaveis: sum('ATIVO_NAO_ESTAVEL'), vagos: sum('VAGO'), aposentados: sum('INATIVO_APOSENTADO'), instituidores: sum('INSTITUIDOR_PENSAO'), beneficiarios: sum('BENEFICIARIO_PENSAO') };
  const expected = { estaveis: totalRow[0], naoEstaveis: totalRow[1], vagos: totalRow[3], aposentados: totalRow[5], instituidores: totalRow[6], beneficiarios: totalRow[8] };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJMG Anexo IV-a: soma não bate com TOTAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

/** Anexo IV-b: PDF de 1 página só, flat por cargo/função — linhas "Total cargos"/"Total funções" (subtotal de
 * seção) e "TOTAL" (geral) só pra conferência. */
export async function parseAnexoIVB(pdfPath: string): Promise<PersonnelRow[]> {
  const parser = new PDFParse({ data: readFileSync(pdfPath) });
  const text = (await parser.getText()).text;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: PersonnelRow[] = [];
  let totalRow: number[] | null = null;
  const lineRe = /^(.+?)\s+([\d.,]+|-)\s+([\d.,]+|-)\s+([\d.,]+|-)\s+([\d.,]+|-)\s+([\d.,]+|-)\s+([\d.,]+|-)$/;
  for (const line of lines) {
    const m = lineRe.exec(line);
    if (!m) continue;
    const label = m[1]!.trim();
    const nums = m.slice(2, 8).map(parseBR);
    if (/^TOTAL$/i.test(label)) { totalRow = nums; continue; }
    if (/^Total (cargos|funç[õo]es)$/i.test(label)) continue;
    if (!label) continue;
    const [optante, integral, , semVinculo, vagos] = nums;
    if (optante) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante!, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral!, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo!, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_B' });
  }
  if (!totalRow) throw new Error('TJMG Anexo IV-b: linha TOTAL não encontrada');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { optante: sum('OCUPADO_COM_VINCULO_OPTANTE'), integral: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  const expected = { optante: totalRow[0], integral: totalRow[1], semVinculo: totalRow[3], vagos: totalRow[4] };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJMG Anexo IV-b: soma não bate com TOTAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }
type PageEvent = { type: 'title'; text: string } | { type: 'table'; rows: string[][] };

/** Consulta o app JSF de Execução Orçamentária-Financeira (Anexo I) pro ano dado — devolve o ano inteiro
 * (Jan até o mês corrente) numa única consulta. Captura os títulos "Inciso N – ..." e as tabelas numa ÚNICA
 * varredura do DOM em ordem de documento (nunca 2 extrações separadas) — nenhum Inciso tem garantia de vir
 * logo após seu próprio título (um Inciso pode não ter tabela de dados no período), o que quebraria qualquer
 * pareamento posicional simples entre "lista de títulos" e "lista de tabelas". */
export async function scrapeAnexoI(ano: number): Promise<PageEvent[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://www8.tjmg.jus.br/transparencia/relatorios/execucaoOrcamentaria.jsf', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.selectOption('#formulario\\:exercicio', String(ano));
    await page.click('input[type=submit]');
    await page.waitForTimeout(3000);
    const events = await page.evaluate(() => {
      // 2 buscas simples (document order natural do querySelectorAll), depois intercaladas por posição real
      // no DOM (`compareDocumentPosition`) — mais fácil de depurar que um TreeWalker com filtro customizado.
      const tableEls = [...document.querySelectorAll('table')].filter(t => t.querySelectorAll('tr').length > 1);
      const titleEls = [...document.querySelectorAll('body *')].filter(el => el.children.length === 0 && /^Inciso\s+[IVX]+\s*[–-]/.test((el.textContent ?? '').trim()));
      type Marked = { el: Element; type: 'table' | 'title' };
      const marked: Marked[] = [...tableEls.map(el => ({ el, type: 'table' as const })), ...titleEls.map(el => ({ el, type: 'title' as const }))];
      marked.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
      return marked.map(m => m.type === 'table'
        ? { type: 'table' as const, rows: [...m.el.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('td,th')].map(td => (td.textContent ?? '').trim())) }
        : { type: 'title' as const, text: (m.el.textContent ?? '').trim() });
    });
    return events;
  } finally {
    await browser.close();
  }
}

/** Processa a sequência de eventos (títulos + tabelas, em ordem real do documento) em FinanceRow — cada par
 * (tabela-rótulo, tabela-valor) adjacente pertence ao Inciso do ÚLTIMO título visto antes dele. O Inciso V
 * (Repasses) reusa os MESMOS rótulos de alínea dos Incisos I-IV (Pessoal e Encargos/Custeio/Investimentos/
 * Inversões Financeiras) pra suas próprias linhas — são dados distintos (repasse, não despesa), nunca um
 * resumo duplicado; tratado igual a qualquer outro Inciso. Cada tabela tem sua própria linha TOTAL (alínea
 * vazia) — usada só pra conferência (soma das linhas de conta == TOTAL), nunca gravada como FinanceRow. Usa a
 * coluna do mês de referência (não a última, "Total" acumulado do ano) como valor. */
export function parseAnexoI(events: PageEvent[], referenceMonthIndex: number): FinanceRow[] {
  const out: FinanceRow[] = [];
  let currentInciso = '';
  let tablePairCount = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    if (ev.type === 'title') { currentInciso = ev.text; continue; }
    // a 1ª tabela da página (Sigla/Nome do Órgão/...) tem a mesma forma de 2 colunas de uma tabela-rótulo
    // real, mas nenhuma linha começa com uma letra única (alínea) — nunca tratada como início de par.
    const looksLikeLabelTable = ev.rows.some(r => /^[a-z]$/i.test((r[0] ?? '').trim()));
    if (!looksLikeLabelTable) continue;
    const next = events[i + 1];
    if (!next || next.type !== 'table') continue;
    const labelTable = ev.rows, valueTable = next.rows;
    i++; // consome o par (tabela-valor) também
    if (labelTable.length !== valueTable.length) continue;
    tablePairCount++;
    let tableTotal: number | null = null;
    let tableSum = 0;
    for (let r = 0; r < labelTable.length; r++) {
      const [alinea, discriminacao] = labelTable[r]!;
      const amount = parseBR(valueTable[r]![referenceMonthIndex]);
      if (!alinea || /^total$/i.test((discriminacao ?? alinea ?? '').trim())) { tableTotal = amount; continue; }
      tableSum += amount;
      out.push({ account: `${alinea} — ${discriminacao}`, category: currentInciso, amountReais: amount });
    }
    if (tableTotal === null) throw new Error(`TJMG Anexo I: tabela do "${currentInciso}" sem linha TOTAL — layout pode ter mudado`);
    if (Math.abs(tableSum - tableTotal) > 0.01) {
      throw new Error(`TJMG Anexo I: soma do "${currentInciso}" não bate com a linha TOTAL. calculado=${tableSum} esperado=${tableTotal}`);
    }
  }
  if (tablePairCount === 0) throw new Error('TJMG Anexo I: nenhuma tabela de dados encontrada — layout pode ter mudado');
  return out;
}
