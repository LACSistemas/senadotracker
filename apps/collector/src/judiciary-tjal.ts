import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as XLSX from 'xlsx';

/**
 * TJAL — Tribunal de Justiça de Alagoas (P14.34, 19º dos 27 TJs). O domínio antigo usado em reconhecimentos
 * anteriores (`aceco.tjal.jus.br`) está morto (DNS não resolve); o site institucional foi reconstruído como
 * SPA, e `/transparencia` devolve 403 (diretório legado, não CAPTCHA). A API real está atrás do SPA, achada
 * pelo bundle JS: `cadastrotransparencia.tjal.jus.br/api/listarAnexos?perfil=DAGP|DICONF` devolve um
 * manifesto JSON com categorias → subgrupos → anexos → `download_url` prontas, sem sessão nem autenticação.
 *
 * **Anexo IV é PDF com geometria genuinamente mais confusa que a do TJSP**: o texto linear
 * (`pdf.getText()`) sai completamente fora de ordem — TODOS os números do documento vêm primeiro, DEPOIS
 * todos os rótulos de carreira/classe, como se o gerador lesse a página por COLUNA, não por linha. Só a
 * reconstrução posicional (pdfjs-dist, x/y por item, clustering sequencial igual ao já usado no TJAC)
 * resolve. Achados reais de geometria, únicos desta fonte:
 * - Os números (Estáveis/Não-Estáveis/Subtotal/Vagos/Total/Aposentados/Instituidores/Total/Beneficiários,
 *   9 colunas fixas por x) saem em grupos de "padrão" 15→1 (uma carreira inteira), seguidos de uma linha
 *   "TOTAL" (fecha o grupo) — usa-se só essa linha "TOTAL" agregada por carreira, nunca as linhas de
 *   padrão individuais (que não têm classe/padrão confiavelmente associável por posição).
 * - O rótulo de carreira (texto rotacionado, célula mesclada) aparece em QUALQUER y dentro do próprio
 *   grupo — às vezes partido em 2+ fragmentos de linha. A reconstrução correta pede um clustering PRÓPRIO
 *   pros fragmentos de rótulo (limiar 8, maior que o das linhas de dado — sem risco de corromper número
 *   nenhum, rótulo nunca tem valor numérico): dentro de um mesmo cluster de rótulo, a ordem certa é x
 *   crescente (ex. "PROCURADOR"+"ADMINISTRATIVO" na mesma linha rotacionada, só separados pelo limiar
 *   apertado de 4 do clustering de linha — gap real medido 4.3); ENTRE clusters de rótulo diferentes, a
 *   ordem certa é y CRESCENTE, não decrescente como o resto da tabela (confirmado comparando contra nomes
 *   de carreira já conhecidos: "OFICIAL DO REGISTRO" aparece ACIMA de "CIVIL" no y decrescente, separados
 *   por um gap real de verdade, 29.5 — e só bate "OFICIAL DO REGISTRO CIVIL" concatenando em y crescente).
 * - A 2ª página tem 2 sub-seções com layouts DIFERENTES do padrão "15→1" da 1ª página: (a) "SUPERIOR/
 *   PROCURADOR ADMINISTRATIVO" — 5 linhas de classe (E,D,C,B,A), cada uma JÁ com os 9 valores na própria
 *   linha (sem padrão numérico, sem TOTAL de fechamento) — usadas diretamente, 1 linha = 1 entrada; (b)
 *   "PARTE SUPLEMENTAR E ESPECIAL - CARGOS EM EXTINÇÃO" — 4 cargos NOMEADOS, cada um com 1 linha de dado
 *   seguida pelos fragmentos do próprio nome (mesma regra de concatenação y-crescente), fechados por 1 só
 *   "TOTAL" pros 4 juntos (verificado aqui, diferente do padrão da 1ª página onde cada grupo tem seu TOTAL
 *   próprio).
 *
 * Anexo IV-b (cargos em comissão) é, ao contrário, um PDF totalmente convencional — lista plana CJ1-16/
 * FC1-2, cada linha já com os 6 valores (Optante/Integral/Subtotal/SemVínculo/Vagos/Total), sem rowspan nem
 * rótulo rotacionado. Mesmo técnica de extração posicional, mas sem a complexidade do a).
 */

const UA = 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)';

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; buf: Buffer }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TJAL download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), buf };
}

