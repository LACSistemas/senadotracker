import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

/**
 * TJSP — Tribunal de Justiça de São Paulo (P14.29+, 14º dos 27 TJs). Maior tribunal do Brasil. Pessoal (Anexo
 * IV-a/b) em PDF real, mas layout de TABELA POSICIONAL (colunas alinhadas por coordenada x, não por espaço em
 * texto) — a extração de texto linear (`pdf-parse`/`getText()`) embaralha a ordem (cabeçalho aparece DEPOIS dos
 * dados, rótulos multi-linha se intercalam com números de outras linhas). Por isso o parser usa `pdfjs-dist`
 * diretamente (`getTextContent()`) pra ler cada item com sua posição (x,y) real na página.
 *
 * As coordenadas x ABSOLUTAS mudam entre meses (confirmado ao vivo: ago/2026 e abr/2026 têm páginas de largura
 * diferente) — nunca hardcodeadas. Em vez disso, cada coluna é localizada a partir da própria linha TOTAL/TOTAL
 * GERAL do arquivo (que tem exatamente 1 token numérico por coluna, sem ambiguidade de rótulo quebrado em
 * várias linhas), e os valores de cada linha de dado são encaixados na coluna mais próxima.
 *
 * Anexo IV-a tem uma particularidade real da fonte: as colunas "Instituidores de Pensão**" e "Beneficiários de
 * Pensão**" aparecem como literal "**" em TODA linha de carreira — a nota de rodapé da própria fonte explica
 * que pensão não é discriminada por carreira (responsabilidade da SPPREV). Só a linha TOTAL GERAL tem valor
 * real pra essas 2 colunas — por isso elas viram 1 linha agregada (career_track=null), nunca uma por carreira.
 *
 * Financeiro: o "Relatório da Execução Orçamentária" (REO) não tem arquivo estático linkado direto — a página
 * usa 2 `<select>` (tipo de relatório, ano) + um botão "Baixar Arquivo" que faz um POST pra um endpoint que
 * devolve JSON com a URL real do PDF (nunca precisa de Playwright: é um POST simples, confirmado ao vivo pela
 * rede). O PDF em si é item-level (~225 rubricas, sem código de Natureza de Despesa) com uma hierarquia
 * pai/filho não desambiguável com segurança — por isso só as 7 linhas do resumo final (padrão Inciso I-IV dos
 * outros tribunais) viram dado, ver `parseExecucaoOrcamentaria`.
 */

async function downloadBuf(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`TJSP download HTTP ${res.status} ${url}`);
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
  if (!t || t === '-' || t === '--' || t === '**') return 0;
  return Number(t.replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.')) || 0;
};

interface Item { str: string; x: number; y: number }

async function getPositionedItems(pdfPath: string): Promise<Item[]> {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items
    .map((it: any) => ({ str: String(it.str ?? ''), x: it.transform[4] as number, y: it.transform[5] as number }))
    .filter((it: Item) => it.str.trim().length > 0);
}

/** Agrupa itens em "linhas físicas" (mesma coordenada y, tolerância pequena) — ainda não é a linha lógica da
 * tabela (um rótulo quebrado em 2 linhas físicas gera 2 grupos aqui; ver `stitchLogicalRows`). */
function groupPhysicalRows(items: Item[]): Array<{ y: number; items: Item[] }> {
  const byY = new Map<number, Item[]>();
  for (const it of items) {
    const key = Math.round(it.y / 3) * 3;
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key)!.push(it);
  }
  return [...byY.entries()]
    .map(([y, its]) => ({ y, items: its.sort((a, b) => a.x - b.x) }))
    .sort((a, b) => b.y - a.y); // topo -> baixo (y do PDF cresce pra cima)
}

/** Acha a linha TOTAL/TOTAL GERAL (rótulo começando com "TOTAL") e devolve suas colunas numéricas (x,str) em
 * ordem — essas x são usadas como as posições CANÔNICAS das colunas pro resto do arquivo (nunca hardcodeadas,
 * porque mudam de mês pra mês conforme a largura da página). */
