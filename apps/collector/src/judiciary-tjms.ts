import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * TJMS — Tribunal de Justiça de Mato Grosso do Sul (P14.36, 21º dos 27 TJs). Memória de reconhecimentos
 * anteriores dizia "portal morto" — falso: `/transparencia` em `www.tjms.jus.br` só redireciona (301/302,
 * nunca bloqueio) pra `www5.tjms.jus.br/transparencia/`, um shell estático cujo menu real (ícones de
 * navegação) só aparece no corpo da página do Confluence institucional (`sti.tjms.jus.br/confluence`), que
 * hospeda o conteúdo via REST API pública (`/rest/api/content/{id}?expand=body.view`, sem sessão). Navegando
 * esse Confluence (espaços GP="Gestão de Pessoas" e ORC="Gestão Orçamentária e Financeira") leva aos PHPs
 * reais que servem o dado: `www5.tjms.jus.br/transparencia/resolucao102/anexo4a.php` (redireciona de volta
 * pro domínio www, outro 301 sem bloqueio) e `.../anexo1/index.php?dataRef=MM/YYYY`.
 *
 * **Anexo IV (pessoal) é CSV em ISO-8859-1 (`charset=iso-8859-1` real, não windows-1252 — decodificado com
 * `Buffer.toString('latin1')`, mapeamento 1:1 sem as armadilhas de byte C1 do TextDecoder já vistas no
 * TJMA), ponto-e-vírgula, com célula de cabeçalho multi-linha entre aspas** (`"CARREIRA / CLASSE /
 * \nESCOLARIDADE / PADRÃO"`) — exige parser CSV ciente de aspas multi-linha (`parseCsvSemicolon`), não um
 * split por linha simples. Layout de colunas fixo (Estável/Não-Estável/Subtotal/Vagos/Total/Aposentados/
 * Instituidores de Pensão/Total/Beneficiários de Pensão), com uma linha "TOTAL <CARREIRA>" fechando cada
 * grupo de padrões/classes (só essa linha agregada é usada, nunca os padrões individuais) e "TOTAL GERAL"
 * ao final. **Achado real, campo derivado com erro na própria fonte** (mesma categoria já vista em TJAL/TJSE):
 * a linha "TOTAL ESCRIVÃO" tem Subtotal=5 mas Estável(0)+Não-Estável(0)=0 — só no campo DERIVADO (Subtotal),
 * nunca verificado; os 6 campos independentes (Estável/NãoEstável/Vagos/Aposentados/Instituidores/
 * Beneficiários) batem exatamente contra TOTAL GERAL. Anexo IV-b (comissionados) é estrutura similar mas
 * mais simples — 2 seções ("Cargos em comissão" e "Funções de Confiança", a 2ª sem população "Sem Vínculo
 * Efetivo" nenhuma, coluna sempre vazia), cada linha de cargo nomeado já é 1 entrada de dado (sem
 * agrupamento por padrão), fechadas por "Total Cargos"/"Total  Funções" (rollups intermediários, descartados)
 * e uma linha "TOTAL" final.
 *
 * **Anexo I (financeiro) é HTML consultável por mês via GET simples** (`anexo1/index.php?dataRef=MM/YYYY`,
 * sem sessão, sem bloqueio) — mesmo template padrão da Resolução 102/2009 CNJ já visto em toda a série
 * (Incisos I-VI, cada um com linhas Alínea/Descrição/Valor e uma linha "Total:" de fechamento). **Achado
 * real de marcação**: TODA linha "Total:" do HTML fecha com `<tr>` em vez de `</tr>` (erro de template
 * consistente nos 6 Incisos, não um acidente isolado) — em vez de um parser DOM estrito (que quebraria
 * nessa tag malformada, fundindo seções), o parser aqui nunca depende do fechamento de `<tr>`/`<td>`: achata
 * todo o HTML num stream de tokens (um valor de célula por linha, tags trocadas por quebra de linha) e
 * processa por reconhecimento de padrão (título de Inciso → "Alínea"/"Descrição"/"Valor" cabeçalho ignorado
 * naturalmente por não casar o regex de letra única → trincas letra/descrição/valor → "Total:"+valor fecha
 * o Inciso) — mesma técnica column-by-recognition já usada nos PDFs column-major do TJSP/TJAL, adaptada pra
 * HTML quebrado.
 *
 * **Fornecedores: fora de escopo, por desproporção de esforço, não por bloqueio.** A categoria "Pagamento a
 * Fornecedores" tem um PDF por mês (confirmado real, sem bloqueio) — mas cada um é um livro-caixa detalhado
 * por TRANSAÇÃO (não um resumo agregado "pagamento por credor" como o XLSX do TJAL), com ~54 páginas por mês
 * e descrição ("Finalidade") livre quebrada em várias linhas sem borda de coluna confiável. Replicar a
 * cobertura anual completa do TJAL exigiria processar ~9-12 PDFs x 54 páginas = centenas de páginas de
 * geometria instável, desproporcional ao ganho (quando a série já tem pessoal E financeiro completos e
 * verificados aqui) — documentado como `DOCUMENTED_PDF_ONLY`, não perseguido.
 */