export interface AnexoManifestItem { id_anexo: number; nome: string; ano: number; quadrimestre: string | null; nome_anexo: string; download_url: string }
export interface AnexoCategoria { id_categoria: number; categoria: string; subgrupos: { nome: string | null; anexos: AnexoManifestItem[] }[] }
export async function fetchManifest(perfil: 'DAGP' | 'DICONF'): Promise<AnexoCategoria[]> {
  const res = await fetch(`https://cadastrotransparencia.tjal.jus.br/api/listarAnexos?perfil=${perfil}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TJAL listarAnexos HTTP ${res.status} (perfil=${perfil})`);
  const json = (await res.json()) as Array<{ perfil: string; categorias: AnexoCategoria[] }>;
  return json[0]?.categorias ?? [];
}

interface Item { str: string; x: number; y: number }
interface Row { y: number; items: Item[] }

function clusterRows(items: Item[]): Row[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= 4) { last.items.push(it); continue; }
    rows.push({ y: it.y, items: [it] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Reconstrói um rótulo (texto rotacionado, possivelmente em vários fragmentos) a partir de itens soltos
 * {x,y,text}: agrupa por proximidade de y (limiar 8, independente do clustering de linha de dado), ordena
 * cada grupo por x crescente (fragmentos da MESMA linha rotacionada), e concatena os grupos em y crescente
 * (linhas diferentes da célula mesclada) — ver nota de geometria no topo do arquivo. */
function assembleLabel(fragments: { x: number; y: number; text: string }[]): string {
  const sorted = [...fragments].sort((a, b) => a.y - b.y);
  const clusters: { y: number; items: typeof fragments }[] = [];
  for (const f of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last.y - f.y) <= 8) { last.items.push(f); continue; }
    clusters.push({ y: f.y, items: [f] });
  }
  return clusters.map(c => [...c.items].sort((a, b) => a.x - b.x).map(f => f.text).join(' ')).join(' ').replace(/\s+/g, ' ').trim();
}

async function getPageRows(pdfPath: string): Promise<Row[][]> {
  const doc = await getDocument(pdfPath).promise;
  const pages: Row[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = (content.items as any[]).map(it => ({ str: it.str as string, x: it.transform[4] as number, y: it.transform[5] as number })).filter(it => it.str.trim());
    pages.push(clusterRows(items));
  }
  return pages;
}

const parseIntBR = (s: string | undefined): number => { const t = (s ?? '').trim().replace(/\./g, ''); return t === '' ? 0 : Number(t) || 0; };

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

interface Buckets9 { estavel: number; naoEstavel: number; subtotal: number; vagos: number; total1: number; aposentados: number; instituidores: number; total2: number; beneficiarios: number }
function classify9(items: Item[]): Buckets9 {
  const b: Buckets9 = { estavel: 0, naoEstavel: 0, subtotal: 0, vagos: 0, total1: 0, aposentados: 0, instituidores: 0, total2: 0, beneficiarios: 0 };
  for (const it of items) {
    if (it.x < 110) continue;
    const v = parseIntBR(it.str);
    if (it.x < 159) b.estavel = v;
    else if (it.x < 204.5) b.naoEstavel = v;
    else if (it.x < 255) b.subtotal = v;
    else if (it.x < 302.5) b.vagos = v;
    else if (it.x < 343) b.total1 = v;
    else if (it.x < 384) b.aposentados = v;
    else if (it.x < 436) b.instituidores = v;
    else if (it.x < 481) b.total2 = v;
    else b.beneficiarios = v;
  }
  return b;
}
/** Nunca verifica contra Subtotal/Total1/Total2 (campos DERIVADOS, calculados a partir dos 6 campos
 * independentes abaixo) — mesma convenção já estabelecida em toda a série (TJSE etc.): um campo derivado
 * pode ter um erro de digitação na própria fonte (confirmado real aqui: o TOTAL GERAL desta fonte tem
 * Total-inativos=444 mas Aposentados+Instituidores=443, 1 unidade de diferença, só no campo derivado —
 * os 6 campos independentes batem exatamente). Só os 6 campos independentes (Estável/NãoEstável/Vagos/
 * Aposentados/Instituidores/Beneficiários) são comparados contra TOTAL GERAL. */
