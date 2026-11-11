import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * TJMA — Tribunal de Justiça do Maranhão (P14.35, 20º dos 27 TJs). **Escopo reduzido, real e documentado**:
 * o item (a) "Cargos Efetivos do Quadro de Pessoal do Órgão" — a métrica mais central de todo tribunal
 * anterior desta série (estáveis/não-estáveis/vagos) — está com link morto no sistema novo
 * (`financas/index.php?acao_portal=anexo_04_a` → 404 confirmado) e sem substituto no sistema legado
 * (também 404). O item (e) Cargos de Magistrados tem o mesmo problema. Os outros 6 subitens do Anexo IV
 * (b,c,d,f,g,h) funcionam ao vivo via um sistema real de RH (Mentorh), mas só o item (b) "Cargos em Comissão
 * e Funções de Confiança" mapeia pro vocabulário desta série (Optante/Integral/SemVínculo/Vagos) — os
 * demais são população diferente (origem funcional de comissionados, situação de servidores/magistrados
 * ativos SEM contagem de vagos, magistrados externos, auxílio-benefício assistencial — nunca pensão).
 * Fornecedores em lote: também confirmado morto (404) nos links oficiais do site. Candidato escolhido
 * mesmo assim porque, somado, entrega mais dado real que as alternativas da rodada (TJRO tem financeiro bom
 * mas ZERO pessoal, bloqueado por um WAF anti-bot dedicado — Rybena, HTTP 420 em todo path — que não deve
 * ser contornado).
 *
 * **Página (b) é consulta em tempo real, não um arquivo de período fixo**: `?mes=X&ano=Y` na URL da página
 * NUNCA muda a "Data de Referência" exibida (sempre mostra o dia em que a consulta é feita) — confirmado ao
 * vivo. `reference_year`/`reference_month` aqui são a DATA DA COLETA, não um período de publicação fixo
 * como em toda outra fonte desta série.
 *
 * **Anexo I vem em CSV windows-1252 (não UTF-8)**, layout "largo" com 1 mês por coluna (1 arquivo cobre o ano
 * inteiro, só o mais recente publicado precisa ser baixado) — cada linha "Inciso X" já é, ela mesma, o TOTAL
 * daquele Inciso por mês (soma das alíneas abaixo dela), usada aqui pra verificação por Inciso (não existe
 * uma linha de TOTAL GERAL separada no arquivo).
 */

const UA = 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)';

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; buf: Buffer }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`TJMA download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), buf };
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number; sourceAnnex: 'ANEXO_IV_B' }

/** Item (b): HTML com tabela real (sistema Mentorh), 2 seções ("Cargos em Comissão", "Funções de
 * Confiança"), linhas de rollup marcadas com `class="sumario-parcial"` (2 subtotais de seção + 1 "TOTAL"
 * geral, todas excluídas dos dados — usadas só pra verificação) — nunca usar o texto do rótulo pra
 * distinguir dado de rollup, só a classe CSS (mesma lição de "detectar por estrutura, não por conteúdo" já
 * aprendida com o TJPI). */
export function parseCargosComissao(html: string): PersonnelRow[] {
  const tableStart = html.indexOf('<table');
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableStart < 0 || tableEnd < 0) throw new Error('TJMA Cargos em Comissão: tabela não encontrada — layout pode ter mudado');
  const table = html.slice(tableStart, tableEnd);
  const trBlocks = [...table.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)];
  const out: PersonnelRow[] = [];
  let totalGeral: number[] | null = null;
  for (const [, attrs, body] of trBlocks) {
    const isRollup = /sumario-parcial/i.test(attrs!);
    const thMatch = /<th[^>]*>([\s\S]*?)<\/th>/.exec(body!);
    const tds = [...body!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]!.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim());
    if (isRollup) {
      const label = thMatch ? thMatch[1]!.replace(/<[^>]*>/g, '').trim() : '';
      if (/^TOTAL$/i.test(label)) totalGeral = tds.map(v => Number(v.replace(/\./g, '')) || 0);
      continue;
    }
    if (thMatch) continue; // marcador de seção ("Cargos em Comissão"/"Funções de Confiança"), sem dado
    if (tds.length !== 7) continue; // cabeçalho ou linha incompleta
    const [label, optanteS, integralS, , semVinculoS, vagosS] = tds;
    if (!label) continue;
    const optante = Number(optanteS!.replace(/\./g, '')) || 0;
    const integral = Number(integralS!.replace(/\./g, '')) || 0;
    const semVinculo = Number(semVinculoS!.replace(/\./g, '')) || 0;
    const vagos = Number(vagosS!.replace(/\./g, '')) || 0;
    if (optante) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_OPTANTE', headcount: optante, sourceAnnex: 'ANEXO_IV_B' });
    if (integral) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_COM_VINCULO_INTEGRAL', headcount: integral, sourceAnnex: 'ANEXO_IV_B' });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO_SEM_VINCULO', headcount: semVinculo, sourceAnnex: 'ANEXO_IV_B' });
    if (vagos) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos, sourceAnnex: 'ANEXO_IV_B' });
  }
  if (!totalGeral) throw new Error('TJMA Cargos em Comissão: linha "TOTAL" não encontrada — layout pode ter mudado');
  const sum = (status: string) => out.filter(r => r.status === status).reduce((s, r) => s + r.headcount, 0);
  const got = { optante: sum('OCUPADO_COM_VINCULO_OPTANTE'), integral: sum('OCUPADO_COM_VINCULO_INTEGRAL'), semVinculo: sum('OCUPADO_SEM_VINCULO'), vagos: sum('VAGO') };
  const [gOptante, gIntegral, , gSemVinculo, gVagos] = totalGeral;
  const expected = { optante: gOptante, integral: gIntegral, semVinculo: gSemVinculo, vagos: gVagos };
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`TJMA Cargos em Comissão: soma não bate com TOTAL. calculado=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
  if (!out.length) throw new Error('TJMA Cargos em Comissão: nenhuma linha de cargo encontrada — layout pode ter mudado');
  return out;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