function findTotalRow(physicalRows: Array<{ y: number; items: Item[] }>): { y: number; columns: Item[] } {
  for (const row of physicalRows) {
    const label = row.items.find(it => /^TOTAL\b/i.test(it.str.trim()));
    if (!label) continue;
    const columns = row.items.filter(it => it !== label && /^[\d.,*-]+$/.test(it.str.trim()));
    if (columns.length >= 4) return { y: row.y, columns };
  }
  throw new Error('TJSP: linha TOTAL/TOTAL GERAL não encontrada — layout pode ter mudado');
}

// Marcadores verticais de faixa de escolaridade (Ensino Superior/Médio/Fundamental) impressos como texto
// solto na mesma coluna dos rótulos de carreira (confirmado ao vivo no Anexo IV-a) — nunca parte do nome da
// carreira, mesmo quando caem na mesma linha física de uma carreira real.
const SIDEBAR_MARKER_RE = /^ENSINO( SUPERIOR| M[ÉE]DIO)?$|^FUNDAMENTAL$/i;

/** Monta linhas lógicas de dado. Um rótulo pode quebrar em várias linhas físicas — ANTES dos números (rótulo
 * comum), DEPOIS (confirmado ao vivo: "SECRETÁRIO" no Anexo IV-b de abr/2026 vem só DEPOIS da sua própria
 * linha de números) ou dos 2 lados (rótulo de 2 linhas com a linha de números encaixada no meio, confirmado no
 * Anexo IV-a). Por isso: toda linha física SEM nenhum item numérico (nas colunas canônicas) é só rótulo e
 * sempre se junta à linha de números mais próxima (anterior OU seguinte) — nunca à distância, já que uma linha
 * de dado real SEMPRE tem números em algum lugar, então uma linha 100% texto nunca é uma linha independente. */
