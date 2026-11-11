import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';

/**
 * TJPI — Tribunal de Justiça do Piauí (P14.26, 11º dos 27 TJs). Portal de transparência próprio
 * (`www.tjpi.jus.br/transparencia/...`), cada alínea do Anexo IV e o Anexo I com sua própria página — tabelas
 * renderizadas no servidor (HTML puro, sem SPA), diferente do TJPE (anterior nesta série). O Anexo I usa um
 * REDIRECT pra uma URL interna real (`/transparencia/siafe/cnj/appendix_i?ano=N&mes=M`) que só aceita acesso
 * com um cookie de sessão (recebido no 1º GET); Anexo IV-a/b não precisam de cookie nenhum. Fornecedores
 * (Valores Pagos aos Contratados - LDO) não encontrados como tabela/arquivo real acessível sem JS pesado —
 * não investigado a fundo por orçamento de tempo; TJPI fica sem essa camada, igual ao TJPE (403 lá, lacuna
 * de reconhecimento aqui — motivo diferente, mesma decisão de não forçar).
 */

/** o servidor só manda `Set-Cookie` na 1ª requisição de uma conexão TCP nova — se o processo já reaproveitou
 * uma conexão keep-alive do `fetch` global pra outro path antes (ex. já baixou Anexo IV-a/b), o header some
 * silenciosamente (confirmado ao vivo). O header `Connection: close` NÃO resolve — é um header "hop-by-hop"
 * que o `fetch`/undici descarta antes de mandar, então não força nada de verdade. Só funciona usando
 * `node:https` diretamente com um agente `keepAlive: false`, que garante uma conexão TCP genuinamente nova. */