interface Independent6 { estavel: number; naoEstavel: number; vagos: number; aposentados: number; instituidores: number; beneficiarios: number }
const toIndependent6 = (b: Buckets9): Independent6 => ({ estavel: b.estavel, naoEstavel: b.naoEstavel, vagos: b.vagos, aposentados: b.aposentados, instituidores: b.instituidores, beneficiarios: b.beneficiarios });
const sumIndependent6 = (rows: Buckets9[]): Independent6 => rows.reduce((s, r) => ({ estavel: s.estavel + r.estavel, naoEstavel: s.naoEstavel + r.naoEstavel, vagos: s.vagos + r.vagos, aposentados: s.aposentados + r.aposentados, instituidores: s.instituidores + r.instituidores, beneficiarios: s.beneficiarios + r.beneficiarios }), { estavel: 0, naoEstavel: 0, vagos: 0, aposentados: 0, instituidores: 0, beneficiarios: 0 });
function emitFromBuckets9(career: string, classLevel: string | null, b: Buckets9): PersonnelRow[] {
  const out: PersonnelRow[] = [];
  const push = (status: string, headcount: number) => { if (headcount) out.push({ careerTrack: career, positionTitle: career, classLevel, status, headcount, sourceAnnex: 'ANEXO_IV_A' }); };
  push('ATIVO_ESTAVEL', b.estavel);
  push('ATIVO_NAO_ESTAVEL', b.naoEstavel);
  push('VAGO', b.vagos);
  push('INATIVO_APOSENTADO', b.aposentados);
  push('INSTITUIDOR_PENSAO', b.instituidores);
  push('BENEFICIARIO_PENSAO', b.beneficiarios);
  return out;
}
const isPadraoNumber = (s: string) => /^\d+$/.test(s.trim());
const isClasseLetra = (s: string) => /^[A-H]$/.test(s.trim());
const isTotalMarker = (s: string) => /^TOTAL( GERAL)?$/i.test(s.trim());

/** Página 1: grupos de carreira delimitados por linhas "TOTAL" (padrão 15→1 cada), com "TOTAL GERAL" ao
 * final pra verificação. Rótulo de carreira: fragmentos de texto da coluna de rótulo (x<110, excluindo
 * padrão numérico/classe/TOTAL) encontrados em QUALQUER y dentro do grupo, reconstruídos via
 * `assembleLabel`. Só começa a coletar fragmentos depois da 1ª linha de padrão numérico (ignora o
 * cabeçalho do documento acima da tabela — "PODER JUDICIÁRIO", "ÓRGÃO:...", títulos de coluna etc. — que
 * também cai na coluna x<110 mas não é rótulo de carreira nenhum). */
function parsePage1Groups(rows: Row[]): { groups: PersonnelRow[]; totalGeral: Buckets9 | null } {
  const groups: PersonnelRow[] = [];
  const groupBuckets: Buckets9[] = [];
  let labelFrags: { x: number; y: number; text: string }[] = [];
  let totalGeral: Buckets9 | null = null;
  let tableStarted = false;
  for (const row of rows) {
    if (!tableStarted) { if (row.items.some(it => it.x >= 110 && it.x < 140 && isPadraoNumber(it.str))) tableStarted = true; else continue; }
    const totalItem = row.items.find(it => it.x < 110 && isTotalMarker(it.str));
    if (totalItem && /GERAL/i.test(totalItem.str)) { totalGeral = classify9(row.items); continue; }
    if (totalItem) {
      const b = classify9(row.items);
      const career = assembleLabel(labelFrags) || 'DESCONHECIDO';
      groups.push(...emitFromBuckets9(career, null, b));
      groupBuckets.push(b);
      labelFrags = [];
      continue;
    }
    const labelItems = row.items.filter(it => it.x < 110 && !isPadraoNumber(it.str) && !isClasseLetra(it.str) && !isTotalMarker(it.str) && it.str.trim().length > 1);
    for (const li of labelItems) labelFrags.push({ x: li.x, y: row.y, text: li.str.trim() });
  }
  if (totalGeral) {
    const sum = sumIndependent6(groupBuckets), expected = toIndependent6(totalGeral);
    if (JSON.stringify(sum) !== JSON.stringify(expected)) throw new Error(`TJAL Anexo IV-a p.1: soma dos grupos (${JSON.stringify(sum)}) != TOTAL GERAL (${JSON.stringify(expected)})`);
  }
  return { groups, totalGeral };
}

