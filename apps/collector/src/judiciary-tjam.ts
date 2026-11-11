import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

/**
 * TJAM — Tribunal de Justiça do Amazonas (P14.22, 7º dos 27 TJs). Forma diferente de todos os anteriores: o
 * verdadeiro Anexo IV (quantitativo de cargos do quadro de servidores) é Power BI embutido (confirmado ao
 * vivo, igual TJGO) — mas o Anexo I (despesas por inciso/alínea) e o Anexo V (relação de magistrados) existem
 * como `.xlsx` reais em `tjam.jus.br/media/com_res102cnj/{NN}_{MM}_{AA}.xlsx` (NN=02 dígitos do nº do anexo,
 * confirmado por sondagem: 01=Anexo I, 02=Anexo II, 05=Anexo V, 07=Anexo VII — 04=Anexo IV nunca existe em
 * nenhum mês de 2025/2026, confirmando a lacuna Power BI). Este piloto cobre Anexo I (financeiro, por
 * categoria) e Anexo V (só magistrados, agregado por cargo — nunca nome individual, mesma disciplina de
 * nunca gravar identidade nominal de servidor usada em todos os tribunais anteriores desta série). Quadro de
 * servidores (não-magistrados) fica como lacuna Power BI documentada, igual fornecedores (também Power BI).
 */
export function anexoUrl(num: string, mes: string, ano2: string): { url: string; label: string } {
  return { url: `https://www.tjam.jus.br/media/com_res102cnj/${num}_${mes}_${ano2}.xlsx`, label: `Anexo ${num} (${mes}/20${ano2})` };
}

