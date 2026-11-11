import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFParse } from 'pdf-parse';

/**
 * TJRJ — Tribunal de Justiça do Rio de Janeiro (P14.21, 6º dos 27 TJs do mapa em
 * `transparencia_judiciario.md`). PRIMEIRO tribunal desta série coletado a partir de PDF, não planilha —
 * confirmado ao vivo que o Anexo IV (A/B) do TJRJ só existe em PDF (`portaltj.tjrj.jus.br/documents/d/guest/
 * anexo_iv_{letra}_{mes}_{ano}`, nome de arquivo previsível), apesar da estrutura de anexos ser a mais
 * completa (A-H) já vista nesta série. Financeiro ("Valores Pagos aos Contratados") é uma lacuna CONFIRMADA
 * por página quebrada no próprio site do TJRJ (corpo vazio, sem erro de rede) — não um "ainda não validado".
 * Usa `pdf-parse` (Apache-2.0, extração de TEXTO, não a API `getTable` — essa trava com um erro real de
 * geometria em cima deste PDF real de verdade; texto puro é mais maduro/confiável e o layout aqui é regular
 * o bastante pra reconstruir via split por tab).
 */
export const TJRJ_SOURCES = {
  anexoIVA: (ano: number, mes: string) => ({ url: `https://portaltj.tjrj.jus.br/documents/d/guest/anexo_iv_a_${mes}_${ano}`, label: `Anexo IV-A — Cargos efetivos (${mes}/${ano})` }),
  anexoIVB: (ano: number, mes: string) => ({ url: `https://portaltj.tjrj.jus.br/documents/d/guest/anexo_iv_b_${mes}_${ano}`, label: `Anexo IV-B — Cargos em comissão (${mes}/${ano})` }),
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

async function extractText(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buf });
  try { const result = await parser.getText(); return result.pages.map(p => p.text).join('\n'); }
  finally { await parser.destroy(); }
}

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

/** Anexo IV-A: cada linha de dado vem como texto tabulado (ordem de EXTRAÇÃO, não a ordem visual da
 * tabela): `Padrão\tEstáveis\tNãoEstáveis\tClasse\tAposentados[\tNomeDoCargo]` — o nome do cargo só aparece
 * na 1ª linha do grupo (linhas seguintes do mesmo cargo vêm sem ele, "carrega" o último visto). Confirmado
 * real: zeros SEMPRE aparecem explícitos aqui (nunca omitidos), diferente do IV-B — por isso dá pra confiar
 * no número de campos (5 ou 6) pra reconhecer uma linha de dado real. Linha "TOTAL" (rollup por cargo) tem
 * só 4 campos — excluída. Processa o texto de TODAS as páginas concatenado (não por página), porque um grupo
 * de cargo pode continuar na página seguinte sem repetir o nome. */
export async function parseAnexoIVA(filePath: string): Promise<PersonnelRow[]> {
  const text = await extractText(filePath);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out: PersonnelRow[] = [];
  let currentCargo = '';
  for (const line of lines) {
    const f = line.split('\t').map(s => s.trim());
    if (f.length < 5 || f.length > 6) continue;
    const [padrao, estaveisS, naoEstaveisS, classe, aposentadosS, cargoName] = f;
    if (!/^\d+$/.test(padrao!) || !/^\d+$/.test(estaveisS!) || !/^\d+$/.test(naoEstaveisS!) || !/^[A-Z]$/.test(classe!) || !/^\d+$/.test(aposentadosS!)) continue;
    if (cargoName) currentCargo = cargoName.replace(/\*$/, '').trim();
    if (!currentCargo) continue;
    const classLevel = `${classe} / ${padrao}`;
    const estaveis = Number(estaveisS), naoEstaveis = Number(naoEstaveisS), aposentados = Number(aposentadosS);
    if (estaveis) out.push({ careerTrack: null, positionTitle: currentCargo, classLevel, status: 'ATIVO_ESTAVEL', headcount: estaveis });
    if (naoEstaveis) out.push({ careerTrack: null, positionTitle: currentCargo, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis });
    if (aposentados) out.push({ careerTrack: null, positionTitle: currentCargo, classLevel, status: 'INATIVO_APOSENTADO', headcount: aposentados });
  }
  return out;
}

/** Anexo IV-B: layout mais simples (`Cargo/Função\t[ComVínculoEfetivo]\t[SemVínculoEfetivo]\t[Vagos]\tTotal`),
 * mas o PDF OMITE colunas com valor 0 em vez de escrever "0" (diferente do IV-A) — ex. uma linha com só 3
 * números não dá pra saber com certeza qual das duas colunas de "Ocupados" (com ou sem vínculo efetivo) foi
 * omitida, só a soma delas é recuperável sem ambiguidade. Por isso aqui só grava OCUPADO agregado (nunca o
 * split com/sem vínculo) e VAGO — nunca inventa uma coluna que o PDF não garante. Total e Vagos são SEMPRE
 * os 2 últimos números da linha (confirmado: a linha "TOTAL" bate com Total-Vagos=ComVínculo+SemVínculo em
 * todas as linhas com os 4 números presentes) — por isso Ocupado = Total - Vagos funciona sempre, com
 * qualquer quantidade de colunas omitidas. Linha "TOTAL" (rollup geral) excluída. */
export async function parseAnexoIVB(filePath: string): Promise<PersonnelRow[]> {
  const text = await extractText(filePath);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const out: PersonnelRow[] = [];
  for (const line of lines) {
    const f = line.split('\t').map(s => s.trim());
    if (f.length < 2 || f.length > 5) continue;
    const label = f[0]!;
    if (!label || /^total$/i.test(label)) continue;
    const nums = f.slice(1).map(Number);
    if (nums.some(n => !Number.isFinite(n))) continue;
    if (nums.length < 1) continue;
    const total = nums[nums.length - 1]!;
    const vagos = nums.length >= 2 ? nums[nums.length - 2]! : 0;
    const ocupado = total - vagos;
    if (ocupado > 0) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'OCUPADO', headcount: ocupado });
    if (vagos > 0) out.push({ careerTrack: null, positionTitle: label, classLevel: null, status: 'VAGO', headcount: vagos });
  }
  return out;
}