const UA = 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)';

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; buf: Buffer }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TJMS download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), buf };
}

/** Parser CSV ponto-e-vírgula ciente de aspas multi-linha (RFC4180-ish) — necessário porque o cabeçalho da
 * própria fonte vem com uma célula entre aspas contendo uma quebra de linha literal. */
function parseCsvSemicolon(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ';') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const parseIntBR = (s: string | undefined): number => { const t = (s ?? '').trim().replace(/\./g, ''); return t === '' ? 0 : Number(t) || 0; };

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

interface Independent6 { estavel: number; naoEstavel: number; vagos: number; aposentados: number; instituidores: number; beneficiarios: number }
const sumIndependent6 = (rows: Independent6[]): Independent6 => rows.reduce((s, r) => ({ estavel: s.estavel + r.estavel, naoEstavel: s.naoEstavel + r.naoEstavel, vagos: s.vagos + r.vagos, aposentados: s.aposentados + r.aposentados, instituidores: s.instituidores + r.instituidores, beneficiarios: s.beneficiarios + r.beneficiarios }), { estavel: 0, naoEstavel: 0, vagos: 0, aposentados: 0, instituidores: 0, beneficiarios: 0 });
function emitIndependent6(career: string, b: Independent6): PersonnelRow[] {
  const out: PersonnelRow[] = [];
  const push = (status: string, headcount: number) => { if (headcount) out.push({ careerTrack: career, positionTitle: career, classLevel: null, status, headcount, sourceAnnex: 'ANEXO_IV_A' }); };
  push('ATIVO_ESTAVEL', b.estavel);
  push('ATIVO_NAO_ESTAVEL', b.naoEstavel);
  push('VAGO', b.vagos);
  push('INATIVO_APOSENTADO', b.aposentados);
  push('INSTITUIDOR_PENSAO', b.instituidores);
  push('BENEFICIARIO_PENSAO', b.beneficiarios);
  return out;
}

/** Anexo IV-a: só as linhas "TOTAL <CARREIRA>" (fecham cada grupo de padrão/classe) e "TOTAL GERAL" (usada
 * só pra verificação dos 6 campos independentes — nunca Subtotal/Total1/Total2, campos derivados que podem
 * ter erro na própria fonte, mesma convenção já estabelecida em toda a série). */
