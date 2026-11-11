/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { chromium } from 'playwright';

/**
 * TJPE — Tribunal de Justiça de Pernambuco (P14.25, 10º dos 27 TJs). Portal Liferay bem organizado, com uma
 * página real por alínea do Anexo IV e do Anexo I — mas os dados em si NUNCA existem como arquivo estático:
 * cada página embute um app ScriptCase (`scase.tjpe.jus.br/transparencia/ANEXO_4A|4B|1/`) que só devolve a
 * grade depois de escolher o período e clicar "Pesquisar" — SPA de verdade, sem URL de export utilizável (o
 * menu "Exportação" existe mas só abre um FORMULÁRIO de configuração de CSV/XML/JSON, não devolve o arquivo
 * direto; não vale o esforço de automatizar esse formulário). Por isso este coletor usa Playwright para
 * navegar e ler a grade renderizada diretamente — primeiro tribunal desta série sem nenhum arquivo bruto
 * salvo em D:, só o HTML da grade capturado linha a linha.
 *
 * O módulo `ContratosConvenios/cPagamentoContratados` (fornecedores) devolve 403 Forbidden mesmo navegando
 * pela própria página do portal (referer correto) — confirmado ao vivo, não contornado (seria bypass de
 * controle de acesso). TJPE fica sem a camada de fornecedores nesta coleta; pessoal e financeiro (Anexo I)
 * cobrem o pedido central ("quanto tá gastando, quantas pessoas").
 */

export interface RawGridRow { cls: string; cells: string[] }

/** Devolve as linhas cruas e o total de registros que a PRÓPRIA grade declara na paginação (ex. "[1 a 23 de
 * 117]" → 117) — usado pelo coletor (`p1425-tjpe-collect.ts`) pra confirmar que nenhuma página ficou pra trás,
 * já que estas grades não têm linha de rollup/TOTAL GERAL pra conferir os valores em si. */
async function scrapePaginatedGrid(appPath: string, dtLabel: string): Promise<{ rows: RawGridRow[]; declaredTotal: number | null }> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`https://scase.tjpe.jus.br/transparencia/${appPath}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.selectOption('#SC_dt_referencia', { label: dtLabel });
    await page.click('#sc_b_pesq_bot');
    await page.waitForTimeout(2500);

    const readGrid = async (): Promise<RawGridRow[]> => {
      const frame = page.frames().find(f => f.url().includes('nmgp_opcao=pesq'));
      if (!frame) throw new Error(`TJPE ${appPath}: iframe de resultado não encontrado após pesquisa`);
      return frame.evaluate(() => {
        const t = document.querySelector('table.scGridTabela');
        if (!t) return [];
        return [...t.querySelectorAll('tr')].map(tr => ({ cls: tr.className, cells: [...tr.querySelectorAll('td,th')].map(td => (td.textContent ?? '').trim()) }));
      });
    };
    const firstDataSignature = (rows: RawGridRow[]) => rows.find(r => r.cls.includes('scGridField'))?.cells.join('|') ?? '';

    const out: RawGridRow[] = [];
    let declaredTotal: number | null = null;
    let prevSignature = '';
    for (let guard = 0; guard < 30; guard++) {
      let rows = await readGrid();
      // a AJAX de paginação às vezes ainda não terminou quando o botão já ficou clicável de novo — se a
      // primeira linha de dado for IGUAL à da página anterior, a página visualmente não avançou ainda;
      // espera mais e tenta de novo antes de aceitar o conteúdo como a página nova.
      for (let retry = 0; retry < 6 && firstDataSignature(rows) === prevSignature && prevSignature !== ''; retry++) {
        await page.waitForTimeout(1000);
        rows = await readGrid();
      }
      out.push(...rows);
      prevSignature = firstDataSignature(rows);
      if (declaredTotal === null) {
        const frame = page.frames().find(f => f.url().includes('nmgp_opcao=pesq'))!;
        const footerText = await frame.evaluate(() => document.body.innerText);
        const m = /\[\s*\d+\s*a\s*\d+\s*de\s*(\d+)\s*\]/.exec(footerText);
        if (m) declaredTotal = Number(m[1]);
      }
      const frame = page.frames().find(f => f.url().includes('nmgp_opcao=pesq'))!;
      const forward = await frame.$('#forward_bot');
      const cls = forward ? await forward.getAttribute('class') : null;
      if (!forward || (cls ?? '').includes('disabled')) break;
      // `.click()` no elemento nem sempre dispara o handler de paginação de forma confiável (confirmado ao
      // vivo: cliques repetidos sem nenhum avanço de página) — chama o `onclick` do próprio botão direto via
      // JS, que é exatamente o que um clique real executaria, sem depender de "actionability" do Playwright.
      await frame.evaluate(() => {
        // jquery.blockUI (efeito visual de "bloquear a tela" durante o Ajax) quebra em algumas destas apps
        // (elemento que ele espera encontrar não existe) — e como ele quebra ANTES da chamada Ajax real de
        // paginação (`ajax_navigate` chama blockUI primeiro), a exceção interrompe a navegação inteira, não
        // só o efeito visual. Neutralizado virando no-op antes de disparar a navegação, nunca só capturado
        // depois (capturar depois ainda deixava a página sempre na 1ª, confirmado ao vivo no IV-b).
        const w = window as unknown as { jQuery?: { blockUI: unknown; unblockUI: unknown } };
        if (w.jQuery) { w.jQuery.blockUI = () => {}; w.jQuery.unblockUI = () => {}; }
        const btn = document.querySelector('#forward_bot');
        const code = btn?.getAttribute('onclick');
        if (code) new Function(code)();
      });
      await page.waitForTimeout(2200);
    }
    return { rows: out, declaredTotal };
  } finally {
    await browser.close();
  }
}

async function scrapeSinglePageGrid(appPath: string, dtLabel: string): Promise<RawGridRow[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`https://scase.tjpe.jus.br/transparencia/${appPath}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.selectOption('#SC_dt_referencia', { label: dtLabel });
    await page.click('#sc_b_pesq_bot');
    await page.waitForTimeout(2500);
    const frame = page.frames().find(f => f.url().includes('nmgp_opcao=pesq'));
    if (!frame) throw new Error(`TJPE ${appPath}: iframe de resultado não encontrado após pesquisa`);
    return await frame.evaluate(() => {
      const t = document.querySelector('table.scGridTabela');
      if (!t) return [];
      return [...t.querySelectorAll('tr')].map(tr => ({ cls: tr.className, cells: [...tr.querySelectorAll('td,th')].map(td => (td.textContent ?? '').trim()) }));
    });
  } finally {
    await browser.close();
  }
}

