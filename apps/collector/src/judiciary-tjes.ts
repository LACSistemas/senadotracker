import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

/**
 * TJES — Tribunal de Justiça do Espírito Santo (P14.20, 5º dos 27 TJs do mapa em
 * `transparencia_judiciario.md`). Site WordPress comum (não SPA, diferente do TJRO/TJGO) — arquivos reais em
 * `wp-content/uploads/`, nomeação previsível (`ANEXO_IV_A_{AAAAMM}.xls`). `.xls` é formato binário antigo
 * (BIFF), não XLSX — `exceljs` não lê, por isso usa `xlsx` (SheetJS, já instalado do piloto do TJCE), que lê
 * `.xls`/`.ods`/`.xlsx` igual.
 */
export const TJES_SOURCES = {
  anexoIVA: (ano: number, mes: number) => ({ url: `https://www.tjes.jus.br/wp-content/uploads/ANEXO_IV_A_${ano}${String(mes).padStart(2, '0')}.xls`, label: `Anexo IV-A — Cargos efetivos (${String(mes).padStart(2, '0')}/${ano})` }),
  anexoIVB: (ano: number, mes: number) => ({ url: `https://www.tjes.jus.br/wp-content/uploads/ANEXO_IV_B_${ano}${String(mes).padStart(2, '0')}.xls`, label: `Anexo IV-B — Cargos em comissão (${String(mes).padStart(2, '0')}/${ano})` }),
  contratados: { url: 'https://www.tjes.jus.br/wp-content/uploads/Execucao-Orcamentaria-dos-contratos-Orgao-e-Contrato-Ate-Set-2026.ods', label: 'Execução orçamentária dos contratos, por órgão e contrato (2026)' },
} as const;

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; httpStatus: number; contentType: string | null }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), httpStatus: res.status, contentType: res.headers.get('content-type') };
}

function readSpreadsheet(filePath: string): XLSX.WorkBook { return XLSX.read(readFileSync(filePath)); }
const asRows = (wb: XLSX.WorkBook): unknown[][] => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, defval: null }) as unknown[][];

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

/** Anexo IV-A TJES: 1 coluna só combina Carreira/Classe/Escolaridade/Padrão (ex. "AUXILIAR JUDICIARIO -
 * I.01") — diferente do TJCE/TJGO, que tinham essas 4 dimensões em colunas separadas. Cada linha já é uma
 * combinação única (confirmado: Vagos/Estáveis variam livremente linha a linha, sem repetição de valor por
 * grupo — diferente do bug visto no TJCE/TJGO, aqui não tem esse padrão). Guarda o rótulo combinado inteiro
 * em `positionTitle`, sem tentar separar carreira/classe artificialmente. Linhas "TOTAL <algo>" e "TOTAL"
 * são rollups — excluídas por `/^total/i`. */
export async function parseAnexoIVA(filePath: string): Promise<PersonnelRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const out: PersonnelRow[] = [];
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r]!;
    const label = String(row[0] ?? '').trim();
    if (!label || /^total/i.test(label)) continue;
    const estaveis = Number(row[1]) || 0, naoEstaveis = Number(row[2]) || 0, vagos = Number(row[4]) || 0;
    const aposentados = Number(row[6]) || 0, instituidores = Number(row[7]) || 0, beneficiarios = Number(row[9]) || 0;
    if (estaveis) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'ATIVO_ESTAVEL', headcount: estaveis });
    if (naoEstaveis) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis });
    if (vagos) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos });
    if (aposentados) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'INATIVO_APOSENTADO', headcount: aposentados });
    if (instituidores) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'INSTITUIDOR_PENSAO', headcount: instituidores });
    if (beneficiarios) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios });
  }
  return out;
}

/** Anexo IV-B TJES: 2 seções no mesmo sheet ("Cargos em Comissão" e "Funções de Confiança"), cada uma com
 * uma linha de cabeçalho de seção (só rótulo, sem número na coluna 1 — usado pra pular, igual padrão já usado
 * no TJGO) e uma linha "Total <seção>" de rollup no fim (excluída por `/^total/i`). */
