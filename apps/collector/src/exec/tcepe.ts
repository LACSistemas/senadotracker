import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { DATASET, FIN_VERSION, SPECS, norm, publishSlice, sha256, type Row } from '@senadotracker/db';
import { assertPgHeadroom, assertVolume, fetchRaw, recordManifest, type ManifestEntry, type StorageConfig } from './storage.ts';
import { isFirstPublication } from './seguranca.ts';

/**
 * Estado de Pernambuco — TCE-PE `DespesasEstaduais`: único Executivo estadual com FUNÇÃO + unidade gestora + natureza + estágios abertos em API comprovada nesta onda.
 * A API limita 100.000 linhas por chamada e aceita filtro por FUNCAO (valor em ISO-8859-1): uma chamada por exercício com FUNCAO = "Segurança Pública" cabe no limite.
 * Cada linha é UM EMPENHO com valor empenhado, liquidado e pago ACUMULADOS até a data da extração; agrupamos pelo mês do empenho. Logo "pago" aqui = pagamentos (até hoje)
 * dos empenhos do exercício — inclui o que foi pago depois como restos a pagar — e NÃO é igual às "despesas pagas" da DCA; a igualdade esperada é a do empenhado.
 * O filtro por unidade gestora não funciona (a API devolve as 100.000 primeiras linhas): a perspectiva INSTITUCIONAL (UG de segurança fora da função 06) não é coletada.
 */
export type Log = (m: string) => void;
const API = 'https://sistemas.tce.pe.gov.br/DadosAbertos/DespesasEstaduais!json';
export const PE_UF = 26; export const PE_FIRST_YEAR = 2014;
export const orgIdState = (ufCode: number, ugId: number): number => 1_900_000_000 + ufCode * 100_000 + (ugId % 100_000);
const SUBFUNCTION: Array<[RegExp, number]> = [[/^POLICIAMENTO/, 181], [/^DEFESA CIVIL/, 182], [/^INFORMACAO E INTELIGENCIA/, 183], [/^ADMINISTRACAO GERAL/, 122], [/^FORMACAO DE RECURSOS HUMANOS/, 128], [/^NORMATIZACAO E FISCALIZACAO/, 125], [/^OUTROS ENCARGOS ESPECIAIS/, 846], [/^PLANEJAMENTO E ORCAMENTO/, 121], [/^ADMINISTRACAO FINANCEIRA/, 123], [/^CONTROLE INTERNO/, 124], [/^TECNOLOGIA DA INFORMA/, 126], [/^COMUNICACAO SOCIAL/, 131], [/^ASSISTENCIA HOSPITALAR/, 302], [/^SERVICO DA DIVIDA/, 841]];
const GRUPO: Array<[RegExp, number]> = [[/^PESSOAL/, 1], [/^JUROS/, 2], [/^OUTRAS DESPESAS CORRENTES/, 3], [/^INVESTIMENTOS/, 4], [/^INVERSOES/, 5], [/^AMORTIZACAO/, 6]];
const MODALIDADE: Array<[RegExp, number]> = [[/DECORR.*OPERACAO ENTRE/, 91], [/APLICACOES? DIRETA/, 90], [/TRANSFERENCIAS? (A|AS) UNIAO/, 20], [/TRANSFERENCIAS? (A|AOS) ESTADOS/, 30], [/TRANSFERENCIAS? (A|AOS) MUNICIPIOS/, 40], [/INSTITUICOES PRIVADAS/, 50], [/EXTERIOR/, 70]];
const find = (tbl: Array<[RegExp, number]>, text: string, dflt: number): number => tbl.find(([re]) => re.test(norm(text)))?.[1] ?? dflt;