/** Página 2 inteira (não dá pra separar as 2 sub-seções por posição — os próprios títulos de seção
 * ("SUPERIOR", "PARTE SUPLEMENTAR E ESPECIAL...") são rótulos rotacionados com âncora NO MEIO do próprio
 * bloco, não no topo, então um corte por y ficaria com linhas do bloco errado dos 2 lados). Em vez disso:
 * (1) linhas de classe (E,D,C,B,A, letra isolada em x<110) são a seção "SUPERIOR/PROCURADOR
 * ADMINISTRATIVO" — usadas direto, nome da carreira concatenado só dos fragmentos que aparecem NA MESMA
 * linha de alguma classe (ex. "PROCURADOR"+"ADMINISTRATIVO" grudados na linha da classe B); (2) todo o
 * resto (exceto os 2 títulos de seção, descartados) segue o padrão "dado depois rótulo" da seção "PARTE
 * SUPLEMENTAR" (cada cargo nomeado: 1 linha de dado + 1-2 linhas de rótulo depois, concatenadas em y
 * crescente). **Achado real**: a única linha "TOTAL" da página fecha as DUAS seções JUNTAS (Procurador
 * Administrativo + os 4 cargos nomeados somados) — confirmado só depois de testar contra a fonte real (a
 * 1ª tentativa verificava cada seção separada e nunca batia; a soma das 2 juntas bate exatamente). */
function parsePage2(rows: Row[]): PersonnelRow[] {
  const out: PersonnelRow[] = [];
  // Linhas de classe (E,D,C,B,A) ficam bem próximas entre si no y, mas o próprio clustering sequencial
  // (limiar 4) às vezes separa um fragmento do nome da carreira (ex. "ADMINISTRATIVO") da linha "B"+dado
  // que o acompanha por pouco mais que o limiar (gap real medido: 4.3, contra limiar 4) — em vez de arriscar
  // fundir linhas de padrão da página 1 subindo o limiar global, busca-se o fragmento numa janela de y mais
  // larga (±8) ao redor de QUALQUER linha de classe, sem exigir o mesmo objeto de linha clusterizada.
  const classeRowYs = rows.filter(r => r.items.some(it => it.x < 110 && isClasseLetra(it.str))).map(r => r.y);
  const nearClasse = (y: number) => classeRowYs.some(cy => Math.abs(cy - y) <= 8);
  const careerFrags: { x: number; y: number; text: string }[] = [];
  for (const row of rows) {
    if (!nearClasse(row.y)) continue;
    for (const it of row.items) if (it.x < 110 && !isClasseLetra(it.str) && it.str.trim().length > 1 && !/^SUPERIOR$/i.test(it.str.trim())) careerFrags.push({ x: it.x, y: row.y, text: it.str.trim() });
  }
  const superiorCareer = assembleLabel(careerFrags) || 'DESCONHECIDO';
  const classeBuckets: Buckets9[] = [];
  for (const row of rows) {
    const classeItem = row.items.find(it => it.x < 110 && isClasseLetra(it.str));
    if (!classeItem) continue;
    const b = classify9(row.items);
    classeBuckets.push(b);
    out.push(...emitFromBuckets9(superiorCareer, classeItem.str.trim(), b));
  }

  const suplementarRows = rows.filter(r => !nearClasse(r.y));
  const bucketsList: Buckets9[] = [...classeBuckets];
  let pendingBuckets: Buckets9 | null = null;
  let labelFrags: { x: number; y: number; text: string }[] = [];
  let totalGeral: Buckets9 | null = null;
  const flush = () => {
    if (!pendingBuckets) return;
    const label = assembleLabel(labelFrags) || 'DESCONHECIDO';
    out.push(...emitFromBuckets9(label, null, pendingBuckets));
    bucketsList.push(pendingBuckets);
    pendingBuckets = null;
    labelFrags = [];
  };
  for (const row of suplementarRows) {
    const totalItem = row.items.find(it => it.x < 110 && isTotalMarker(it.str));
    if (totalItem) { flush(); totalGeral = classify9(row.items); continue; }
    const hasData = row.items.some(it => it.x >= 110);
    const labelItems = row.items.filter(it => it.x < 110 && it.str.trim().length > 1 && !/PARTE SUPLEMENTAR/i.test(it.str));
    if (hasData) { flush(); pendingBuckets = classify9(row.items); continue; }
    for (const li of labelItems) labelFrags.push({ x: li.x, y: row.y, text: li.str.trim() });
  }
  flush();
  if (totalGeral) {
    const sum = sumIndependent6(bucketsList), expected = toIndependent6(totalGeral);
    if (JSON.stringify(sum) !== JSON.stringify(expected)) throw new Error(`TJAL Anexo IV-a p.2 (parte suplementar): soma (${JSON.stringify(sum)}) != TOTAL (${JSON.stringify(expected)})`);
  }
  return out;
}

