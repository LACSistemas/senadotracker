import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

/**
 * TJSC — Tribunal de Justiça de Santa Catarina (P14.17, 2º dos 27 TJs do mapa em
 * `transparencia_judiciario.md`). Diferente do TJCE (API REST própria), o TJSC publica arquivos diretos
 * sem API — URLs descobertas por reconhecimento ao vivo (não a documentação do mapa, que não comprovava
 * rota direta nenhuma pro TJSC). Confirmado ao vivo: orçamento (Anexo II) só existe em PDF por mês; folha
 * nominal é um portal só-JS (sem arquivo); por isso este piloto cobre só pessoal (Anexo IV-a, quadrimestral)
 * e fornecedores (arquivo anual "valores pagos a contratados", com CNPJ real e granularidade mensal) —
 * financeiro fica como lacuna documentada (`jud_fin_coverage`), não forçado com PDF sem ferramenta validada.
 */
export const TJSC_SOURCES = {
  CARGOS_EFETIVOS: { url: 'https://www.tjsc.jus.br/documents/d/transparencia/anexoiva-agosto2026-xlsx', label: 'Anexo IVa — Quantitativo de Cargos Efetivos (Agosto/2026)' },
  CONTRATADOS: { url: 'https://www.tjsc.jus.br/documents/d/orcamento-e-financas/valores-pagos-a-contratados-2026', label: 'Valores pagos a contratados (2026)' },
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

const cellVal = (v: unknown): unknown => (v != null && typeof v === 'object' && 'result' in (v as object)) ? (v as { result: unknown }).result : (v != null && typeof v === 'object' && 'formula' in (v as object)) ? null : v;
const cellStr = (v: unknown): string => { const r = cellVal(v); return r == null ? '' : String(r).trim(); };
const cellNum = (v: unknown): number | null => { const r = cellVal(v); if (r == null) return null; const n = Number(r); return Number.isFinite(n) ? n : null; };

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

/** Anexo IVa TJSC: Carreira | Classe | Padrão | Estáveis | Não-Estáveis | Subtotal(fórmula) | Vagos | Total(fórmula) | Aposentados.
 * Diferente do TJCE: aqui "Aposentados" VARIA de verdade por padrão (confirmado linha a linha — não é o
 * mesmo total-por-cargo repetido do TJCE), soma por linha como os outros status, sem o ajuste usado lá.
 * Linhas "<Carreira> Total" e a linha final "Total" são rollups (valor repetido/recalculado das linhas de
 * cima) — excluídas pelo sufixo " Total", senão dobraria a conta. */
export async function parseCargosEfetivos(filePath: string): Promise<PersonnelRow[]> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0]!; const out: PersonnelRow[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const vals: unknown[] = []; ws.getRow(r).eachCell({ includeEmpty: true }, c => vals.push(c.value));
    const career = cellStr(vals[1]);
    if (!career || /total$/i.test(career) || /^carreira/i.test(career)) continue;
    const classe = cellStr(vals[2]); const padrao = cellStr(vals[3]);
    const estaveis = cellNum(vals[4]), naoEstaveis = cellNum(vals[5]), vagos = cellNum(vals[7]), aposentados = cellNum(vals[9]);
    if (estaveis == null && naoEstaveis == null && vagos == null && aposentados == null) continue;
    const classLevel = [classe, padrao].filter(Boolean).join(' / ') || null;
    if (estaveis) out.push({ careerTrack: career, positionTitle: career, classLevel, status: 'ATIVO_ESTAVEL', headcount: estaveis });
    if (naoEstaveis) out.push({ careerTrack: career, positionTitle: career, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis });
    if (vagos) out.push({ careerTrack: career, positionTitle: career, classLevel, status: 'VAGO', headcount: vagos });
    if (aposentados) out.push({ careerTrack: career, positionTitle: career, classLevel, status: 'INATIVO_APOSENTADO', headcount: aposentados });
  }
  return out;
}

export interface SupplierPaymentRow { supplierName: string; supplierCnpj: string | null; expenseDescription: string; month: number; amountReais: number }
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** "Valores pagos a contratados": formato largo, 1 linha por credor×natureza, 1 coluna por mês (Jan..Dez) + Total.
 * Credor vem como "CNPJ - RAZÃO SOCIAL" — único dos 2 TJs coletados até agora que publica CNPJ real.
 * A própria fonte já declara filtrar fora elementos de despesa de pessoal (pensão, vencimentos, indenizações
 * trabalhistas) — nunca confundir este arquivo com folha: é só fornecedor/contratado pessoa jurídica (e,
 * pela nota da fonte, eventualmente física também). */
export async function parseContratados(filePath: string): Promise<SupplierPaymentRow[]> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0]!; const out: SupplierPaymentRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const vals: unknown[] = []; ws.getRow(r).eachCell({ includeEmpty: true }, c => vals.push(c.value));
    const credor = cellStr(vals[0]); if (!credor || /^filtros aplicados/i.test(credor) || /^total$/i.test(credor)) continue;
    const cnpjMatch = credor.match(/^([\d./-]{14,18})\s*-\s*(.+)$/);
    const supplierCnpj = cnpjMatch ? cnpjMatch[1]! : null; const supplierName = cnpjMatch ? cnpjMatch[2]!.trim() : credor;
    const natureza = cellStr(vals[1]);
    for (let m = 0; m < 12; m++) {
      const amount = cellNum(vals[2 + m]);
      if (amount) out.push({ supplierName, supplierCnpj, expenseDescription: natureza, month: m + 1, amountReais: amount });
    }
  }
  return out;
}
export { MONTHS };