const isNumericCell = (s: string) => s === '' || /^[\d.,-]+$/.test(s);
const parseBR = (s: string): number => { const t = s.trim(); if (!t) return 0; return Number(t.replace(/\./g, '').replace(',', '.')) || 0; };

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

/** Anexo IV a) cargos efetivos: grade FLAT por (carreira,escolaridade,classe,padrão) — diferente do padrão
 * usado em outros tribunais, aqui CADA linha repete o nome completo da carreira (sem carry-forward de célula
 * em branco), então nunca precisa rastrear "último valor visto". Sem linha de rollup por carreira nem TOTAL
 * GERAL na grade — a única conferência disponível é contra o total de registros que a própria paginação
 * declara ("[1 a 23 de N]"), feita no coletor (`p1425-tjpe-collect.ts`), não aqui. Última coluna da grade é
 * rotulada "INSTITUIDORES DE PENSÃO" duas vezes (erro de rótulo do próprio TJPE — confirmado pelo nome real
 * do campo no DOM, `QTD_INATIV_BENPENS`), mas o valor é de Beneficiários de Pensão — nunca confiar no texto
 * do cabeçalho sem checar o campo real. */
export function parsePersonnelGridIVA(rows: RawGridRow[]): PersonnelRow[] {
  const out: PersonnelRow[] = [];
  for (const { cells } of rows) {
    if (cells.length !== 13) continue;
    if (!cells[0] || cells[0] === 'CARREIRA') continue;
    if (!cells.slice(4).every(isNumericCell)) continue;
    const [career, escolaridade, classe, padrao] = cells;
    const classLevel = [escolaridade, classe, padrao].filter(Boolean).join(' / ') || null;
    const estaveis = parseBR(cells[4]!), naoEstaveis = parseBR(cells[5]!), vagos = parseBR(cells[7]!);
    const aposentados = parseBR(cells[9]!), instituidores = parseBR(cells[10]!), beneficiarios = parseBR(cells[12]!);
    if (estaveis) out.push({ careerTrack: career!, positionTitle: career!, classLevel, status: 'ATIVO_ESTAVEL', headcount: estaveis, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: career!, positionTitle: career!, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: career!, positionTitle: career!, classLevel, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_A' });
    if (aposentados) out.push({ careerTrack: career!, positionTitle: career!, classLevel, status: 'INATIVO_APOSENTADO', headcount: aposentados, sourceAnnex: 'ANEXO_IV_A' });
    if (instituidores) out.push({ careerTrack: career!, positionTitle: career!, classLevel, status: 'INSTITUIDOR_PENSAO', headcount: instituidores, sourceAnnex: 'ANEXO_IV_A' });
    if (beneficiarios) out.push({ careerTrack: career!, positionTitle: career!, classLevel, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios, sourceAnnex: 'ANEXO_IV_A' });
  }
  return out;
}

/** Anexo IV b) cargos em comissão: grade flat por "Cargo/Função" — mesmo layout (Optante/Integral/Subtotal/
 * SemVínculo/Vagos/Total) já visto no TJPA, mesmo vocabulário de status reaproveitado (`OCUPADO_COM_VINCULO_
 * OPTANTE`/`_INTEGRAL`/`OCUPADO_SEM_VINCULO`, já reconhecidos pela tela como "ocupados"). Diferente do que a
 * contagem de registros declarada pela paginação sugeria, a grade TEM uma linha de rollup real no fim ("Total
 * Geral(174) - Soma"), além de linhas "Soma" por subseção (Cargos em Comissão / Funções Gratificadas) — todas
 * excluídas por regex de prefixo (não por igualdade exata, que deixou passar "Soma"/"Total Geral(...)" na 1ª
 * tentativa). A linha "Total Geral" é usada aqui pra conferir a soma antes de aceitar. */
export function parsePersonnelGridIVB(rows: RawGridRow[]): PersonnelRow[] {
  const out: PersonnelRow[] = [];
  let totalGeral: string[] | null = null;
  for (const { cells } of rows) {
    if (cells.length !== 7) continue;
    if (!cells[0]) continue;
    if (/^total geral/i.test(cells[0])) { totalGeral = cells; continue; }
    if (/^(cargo\/fun|ocupados|vagos|total|soma)/i.test(cells[0])) continue;
    if (!cells.slice(1).every(isNumericCell)) continue;
    const cargo = cells[0]!;
    const optante = parseBR(cells[1]!), integral = parseBR(cells[2]!), semVinculo = parseBR(cells[4]!), vagos = parseBR(cells[5]!);
    if (!optante && !integral && !semVinculo && !vagos) continue;
    if (optante) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_B' });
  }
  if (!totalGeral) throw new Error('TJPE Anexo IV-b: linha "Total Geral" não encontrada na grade');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const expected = { optante: parseBR(totalGeral[1]!), integral: parseBR(totalGeral[2]!), semVinculo: parseBR(totalGeral[4]!), vagos: parseBR(totalGeral[5]!) };
  const got = { optante: sum('OCUPADO_COM_VINCULO_OPTANTE'), integral: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJPE Anexo IV-b: soma não bate com "Total Geral". calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: grade com linhas de "quebra" (1 célula, texto "Inciso N - ..."), linha de cabeçalho repetida por
 * inciso (classe `scGridLabel`, ignorada) e linhas de dado (`scGridFieldOdd/Even`, 5 células: alínea,
 * discriminação, TOTAL CONSOLIDADO, UG-TJPE, UG-FERM — 2 unidades gestoras somadas; usamos só o TOTAL
 * CONSOLIDADO, nunca as 2 parcelas separadas). Linha `scGridSubtotal` ("Soma") existe por inciso — usada aqui
 * para conferir a soma de cada inciso antes de aceitar, lança erro se não bater. */
export function parseFinanceGridAnexoI(rows: RawGridRow[]): FinanceRow[] {
  const out: FinanceRow[] = [];
  let inciso = '';
  let runningTotal = 0;
  for (const { cls, cells } of rows) {
    if (cells.length === 1 && /^Inciso\s/i.test(cells[0]!)) { inciso = cells[0]!; runningTotal = 0; continue; }
    if (cls.includes('scGridLabel')) continue;
    if (cls.includes('scGridSubtotal')) {
      const declared = parseBR(cells[1] ?? cells[0] ?? '0');
      if (Math.abs(declared - runningTotal) > 0.01) throw new Error(`TJPE Anexo I: soma do ${inciso} (${runningTotal}) não bate com a linha "Soma" da grade (${declared})`);
      continue;
    }
    if (!cls.includes('scGridFieldOdd') && !cls.includes('scGridFieldEven')) continue;
    if (cells.length !== 5) continue;
    const [alinea, discriminacao, totalConsolidado] = cells;
    if (!alinea || !discriminacao) continue;
    const amount = parseBR(totalConsolidado!);
    out.push({ account: `${alinea} — ${discriminacao}`, category: inciso || 'Sem seção identificada', amountReais: amount });
    runningTotal += amount;
  }
  return out;
}

export async function scrapeAnexoIVA(dtLabel: string): Promise<{ rows: RawGridRow[]; declaredTotal: number | null }> { return scrapePaginatedGrid('ANEXO_4A', dtLabel); }
export async function scrapeAnexoIVB(dtLabel: string): Promise<{ rows: RawGridRow[]; declaredTotal: number | null }> { return scrapePaginatedGrid('ANEXO_4B', dtLabel); }
export async function scrapeAnexoI(dtLabel: string): Promise<RawGridRow[]> { return scrapeSinglePageGrid('ANEXO_1', dtLabel); }

/** Conta linhas de dado ÚNICAS (carreira/cargo/padrão distinto, nunca duplicado por uma página reaberta) —
 * comparada contra `declaredTotal` no coletor antes de aceitar a coleta como completa. */
export function countUniqueDetailRows(rows: RawGridRow[], cellCount: number): number {
  const seen = new Set<string>();
  for (const { cells } of rows) {
    if (cells.length !== cellCount) continue;
    if (!cells[0] || cells[0] === 'CARREIRA' || /^(cargo\/fun|ocupados|vagos|total|soma)/i.test(cells[0])) continue;
    seen.add(cells.join('|'));
  }
  return seen.size;
}