export function parseAnexoIVA(buf: Buffer): PersonnelRow[] {
  const rows = parseCsvSemicolon(buf.toString('latin1'));
  const out: PersonnelRow[] = [];
  const groupBuckets: Independent6[] = [];
  let totalGeral: Independent6 | null = null;
  let started = false;
  const extract = (cols: string[]): Independent6 => ({ estavel: parseIntBR(cols[3]), naoEstavel: parseIntBR(cols[4]), vagos: parseIntBR(cols[6]), aposentados: parseIntBR(cols[8]), instituidores: parseIntBR(cols[9]), beneficiarios: parseIntBR(cols[11]) });
  for (const cols of rows) {
    const label = (cols[0] ?? '').trim();
    if (!started) { if (/^CARREIRA/i.test(label)) started = true; continue; }
    if (!label) continue;
    if (/^TOTAL GERAL$/i.test(label)) { totalGeral = extract(cols); continue; }
    const m = /^TOTAL\s+(.+)$/i.exec(label);
    if (m) {
      const career = m[1]!.trim().replace(/\s+/g, ' ');
      const b = extract(cols);
      groupBuckets.push(b);
      out.push(...emitIndependent6(career, b));
    }
  }
  if (!totalGeral) throw new Error('TJMS Anexo IV-a: linha "TOTAL GERAL" não encontrada — layout pode ter mudado');
  const sum = sumIndependent6(groupBuckets);
  if (JSON.stringify(sum) !== JSON.stringify(totalGeral)) throw new Error(`TJMS Anexo IV-a: soma dos grupos (${JSON.stringify(sum)}) != TOTAL GERAL (${JSON.stringify(totalGeral)})`);
  if (!out.length) throw new Error('TJMS Anexo IV-a: nenhuma linha reconhecida — layout pode ter mudado');
  return out;
}

interface Buckets4 { optante: number; integral: number; semVinculo: number; vagos: number }
const sumBuckets4 = (rows: Buckets4[]): Buckets4 => rows.reduce((s, r) => ({ optante: s.optante + r.optante, integral: s.integral + r.integral, semVinculo: s.semVinculo + r.semVinculo, vagos: s.vagos + r.vagos }), { optante: 0, integral: 0, semVinculo: 0, vagos: 0 });

/** Anexo IV-b: 2 seções ("Cargos em comissão" — com população Sem Vínculo Efetivo; "Funções de Confiança" —
 * sem essa população, coluna sempre vazia na própria fonte). Cada linha de cargo nomeado já é 1 entrada;
 * "Total Cargos"/"Total  Funções" são rollups intermediários (descartados), só a linha "TOTAL" final é usada
 * pra verificação (soma dos 4 campos independentes Optante/Integral/SemVínculo/Vagos). */
export function parseAnexoIVB(buf: Buffer): PersonnelRow[] {
  const rows = parseCsvSemicolon(buf.toString('latin1'));
  const out: PersonnelRow[] = [];
  const rowBuckets: Buckets4[] = [];
  let totalGeral: Buckets4 | null = null;
  let started = false;
  const extract = (cols: string[]): Buckets4 => ({ optante: parseIntBR(cols[1]), integral: parseIntBR(cols[2]), semVinculo: parseIntBR(cols[4]), vagos: parseIntBR(cols[5]) });
  for (const cols of rows) {
    const label = (cols[0] ?? '').trim();
    if (!started) { if (/^Denomina/i.test(label)) started = true; continue; }
    if (!label) continue;
    if (/^(Cargos em comiss|Fun[çc][õo]es de Confian)/i.test(label)) continue; // título de seção, sem dado
    if (/^TOTAL$/i.test(label)) { totalGeral = extract(cols); continue; }
    if (/^Total\s+(Cargos|Fun[çc][õo]es)/i.test(label)) continue; // rollup intermediário por seção
    const b = extract(cols);
    rowBuckets.push(b);
    if (b.optante) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: b.optante, sourceAnnex: 'ANEXO_IV_B' });
    if (b.integral) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: b.integral, sourceAnnex: 'ANEXO_IV_B' });
    if (b.semVinculo) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: b.semVinculo, sourceAnnex: 'ANEXO_IV_B' });
    if (b.vagos) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: b.vagos, sourceAnnex: 'ANEXO_IV_B' });
  }
  if (!totalGeral) throw new Error('TJMS Anexo IV-b: linha "TOTAL" não encontrada — layout pode ter mudado');
  const sum = sumBuckets4(rowBuckets);
  if (JSON.stringify(sum) !== JSON.stringify(totalGeral)) throw new Error(`TJMS Anexo IV-b: soma das linhas (${JSON.stringify(sum)}) != TOTAL (${JSON.stringify(totalGeral)})`);
  if (!out.length) throw new Error('TJMS Anexo IV-b: nenhuma linha reconhecida — layout pode ter mudado');
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

