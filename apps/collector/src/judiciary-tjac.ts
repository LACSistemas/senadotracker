import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFParse } from 'pdf-parse';

/**
 * TJAC — Tribunal de Justiça do Acre (P14.31, 16º dos 27 TJs). Pessoal: PDF quadrimestral (abril/agosto/
 * dezembro) do Anexo IV, publicado em `wp-content/uploads` (WordPress), listado em
 * `www.tjac.jus.br/transparenci/anexoiv` (prefixo "transparenci" sem o "a" final — path legado do site que
 * ainda funciona, diferente do `/transparencia/` genérico, que só mostra o menu). A fonte NÃO nomeia carreiras
 * individuais — só agrupa por vínculo/escolaridade/regime de horas (ex. "SPJ/NS/40H" = Servidor do Poder
 * Judiciário, Nível Superior, 40 horas), cada grupo com sua própria linha "TOTAL <grupo>" (9 colunas) — essas
 * são as únicas linhas usadas (mesmo nível de granularidade por "carreira" já usado em todo tribunal anterior
 * da série, aqui o "nome da carreira" é o próprio grupo de vínculo). O layout do Anexo IV-a é denso e tem
 * rótulos verticais rotacionados (regime de horas) — precisou de reconstrução posicional via pdfjs-dist (igual
 * TJSP), mas MUITO mais simples: só 6 linhas-alvo (5 grupos + TOTAL CARGOS), nunca problema de rótulo partido
 * ou vizinho roubado. Anexo IV-b (cargos em comissão/funções de confiança) e Anexo I (financeiro) já vêm em
 * texto linear limpo — `pdf-parse` simples resolve, sem geometria.
 *
 * **Anexo I tem uma excentricidade de layout nunca vista antes**: a linha de TOTAL de cada Inciso vem
 * INVERTIDA — "31.264.468,54\tTotal" (valor primeiro, rótulo "Total" depois, separados por tab) — ao
 * contrário de todo tribunal anterior, que sempre tem o rótulo primeiro. Descrições de alínea também podem
 * quebrar em várias linhas físicas antes do valor aparecer (ex. alínea "e": "Diárias pagas a... e\n
 * colaboradores\n701.226,57").
 *
 * **Fornecedores pagos: fora de escopo, fonte não publica em lote**. Investigação extensa (menu de
 * transparência, `/transparenci/anexoi` a `anexovii`, página de licitações, "Outras Despesas Orçamentárias"
 * consulta dinâmica) não achou nenhum arquivo com relação de fornecedores/CNPJ/valor pago em lote — só uma
 * "Consulta de Pagamentos" de precatórios (escopo diferente) e uma consulta dinâmica por filtro. Mesma decisão
 * de escopo já tomada pro TJPI/TJPE/TJMG quando a fonte não oferece lista em massa.
 */

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; buf: Buffer }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`TJAC download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), buf };
}

const parseBR = (s: string | undefined): number => {
  const t = (s ?? '').trim();
  if (!t || t === '-') return 0;
  return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
};

interface Item { str: string; x: number; y: number }

async function getPositionedItems(pdfPath: string): Promise<Item[]> {
  const doc = await getDocument(pdfPath).promise;
  const items: Item[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as any[]) {
      const s = (it.str ?? '').trim();
      if (s) items.push({ str: it.str, x: it.transform[4], y: it.transform[5] - p * 100000 });
    }
  }
  return items;
}

/** Agrupa por proximidade sequencial de y (nunca por bucket de arredondamento fixo — um valor exatamente na
 * borda de um bucket fixo pode cair no bucket errado e perder a linha inteira, confirmado ao vivo). */
function groupPhysicalRows(items: Item[]): Array<{ y: number; items: Item[] }> {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: Array<{ y: number; items: Item[] }> = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= 4) { last.items.push(it); continue; }
    rows.push({ y: it.y, items: [it] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

/** Anexo IV-a: só usa as linhas "TOTAL <grupo>" (9 colunas: Estáveis,Não-Estáveis,Subtotal,Vagos,Total,
 * Aposentados,Instituidores de Pensão,Total,Beneficiários de Pensão) e a linha final "TOTAL CARGOS" (grande
 * total, usada só pra conferência). A fonte não nomeia carreiras — "grupo" é o rótulo vertical de vínculo/
 * escolaridade/regime (ex. "SPJ/NS/40H"), extraído da própria linha TOTAL (nunca precisou reconstruir os
 * rótulos verticais rotacionados em si — só a linha de TOTAL horizontal, que já vem legível). */
export async function parseAnexoIVA(pdfPath: string): Promise<PersonnelRow[]> {
  const items = await getPositionedItems(pdfPath);
  const rows = groupPhysicalRows(items);
  let grandTotal: number[] | null = null;
  const groups: Array<{ label: string; vals: number[] }> = [];
  for (const row of rows) {
    const text = row.items.map(it => it.str.trim()).filter(Boolean);
    if (!text.length || !/^TOTAL\b/i.test(text[0]!)) continue;
    const vals = text.slice(1).map(parseBR);
    if (vals.length !== 9) continue;
    if (/^TOTAL\s*CARGOS$/i.test(text[0]!.replace(/\s+/g, ' '))) { grandTotal = vals; continue; }
    groups.push({ label: text[0]!.replace(/^TOTAL\s*/i, '').trim(), vals });
  }
  if (!grandTotal) throw new Error('TJAC Anexo IV-a: linha "TOTAL CARGOS" não encontrada — layout pode ter mudado');
  if (!groups.length) throw new Error('TJAC Anexo IV-a: nenhum grupo "TOTAL <grupo>" encontrado — layout pode ter mudado');

  const out: PersonnelRow[] = [];
  for (const { label, vals } of groups) {
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
  const [gEstaveis, gNaoEstaveis, , gVagos, , gAposentados, gInstituidores, , gBeneficiarios] = grandTotal;
  const expected = { estaveis: gEstaveis, naoEstaveis: gNaoEstaveis, vagos: gVagos, aposentados: gAposentados, instituidores: gInstituidores, beneficiarios: gBeneficiarios };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJAC Anexo IV-a: soma não bate com TOTAL CARGOS. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

/** Anexo IV-b: texto linear limpo (sem geometria). 2 seções ("Cargos em Comissão"/"Funções de Confiança"),
 * 1 linha por código (CJ-N/FC-N), 6 colunas — Optante,Integral,Subtotal,SemVínculo,Vagos,Total. "Total Cargos"/
 * "Total Funções" são subtotal de seção (pulados); "TOTAL" final é a conferência. */
export async function parseAnexoIVB(pdfPath: string): Promise<PersonnelRow[]> {
  const buf = await fs.readFile(pdfPath);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: PersonnelRow[] = [];
  let total: number[] | null = null;
  for (const line of lines) {
    const m = /^([A-Z]{2}-[A-Z0-9-]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)$/.exec(line);
    if (m) {
      const [, label, optanteS, integralS, , semVinculoS, vagosS] = m;
      const optante = parseBR(optanteS), integral = parseBR(integralS), semVinculo = parseBR(semVinculoS), vagos = parseBR(vagosS);
      if (optante) out.push({ careerTrack: null, positionTitle: label!, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante, sourceAnnex: 'ANEXO_IV_B' });
      if (integral) out.push({ careerTrack: null, positionTitle: label!, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral, sourceAnnex: 'ANEXO_IV_B' });
      if (semVinculo) out.push({ careerTrack: null, positionTitle: label!, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo, sourceAnnex: 'ANEXO_IV_B' });
      if (vagos) out.push({ careerTrack: null, positionTitle: label!, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_B' });
      continue;
    }
    const t = /^TOTAL\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)$/.exec(line);
    if (t) total = t.slice(1).map(parseBR);
  }
  if (!total) throw new Error('TJAC Anexo IV-b: linha "TOTAL" não encontrada — layout pode ter mudado');
  if (!out.length) throw new Error('TJAC Anexo IV-b: nenhuma linha de cargo reconhecida — layout pode ter mudado');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { optante: sum('OCUPADO_COM_VINCULO_OPTANTE'), integral: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  const [gOptante, gIntegral, , gSemVinculo, gVagos] = total;
  const expected = { optante: gOptante, integral: gIntegral, semVinculo: gSemVinculo, vagos: gVagos };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJAC Anexo IV-b: soma não bate com TOTAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: texto linear limpo, mas com 2 excentricidades: (1) linha de TOTAL por Inciso vem INVERTIDA
 * ("<valor>\tTotal", nunca "Total <valor>" como em todo tribunal anterior); (2) descrição de alínea pode
 * quebrar em várias linhas físicas antes do valor aparecer. Resolvido acumulando texto até achar um valor
 * monetário no fim da linha (isolado ou após o acúmulo). */
export async function parseAnexoI(pdfPath: string): Promise<FinanceRow[]> {
  const buf = await fs.readFile(pdfPath);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: FinanceRow[] = [];
  let currentInciso = '';
  let pending: { alinea: string; desc: string } | null = null;
  let incisoSum = 0;
  const MONEY_RE = /(-?[\d.]+,\d{2})\s*$/;

  const flushTotalCheck = (totalValue: number) => {
    if (Math.abs(incisoSum - totalValue) > 0.01) throw new Error(`TJAC Anexo I: soma do "${currentInciso}" não bate com a linha Total. calculado=${incisoSum} esperado=${totalValue}`);
    incisoSum = 0;
  };

  for (const line of lines) {
    if (/^Inciso\s/i.test(line)) { currentInciso = line; pending = null; continue; }
    if (/^Alínea\s+Descrição/i.test(line)) continue;
    const totalInverted = /^(-?[\d.]+,\d{2})\s+Total$/i.exec(line);
    if (totalInverted) { flushTotalCheck(parseBR(totalInverted[1])); continue; }
    const newEntry = /^([a-z])\s+(.*)$/.exec(line);
    if (newEntry && !pending) { pending = { alinea: newEntry[1]!, desc: newEntry[2]! }; }
    else if (pending) { pending.desc += ' ' + line; }
    else continue;
    const m = MONEY_RE.exec(pending.desc);
    if (m) {
      const amount = parseBR(m[1]);
      const descricao = pending.desc.slice(0, m.index).trim();
      out.push({ account: `${pending.alinea} — ${descricao}`, category: currentInciso, amountReais: amount });
      incisoSum += amount;
      pending = null;
    }
  }
  if (!out.length) throw new Error('TJAC Anexo I: nenhuma linha de alínea encontrada — layout pode ter mudado');
  return out;
}
