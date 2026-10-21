import type { Pool } from 'pg';

/** Domínios de indicador (exec_ind_def.domain). */
export const DOMAIN = { saude: 1, educacao: 2, seguranca: 3, bem_estar: 4, infraestrutura: 5 } as const;
/** Bits de flags (exec_ind_value.flags). */
export const FLAG = { smallN: 1, preliminary: 2, partialCoverage: 4, suppressed: 8, denominatorDivergent: 16, above100: 32, noDenominator: 64 } as const;

export interface IndDef { id: number; code: string; version?: number; label: string; unit: string; grain: 'M' | 'Q' | 'S' | 'A'; sort: number; numerator: string; denominator: string; minDenominator?: number; note: string; ranking?: boolean; aggregation?: boolean }

/** Somente indicadores com contrato definido e extração reconciliada. Mortalidade materna, ocupação, resolutividade etc. ficam fora (P8). */
export const SAUDE_DEFS: IndDef[] = [
  { id: 5, code: 'IND-SAU-05', label: 'Leitos hospitalares existentes por 1.000 habitantes', unit: 'leitos/1.000 hab.', grain: 'M', sort: 50, numerator: 'Σ QT_EXIST do CNES-LT (TP_LEITO ≠ 7, sem hospital-dia) no município do estabelecimento', denominator: 'população residente estimada (IBGE) do ano da competência', minDenominator: 0, aggregation: true,
    note: 'Cadastro autodeclarado do CNES; leitos complementares (UTI/UCI) entram na soma. Município sem estabelecimento no mês não tem linha; sem leito registrado = 0. Leitos por residente ignoram o fluxo regional.' },
  { id: 6, code: 'IND-SAU-05S', label: 'Leitos SUS por 1.000 habitantes', unit: 'leitos/1.000 hab.', grain: 'M', sort: 51, numerator: 'Σ QT_SUS do CNES-LT (TP_LEITO ≠ 7)', denominator: 'população residente estimada (IBGE)', minDenominator: 0, aggregation: true, note: 'Ver IND-SAU-05.' },
  { id: 8, code: 'IND-SAU-08', label: 'Mortalidade infantil', unit: 'óbitos <1 ano por 1.000 nascidos vivos', grain: 'A', sort: 80, numerator: 'SIM: óbitos não fetais com idade < 1 ano, por município de residência', denominator: 'SINASC: nascidos vivos, por município de residência', minDenominator: 100, aggregation: true,
    note: 'Residência, não ocorrência. Números pequenos são instáveis: municípios com menos de 100 nascidos levam o sinal de pequeno número e não entram em comparação. 2025–2026 são preliminares.' },
  { id: 10, code: 'IND-SAU-10', label: 'Proporção de internações SUS por condições sensíveis à atenção primária (ICSAP)', unit: '% das AIH de residentes', grain: 'M', sort: 100, numerator: 'AIH com diagnóstico principal na Lista Brasileira de ICSAP (Portaria SAS/MS 221/2008)', denominator: 'AIH de residentes aprovadas na competência', minDenominator: 30, aggregation: true,
    note: 'Proporção, não taxa padronizada por idade. Só internações pagas pelo SUS. Residência exige os 27 arquivos do SIH: UFs sem os 27 arquivos ficam com cobertura parcial. Não equivale a "internações evitáveis".' },
  { id: 11, code: 'IND-SAU-11', label: 'Nascidos de mães com 6 ou mais consultas de pré-natal', unit: '% dos nascidos com informação válida', grain: 'A', sort: 110, numerator: 'SINASC: CONSPRENAT entre 6 e 98', denominator: 'SINASC: CONSPRENAT válido (0 a 98)', minDenominator: 100, aggregation: true,
    note: 'Consultas declaradas na DN, não produção da APS. A referência de 6 consultas está sob revisão clínica.' },
  { id: 12, code: 'IND-SAU-12', label: 'Partos cesáreos', unit: '% dos partos com tipo informado', grain: 'A', sort: 120, numerator: 'SINASC: PARTO = 2', denominator: 'SINASC: PARTO ∈ {1, 2}', minDenominator: 100, aggregation: true,
    note: 'Taxa bruta, sem ajuste pelo perfil das gestantes (classificação de Robson). Nenhuma faixa de referência é aplicada.' },
];
/** Cobertura vacinal: um indicador por rótulo canônico do arquivo oficial (rótulos diferentes são definições diferentes). */
export const VAC_BASE_ID = 700;

export async function seedIndicatorDefs(pool: Pool, defs: IndDef[] = SAUDE_DEFS): Promise<number> {
  let n = 0;
  for (const d of defs) {
    await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,false,$11,'sem linha = sem registro; nunca zero no lugar de ausência',$12)
      ON CONFLICT (indicator_id) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit, numerator_desc = EXCLUDED.numerator_desc, denominator_desc = EXCLUDED.denominator_desc, min_denominator = EXCLUDED.min_denominator, methodology_note = EXCLUDED.methodology_note`,
      [d.id, d.code, d.version ?? 1, d.sort, d.label, d.unit, d.grain, d.numerator, d.denominator, d.minDenominator ?? null, d.aggregation ?? true, d.note]);
    n++;
  }
  return n;
}