export async function parseAnexoIVA(pdfPath: string): Promise<PersonnelRow[]> {
  const pages = await getPageRows(pdfPath);
  const out: PersonnelRow[] = [];
  if (pages[0]) out.push(...parsePage1Groups(pages[0]).groups);
  if (pages[1]) out.push(...parsePage2(pages[1]));
  if (!out.length) throw new Error('TJAL Anexo IV-a: nenhuma linha reconhecida — layout pode ter mudado');
  return out;
}

/** Anexo IV-b: lista plana CJ1-16/FC1-2, cada linha já com 6 valores (Optante/Integral/Subtotal/
 * SemVínculo/Vagos/Total) — sem rowspan, sem rótulo rotacionado. Colunas por x (mesma técnica de bucket). */
export async function parseAnexoIVB(pdfPath: string): Promise<PersonnelRow[]> {
  const pages = await getPageRows(pdfPath);
  const rows = pages.flat();
  const out: PersonnelRow[] = [];
  type Buckets6 = { optante: number; integral: number; subtotal: number; semVinculo: number; vagos: number; total: number };
  let totalGeral: Buckets6 | null = null;
  const groupTotals: Buckets6[] = [];
  const classify6 = (items: Item[]) => {
    const b = { optante: 0, integral: 0, subtotal: 0, semVinculo: 0, vagos: 0, total: 0 };
    for (const it of items) {
      if (it.x < 100) continue;
      const v = parseIntBR(it.str);
      if (it.x < 190) b.optante = v;
      else if (it.x < 260) b.integral = v;
      else if (it.x < 325) b.subtotal = v;
      else if (it.x < 395) b.semVinculo = v;
      else if (it.x < 465) b.vagos = v;
      else b.total = v;
    }
    return b;
  };
  for (const row of rows) {
    const label = row.items.find(it => it.x < 100);
    if (!label) continue;
    const text = label.str.trim();
    if (/^TOTAL$/i.test(text)) { totalGeral = classify6(row.items); continue; }
    if (/^Total (cargos|funç)/i.test(text)) continue; // rollup intermediário (CJ ou FC), nunca linha de dado
    if (!/^(CJ|FC)\d+$/i.test(text)) continue; // cabeçalho/observação/rodapé
    const b = classify6(row.items);
    if (b.subtotal !== b.optante + b.integral) throw new Error(`TJAL Anexo IV-b: Subtotal (${b.subtotal}) != Optante+Integral em ${text}`);
    if (b.total !== b.subtotal + b.semVinculo + b.vagos) throw new Error(`TJAL Anexo IV-b: Total (${b.total}) != Subtotal+SemVinculo+Vagos em ${text}`);
    groupTotals.push(b);
    if (b.optante) out.push({ careerTrack: null, positionTitle: text, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: b.optante, sourceAnnex: 'ANEXO_IV_B' });
    if (b.integral) out.push({ careerTrack: null, positionTitle: text, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: b.integral, sourceAnnex: 'ANEXO_IV_B' });
    if (b.semVinculo) out.push({ careerTrack: null, positionTitle: text, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: b.semVinculo, sourceAnnex: 'ANEXO_IV_B' });
    if (b.vagos) out.push({ careerTrack: null, positionTitle: text, classLevel: null, status: 'VAGO', headcount: b.vagos, sourceAnnex: 'ANEXO_IV_B' });
  }
  if (totalGeral) {
    const sum = groupTotals.reduce((s, b) => ({ optante: s.optante + b.optante, integral: s.integral + b.integral, subtotal: s.subtotal + b.subtotal, semVinculo: s.semVinculo + b.semVinculo, vagos: s.vagos + b.vagos, total: s.total + b.total }), { optante: 0, integral: 0, subtotal: 0, semVinculo: 0, vagos: 0, total: 0 });
    if (JSON.stringify(sum) !== JSON.stringify(totalGeral)) throw new Error(`TJAL Anexo IV-b: soma (${JSON.stringify(sum)}) != TOTAL (${JSON.stringify(totalGeral)})`);
  }
  if (!out.length) throw new Error('TJAL Anexo IV-b: nenhuma linha reconhecida — layout pode ter mudado');
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

const parseBR = (s: string | undefined): number => { const t = (s ?? '').trim(); if (!t || t === '-') return 0; return Number(t.replace(/\./g, '').replace(',', '.')) || 0; };

/** Anexo I: PDF mensal, texto linear (não precisa de geometria — layout em bloco único, sem colunas lado
 * a lado como TJDFT). Cada alínea tem rótulo+descrição+valor numa sequência linear reconhecível. */
export async function parseAnexoI(pdfPath: string): Promise<FinanceRow[]> {
  const pages = await getPageRows(pdfPath);
  const out: FinanceRow[] = [];
  let inciso = '';
  let runningTotal = 0;
  for (const rows of pages) {
    for (const row of rows) {
      const text = row.items.map(it => it.str.trim()).filter(Boolean).join(' ');
      if (!text) continue;
      if (/^Inciso\s/i.test(text)) { inciso = text; runningTotal = 0; continue; }
      const totalMatch = /^Total\s+(-?[\d.]+,\d{2})\s*$/i.exec(text);
      if (totalMatch) {
        const declared = parseBR(totalMatch[1]);
        if (Math.abs(declared - runningTotal) > 0.01) throw new Error(`TJAL Anexo I: soma do "${inciso}" (${runningTotal}) não bate com a linha "Total" (${declared})`);
        continue;
      }
      const m = /^([a-z])\s*[-–)]?\s*(.+?)\s+(-?[\d.]+,\d{2})\s*$/i.exec(text);
      if (m && inciso) { const amount = parseBR(m[3]); out.push({ account: `${m[1]} — ${m[2]!.trim()}`, category: inciso, amountReais: amount }); runningTotal += amount; }
    }
  }
  if (!out.length) throw new Error('TJAL Anexo I: nenhuma linha de alínea encontrada — layout pode ter mudado');
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }

