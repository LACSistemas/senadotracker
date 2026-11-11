import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * TJDFT — Tribunal de Justiça do Distrito Federal e dos Territórios (P14.33, 18º dos 27 TJs/DF).
 * Reconhecimento anterior (sessão passada) tinha descartado TJDFT por HTTP 403 — bloqueio que não existe
 * mais hoje (confirmado ao vivo, mesma lição já registrada pro TJAC: avaliação antiga nunca é definitiva).
 *
 * **Melhor fonte de pessoal de toda a série: JSON nativo, não PDF/HTML.** Cada alínea do Anexo IV
 * (`rh.tjdft.jus.br/s287/transparencia/cargosefetivos/anexo_iv_{a,b}.asp`) é um sistema ASP clássico — a
 * página em si só tem um `<select>` de datas-base; os dados reais vêm de um 2º request, POST pro endpoint
 * `ajaxBuscaQuantitativo*.asp` da MESMA pasta, com `data=AAAA-MM-DD` no corpo. Exige: (1) um GET prévio na
 * própria página `.asp` pra ganhar um cookie `ASPSESSIONID...`, (2) o POST com esse cookie + header
 * `Referer` apontando de volta pra página — sem o Referer o servidor devolve corpo vazio (sessão ASP
 * clássica, não CAPTCHA). Zero Playwright necessário, zero parsing de tabela/PDF: o JSON já vem com campos
 * tipados que batem exatamente com o vocabulário desta série.
 *
 * **Anexo I é um CSV "largo"**: ao contrário de todo tribunal anterior (um Inciso de cada vez, empilhado),
 * aqui os Incisos ficam LADO A LADO na mesma linha, em blocos fixos de 6 colunas (Alínea/Interno/
 * Discriminação/branco/Valor/branco) — Inciso I (cols 1-6), II (7-12), III (13-18), **sem Inciso IV**,
 * "Inciso V" (19-24, que na verdade é um detalhamento de REPASSES por Inciso de destino — "V-A" = repasse
 * usado em Pessoal e Encargos, não uma alínea nova), VI (27-32, Receitas). Cada bloco tem seu próprio número
 * de linhas (Inciso I só vai até "d", Inciso II vai até "z") — linhas que faltam ficam com célula vazia nos
 * blocos mais curtos, nunca "0" explícito. **Esta fonte não tem nenhuma linha de TOTAL/subtotal pra
 * conferência** — diferente de toda fonte anterior desta série — então a soma aqui é informativa, nunca
 * verificada contra um valor declarado pela própria fonte (documentado, não escondido). Sem separador de
 * milhar (só vírgula decimal, confirmado varrendo o arquivo inteiro à procura de ponto).
 *
 * Fornecedores (Contratados Pagos LDO): fonte existe mas o arquivo mais recente é de 01/2024 — quase 2 anos
 * desatualizado em relação ao pessoal/financeiro (08-09/2026) — fora de escopo aqui (não insere dado velho
 * como se fosse atual).
 */

const UA = 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)';

async function saveToD(content: Buffer, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; buf: Buffer }> {
  await fs.mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, content);
  return { path: destPath, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex'), buf: content };
}

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; buf: Buffer }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TJDFT download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return saveToD(buf, destDir, fileName);
}

/** Sessão ASP clássica: GET na própria página (cookie) + POST no endpoint ajax da mesma pasta (Referer +
 * Cookie), body `data=AAAA-MM-DD`. Sem isso (ou sem o Referer certo) o servidor devolve corpo vazio. */
export async function fetchAspJson(pageUrl: string, ajaxFileName: string, dateParam: string, destDir: string, saveAs: string): Promise<{ json: unknown[]; snapshot: { path: string; bytes: number; sha256: string } }> {
  const r1 = await fetch(pageUrl, { headers: { 'User-Agent': UA } });
  if (!r1.ok) throw new Error(`TJDFT download HTTP ${r1.status} ${pageUrl}`);
  const cookie = r1.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error(`TJDFT: sessão ASP (ASPSESSIONID) não recebida em ${pageUrl}`);
  const ajaxUrl = new URL(ajaxFileName, pageUrl).toString();
  const r2 = await fetch(ajaxUrl, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: pageUrl, Cookie: cookie },
    body: `data=${dateParam}`,
  });
  if (!r2.ok) throw new Error(`TJDFT ajax HTTP ${r2.status} ${ajaxUrl}`);
  const raw = Buffer.from(await r2.arrayBuffer());
  const json = JSON.parse(raw.toString('utf8'));
  if (!Array.isArray(json) || !json.length) throw new Error(`TJDFT ${ajaxUrl}: resposta vazia ou não é array — layout/sessão pode ter mudado`);
  const snapshot = await saveToD(raw, destDir, saveAs);
  return { json, snapshot };
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

interface AnexoIVARecord { Carreira: string; Escolaridade: string; ClasseCargo: string; PadraoCargo: string; CargoOcupado: number; CargoVago: number; Estavel: number; NaoEstavel: number; QtdAposentados: number; QtdInstituidoresDePensao: number; QtdBeneficiariosDePensao: number }