const parseBR = (s: string | undefined): number => { const t = (s ?? '').trim(); if (!t || t === '-') return 0; return Number(t.replace(/\./g, '').replace(',', '.')) || 0; };

const HTML_ENTITIES: Record<string, string> = { iacute: 'í', Iacute: 'Í', eacute: 'é', Eacute: 'É', atilde: 'ã', Atilde: 'Ã', otilde: 'õ', Otilde: 'Õ', ccedil: 'ç', Ccedil: 'Ç', ecirc: 'ê', Ecirc: 'Ê', ocirc: 'ô', Ocirc: 'Ô', acirc: 'â', Acirc: 'Â', aacute: 'á', Aacute: 'Á', agrave: 'à', Agrave: 'À', uacute: 'ú', Uacute: 'Ú', oacute: 'ó', Oacute: 'Ó', ntilde: 'ñ', amp: '&' };
const decodeEntities = (s: string) => s.replace(/&([a-zA-Z]+);/g, (m, name) => HTML_ENTITIES[name] ?? m);

/** Achata o HTML da Anexo I (que fecha TODA linha "Total:" com `<tr>` em vez de `</tr>`, erro de template
 * consistente nos 6 Incisos) num stream de tokens — um valor de célula por linha — em vez de depender de
 * pareamento de tag, que quebraria nessa marcação malformada. */
function flattenCells(html: string): string[] {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/<\/(td|tr|table)>/gi, '\n')
    .replace(/<[^>]*>/g, '\n')
    .split('\n')
    .map(s => decodeEntities(s).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Anexo I: HTML consultável por mês (Inciso I-VI, Alínea/Descrição/Valor, linha "Total:" de fechamento por
 * Inciso). Reconhecimento por padrão no stream de tokens (nunca por estrutura de tag): título de Inciso
 * ("I - Despesas..."), header "Alínea"/"Descrição"/"Valor (em R$)" ignorado por não casar o regex de letra
 * única, trincas letra→descrição→valor, "Total:"+valor fecha e verifica a soma do Inciso. */
export function parseAnexoI(html: string): FinanceRow[] {
  const tokens = flattenCells(html);
  const out: FinanceRow[] = [];
  let inciso = '';
  let runningSum = 0;
  const incisoRe = /^[IVX]+\s*-\s*.+$/;
  const letterRe = /^[A-Z]$/;
  const moneyRe = /^-?[\d.]+,\d{2}$/;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (incisoRe.test(t)) { inciso = t; runningSum = 0; continue; }
    if (/^Total:?$/i.test(t)) {
      const val = tokens[i + 1];
      if (val !== undefined && moneyRe.test(val)) {
        const declared = parseBR(val);
        if (Math.abs(declared - runningSum) > 0.01) throw new Error(`TJMS Anexo I: soma do "${inciso}" (${runningSum.toFixed(2)}) != linha Total (${declared})`);
        i++;
      }
      continue;
    }
    if (letterRe.test(t) && inciso) {
      const desc = tokens[i + 1];
      const val = tokens[i + 2];
      if (desc !== undefined && val !== undefined && moneyRe.test(val) && !letterRe.test(desc)) {
        const amount = parseBR(val);
        out.push({ account: `${t.toLowerCase()} — ${desc}`, category: `Inciso ${inciso}`, amountReais: amount });
        runningSum += amount;
        i += 2;
      }
    }
  }
  if (!out.length) throw new Error('TJMS Anexo I: nenhuma linha de alínea encontrada — layout pode ter mudado');
  return out;
}