export async function downloadToD(url: string, destDir: string, fileName: string): Promise<{ path: string; bytes: number; sha256: string; httpStatus: number; contentType: string | null }> {
  await fs.mkdir(destDir, { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'civica-judiciario/1.0 (pesquisa de transparencia; contato lac.solsoftware@gmail.com)' } });
  if (!res.ok) throw new Error(`download HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = path.join(destDir, fileName);
  await fs.writeFile(destPath, buf);
  return { path: destPath, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), httpStatus: res.status, contentType: res.headers.get('content-type') };
}

/** Valor real de uma célula numérica, incluindo fórmula mestre (`cell.value.result`) e fórmula escrava de
 * grupo compartilhado (`cell.value={sharedFormula}`, sem `.result` inline — confirmado ao vivo que o valor
 * calculado real só existe em `cell.result`, propriedade separada do objeto Cell, não dentro de `.value`).
 * Nunca confiar só em `cell.value` quando o arquivo usa fórmulas compartilhadas. */
function cellNumber(cell: ExcelJS.Cell): number {
  if (typeof cell.value === 'number') return cell.value;
  const r = (cell as unknown as { result?: unknown }).result;
  return typeof r === 'number' ? r : 0;
}

export interface FinanceRow { account: string; category: string; amountReais: number }

/** Anexo I: seções "Inciso N – <descrição>" seguidas de linhas Alínea(letra única)|Discriminação|Valor. Só
 * alínea-letra única (a, b, c...) — nunca subitens. Linha "TOTAL" (rollup por inciso) excluída (coluna A
 * vazia, "TOTAL" só na coluna B). Mesma convenção de `account`/`category` já usada no TJCE: `account` =
 * "letra — descrição" (detalhe), `category` = texto do Inciso (agrupador), pro frontend já existente
 * continuar funcionando sem mudança. O arquivo baixado por mês às vezes acumula abas de OUTRAS competências
 * dentro do mesmo arquivo (confirmado real: um arquivo de "maio/2024" tinha abas de jan/2022, jan/2023 e
 * fev/2022 também, fora de ordem) — a última aba costuma ser a mais recente, mas nunca confiar nisso sem
 * conferir: valida contra o cabeçalho "Mês de Referência: ..." da própria aba antes de aceitar. O FORMATO
 * desse cabeçalho também mudou real ao longo do tempo (ex. 05/2024 usava "05/2024" numérico; 09/2026 passou
 * a usar "SETEMBRO 2026" por extenso) — aceita os dois formatos, nunca assume qual está em vigor. */
export async function parseAnexoI(filePath: string, expectedMonth: number, expectedYear: number): Promise<FinanceRow[]> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[wb.worksheets.length - 1]!;
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const expectedNumeric = `${String(expectedMonth).padStart(2, '0')}/${expectedYear}`;
  const expectedName = monthNames[expectedMonth - 1]!;
  let headerOk = false;
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const text = String(sheet.getRow(r).getCell(1).value ?? '');
    if (!text.includes('Mês de Referência')) continue;
    const lower = text.toLowerCase();
    if (text.includes(expectedNumeric) || (lower.includes(expectedName) && lower.includes(String(expectedYear)))) { headerOk = true; break; }
  }
  if (!headerOk) throw new Error(`Anexo I TJAM: última aba não é a competência esperada (${expectedNumeric} / ${expectedName} ${expectedYear}) — planilha pode ter mudado de formato de novo`);
  const out: FinanceRow[] = [];
  let inciso = '';
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const col0 = String(row.getCell(1).value ?? '').trim();
    if (/^Inciso/i.test(col0)) { inciso = col0; continue; }
    if (!/^[a-z]$/i.test(col0)) continue;
    const label = String(row.getCell(2).value ?? '').trim();
    const amount = cellNumber(row.getCell(3));
    if (!label || !amount) continue;
    out.push({ account: `${col0} — ${label}`, category: inciso || 'Sem seção identificada', amountReais: amount });
  }
  return out;
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

/** Anexo V: "RELAÇÃO DE MEMBROS DA MAGISTRATURA E DEMAIS AGENTES PÚBLICOS" — nome do arquivo sugere cobrir
 * mais que magistrados, mas na prática a aba tem 2 seções bem diferentes: (1) magistrados de verdade
 * (Desembargador, Juiz de Direito, Juiz de Paz), cada subgrupo terminando numa linha "TOTAL DE X" e com
 * `CARGO` (coluna 3) preenchido de verdade; (2) depois da 3ª linha "TOTAL DE X" (TOTAL DE JUÍZES DE PAZ), uma
 * seção de "demais agentes públicos" MUITO maior (milhares de linhas) onde `CARGO` é sempre "Não aplicável"
 * — a classificação real desse pessoal estaria em outra coluna (FUNÇÃO ou CARGO/FUNÇÃO COMISSIONADA),
 * nunca investigada neste piloto. Processar só até a seção de magistrados (pára na 3ª linha "TOTAL DE..."),
 * nunca inventar uma classificação pra seção 2 que a própria fonte não dá na coluna que eu leio. Nunca grava
 * nome, só agrega por cargo (ex. "Desembargador") contando linhas — mesma disciplina de nunca armazenar
 * identidade individual de servidor já usada em todos os tribunais anteriores desta série. */
export async function parseAnexoV(filePath: string, expectedMonth: number, expectedYear: number): Promise<PersonnelRow[]> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0]!;
  // "Data de referência" vem sempre numérico DD/MM/AAAA (confirmado em 2024 e 2026, sem o drift de formato
  // visto no Anexo I) — o mês por extenso só aparece no NOME da aba (ex. "Setembro"), nunca no texto do
  // cabeçalho; checar os dois.
  const mm = String(expectedMonth).padStart(2, '0');
  const mesExtenso = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][expectedMonth - 1]!;
  const sheetNameOk = sheet.name.toLowerCase() === mesExtenso;
  let headerOk = false;
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const text = String(sheet.getRow(r).getCell(1).value ?? '');
    if (text.includes('Data de referência') && text.includes(`/${mm}/${expectedYear}`)) { headerOk = true; break; }
  }
  if (!sheetNameOk || !headerOk) throw new Error(`Anexo V TJAM: aba "${sheet.name}" não confirma a competência esperada (${mesExtenso}/${expectedYear}) — pode ter mudado de formato`);
  const counts = new Map<string, number>();
  let totalMarkersSeen = 0;
  const MAX_MAGISTRATE_TOTAL_MARKERS = 3; // Desembargadores, Juízes de Direito, Juízes de Paz — pára aqui, nunca entra na seção de "demais agentes públicos"
  for (let r = 9; r <= sheet.rowCount && totalMarkersSeen < MAX_MAGISTRATE_TOTAL_MARKERS; r++) {
    const row = sheet.getRow(r);
    const cell = row.getCell(3);
    const raw = cell.value;
    const cargo = (typeof raw === 'object' && raw != null && 'richText' in raw ? (raw as { richText: Array<{ text: string }> }).richText.map(t => t.text).join('') : String(raw ?? '')).trim().replace(/^-\s*/, '');
    if (!cargo) continue;
    if (/^total de /i.test(cargo)) { totalMarkersSeen++; continue; }
    if (cargo === 'Não aplicável') continue; // seção de "demais agentes públicos" não deveria ser alcançada, mas defensivo
    counts.set(cargo, (counts.get(cargo) ?? 0) + 1);
  }
  // A tela de "Pessoal" agrupa a visão geral por `status`, não por `position_title` (todo outro tribunal
  // desta série usa status pra distinguir ocupação dentro do MESMO cargo — ex. ATIVO_ESTAVEL vs VAGO). Aqui é
  // o oposto: o cargo É a dimensão que importa (status seria sempre "ativo/em exercício", trivial) — por
  // isso o cargo vira o `status` (eslugado), senão os 12 cargos distintos colapsariam numa única barra
  // "ATIVO" na visão geral, perdendo a distinção toda. `position_title` continua com o nome real, pra
  // qualquer leitura futura por carreira/cargo.
  const slug = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return [...counts.entries()].map(([cargo, headcount]) => ({ careerTrack: null, positionTitle: cargo, classLevel: null, status: slug(cargo), headcount }));
}