export async function parseAnexoIVB(filePath: string): Promise<PersonnelRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const out: PersonnelRow[] = [];
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r]!;
    const nivel = String(row[0] ?? '').trim();
    if (!nivel || /^total/i.test(nivel)) continue;
    if (typeof row[1] !== 'number') continue; // cabeçalho de seção ("Cargos em Comissão"/"Funções de Confiança")
    const optante = Number(row[1]) || 0, integral = Number(row[2]) || 0, semVinculo = Number(row[4]) || 0, vagos = Number(row[5]) || 0;
    if (optante) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'COMISSIONADO_OPTANTE_REM_EFETIVO', headcount: optante });
    if (integral) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'COMISSIONADO_REM_INTEGRAL', headcount: integral });
    if (semVinculo) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'COMISSIONADO_SEM_VINCULO', headcount: semVinculo });
    if (vagos) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'VAGO', headcount: vagos });
  }
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; documentNumber: string | null; processNumber: string | null; biddingType: string | null; expenseDescription: string; month: number; amountReais: number }
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** "Execução Orçamentária dos contratos": formato hierárquico — linha de Exercício (ex. "2026"), linha de
 * Unidade Gestora (ex. "   030101 - TRIBUNAL..."), linha de Credor (ex. "      00526874732 - VANUZA..."),
 * todas misturadas na mesma coluna 0 por nível de indentação. As 2 primeiras são ROLLUP (somam tudo embaixo)
 * — nunca têm valor em "Processo" (coluna 1); só linhas de credor têm. Um credor com 2+ contratos no ano
 * aparece em várias linhas seguidas, mas só a PRIMEIRA repete o nome (col 0) — as seguintes vêm com col 0
 * vazio (célula mesclada visualmente) e só preenchem Processo/Contrato pra frente — precisa "carregar" o
 * último nome de credor visto. Usa só "Despesas Liquidadas" (único estágio com granularidade mensal real no
 * arquivo — Empenhadas/Pagas/RestosAPagar são só 1 total anual cada, sem mês) — **liquidado é reconhecimento
 * da obrigação, não confirma que o fornecedor já recebeu o dinheiro** (ver regra de `transparencia_judiciario.md`
 * §4.3: nunca confundir estágios). Credor vem como dígitos crus (sem pontuação) — 11 dígitos = CPF de pessoa
 * física (nunca armazenado, só o nome), 14 = CNPJ (armazenado). */
export async function parseContratados(filePath: string): Promise<SupplierPaymentRow[]> {
  const rows = asRows(readSpreadsheet(filePath));
  const out: SupplierPaymentRow[] = [];
  let lastSupplierName = '', lastSupplierCnpj: string | null = null;
  for (let r = 5; r < rows.length; r++) {
    const row = rows[r]!;
    const processo = row[1] != null ? String(row[1]).trim() : '';
    if (!processo) continue; // linha de rollup (Exercício ou Unidade Gestora), não de credor
    const rawLabel = row[0] != null ? String(row[0]).trim() : '';
    if (rawLabel) {
      const m = rawLabel.match(/^(\d{11,14})\s*-\s*(.+)$/);
      if (m) { const digits = m[1]!; lastSupplierCnpj = digits.length === 14 ? digits : null; lastSupplierName = m[2]!.trim(); }
      else { lastSupplierCnpj = null; lastSupplierName = rawLabel; }
    }
    if (!lastSupplierName) continue;
    const contratoCodigo = row[7] != null ? String(row[7]).trim() : null;
    const modalidade = row[5] != null ? String(row[5]).trim() : null;
    const objeto = row[6] != null ? String(row[6]).trim() : '';
    for (let m = 0; m < 9; m++) { // arquivo cobre jan-set/2026 nesta edição (confirmado: só 9 colunas de mês presentes)
      const amount = Number(row[9 + m]) || 0;
      if (amount) out.push({ supplierName: lastSupplierName, supplierCnpj: lastSupplierCnpj, documentNumber: processo || null, processNumber: contratoCodigo, biddingType: modalidade, expenseDescription: objeto, month: m + 1, amountReais: amount });
    }
  }
  return out;
}
export { MONTHS };