export function parseAnexoIVA(records: unknown[]): PersonnelRow[] {
  const rows = records as AnexoIVARecord[];
  const out: PersonnelRow[] = [];
  for (const r of rows) {
    const classLevel = [r.Escolaridade, r.ClasseCargo, r.PadraoCargo].filter(Boolean).join(' / ') || null;
    if (r.Estavel) out.push({ careerTrack: r.Carreira, positionTitle: r.Carreira, classLevel, status: 'ATIVO_ESTAVEL', headcount: r.Estavel, sourceAnnex: 'ANEXO_IV_A' });
    if (r.NaoEstavel) out.push({ careerTrack: r.Carreira, positionTitle: r.Carreira, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: r.NaoEstavel, sourceAnnex: 'ANEXO_IV_A' });
    if (r.CargoVago) out.push({ careerTrack: r.Carreira, positionTitle: r.Carreira, classLevel, status: 'VAGO', headcount: r.CargoVago, sourceAnnex: 'ANEXO_IV_A' });
    if (r.QtdAposentados) out.push({ careerTrack: r.Carreira, positionTitle: r.Carreira, classLevel, status: 'INATIVO_APOSENTADO', headcount: r.QtdAposentados, sourceAnnex: 'ANEXO_IV_A' });
    if (r.QtdInstituidoresDePensao) out.push({ careerTrack: r.Carreira, positionTitle: r.Carreira, classLevel, status: 'INSTITUIDOR_PENSAO', headcount: r.QtdInstituidoresDePensao, sourceAnnex: 'ANEXO_IV_A' });
    if (r.QtdBeneficiariosDePensao) out.push({ careerTrack: r.Carreira, positionTitle: r.Carreira, classLevel, status: 'BENEFICIARIO_PENSAO', headcount: r.QtdBeneficiariosDePensao, sourceAnnex: 'ANEXO_IV_A' });
  }
  // Estável/Não-estável/Vago/Aposentados/Instituidores/Beneficiários somam exatamente CargoCriado+inativos — mas
  // a própria fonte não expõe uma linha "TOTAL GERAL" (cada linha já é uma carreira/classe/padrão atômica, sem
  // rollup); a única verificação possível aqui é Ocupado=Estável+NãoEstável por linha, feita abaixo.
  for (const r of rows) {
    if (r.CargoOcupado !== r.Estavel + r.NaoEstavel) throw new Error(`TJDFT Anexo IV-a: CargoOcupado (${r.CargoOcupado}) != Estavel+NaoEstavel (${r.Estavel + r.NaoEstavel}) em ${r.Carreira} ${r.PadraoCargo}`);
  }
  if (!out.length) throw new Error('TJDFT Anexo IV-a: nenhuma linha reconhecida — layout pode ter mudado');
  return out;
}

interface AnexoIVBRecord { Fccj: string; NivelCargoComissao: string; OpcaoCargoSim: number; OpcaoCargoNao: number; SemVinculo: number; Vago: number; Subtotal: number }

export function parseAnexoIVB(records: unknown[]): PersonnelRow[] {
  const rows = records as AnexoIVBRecord[];
  const out: PersonnelRow[] = [];
  for (const r of rows) {
    const label = `${r.Fccj} ${r.NivelCargoComissao}`;
    if (r.OpcaoCargoSim) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: r.OpcaoCargoSim, sourceAnnex: 'ANEXO_IV_B' });
    if (r.OpcaoCargoNao) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: r.OpcaoCargoNao, sourceAnnex: 'ANEXO_IV_B' });
    if (r.SemVinculo) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: r.SemVinculo, sourceAnnex: 'ANEXO_IV_B' });
    if (r.Vago) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: r.Vago, sourceAnnex: 'ANEXO_IV_B' });
  }
  for (const r of rows) {
    if (r.Subtotal !== r.OpcaoCargoSim + r.OpcaoCargoNao) throw new Error(`TJDFT Anexo IV-b: Subtotal (${r.Subtotal}) != OpcaoCargoSim+OpcaoCargoNao (com vínculo efetivo) em ${r.Fccj} ${r.NivelCargoComissao}`);
  }
  if (!out.length) throw new Error('TJDFT Anexo IV-b: nenhuma linha reconhecida — layout pode ter mudado');
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

const parseBR = (s: string | undefined): number => {
  const t = (s ?? '').trim();
  if (!t) return 0;
  return Number(t.replace(',', '.')) || 0;
};

interface IncisoBlock { label: string; alineaCol: number; descCol: number; valorCol: number }
const BLOCKS: IncisoBlock[] = [
  { label: 'Inciso I — Despesas com Pessoal e Encargos', alineaCol: 1, descCol: 3, valorCol: 5 },
  { label: 'Inciso II — Outras Despesas de Custeio', alineaCol: 7, descCol: 9, valorCol: 11 },
  { label: 'Inciso III — Despesas com Investimentos', alineaCol: 13, descCol: 15, valorCol: 17 },
  { label: 'Inciso V — Repasses do Tesouro por Inciso de destino', alineaCol: 19, descCol: 21, valorCol: 23 },
  { label: 'Inciso VI — Receitas', alineaCol: 27, descCol: 29, valorCol: 31 },
];

/** CSV "largo": Incisos lado a lado em blocos fixos de 6 colunas, sem Inciso IV, sem linha de TOTAL (a
 * fonte genuinamente não publica uma — soma calculada aqui é informativa, nunca verificada contra a
 * própria fonte, diferente de toda fonte anterior desta série). */
export function parseAnexoI(buf: Buffer): FinanceRow[] {
  const text = buf.toString('utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).map(l => l.split(';'));
  const out: FinanceRow[] = [];
  for (const cells of lines) {
    for (const block of BLOCKS) {
      const alinea = (cells[block.alineaCol] ?? '').trim();
      const desc = (cells[block.descCol] ?? '').trim();
      if (!alinea || !desc) continue;
      if (/^Alínea$/i.test(alinea)) continue;
      const amount = parseBR(cells[block.valorCol]);
      out.push({ account: `${alinea} — ${desc}`, category: block.label, amountReais: amount });
    }
  }
  if (!out.length) throw new Error('TJDFT Anexo I: nenhuma linha de alínea encontrada — layout pode ter mudado');
  return out;
}
