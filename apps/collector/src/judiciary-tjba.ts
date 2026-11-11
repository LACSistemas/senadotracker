import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';

/**
 * TJBA — Tribunal de Justiça da Bahia (P14.18, 3º dos 27 TJs do mapa em `transparencia_judiciario.md`).
 * Diferente do TJCE (API REST) e do TJSC (xlsx direto), o TJBA publica `.ods` diretos — confirmado ao vivo:
 * fornecedores (arquivo anual "item 42", formato CNJ padrão, com CNPJ real) e quadro de pessoal por LOTAÇÃO
 * (TLP — Tabela de Lotação de Pessoal, 2 arquivos: TLP2 "Direto à atividade judicante" e TLP3 "Indireto —
 * Administração", cada um por unidade/comarca, não por carreira/cargo como o Anexo IVa do TJCE/TJSC).
 * Orçamento (Anexo I/II) é sistema dinâmico (`sipof.wsp`), não arquivo — não coletado neste piloto, mesma
 * lacuna documentada do Anexo II do TJSC.
 */
export const TJBA_SOURCES = {
  FORNECEDORES: { url: 'https://www.tjba.jus.br/transparencia/wp-content/uploads/2026/10/2026-item-42-JAN-SET26.ods', label: 'Item 42 CNJ — Relação de contratados e valores pagos (2026)' },
  TLP2: { url: 'https://www.tjba.jus.br/transparencia/wp-content/uploads/2026/09/TLP2.ods', label: 'TLP 2 — Lotação direta à atividade judicante de 1º grau (01/07/2026)' },
  TLP3: { url: 'https://www.tjba.jus.br/transparencia/wp-content/uploads/2026/09/TLP-3.ods', label: 'TLP 3 — Lotação indireta (administração) (01/07/2026)' },
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
const asRows = (wb: XLSX.WorkBook, sheet: string): unknown[][] => XLSX.utils.sheet_to_json(wb.Sheets[sheet]!, { header: 1, defval: null }) as unknown[][];

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }
const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** "item 42" CNJ (padrão nacional, não exclusivo do TJBA): formato largo, 1 linha por credor×natureza, 1
 * coluna por mês + "Total Resultado". O arquivo real tinha 2 abas no momento da coleta — uma só até junho
 * (subconjunto antigo da mesma publicação), outra até setembro (superconjunto) — escolhe sempre a aba com
 * mais meses preenchidos no cabeçalho, nunca soma as duas (duplicaria). Credor vem como "CNPJ/CPF do Credor
 * Principal": confirmado ao vivo que as 1.542 linhas reais são todas CNPJ (nenhum CPF) — mesmo assim, se um
 * CPF aparecer (pessoa física prestadora), o documento não é armazenado (`supplierCnpj=null`), só o nome
 * público, por cautela de dado pessoal. Última linha é rollup "Total Resultado" — excluída, senão dobra a
 * conta (mesmo bug já visto no arquivo de contratados do TJSC). Valores vêm como número já parseado OU como
 * string brasileira "0,00"/"1.234,56" — os dois formatos coexistem na mesma coluna. */
export async function parseFornecedores(filePath: string): Promise<SupplierPaymentRow[]> {
  const wb = readSpreadsheet(filePath);
  let bestSheet = wb.SheetNames[0]!, bestCount = -1;
  for (const name of wb.SheetNames) {
    const header = asRows(wb, name)[1] ?? [];
    const count = header.filter(v => v != null).length;
    if (count > bestCount) { bestCount = count; bestSheet = name; }
  }
  const rows = asRows(wb, bestSheet);
  const monthHeader = (rows[1] ?? []).map(v => String(v ?? '').trim().toUpperCase());
  const monthCols: Array<{ col: number; month: number }> = [];
  for (let c = 4; c < monthHeader.length; c++) {
    const idx = MONTHS.indexOf(monthHeader[c]!);
    if (idx >= 0) monthCols.push({ col: c, month: idx + 1 });
  }
  const out: SupplierPaymentRow[] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r]!;
    const idRaw = String(row[0] ?? '').trim();
    if (!idRaw || /^total resultado$/i.test(idRaw)) continue;
    const isCpf = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(idRaw);
    const supplierCnpj = isCpf ? null : (idRaw || null);
    const supplierName = String(row[1] ?? '').trim();
    if (!supplierName) continue;
    const expenseDescription = String(row[3] ?? '').trim();
    for (const { col, month } of monthCols) {
      const amount = toNumber(row[col]);
      if (amount) out.push({ supplierName, supplierCnpj, expenseDescription, month, amountReais: amount });
    }
  }
  return out;
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

/** TLP (Tabela de Lotação de Pessoal): diferente do Anexo IVa (TJCE/TJSC, por carreira/cargo), aqui a
 * granularidade é por UNIDADE/comarca — `positionTitle` carrega a unidade (lotação), `classLevel` o
 * município, `careerTrack` fica null (não existe esse conceito nesta fonte). 2 arquivos cobrem escopos
 * organizacionais diferentes (TLP2 = atividade judicante direta de 1º grau; TLP3 = administração/indireta) —
 * nunca somados juntos, cada um é uma fatia distinta da força de trabalho; quem chama esta função marca
 * `source_annex` ('TLP_1_GRAU'/'TLP_ADMINISTRACAO') na hora de gravar, o parser não sabe qual arquivo é qual.
 * Colunas por status seguem a legenda publicada no rodapé do próprio arquivo (linhas de texto explicativo no
 * fim da planilha — excluídas do parse por não terem valor numérico na coluna de efetivos). TJFC1-6 é cargo
 * em comissão por nível (1 coluna por nível, nunca somado num único "comissionados"). */
export async function parseLotacao(filePath: string): Promise<PersonnelRow[]> {
  const wb = readSpreadsheet(filePath);
  const rows = asRows(wb, wb.SheetNames[0]!);
  const statusCols: Array<[number, string]> = [
    [2, 'EFETIVO'], [3, 'CEDIDO_OU_REQUISITADO'], [4, 'SEM_VINCULO_COMISSIONADO'], [5, 'OUTRO_UNIDADE_PRIVATIZADA'],
    [6, 'COMISSIONADO_TJFC1'], [7, 'COMISSIONADO_TJFC2'], [8, 'COMISSIONADO_TJFC3'], [9, 'COMISSIONADO_TJFC4'], [10, 'COMISSIONADO_TJFC5'], [11, 'COMISSIONADO_TJFC6'],
  ];
  const out: PersonnelRow[] = [];
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r]!;
    if (typeof row[2] !== 'number') continue; // linhas de legenda no rodapé não têm número na coluna de efetivos
    const unidade = String(row[0] ?? '').trim();
    const municipio = String(row[1] ?? '').trim();
    if (!unidade) continue;
    for (const [col, status] of statusCols) {
      const headcount = row[col];
      if (typeof headcount === 'number' && headcount > 0) {
        out.push({ careerTrack: null, positionTitle: unidade, classLevel: municipio || null, status, headcount });
      }
    }
  }
  return out;
}