function stitchLogicalRows(physicalRows: Array<{ y: number; items: Item[] }>, canonicalX: number[], labelMaxX: number): Array<{ label: string; values: string[] }> {
  const snap = (x: number) => { let best = 0, bestDist = Infinity; for (let i = 0; i < canonicalX.length; i++) { const d = Math.abs(x - canonicalX[i]!); if (d < bestDist) { bestDist = d; best = i; } } return best; };
  const classified = physicalRows.map(row => {
    const values: (string | null)[] = new Array(canonicalX.length).fill(null);
    const labelParts: string[] = [];
    for (const it of row.items) {
      if (it.x >= labelMaxX) { values[snap(it.x)] = it.str.trim(); continue; }
      const t = it.str.trim();
      if (!SIDEBAR_MARKER_RE.test(t)) labelParts.push(t);
    }
    return { y: row.y, labelParts, values, hasNumbers: values.some(v => v !== null) };
  });

  // uma linha só-rótulo nunca pertence a 2 linhas de número ao mesmo tempo (ex.: rótulo quebrado em 2 linhas
  // com a linha de números encaixada no meio — a 2ª metade do rótulo nunca pode "vazar" pra linha seguinte).
  const consumed = new Array(classified.length).fill(false);
  const out: Array<{ label: string; values: string[] }> = [];
  for (let i = 0; i < classified.length; i++) {
    const row = classified[i]!;
    if (!row.hasNumbers) continue; // absorvida por uma linha de números vizinha — nunca uma linha própria
    const ownLabelEmpty = row.labelParts.length === 0;
    const labelParts = [...row.labelParts];
    // só busca rótulo ANTES ou DEPOIS dos números quando a própria linha não trouxe nenhum rótulo — senão
    // rouba o rótulo de uma linha vizinha que já pertence a outra carreira (ou a um marcador de escolaridade).
    const prev = classified[i - 1];
    if (ownLabelEmpty && prev && !prev.hasNumbers && !consumed[i - 1]) { labelParts.unshift(...prev.labelParts); consumed[i - 1] = true; }
    // rótulo da PRÓXIMA carreira (confirmado ao vivo: "AUXILIAR DE GABINETE JUDICIÁRIO" tem rótulo+números
    // juntos, e a linha seguinte só-rótulo "AUXILIAR JUDICIÁRIO CHEFE" pertence à carreira seguinte, não a ela).
    const next = classified[i + 1];
    if (ownLabelEmpty && next && !next.hasNumbers && !consumed[i + 1]) { labelParts.push(...next.labelParts); consumed[i + 1] = true; }
    out.push({ label: labelParts.join(' ').trim(), values: row.values.map(v => v ?? '0') });
  }
  return out.filter(r => r.label.length > 0);
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

/** Anexo IV-a: cargos efetivos. 9 colunas: Estáveis, Não-Estáveis, Subtotal, Vagos, Total(ativos), Aposentados,
 * Instituidores de Pensão(sempre "**" por carreira), Total(inativos, = Aposentados+Benef.+Instit.), Beneficiários
 * de Pensão(sempre "**" por carreira). */
export async function parseAnexoIVA(pdfPath: string): Promise<PersonnelRow[]> {
  const items = await getPositionedItems(pdfPath);
  const physicalRows = groupPhysicalRows(items);
  const totalRowY = physicalRows.find(r => r.items.some(it => /^TOTAL GERAL$/i.test(it.str.trim())))?.y;
  if (totalRowY === undefined) throw new Error('TJSP Anexo IV-a: linha TOTAL GERAL não encontrada');
  const { columns: totalCols } = findTotalRow(physicalRows);
  if (totalCols.length !== 9) throw new Error(`TJSP Anexo IV-a: esperava 9 colunas na linha TOTAL GERAL, achei ${totalCols.length} — layout pode ter mudado`);
  const canonicalX = totalCols.map(c => c.x).sort((a, b) => a - b);
  const labelMaxX = canonicalX[0]! - 40;

  // linhas de dado: estritamente entre o cabeçalho (acima) e a linha TOTAL GERAL (abaixo, exclusive)
  const dataRows = physicalRows.filter(r => r.y > totalRowY && r.items.every(it => !/^(ATIVOS|INATIVOS E PENSIONISTAS|CARREIRA|Ocupados|Instituidores de|Beneficiários de|Pensão\*\*|Vagos|Total|Aposentados|Estáveis|Não-Estáveis|Subtotal|RESOLUÇÃO|a\) cargos|PODER|ÓRGÃO|UNIDADE|Data de|TRIBUNAL)/i.test(it.str.trim()) || it.x >= labelMaxX && !/^[A-ZÀ-Ú]/.test(it.str.trim())));
  const logical = stitchLogicalRows(dataRows, canonicalX, labelMaxX);

  const out: PersonnelRow[] = [];
  let sumEstaveis = 0, sumNaoEstaveis = 0, sumVagos = 0, sumAposentados = 0;
  for (const r of logical) {
    const [estaveis, naoEstaveis, , vagos, , aposentados] = r.values.map(parseBR);
    if (estaveis) out.push({ careerTrack: r.label, positionTitle: r.label, classLevel: null, status: 'ATIVO_ESTAVEL', headcount: estaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: r.label, positionTitle: r.label, classLevel: null, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis!, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: r.label, positionTitle: r.label, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_A' });
    if (aposentados) out.push({ careerTrack: r.label, positionTitle: r.label, classLevel: null, status: 'INATIVO_APOSENTADO', headcount: aposentados!, sourceAnnex: 'ANEXO_IV_A' });
    sumEstaveis += estaveis ?? 0; sumNaoEstaveis += naoEstaveis ?? 0; sumVagos += vagos ?? 0; sumAposentados += aposentados ?? 0;
  }
  const totalVals = totalCols.sort((a, b) => a.x - b.x).map(c => parseBR(c.str));
  const [tEstaveis, tNaoEstaveis, , tVagos, , tAposentados, tInstituidores, , tBeneficiarios] = totalVals;
  const got = { estaveis: sumEstaveis, naoEstaveis: sumNaoEstaveis, vagos: sumVagos, aposentados: sumAposentados };
  const expected = { estaveis: tEstaveis, naoEstaveis: tNaoEstaveis, vagos: tVagos, aposentados: tAposentados };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJSP Anexo IV-a: soma não bate com TOTAL GERAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  // Instituidores/Beneficiários de Pensão: fonte não discrimina por carreira ("**" em toda linha) — só a
  // linha TOTAL GERAL tem valor real, por isso vira 1 linha agregada (career_track=null).
  if (tInstituidores) out.push({ careerTrack: null, positionTitle: '(agregado — não discriminado por carreira pela fonte)', classLevel: null, status: 'INSTITUIDOR_PENSAO', headcount: tInstituidores!, sourceAnnex: 'ANEXO_IV_A' });
  if (tBeneficiarios) out.push({ careerTrack: null, positionTitle: '(agregado — não discriminado por carreira pela fonte)', classLevel: null, status: 'BENEFICIARIO_PENSAO', headcount: tBeneficiarios!, sourceAnnex: 'ANEXO_IV_A' });
  return out;
}

/** Anexo IV-b: cargos em comissão/funções de confiança. 6 colunas: Optante, Integral, Subtotal, Sem Vínculo,
 * Vagos, Total. */
export async function parseAnexoIVB(pdfPath: string): Promise<PersonnelRow[]> {
  const items = await getPositionedItems(pdfPath);
  const physicalRows = groupPhysicalRows(items);
  const { y: totalRowY, columns: totalCols } = findTotalRow(physicalRows);
  if (totalCols.length !== 6) throw new Error(`TJSP Anexo IV-b: esperava 6 colunas na linha TOTAL, achei ${totalCols.length} — layout pode ter mudado`);
  const canonicalX = totalCols.map(c => c.x).sort((a, b) => a - b);
  const labelMaxX = canonicalX[0]! - 40;

  const dataRows = physicalRows.filter(r => r.y > totalRowY && r.items.every(it => !/^(Ocupados|Com Vínculo|Sem Vínculo|Denominação|Optante|Remuneração|Efetivo|Vagos|Total|Cargo|Integral|Função|Subtotal|RESOLUÇÃO|b\) cargos|PODER|ÓRGÃO|UNIDADE|Data de|TRIBUNAL)/i.test(it.str.trim())));
  const logical = stitchLogicalRows(dataRows, canonicalX, labelMaxX);

  const out: PersonnelRow[] = [];
  let sumOptante = 0, sumIntegral = 0, sumSemVinculo = 0, sumVagos = 0;
  for (const r of logical) {
    const [optante, integral, , semVinculo, vagos] = r.values.map(parseBR);
    if (optante) out.push({ careerTrack: null, positionTitle: r.label, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante!, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: r.label, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral!, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: r.label, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo!, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: r.label, classLevel: null, status: 'VAGO', headcount: vagos!, sourceAnnex: 'ANEXO_IV_B' });
    sumOptante += optante ?? 0; sumIntegral += integral ?? 0; sumSemVinculo += semVinculo ?? 0; sumVagos += vagos ?? 0;
  }
  const totalVals = totalCols.sort((a, b) => a.x - b.x).map(c => parseBR(c.str));
  const [tOptante, tIntegral, , tSemVinculo, tVagos] = totalVals;
  const got = { optante: sumOptante, integral: sumIntegral, semVinculo: sumSemVinculo, vagos: sumVagos };
  const expected = { optante: tOptante, integral: tIntegral, semVinculo: tSemVinculo, vagos: tVagos };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJSP Anexo IV-b: soma não bate com TOTAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo "Relatório da Execução Orçamentária" (REO) — POST direto (sem Playwright): o form da página envia
 * `anoText=<ano>&tipoRelatorioValue=REO`, resposta é JSON com a URL do PDF estático real (confirmado ao vivo
 * via rede: Content-Type application/json contendo só a URL, nunca o PDF em si). */
export async function fetchExecucaoOrcamentariaUrl(ano: number): Promise<string> {
  const res = await fetch('https://www.tjsp.jus.br/CanaisComunicacao/Transparencia/DownloadArquivoExecucaoOrcamentaria', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' },
    body: `anoText=${ano}&tipoRelatorioValue=REO`,
  });
  if (!res.ok) throw new Error(`TJSP REO HTTP ${res.status}`);
  const url = JSON.parse(await res.text());
  if (typeof url !== 'string' || !/^https:\/\/www\.tjsp\.jus\.br\//.test(url)) throw new Error(`TJSP REO: URL inesperada: ${JSON.stringify(url)}`);
  return url;
}

export async function extractPdfText(pdfPath: string): Promise<string> {
  const parser = new PDFParse({ data: readFileSync(pdfPath) });
  return (await parser.getText()).text;
}

/** O relatório REO lista ~225 rubricas de despesa em nível de item (sem código de Natureza de Despesa visível,
 * só o rótulo), numa hierarquia pai/filho NÃO distinguível de forma confiável só pelo texto (confirmado ao
 * vivo: somar as ~40 primeiras linhas já dá o DOBRO do valor real de "Pessoal", porque cada classificação-pai
 * reaparece com o mesmo valor de uma de suas próprias linhas-filhas, ou se decompõe em várias). A ÚNICA faixa
 * seguramente verificável é o resumo de 4 categorias ao final do relatório (mesmo padrão Inciso I-IV usado
 * pelos outros tribunais: Pessoal e Encargos Sociais / Outras Despesas Correntes / Investimentos / Inversões
 * Financeiras), mais 3 linhas "deduzidas" de Outras Despesas Correntes que a própria fonte lista separadamente
 * (nota de rodapé "** DEDUZIDAS AS DESPESAS": são rubricas tratadas à parte, não duplicadas) — confirmado que
 * essas 7 linhas somam EXATAMENTE à linha de TOTAL GERAL (sem rótulo, logo após "Inversões Financeiras") que o
 * próprio relatório imprime. Por isso só essas 7 linhas viram FinanceRow; as ~218 linhas de item fiquem de
 * fora (risco real de dupla contagem sem o código de Natureza de Despesa pra desambiguar). O relatório é só de
 * despesas — não há seção de receita neste PDF (confirmado: 0 ocorrências de "receita" no texto extraído). */
// "TAXA ADMINISTRAÇÃO SÃO PAULO PREV..." vem truncado de forma diferente entre anos (confirmado ao vivo:
// "-SPPREV" em 2026, "-SPPRE" em 2025 — mesmo rótulo, 1 caractere a menos) — por isso casa só pelo prefixo
// estável, comum aos dois anos.
const REO_LABELS = ['PESSOAL E ENCARGOS SOCIAIS', 'OUTRAS DESPESAS CORRENTES', 'CUSTEIO DILIGÊNCIAS DOS OFIC.DE JUSTIÇA', 'CONTRIBUIÇÕES P/FORMAÇÃO DO PASEP/PIS', 'TAXA ADMINISTRAÇÃO SÃO PAULO PREV', 'INVESTIMENTOS', 'INVERSÕES FINANCEIRAS'];

export function parseExecucaoOrcamentaria(text: string, referenceMonthIndex: number): FinanceRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const numRe = /-?[\d.]+,\d{2}|(?<!\S)-(?!\S)/g;
  const extractTrailingValues = (line: string, count: number): number[] | null => {
    const matches = [...line.matchAll(numRe)];
    if (matches.length < count) return null;
    return matches.slice(-count).map(m => parseBR(m[0]));
  };

  const startIdx = lines.findIndex(l => l.startsWith('PESSOAL E ENCARGOS SOCIAIS'));
  const endIdx = lines.findIndex(l => l.startsWith('INVERSÕES FINANCEIRAS'));
  if (startIdx < 0 || endIdx < startIdx) throw new Error('TJSP REO: seção de resumo (Pessoal..Inversões Financeiras) não encontrada — layout pode ter mudado');
  const recapLines = lines.slice(startIdx, endIdx + 1);
  const out: FinanceRow[] = [];
  for (const line of recapLines) {
    const label = REO_LABELS.find(l => line.startsWith(l));
    if (!label) throw new Error(`TJSP REO: linha de resumo inesperada: ${JSON.stringify(line.slice(0, 60))}`);
    const vals = extractTrailingValues(line, 13);
    if (!vals) throw new Error(`TJSP REO: linha "${label}" sem as 13 colunas esperadas (12 meses + soma)`);
    out.push({ account: label, category: 'Execução Orçamentária e Financeira (REO) — resumo CNJ 4 categorias', amountReais: vals[referenceMonthIndex]! });
  }
  if (out.length !== REO_LABELS.length) throw new Error(`TJSP REO: esperava ${REO_LABELS.length} linhas de resumo, achei ${out.length}`);

  // Linha de TOTAL GERAL: logo após "Inversões Financeiras", sem rótulo (só números) — única verificação
  // legítima disponível nesta fonte (não há totalizador por rubrica individual).
  const grandTotalLine = lines[endIdx + 1];
  const grandTotalVals = grandTotalLine ? extractTrailingValues(grandTotalLine, 13) : null;
  if (!grandTotalVals) throw new Error('TJSP REO: linha de TOTAL GERAL (após Inversões Financeiras) não encontrada');
  const got = out.reduce((s, r) => s + r.amountReais, 0);
  const expected = grandTotalVals[referenceMonthIndex]!;
  if (Math.abs(got - expected) > 0.01) throw new Error(`TJSP REO: soma do resumo não bate com o TOTAL GERAL. calculado=${got} esperado=${expected}`);
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }
const formatCnpj = (digits: string) => `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;

/** "Relação de Contratados Pagos" (XLSX, 1 arquivo por ano, aba "CNPJ_Natureza da Despesa") — por CNPJ/CPF ×
 * natureza de despesa × mês, com linha TOTAL ao final (verificação real, mês a mês). A PRÓPRIA FONTE já
 * mascara CPF de pessoa física (ex. "***.***.878-**") — nunca aparece em claro, diferente de todo tribunal
 * anterior (onde a máscara/exclusão era responsabilidade nossa). Só documento 100% numérico de 14 dígitos vira
 * CNPJ (regra idêntica aos outros tribunais); os poucos códigos de 11 dígitos sem máscara (2 casos: PRODESP e
 * SPPREV, CNPJ de órgão público com zeros à esquerda perdidos pelo Excel) e os códigos internos "PF########"
 * (pessoa física sem CNPJ) ficam com `supplierCnpj=null` — perde o CNPJ reconstruído desses 2 casos
 * institucionais, mas mantém a regra simples e nunca arrisca tratar um CPF como CNPJ.
 *
 * A aba "OB" (Ordem Bancária, ~70 mil linhas em menos de 1 ano) tem granularidade de PAGAMENTO INDIVIDUAL,
 * com texto livre de justificativa que às vezes cita nome de autoridade/magistrado — fora de escopo (nunca
 * usada), mesmo nível de granularidade (mensal agregado) usado por todo tribunal anterior da série. */
export function parseContratadosPagos(buf: Buffer): SupplierPaymentRow[] {
  const wb = XLSX.read(buf);
  const sheet = wb.Sheets['CNPJ_Natureza da Despesa'];
  if (!sheet) throw new Error('TJSP Contratados Pagos: aba "CNPJ_Natureza da Despesa" não encontrada — layout pode ter mudado');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as unknown[][];
  const monthHeaderRow = rows.find(r => (r[2] as string)?.toString().trim() === 'Mês Lançamento');
  if (!monthHeaderRow) throw new Error('TJSP Contratados Pagos: linha de cabeçalho de mês não encontrada');
  const MONTHS_PT3 = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const monthCols: Array<{ col: number; month: number }> = [];
  for (let c = 4; c < monthHeaderRow.length; c++) {
    const label = (monthHeaderRow[c] as string ?? '').toString().toUpperCase();
    const m = MONTHS_PT3.findIndex(mm => label.startsWith(mm));
    if (m >= 0) monthCols.push({ col: c, month: m + 1 });
  }
  if (!monthCols.length) throw new Error('TJSP Contratados Pagos: nenhuma coluna de mês reconhecida');

  const headerIdx = rows.indexOf(monthHeaderRow);
  const dataStart = headerIdx + 2; // pula a linha de rótulos de coluna (CPF/CNPJ, Nome, ...) logo abaixo
  const out: SupplierPaymentRow[] = [];
  const sums = new Map<number, number>();
  let totalRowVals: number[] | null = null;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i]!;
    const doc = (r[0] ?? '').toString().trim();
    if (!doc) continue;
    if (doc === 'Total') { totalRowVals = monthCols.map(({ col }) => Number(r[col]) || 0); continue; }
    const docDigits = doc.replace(/\D/g, '');
    const supplierName = (r[1] ?? '').toString().trim();
    const supplierCnpj = /^\d{14}$/.test(docDigits) ? formatCnpj(docDigits) : null;
    const expenseDescription = (r[3] ?? '').toString().trim();
    for (const { col, month } of monthCols) {
      const amount = Number(r[col]) || 0;
      if (!amount) continue;
      out.push({ supplierName, supplierCnpj, expenseDescription, month, amountReais: amount });
      sums.set(month, (sums.get(month) ?? 0) + amount);
    }
  }
  if (!totalRowVals) throw new Error('TJSP Contratados Pagos: linha TOTAL não encontrada');
  for (let i = 0; i < monthCols.length; i++) {
    const { month } = monthCols[i]!;
    const got = sums.get(month) ?? 0;
    const expected = totalRowVals[i]!;
    if (Math.abs(got - expected) > 0.5) throw new Error(`TJSP Contratados Pagos: soma do mês ${month} não bate com TOTAL. calculado=${got} esperado=${expected}`);
  }
  return out;
}