async function getSessionCookie(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request('https://www.tjpi.jus.br/transparencia/relatorios/anexo_i', {
      headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' },
      agent: new https.Agent({ keepAlive: false }),
    }, res => {
      const setCookie = res.headers['set-cookie']?.[0];
      res.resume();
      if (!setCookie) { reject(new Error('TJPI: não recebeu cookie de sessão no 1º request')); return; }
      resolve(setCookie.split(';')[0]!);
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchHtml(url: string, cookie?: string): Promise<string> {
  const headers: Record<string, string> = { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TJPI download HTTP ${res.status} ${url}`);
  return res.text();
}

export async function saveSnapshot(html: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string }> {
  await fs.mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, html, 'utf8');
  const buf = Buffer.from(html, 'utf8');
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

/** Extrai todas as tabelas HTML de uma página como arrays de células de texto (sem HTML, sem colapsar por
 * colspan — uma célula com colspan ainda vira 1 só <td> na extração, igual ao navegador reportaria pra
 * `cells.length`). Tabelas aninhadas dentro de uma célula não existem nestas páginas — confirmado olhando o
 * HTML real antes de escrever este extrator simples baseado em regex. */
export function extractTables(html: string): string[][][] {
  const tables: string[][][] = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html))) {
    const rows: string[][] = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = trRe.exec(tm[1]!))) {
      const cells: string[] = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1]!))) {
        cells.push(cm[1]!.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

const parseNum = (s: string | undefined): number => {
  const t = (s ?? '').trim();
  if (!t || t === '-') return 0;
  return Number(t.replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')) || 0;
};

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

/** Anexo IV-a (cargos efetivos): 1 tabela, carreira em carry-forward (só na 1ª linha do grupo), linha
 * "TOTAL <carreira>" ao final de cada grupo com os mesmos 9 números na posição final da linha (usada só pra
 * conferência, nunca somada de novo). Colunas numéricas sempre as 9 últimas células da linha, não um índice
 * fixo — uma linha de rollup tem menos células (sem nível/escolaridade/padrão) que uma linha de detalhe. */
export function parseAnexoIVA(html: string): PersonnelRow[] {
  const tables = extractTables(html);
  const table = tables.find(t => t.some(r => r[0] === 'Carreira' && r.includes('Nível')));
  if (!table) throw new Error('TJPI Anexo IV-a: tabela com cabeçalho "Carreira/Nível" não encontrada');
  const out: PersonnelRow[] = [];
  let currentCareer = '';
  const totalsByCareer = new Map<string, number[]>();
  let afterHeader = false;
  for (const row of table) {
    if (row[0] === 'Carreira') { afterHeader = true; continue; }
    if (!afterHeader) continue;
    if (row[0]?.startsWith('Dados a partir de')) break;
    const nums = row.slice(-9).map(parseNum);
    if (nums.length !== 9) continue;
    const label = (row[0] ?? '').trim();
    if (/^TOTAL\s+/i.test(label)) {
      const career = label.replace(/^TOTAL\s+/i, '').trim();
      totalsByCareer.set(career, nums);
      continue;
    }
    // a célula de CARREIRA usa rowspan na fonte — só existe na 1ª linha de cada grupo (13 células); as
    // linhas seguintes do mesmo grupo têm 1 célula a menos (12, já sem a carreira) e NUNCA trocam
    // `currentCareer`, mesmo que `row[0]` pareça um rótulo novo (na verdade é o "Nível" da mesma carreira).
    // Nível/Escolaridade/Padrão SEMPRE presentes (nunca rowspan'd) — guardados em `classLevel`, não
    // descartados: sem isso, 2 padrões diferentes da mesma carreira com o mesmo headcount geravam o MESMO
    // `fact_id` (colisão real de chave primária, pega rodando contra o banco antes de aceitar como certo).
    const isFullRow = row.length === 13;
    if (isFullRow) currentCareer = label;
    if (!currentCareer) continue;
    const [nivel, escolaridade, padrao] = isFullRow ? row.slice(1, 4) : row.slice(0, 3);
    const classLevel = [nivel, escolaridade, padrao].filter(Boolean).join(' / ') || null;
    const [estaveis, naoEstaveis, , vagos, , aposentados, instituidores, , beneficiarios] = nums;
    if (estaveis) out.push({ careerTrack: currentCareer, positionTitle: currentCareer, classLevel, status: 'ATIVO_ESTAVEL', headcount: estaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: currentCareer, positionTitle: currentCareer, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: currentCareer, positionTitle: currentCareer, classLevel, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_A' });
    if (aposentados) out.push({ careerTrack: currentCareer, positionTitle: currentCareer, classLevel, status: 'INATIVO_APOSENTADO', headcount: aposentados!, sourceAnnex: 'ANEXO_IV_A' });
    if (instituidores) out.push({ careerTrack: currentCareer, positionTitle: currentCareer, classLevel, status: 'INSTITUIDOR_PENSAO', headcount: instituidores!, sourceAnnex: 'ANEXO_IV_A' });
    if (beneficiarios) out.push({ careerTrack: currentCareer, positionTitle: currentCareer, classLevel, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios!, sourceAnnex: 'ANEXO_IV_A' });
  }
  // conferência: soma por carreira bate com a linha "TOTAL <carreira>" correspondente — "TOTAL <carreira>"
  // vem em CAIXA ALTA na própria fonte, enquanto a carreira nas linhas de detalhe vem em texto normal (ex.
  // "Analista" vs "TOTAL ANALISTA") — comparação sempre case-insensitive, nunca por igualdade exata.
  for (const [career, expected] of totalsByCareer) {
    const sum = (idx: number) => out.filter(r => r.careerTrack?.toUpperCase() === career.toUpperCase()).reduce((acc, r) => acc + (
      [r.status === 'ATIVO_ESTAVEL', r.status === 'ATIVO_NAO_ESTAVEL', false, r.status === 'VAGO', false, r.status === 'INATIVO_APOSENTADO', r.status === 'INSTITUIDOR_PENSAO', false, r.status === 'BENEFICIARIO_PENSAO'][idx] ? r.headcount : 0), 0);
    const got = [0, 1, 3, 5, 6, 8].map(sum);
    const exp = [0, 1, 3, 5, 6, 8].map(i => expected[i]);
    if (JSON.stringify(got) !== JSON.stringify(exp)) throw new Error(`TJPI Anexo IV-a: soma da carreira "${career}" não bate com TOTAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(exp)}`);
  }
  if (!totalsByCareer.size) throw new Error('TJPI Anexo IV-a: nenhuma linha TOTAL encontrada — layout pode ter mudado');
  return out;
}

/** Anexo IV-b (cargos em comissão + funções de confiança): 3 tabelas na mesma página — "Cargos em Comissão"
 * (níveis CC-N), "Funções de Confiança" (níveis FC-N) e um pequeno resumo final. Colunas reais (confirmadas
 * via estrutura de cabeçalho com colspan, não pelo texto achatado — "RCE"/"RI" são a MESMA distinção de
 * vínculo já usada no TJPA/TJPE sob outro nome: Optante Remuneração Cargo Efetivo / Remuneração Integral):
 * Nível, Denominação, RCE, RI, Subtotal(pular), Sem Vínculo Efetivo, Vagos, Total(pular). Usa o resumo final
 * ("Cargos em Comissão"/"Funções de Confiança"/"TOTAL") pra conferência. */
export function parseAnexoIVB(html: string): PersonnelRow[] {
  const tables = extractTables(html);
  const detailTables = tables.filter(t => t.some(r => r[0] === 'Nível' || /^(CC|FC)-/.test(r[0] ?? '')));
  const summaryTable = tables.find(t => t.some(r => r[0] === 'Cargos em Comissão') && t.some(r => r[0] === 'TOTAL'));
  if (!detailTables.length) throw new Error('TJPI Anexo IV-b: nenhuma tabela de detalhe (Nível/CC-/FC-) encontrada');
  if (!summaryTable) throw new Error('TJPI Anexo IV-b: tabela de resumo (Cargos em Comissão/Funções de Confiança/TOTAL) não encontrada');
  const out: PersonnelRow[] = [];
  for (const table of detailTables) {
    for (const row of table) {
      if (!/^(CC|FC)-/.test(row[0] ?? '')) continue;
      if (row.length < 8) continue;
      const cargo = `${row[0]} ${row[1]}`.trim();
      const nums = row.slice(-6).map(parseNum);
      const [rce, ri, , semVinculo, vagos] = nums;
      if (rce) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: rce!, sourceAnnex: 'ANEXO_IV_B' });
      if (ri) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: ri!, sourceAnnex: 'ANEXO_IV_B' });
      if (semVinculo) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo!, sourceAnnex: 'ANEXO_IV_B' });
      if (vagos) out.push({ careerTrack: null, positionTitle: cargo, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_B' });
    }
  }
  const totalRow = summaryTable.find(r => r[0] === 'TOTAL');
  if (!totalRow) throw new Error('TJPI Anexo IV-b: linha TOTAL não encontrada no resumo');
  const [expRce, expRi, , expSemVinculo, expVagos] = totalRow.slice(-6).map(parseNum);
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { rce: sum('OCUPADO_COM_VINCULO_OPTANTE'), ri: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  const expected = { rce: expRce, ri: expRi, semVinculo: expSemVinculo, vagos: expVagos };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJPI Anexo IV-b: soma não bate com TOTAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: Incisos I-VI, cada um com sua própria tabelinha (Alínea/Descrição/Valor) terminando numa linha
 * "Total" (rótulo na 2ª célula, não na 1ª — a 1ª fica vazia). O título "Inciso N: ..." fica como texto SOLTO
 * fora da tabela (não vira linha nenhuma na extração por `<table>`) — extraído do HTML cru, em ordem de
 * aparição, e pareado posicionalmente com as 6 tabelas de Alínea (1 inciso por tabela, mesma ordem). Valores
 * vêm como "R$56.295.301,32" (símbolo de moeda embutido, nunca visto nos tribunais anteriores desta série). */
export function parseAnexoI(html: string): FinanceRow[] {
  const tables = extractTables(html);
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  // a página também tem um menu de abas com "Inciso I Inciso II ..." sem dois-pontos antes do conteúdo real —
  // só os títulos de verdade têm "Inciso N:", exigido aqui pra não confundir os dois.
  const incisoTitles = [...plain.matchAll(/Inciso\s+[IVX]+\s*:\s*[\s\S]*?(?=\s*Alínea)/gi)].map(m => m[0]!.trim().replace(/\s+/g, ' '));
  const alineaTables = tables.filter(t => t.some(r => r[0] === 'Alínea'));
  const out: FinanceRow[] = [];
  let runningTotal = 0, fileTotal = 0;
  alineaTables.forEach((table, idx) => {
    const inciso = incisoTitles[idx] ?? `Inciso ${idx + 1}`;
    const headerIdx = table.findIndex(r => r[0] === 'Alínea');
    for (let i = headerIdx + 1; i < table.length; i++) {
      const row = table[i]!;
      if (/^total$/i.test(row[1] ?? row[0] ?? '')) { fileTotal += parseNum(row[row.length - 1]); continue; }
      if (row.length < 3) continue;
      const [alinea, descricao] = row;
      const amount = parseNum(row[row.length - 1]);
      if (!alinea || !descricao) continue;
      out.push({ account: `${alinea} — ${descricao}`, category: inciso, amountReais: amount });
      runningTotal += amount;
    }
  });
  if (Math.abs(runningTotal - fileTotal) > 0.01) throw new Error(`TJPI Anexo I: soma das alíneas (${runningTotal}) não bate com soma dos Total (${fileTotal})`);
  return out;
}

export async function downloadAnexoIVA(destDir: string, ano: number, mes: number): Promise<{ html: string; meta: { path: string; bytes: number; sha256: string } }> {
  const url = `https://www.tjpi.jus.br/transparencia/relatorios/anexo_iv_a?ano=${ano}&mes=${mes}`;
  const html = await fetchHtml(url);
  const meta = await saveSnapshot(html, destDir, `anexo-iv-a-${ano}-${String(mes).padStart(2, '0')}.html`);
  return { html, meta };
}
export async function downloadAnexoIVB(destDir: string, ano: number, mes: number): Promise<{ html: string; meta: { path: string; bytes: number; sha256: string } }> {
  const url = `https://www.tjpi.jus.br/transparencia/relatorios/anexo_iv_b?ano=${ano}&mes=${mes}`;
  const html = await fetchHtml(url);
  const meta = await saveSnapshot(html, destDir, `anexo-iv-b-${ano}-${String(mes).padStart(2, '0')}.html`);
  return { html, meta };
}
export async function downloadAnexoI(destDir: string, ano: number, mes: number): Promise<{ html: string; meta: { path: string; bytes: number; sha256: string } }> {
  const cookie = await getSessionCookie();
  const url = `https://www.tjpi.jus.br/transparencia/siafe/cnj/appendix_i?ano=${ano}&mes=${mes}`;
  const html = await fetchHtml(url, cookie);
  const meta = await saveSnapshot(html, destDir, `anexo-i-${ano}-${String(mes).padStart(2, '0')}.html`);
  return { html, meta };
}
