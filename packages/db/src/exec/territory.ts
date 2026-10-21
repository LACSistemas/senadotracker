import type { Pool } from 'pg';
import { DATASET, SPECS } from './specs.ts';
import { publishSlice, sha256, type PublishResult, type Row } from './publication.ts';

/** Estruturas mínimas das respostas de https://servicodados.ibge.gov.br/api/v1/localidades/{municipios,estados,regioes}. */
export interface IbgeRegiao { id: number; sigla: string; nome: string }
export interface IbgeEstado { id: number; sigla: string; nome: string; regiao: IbgeRegiao }
export interface IbgeMunicipio {
  id: number; nome: string;
  microrregiao?: { mesorregiao?: { UF?: IbgeEstado } } | null;
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: IbgeEstado } } | null;
}
export const KIND = { BR: 1, REGION: 2, UF: 3, MUNICIPALITY: 4, MUNICIPALITY_UNKNOWN: 5 } as const;
export const BRASIL_IBGE = 76;
export const EXT_SOURCE = { ibge6: 1, ibge7: 2 } as const;
export const DATASET_LABELS: Record<number, string> = {
  1: 'territory_ibge', 2: 'population_sidra', 3: 'cnes_st', 4: 'cnes_lt', 5: 'cnes_eq', 6: 'cnes_pf', 7: 'sim', 8: 'sinasc', 9: 'pni', 10: 'sih_rd', 11: 'sih_mun', 12: 'aps', 13: 'siconfi', 14: 'ind_derived',
};

export function ufOfMunicipio(m: IbgeMunicipio): IbgeEstado | undefined {
  return m.microrregiao?.mesorregiao?.UF ?? m['regiao-imediata']?.['regiao-intermediaria']?.UF;
}

/** entity_id = código IBGE de 7 dígitos (município, município ignorado), 2 dígitos (UF), 1 dígito (região) ou 76 (Brasil): inteiros distintos entre os tipos. */
export function buildTerritory(municipios: IbgeMunicipio[], estados: IbgeEstado[], regioes: IbgeRegiao[]): { entities: Row[]; external: Row[]; versions: Row[]; errors: string[] } {
  const errors: string[] = [];
  const entities: Row[] = []; const external: Row[] = []; const versions: Row[] = [];
  entities.push({ entity_id: BRASIL_IBGE, kind: KIND.BR, ibge7: BRASIL_IBGE, uf_code: null, uf: null, name: 'Brasil', parent_id: null, is_current: true });
  for (const r of regioes) entities.push({ entity_id: r.id, kind: KIND.REGION, ibge7: r.id, uf_code: null, uf: null, name: r.nome, parent_id: BRASIL_IBGE, is_current: true });
  const ufs = new Map<number, IbgeEstado>(); for (const e of estados) ufs.set(e.id, e);
  for (const e of estados) {
    entities.push({ entity_id: e.id, kind: KIND.UF, ibge7: e.id, uf_code: e.id, uf: e.sigla, name: e.nome, parent_id: e.regiao.id, is_current: true });
    const unknown = e.id * 100000;
    entities.push({ entity_id: unknown, kind: KIND.MUNICIPALITY_UNKNOWN, ibge7: unknown, uf_code: e.id, uf: e.sigla, name: `Município ignorado - ${e.sigla}`, parent_id: e.id, is_current: true });
    external.push({ source: EXT_SOURCE.ibge6, code: String(unknown / 10), valid_from: '1900-01-01', valid_to: null, entity_id: unknown });
  }
  const seen6 = new Map<string, number>();
  for (const m of municipios) {
    const uf = ufOfMunicipio(m);
    if (!uf || !ufs.has(uf.id)) { errors.push(`município ${m.id} (${m.nome}) sem UF resolvível`); continue; }
    if (String(m.id).length !== 7) { errors.push(`município ${m.id} sem 7 dígitos`); continue; }
    if (Math.floor(m.id / 100000) !== uf.id) errors.push(`município ${m.id}: prefixo não bate com a UF ${uf.id}`);
    const six = String(Math.floor(m.id / 10));
    if (seen6.has(six)) errors.push(`colisão ibge6 ${six}: ${seen6.get(six)} e ${m.id}`);
    seen6.set(six, m.id);
    entities.push({ entity_id: m.id, kind: KIND.MUNICIPALITY, ibge7: m.id, uf_code: uf.id, uf: uf.sigla, name: m.nome, parent_id: uf.id, is_current: true });
    external.push({ source: EXT_SOURCE.ibge6, code: six, valid_from: '1900-01-01', valid_to: null, entity_id: m.id });
    external.push({ source: EXT_SOURCE.ibge7, code: String(m.id), valid_from: '1900-01-01', valid_to: null, entity_id: m.id });
    // Município sem microrregião no catálogo (criado depois do quadro de microrregiões): registrado sem inventar data de instalação.
    if (!m.microrregiao) versions.push({ entity_id: m.id, valid_from: '1900-01-01', valid_to: null, change_kind: 1, name: m.nome, ibge7_prev: null, source_id: 1, evidence_ref: 'IBGE localidades/municipios: sem microrregião; data de instalação NÃO comprovada' });
  }
  const counts: Record<number, number> = { [KIND.BR]: 1, [KIND.REGION]: 5, [KIND.UF]: 27, [KIND.MUNICIPALITY_UNKNOWN]: 27 };
  for (const [k, n] of Object.entries(counts)) if (entities.filter(e => e.kind === Number(k)).length !== n) errors.push(`kind ${k}: esperado ${n}`);
  return { entities, external, versions, errors };
}

export async function seedTerritory(pool: Pool, t: ReturnType<typeof buildTerritory>, competence: number): Promise<PublishResult> {
  if (t.errors.length) throw new Error(`catálogo territorial inconsistente: ${t.errors.slice(0, 5).join('; ')}`);
  const refs: Row[] = Object.entries(DATASET_LABELS).map(([id, label]) => ({ domain: 0, code: String(id), valid_from: '1900-01-01', valid_to: null, canonical_code: label, label, attrs: null }));
  const hash = sha256(JSON.stringify([t.entities.map(e => e.entity_id), t.external.length, refs.length]));
  return publishSlice(pool, {
    datasetId: DATASET.territory_ibge, uf: 0, competence, sourceHash: hash, bootstrap: true, parserVersion: 'territory-v1',
    tables: [
      { spec: SPECS.entity, rows: t.entities }, { spec: SPECS.entity_ext, rows: t.external }, { spec: SPECS.entity_version, rows: t.versions }, { spec: SPECS.ref_code, rows: refs },
    ],
  });
}