/** "Pagamentos por credor": XLSX cumulativo pro ano (jan-out/2026 nesta coleta), só do órgão TJAL (fora
 * FUNJURIS/ESMAL, entidades satélites separadas — mesmo escopo "só o tribunal" já usado em toda a série).
 * **Achado real**: os números vêm em formato AMERICANO (vírgula de milhar, ponto decimal — "1,775.55"),
 * não brasileiro, único caso assim na série até agora (confirmado não ser ambíguo: todo valor com vírgula
 * SEMPRE também tem ponto, nunca os dois papéis invertidos como o `xlsx` do TJSE tinha). "Credor" concatena
 * CPF/CNPJ e nome num campo só ("00101953437 - CLÁUDIA MARIA BEZERRA ") — separado por regex. */
const parseUS = (s: string | undefined): number => { const t = (s ?? '').trim(); if (!t) return 0; return Number(t.replace(/,/g, '')) || 0; };
const MONTH_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Jan..Out, índice fixo (cabeçalho de 2 linhas mesclado não é confiável)
export function parseContratadosPagos(buf: Buffer): SupplierPaymentRow[] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: false });
  const out: SupplierPaymentRow[] = [];
  for (const r of rows) {
    const credor = (r[0] ?? '').toString().trim();
    const natureza = (r[1] ?? '').toString().trim();
    if (!credor || !natureza) continue;
    const m = /^(\d{11,14})\s*-\s*(.+)$/.exec(credor);
    if (!m) continue; // cabeçalho/rodapé, sem CPF/CNPJ no início
    const digits = m[1]!, supplierName = m[2]!.trim();
    const supplierCnpj = digits.length === 14 ? digits : null;
    const monthValues = MONTH_COLS.map(c => parseUS(r[c] as string | undefined));
    const total = parseUS(r[12] as string | undefined);
    const sum = monthValues.reduce((s, v) => s + v, 0);
    if (Math.abs(sum - total) > 0.01) throw new Error(`TJAL Contratados Pagos: soma dos meses (${sum}) não bate com a coluna Total (${total}) em "${credor}"`);
    monthValues.forEach((amount, i) => { if (amount) out.push({ supplierName, supplierCnpj, expenseDescription: natureza, month: i + 1, amountReais: amount }); });
  }
  if (!out.length) throw new Error('TJAL Contratados Pagos: nenhuma linha de pagamento encontrada — layout pode ter mudado');
  return out;
}