const parseBR = (s: string | undefined): number => { const t = (s ?? '').trim(); if (!t || t === '-') return 0; return Number(t.replace(/\./g, '').replace(',', '.')) || 0; };

/** Parser de CSV ciente de aspas (RFC4180 simplificado) — necessário porque os valores em R$ vêm entre
 * aspas com vírgula decimal DENTRO do campo ("118.062.475,18"), que um split ingênuo por vírgula quebraria. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Anexo I: CSV latin1, layout "largo" (1 mês por coluna, cols 3-14 = Jan-Dez, col15 = Restos a Pagar),
 * 1 arquivo cobre o ano inteiro (só o mais recente precisa ser baixado). Cada linha "Inciso X" já é, ela
 * mesma, o total daquele Inciso por mês — usada aqui pra verificar a soma das alíneas abaixo dela (não
 * existe uma linha de TOTAL GERAL separada no arquivo). `referenceMonthCol` é o índice da coluna do mês
 * mais recente publicado (3=Jan ... 14=Dez). */
export function parseAnexoI(buf: Buffer, referenceMonthCol: number): FinanceRow[] {
  // O TextDecoder('windows-1252') deste runtime não remapeia certos bytes C1 (ex. 0x96, en-dash) —
  // normalizado pra hífen simples; cosmético, não afeta nenhum valor numérico nem a verificação.
  const text = new TextDecoder('windows-1252').decode(buf).replace(/[\u0080-\u009F]/g, '-');
  const lines = text.split(/\r?\n/).map(splitCsvLine);
  const out: FinanceRow[] = [];
  let inciso = '';
  let expectedTotal = 0;
  let runningSum = 0;
  const flushCheck = () => { if (inciso && Math.abs(runningSum - expectedTotal) > 0.01) throw new Error(`TJMA Anexo I: soma do "${inciso}" (${runningSum}) não bate com o total do próprio Inciso (${expectedTotal})`); };
  for (const cells of lines) {
    const code = (cells[1] ?? '').trim();
    if (!code) continue;
    if (/^Inciso\s/i.test(code)) {
      flushCheck();
      inciso = code; expectedTotal = parseBR(cells[referenceMonthCol]); runningSum = 0;
      continue;
    }
    if (!/^[IVX]+-[A-Z]$/i.test(code)) continue; // cabeçalho/rodapé/linha em branco
    const desc = (cells[2] ?? '').trim();
    const amount = parseBR(cells[referenceMonthCol]);
    out.push({ account: `${code} — ${desc}`, category: inciso, amountReais: amount });
    runningSum += amount;
  }
  flushCheck();
  if (!out.length) throw new Error('TJMA Anexo I: nenhuma linha de alínea encontrada — layout pode ter mudado');
  return out;
}