export interface PeFile { year: number; entry: ManifestEntry }
export async function fetchPe(pool: Pool, cfg: StorageConfig, year: number, log?: Log): Promise<PeFile> {
  await assertVolume(cfg);
  const e = await fetchRaw(cfg, { url: `${API}?ANOREFERENCIA=${year}&FUNCAO=Seguran%E7a%20P%FAblica`, relPath: `tcepe/despesas-estaduais/funcao06_${year}${year >= new Date().getUTCFullYear() ? `_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}` : ''}.json`,   // ano corrente: um instantâneo por dia
     competence: year * 100 + 12, uf: PE_UF, retention: 1, dataset: 'tcepe_despesas_estaduais', dedupeByHash: false, accept: h => h.toString('latin1').includes('"resposta"'), retries: 6 });
  await recordManifest(pool, e); log?.(JSON.stringify({ tcepe: 'raw', year, bytes: e.bytes, sha256: e.sha256 })); return { year, entry: e };
}
export interface PeRow { ANOREFERENCIA: string; DATAEMPENHO: string; ID_UNIDADE_GESTORA: string; NOMEUNIDADEGESTORA: string; SUBFUNCAO: string; CODIGO_PROGRAMA: string; CODIGO_ACAO: string; CATEGORIA: string; NATUREZA: string; MODALIDADE: string; VALOREMPENHADO: string; VALORLIQUIDADO: string; VALORPAGO: string; FUNCAO: string }
const cents = (s: string): number => Math.round(Number(s) * 100);
export interface PeBuilt { rows: Row[]; orgs: Row[]; stats: Record<string, number>; ugs: Array<{ id: number; name: string; pagoCents: number }> }
/** Agrupa os empenhos da função 06 por mês do empenho × UG × subfunção × programa × ação × natureza. Sem credor, CPF, histórico ou número de empenho. */
export function buildPe(year: number, content: PeRow[], peEntity: number): PeBuilt {
  const acc = new Map<string, Row>(); const orgs = new Map<number, Row>(); const idToUg = new Map<number, string>(); const ugPago = new Map<number, number>(); const stats: Record<string, number> = { empenhos: content.length, outOfYear: 0, subfunctionUnknown: 0, notFunction06: 0 };
  for (const r of content) {
    if (norm(r.FUNCAO) !== 'SEGURANCA PUBLICA') { stats.notFunction06!++; continue; }
    const m = /^(\d{4})-(\d{2})/.exec(r.DATAEMPENHO ?? ''); if (!m || Number(m[1]) !== year) { stats.outOfYear!++; continue; }
    const ugId = Number(r.ID_UNIDADE_GESTORA); const id = orgIdState(PE_UF, ugId); const prev = idToUg.get(id); if (prev !== undefined && prev !== String(ugId)) throw new Error(`colisão de org_id ${id}: UG ${prev} × ${ugId}`); idToUg.set(id, String(ugId));
    const name = r.NOMEUNIDADEGESTORA.trim().replace(/\s+/g, ' ').slice(0, 160);
    if (!orgs.has(id)) orgs.set(id, { org_id: id, entity_id: peEntity, level: 3, code: String(ugId), parent_id: null, name, first_year: year, last_year: year, names: { [String(year)]: name } });
    const sf = find(SUBFUNCTION, r.SUBFUNCAO, 0); if (!sf) stats.subfunctionUnknown!++;
    const cat = /CAPITAL/i.test(r.CATEGORIA) ? 4 : /CORRENTE/i.test(r.CATEGORIA) ? 3 : -1;
    const k = [Number(m[2]), id, sf, r.CODIGO_PROGRAMA, r.CODIGO_ACAO, cat, find(GRUPO, r.NATUREZA, -1), find(MODALIDADE, r.MODALIDADE, -1)].join('|');
    const row = acc.get(k) ?? { entity_id: peEntity, exercicio: year, mes: Number(m[2]), org_id: id, funcao: 6, subfuncao: sf, programa: Number(r.CODIGO_PROGRAMA) || 0, acao: String(r.CODIGO_ACAO || '-').slice(0, 12), categoria: cat, grupo: find(GRUPO, r.NATUREZA, -1), modalidade: find(MODALIDADE, r.MODALIDADE, -1), uf_loc: PE_UF, emp: 0, liq: 0, pago: 0, rp_insc: 0, rp_canc: 0, rp_pago: 0 };
    row.emp = Number(row.emp) + cents(r.VALOREMPENHADO); row.liq = Number(row.liq) + cents(r.VALORLIQUIDADO); row.pago = Number(row.pago) + cents(r.VALORPAGO); acc.set(k, row); ugPago.set(ugId, (ugPago.get(ugId) ?? 0) + cents(r.VALORPAGO));
  }
  return { rows: [...acc.values()], orgs: [...orgs.values()], stats, ugs: [...ugPago.entries()].map(([id, pagoCents]) => ({ id, name: [...orgs.values()].find(o => o.code === String(id))?.name as string, pagoCents })) };
}
export async function publishPeYear(pool: Pool, cfg: StorageConfig, f: PeFile, o: { log?: Log; failAfterApply?: boolean } = {}) {
  await assertPgHeadroom(cfg);
  const j = JSON.parse(Buffer.from(await readFile(join(cfg.rawDir, f.entry.relPath))).toString('latin1')) as { resposta: { tamanhoResultado: string; limiteResultado: string; conteudo: PeRow[] } };
  const total = Number(j.resposta.tamanhoResultado), limit = Number(j.resposta.limiteResultado); if (total >= limit) throw new Error(`TCE-PE ${f.year}: ${total} linhas atingem o limite da API (${limit}); resposta pode estar truncada`);
  const pe = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [PE_UF])).rows[0].entity_id as number; const b = buildPe(f.year, j.resposta.conteudo, pe);
  const first = await isFirstPublication(pool, DATASET.fin_pe_exec, PE_UF, f.year * 100 + 12); const fp = sha256(`${f.entry.sha256}:${FIN_VERSION.publish}:${FIN_VERSION.pe}`);
  const r = await publishSlice(pool, { datasetId: DATASET.fin_pe_exec, uf: PE_UF, competence: f.year * 100 + 12, stage: f.year >= new Date().getUTCFullYear() ? 1 : 2, sourceHash: fp, parserVersion: FIN_VERSION.publish, bootstrap: first,
    tables: [{ spec: SPECS.fin_org, rows: b.orgs }, { spec: SPECS.fin_exec_state, rows: b.rows }], inputs: { year: f.year, file: f.entry.relPath, sha256: f.entry.sha256 }, quality: { ...b.stats, rowsOut: b.rows.length, ugs: b.ugs.length, apiTotal: total },
    ...(o.failAfterApply ? { failAfterApply: true } : {}) });
  o.log?.(JSON.stringify({ tcepe: 'publish', year: f.year, status: r.status, rows: b.rows.length, ...b.stats })); return { status: r.status, built: b };
}
