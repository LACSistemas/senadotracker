import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

/**
 * TJGO — Tribunal de Justiça de Goiás (P14.19, 4º dos 27 TJs do mapa em `transparencia_judiciario.md`).
 * Pessoal (Anexo IV-A/IV-B, `.xlsx` real) vem de um sistema PRÓPRIO (`gestaodepessoas.tjgo.jus.br`), com uma
 * URL de exportação parametrizada por ano/mês — confirmado ao vivo via `curl` puro (sem sessão/cookie) que
 * é genuinamente pública. Diferente dos 3 tribunais anteriores, o financeiro do TJGO é 100% Power BI embutido
 * (Anexo I/II E o relatório de aquisições Lei 17.928/2012) — confirmado ao vivo nas 2 páginas (iframe
 * `app.powerbi.com/reportEmbed`), sem exportação de arquivo nenhuma — não um "ainda não validado", uma
 * lacuna CONFIRMADA. Este piloto é só pessoal; financeiro fica 100% documentado como lacuna.
 */
export function anexoIvaUrl(ano: number, mes: number): string {
  return `https://gestaodepessoas.tjgo.jus.br/transparencia/anexo_iv_a?utf8=%E2%9C%93&tipo_relatorio=XLSX&transparencia_tb_anexo_iv_a%5Bpreview%5D=&transparencia_tb_anexo_iv_a%5Bano%5D=${ano}&transparencia_tb_anexo_iv_a%5Bmes%5D=${mes}&transparencia_tb_anexo_iv_a%5Bnme_cargo%5D=`;
}
export function anexoIvbUrl(ano: number, mes: number): string {
  return `https://gestaodepessoas.tjgo.jus.br/transparencia/tb_anexo_iv_bs?utf8=%E2%9C%93&tipo_relatorio=XLSX&transparencia_tb_anexo_iv_b%5Bano%5D=${ano}&transparencia_tb_anexo_iv_b%5Bmes%5D=${mes}`;
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

export interface PersonnelRow { careerTrack: string | null; positionTitle: string | null; classLevel: string | null; status: string; headcount: number }

/** Anexo IV-A TJGO: Carreira|Cargo|Classe|Escolaridade|Padrão|Ativos(Estáveis,NãoEstáveis,Subtotal)|Vagos|
 * Total|Inativos(Aposentados,InstituidoresDePensão,Total,BeneficiáriosDePensão). "Aposentados",
 * "Instituidores de Pensão" e "Beneficiários de Pensão" VARIAM de verdade por classe/padrão (confirmado linha
 * a linha em vários cargos reais, ex. AUXILIAR JUDICIARIO-CATEGORIA GERAL: aposentados 103/12/10 em padrões
 * F3/F2/F1) — somam por linha, sem dedup. MAS "Vagos" é um total por CARGO repetido sem variação em toda
 * linha de classe/padrão do mesmo cargo (confirmado: 65 repetido em 18 linhas seguidas de um mesmo cargo,
 * dezenas de vezes no arquivo real) — mesma armadilha já vista no TJCE (lá era "Aposentados" que repetia,
 * aqui é "Vagos"; nunca assumir qual coluna tem esse padrão sem checar, cada tribunal pode variar).
 * Corrigido coletando Vagos 1x por (carreira,cargo), fora do loop de classe/padrão. Linhas "TOTAL" e "TOTAL
 * GERAL" são rollups — excluídas por `/^total/i` no início da Carreira. Tem 2 colunas novas que TJCE/TJSC não
 * tinham: Instituidores de Pensão e Beneficiários de Pensão (quem originou e quem recebe pensão por morte —
 * não são nem ativos nem aposentados, categoria própria). */
export async function parseAnexoIVA(filePath: string): Promise<PersonnelRow[]> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0]!; const out: PersonnelRow[] = [];
  const vagosSeen = new Set<string>();
  for (let r = 12; r <= ws.rowCount; r++) {
    const vals: unknown[] = []; ws.getRow(r).eachCell({ includeEmpty: true }, c => vals.push(c.value));
    const career = String(vals[0] ?? '').trim();
    if (!career || /^total/i.test(career)) continue;
    const cargo = String(vals[1] ?? '').trim();
    const classLevel = [vals[2], vals[3], vals[4]].filter(v => v != null && v !== '').join(' / ') || null;
    const estaveis = Number(vals[5]) || 0, naoEstaveis = Number(vals[6]) || 0, vagos = Number(vals[8]) || 0;
    const aposentados = Number(vals[10]) || 0, instituidores = Number(vals[11]) || 0, beneficiarios = Number(vals[13]) || 0;
    if (estaveis) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'ATIVO_ESTAVEL', headcount: estaveis });
    if (naoEstaveis) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'ATIVO_NAO_ESTAVEL', headcount: naoEstaveis });
    const cargoKey = `${career}|${cargo}`;
    if (vagos && !vagosSeen.has(cargoKey)) { vagosSeen.add(cargoKey); out.push({ careerTrack: career, positionTitle: cargo, classLevel: null, status: 'VAGO', headcount: vagos }); }
    if (aposentados) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'INATIVO_APOSENTADO', headcount: aposentados });
    if (instituidores) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'INSTITUIDOR_PENSAO', headcount: instituidores });
    if (beneficiarios) out.push({ careerTrack: career, positionTitle: cargo, classLevel, status: 'BENEFICIARIO_PENSAO', headcount: beneficiarios });
  }
  return out;
}

/** Anexo IV-B TJGO: 2 abas reais no mesmo arquivo — "Cargos em Comissão" (níveis DAE-1..12) e "Funções
 * Encargo de Confiança" (níveis FEC-1..10) — são 2 categorias distintas de função comissionada, nunca
 * somadas juntas (mesmo arquivo, mesmo layout de coluna, rótulo de nível já desambigua DAE vs FEC). Colunas:
 * Denominação/Nível|Ocupados(OptanteRemuneraçãoCargoEfetivo,RemuneraçãoIntegral,Subtotal)|SemVínculoEfetivo|
 * Vagos|Total. Linhas "Total..."/"Total" (rollup) e "Observações:"/notas de rodapé excluídas — a de rodapé
 * detectada por não ter número na coluna 1 (nunca confiar só no texto da coluna 0). */
export async function parseAnexoIVB(filePath: string): Promise<PersonnelRow[]> {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(filePath);
  const out: PersonnelRow[] = [];
  for (const ws of wb.worksheets) {
    for (let r = 12; r <= ws.rowCount; r++) {
      const vals: unknown[] = []; ws.getRow(r).eachCell({ includeEmpty: true }, c => vals.push(c.value));
      const nivel = String(vals[0] ?? '').trim();
      if (!nivel || /^total/i.test(nivel)) continue; // rollup "Total de Cargos Comissionados"/"Total" — tem número real, só filtra pelo rótulo
      if (typeof vals[1] !== 'number') continue; // linhas "Observações:"/notas de rodapé não têm número na col 1
      const optante = Number(vals[1]) || 0, integral = Number(vals[2]) || 0, semVinculo = Number(vals[4]) || 0, vagos = Number(vals[5]) || 0;
      if (optante) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'COMISSIONADO_OPTANTE_REM_EFETIVO', headcount: optante });
      if (integral) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'COMISSIONADO_REM_INTEGRAL', headcount: integral });
      if (semVinculo) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'COMISSIONADO_SEM_VINCULO', headcount: semVinculo });
      if (vagos) out.push({ careerTrack: null, positionTitle: nivel, classLevel: null, status: 'VAGO', headcount: vagos });
    }
  }
  return out;
}
