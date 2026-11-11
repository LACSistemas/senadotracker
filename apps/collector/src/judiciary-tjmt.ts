import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

/**
 * TJMT — Tribunal de Justiça de Mato Grosso (P14.32, 17º dos 27 TJs). Publicado via um CMS Angular (SSR) com
 * um padrão de wrapper `?url=/Institucional/C/{id}` que esconde links de download estáticos — o reconhecimento
 * inicial (via subagent) viu só a "folha de pagamento" como SPA (Angular hash-routed, precisa Playwright) e
 * concluiu precipitadamente que todo o Anexo IV/I também precisaria disso; na prática, Anexo IV-a/b e Anexo I
 * são arquivos ODS ESTÁTICOS hospedados em `cms.tjmt.jus.br/Download.aspx?arquivo=...`, server-rendered,
 * `fetch()` simples resolve tudo sem Playwright — a folha de pagamento (SPA) nunca é usada aqui.
 *
 * TJAP foi descartado antes deste tribunal: suas 4 telas ScriptCase exigem resolver um reCAPTCHA real
 * (`grecaptcha.getResponse()` no próprio JS de submissão do formulário) — não é só um bloqueio de página, é
 * uma barreira de automação deliberada na submissão dos dados, que não deve ser contornada.
 *
 * O Anexo IV do TJMT segue a estrutura literal da Resolução 102/CNJ (itens a-h) sem combinar inativos/
 * pensionistas no mesmo arquivo — "Despesas com Pessoal Inativo e Pensões" só aparece no Anexo I (como
 * categoria de DESPESA, não contagem de pessoas); não existe item h equivalente a aposentados/pensionistas
 * (o item h de fato existente, "Beneficiários de auxílios assistenciais (FACULTATIVO)", é outra coisa — não
 * confundir com pensão). Diferente de TJSE/TJAC (que tinham essas 3 colunas no mesmo arquivo), aqui o dado
 * genuinamente não existe como contagem de pessoas em nenhum anexo público — gap real da fonte, documentado,
 * não um bug de parsing.
 *
 * Cada arquivo tem colunas 2025 E 2026 lado a lado (comparativo ano-a-ano) mais uma coluna de Variação % —
 * usamos só a coluna 2026 (mais recente). A coluna final "Total" de cada arquivo tem uma inconsistência
 * sistemática (é "Total OCUPADOS", sem somar Vagos, apesar do rótulo "Total" sugerir "Total geral") — nunca
 * verificado contra ela, só contra os campos independentes (Estáveis/Não-Estáveis/Vagos ou Optante/Integral/
 * SemVínculo/Vagos), mesma convenção já usada em toda a série.
 *
 * Cada arquivo tem linhas de rollup intermediárias por grupo de carreira ("TOTAL Técnico Judiciário", "TOTAL
 * PDA") ALÉM da "TOTAL GERAL" final — essas linhas de grupo são puro re-somatório das linhas de detalhe
 * anteriores (nunca dados novos) e são excluídas para não contar em dobro; só "TOTAL GERAL" é usada, e só
 * para verificação, nunca inserida como linha de dado.
 */

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; buf: Buffer }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`TJMT download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), buf };
}

const parseBR = (s: unknown): number => {
  const t = (s ?? '').toString().trim();
  if (!t || t === '-') return 0;
  return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
};

function readFirstSheetRows(buf: Buffer): unknown[][] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: false });
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_A' | 'ANEXO_IV_B' }

export function parseAnexoIVA(buf: Buffer): PersonnelRow[] {
  const rows = readFirstSheetRows(buf);
  let totalGeral: { estaveis: number; naoEstaveis: number; vagos: number } | null = null;
  const out: PersonnelRow[] = [];
  for (const r of rows) {
    const label = (r[0] ?? '').toString().trim();
    if (!label) continue;
    if (/^TOTAL\s+GERAL$/i.test(label)) { totalGeral = { estaveis: parseBR(r[2]), naoEstaveis: parseBR(r[5]), vagos: parseBR(r[10]) }; continue; }
    if (/^TOTAL\s+/i.test(label)) continue;
    if (r.length < 11) continue;
    const estaveis = parseBR(r[2]), naoEstaveis = parseBR(r[5]), vagos = parseBR(r[10]);
    if (!estaveis && !naoEstaveis && !vagos) continue;
    if (estaveis) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'ATIVO_ESTAVEL', headcount: estaveis, sourceAnnex: 'ANEXO_IV_A' });
    if (naoEstaveis) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis, sourceAnnex: 'ANEXO_IV_A' });
    if (vagos) out.push({ careerTrack: label, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_A' });
  }
  if (!totalGeral) throw new Error('TJMT Anexo IV-a: linha "TOTAL GERAL" não encontrada — layout pode ter mudado');
  if (!out.length) throw new Error('TJMT Anexo IV-a: nenhuma linha de carreira encontrada — layout pode ter mudado');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { estaveis: sum('ATIVO_ESTAVEL'), naoEstaveis: sum('ATIVO_NAO_ESTAVEL'), vagos: sum('VAGO') };
  if (JSON.stringify(got) !== JSON.stringify(totalGeral)) throw new Error(`TJMT Anexo IV-a: soma não bate com TOTAL GERAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(totalGeral)}`);
  return out;
}

export function parseAnexoIVB(buf: Buffer): PersonnelRow[] {
  const rows = readFirstSheetRows(buf);
  let totalGeral: { optante: number; integral: number; semVinculo: number; vagos: number } | null = null;
  const out: PersonnelRow[] = [];
  for (const r of rows) {
    const label = (r[0] ?? '').toString().trim();
    if (!label) continue;
    if (/^TOTAL\s+GERAL$/i.test(label)) { totalGeral = { optante: parseBR(r[2]), integral: parseBR(r[5]), semVinculo: parseBR(r[8]), vagos: parseBR(r[11]) }; continue; }
    if (/^TOTAL\s+/i.test(label)) continue;
    if (r.length < 12) continue;
    const optante = parseBR(r[2]), integral = parseBR(r[5]), semVinculo = parseBR(r[8]), vagos = parseBR(r[11]);
    if (!optante && !integral && !semVinculo && !vagos) continue;
    if (optante) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_B' });
  }
  if (!totalGeral) throw new Error('TJMT Anexo IV-b: linha "TOTAL GERAL" não encontrada — layout pode ter mudado');
  if (!out.length) throw new Error('TJMT Anexo IV-b: nenhuma linha de cargo encontrada — layout pode ter mudado');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { optante: sum('OCUPADO_COM_VINCULO_OPTANTE'), integral: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  if (JSON.stringify(got) !== JSON.stringify(totalGeral)) throw new Error(`TJMT Anexo IV-b: soma não bate com TOTAL GERAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(totalGeral)}`);
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

export function parseAnexoI(buf: Buffer): FinanceRow[] {
  const rows = readFirstSheetRows(buf);
  const out: FinanceRow[] = [];
  let inciso = '';
  let runningTotal = 0;
  for (const r of rows) {
    const c1 = (r[1] ?? '').toString().trim();
    if (!c1) continue;
    if (/^Inciso\s/i.test(c1)) { inciso = c1; runningTotal = 0; continue; }
    if (/^Alínea$/i.test(c1)) continue;
    if (/^Total\s*-\s*Inciso/i.test(c1)) {
      const declared = parseBR(r[6]);
      if (Math.abs(declared - runningTotal) > 0.01) throw new Error(`TJMT Anexo I: soma do "${inciso}" (${runningTotal}) não bate com "${c1}" (${declared})`);
      continue;
    }
    const descricao = (r[2] ?? '').toString().trim();
    if (!descricao) continue;
    const amount = parseBR(r[6]);
    out.push({ account: `${c1} — ${descricao}`, category: inciso, amountReais: amount });
    runningTotal += amount;
  }
  if (!out.length) throw new Error('TJMT Anexo I: nenhuma linha de alínea encontrada — layout pode ter mudado');
  return out;
}
