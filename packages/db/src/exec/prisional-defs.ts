import type { Pool } from 'pg';
import { DOMAIN } from './indicator-defs.ts';

/**
 * Contratos do Sistema Prisional (P9.4, SISDEPEN/SENAPPEN). O que vale para tudo abaixo:
 *  - cada ciclo é um SEMESTRE (estoque na data de referência: 30/06 ou 31/12), nunca um mês; 19 ciclos (2016/2 a 2025/2);
 *  - capacidade (1.3) e população (4.1) são margens do MESMO universo: nunca se soma total + componentes (validado: total = Σ componentes em todas as linhas preenchidas dos 19 ciclos);
 *  - população "em celas físicas" (Tipo do Estabelecimento = Cela física) é a medida principal; prisão domiciliar (com/sem monitoramento) tem indicadores próprios e NUNCA entra na ocupação;
 *  - "Justiça Estadual/Federal/Outros" em 4.1 é a jurisdição do processo, não o âmbito do estabelecimento (estadual/federal);
 *  - célula vazia ≠ zero declarado; a fonte só traz respostas validadas, então não há universo esperado nem "cobertura" além da continuidade entre ciclos;
 *  - local do estabelecimento ≠ residência dos custodiados: nada aqui é indicador de criminalidade do município.
 */
export const PRI_VERSION = { parser: 'sisdepen-v1', publish: 'pri-v1', identity: 'pri-id-v1' } as const;
export const PRI_FIRST_CYCLE = { year: 2016, sem: 2 } as const;
export const PRI_TIPO = { cela: 1, domSem: 2, domCom: 3 } as const;
export const PRI_AMBITO = { estadual: 1, federal: 2 } as const;

export interface Semester { year: number; sem: 1 | 2; cycle: number; competence: number; start: string; end: string; ref: string }
export function semesterOfRef(ref: string): Semester {
  const m = /^(\d{4})\/([12])$/.exec(ref.trim()); if (!m) throw new Error(`referência de ciclo inválida: ${ref}`);
  const year = Number(m[1]), sem = Number(m[2]) as 1 | 2; const cycle = (year - PRI_FIRST_CYCLE.year) * 2 + sem - 1;
  if (cycle < 1) throw new Error(`ciclo anterior ao 1º (${ref})`);
  return { year, sem, cycle, competence: year * 100 + (sem === 1 ? 6 : 12), start: sem === 1 ? `${year}-01-01` : `${year}-07-01`, end: sem === 1 ? `${year}-07-01` : `${year + 1}-01-01`, ref: `${year}/${sem}` };
}

const CAPP = '1.3 Capacidade do estabelecimento | ', POPP = '4.1 População prisional | ';
export interface PriMeasure { id: number; code: string; block: '1.3 capacidade' | '4.1 população'; label: string; header: string; note: string }
export const CAP_REGIMES = [['prov', 'Presos provisórios'], ['fechado', 'Regime fechado'], ['semi', 'Regime semiaberto'], ['aberto', 'Regime aberto'], ['rdd', 'Regime Disciplinar Diferenciado (RDD)'], ['ms', 'Medidas de segurança de internação'], ['outros', 'Outro(s). Qual(is)?']] as const;
export const POP_GROUPS = [['prov', 'Presos provisórios (sem condenação)'], ['fechado', 'Presos sentenciados - regime fechado'], ['semi', 'Presos sentenciados - regime semiaberto'], ['aberto', 'Presos sentenciados - regime aberto'], ['msi', 'Medida de segurança - internação'], ['msa', 'Medida de segurança - tratamento ambulatorial']] as const;
const POP_SPLITS = [['EM', 'Justiça Estadual Masculino'], ['EF', 'Justiça Estadual Feminino'], ['FM', 'Justiça Federal Masculino'], ['FF', 'Justiça Federal Feminino'], ['OM', 'Outros(Just. Trab., cível) Masculino'], ['OF', 'Outros(Just. Trab., cível) Feminino'], ['T', 'Total']] as const;
function buildMeasures(): PriMeasure[] {
  const out: PriMeasure[] = []; let id = 101;
  for (const [k, name] of CAP_REGIMES) for (const [s, sn] of [['M', 'Masculino'], ['F', 'Feminino'], ['T', 'Total']] as const)
    out.push({ id: id++, code: `cap.${k}.${s}`, block: '1.3 capacidade', label: `Capacidade — ${name} — ${sn}`, header: `${CAPP}${name} | ${sn}`, note: s === 'T' ? 'Total do regime = masculino + feminino (conferido). Não somar ao total geral.' : 'Margem por sexo dentro do regime.' });
  out.push({ id: id++, code: 'cap.total.M', block: '1.3 capacidade', label: 'Capacidade — Masculino — Total (todos os regimes)', header: `${CAPP}Masculino | Total`, note: 'Total geral masculino = Σ regimes masculinos (conferido). Em unidade só feminina a fonte deixa a célula vazia (não aplicável).' });
  out.push({ id: id++, code: 'cap.total.F', block: '1.3 capacidade', label: 'Capacidade — Feminino — Total (todos os regimes)', header: `${CAPP}Feminino | Total`, note: 'Total geral feminino = Σ regimes femininos (conferido). Em unidade só masculina a fonte deixa a célula vazia (não aplicável).' });
  for (const [k, h, l] of [['dis.cells', 'Celas interditadas/ desativadas e respectivas vagas | Celas não aptas', 'Celas não aptas'], ['dis.M', 'Celas interditadas/ desativadas e respectivas vagas | Vagas desativadas - Masculino', 'Vagas desativadas — masculino'], ['dis.F', 'Celas interditadas/ desativadas e respectivas vagas | Vagas desativadas - Feminino', 'Vagas desativadas — feminino'], ['dis.T', 'Celas interditadas/ desativadas e respectivas vagas | Total de vagas desativadas', 'Total de vagas desativadas']] as const)
    out.push({ id: id++, code: `cap.${k}`, block: '1.3 capacidade', label: `Capacidade — ${l}`, header: `${CAPP}${h}`, note: 'Informação sobre celas/vagas desativadas; não é subtraída nem somada à capacidade publicada (a fonte não diz se já está fora do total).' });
  id = 201;
  for (const [k, name] of POP_GROUPS) for (const [s, sn] of POP_SPLITS)
    out.push({ id: id++, code: `pop.${k}.${s}`, block: '4.1 população', label: `População — ${name} — ${sn}`, header: `${POPP}${name} | ${sn}`, note: s === 'T' ? 'Total do grupo = Σ das 6 margens de jurisdição × sexo (conferido). Não somar ao total geral.' : 'Jurisdição do processo (estadual/federal/outros) × sexo; não é o âmbito do estabelecimento.' });
  out.push({ id: id++, code: 'pop.total', block: '4.1 população', label: 'População prisional — Total', header: `${POPP}Total`, note: 'Total geral = Σ dos totais dos 6 grupos (conferido em todos os ciclos). Em celas físicas = pessoas custodiadas nas celas; em estabelecimento domiciliar = pessoas em prisão domiciliar.' });
  out.push({ id: id++, code: 'pop.rdd', block: '4.1 população', label: 'Pessoas em Regime Disciplinar Diferenciado', header: `${POPP}Quantas pessoas privadas de liberdade estão em Regime Disciplinar Diferenciado?`, note: 'Subconjunto já contido na população total; nunca somar ao total.' });
  return out;
}
export const PRI_MEASURES: PriMeasure[] = buildMeasures();
export const PRI_MEASURE_BY_HEADER = new Map(PRI_MEASURES.map(m => [m.header, m]));
export const PRI_MEASURE_BY_CODE = new Map(PRI_MEASURES.map(m => [m.code, m]));
export const mid = (code: string): number => { const m = PRI_MEASURE_BY_CODE.get(code); if (!m) throw new Error(`medida desconhecida ${code}`); return m.id; };

/** Indicadores territoriais (município, UF, Brasil). Escopo E = estabelecimentos estaduais; F = federais (localizados na UF, fora do sistema estadual); D = domiciliar. */
export type PriDef = { id: number; code: string; label: string; unit: string; sort: number; numerator: string; denominator: string; note: string; additive: boolean; scope: 'E' | 'F' | 'D'; kind: string };
const NOTE_BASE = 'SISDEPEN/SENAPPEN: formulário semestral das administrações prisionais (apenas respostas validadas). Estoque na data de referência do ciclo (30/06 ou 31/12). Celas físicas; prisão domiciliar tem indicador próprio. Local do estabelecimento ≠ residência dos custodiados; não é indicador de criminalidade do território.';
export const PRI_OCC_FORMULA = 'ocupação (%) = Σ população das celas físicas ÷ Σ capacidade (vagas) × 100, somente dos estabelecimentos com capacidade utilizável (> 0) no ciclo; agregação por soma, nunca média das taxas das unidades';
function priDefs(): PriDef[] {
  const out: PriDef[] = []; let sort = 6000;
  const fam = (base: number, scope: 'E' | 'F', sc: string) => {
    const mk = (off: number, kind: string, label: string, unit: string, num: string, den: string, note: string, additive: boolean) => out.push({ id: base + off, code: `IND-PRI-${scope}-${kind.toUpperCase()}`, label: `${label} — ${sc}`, unit, sort: sort++, numerator: num, denominator: den, scope, kind, additive, note: `${NOTE_BASE} ${note}` });
    mk(1, 'units', 'Estabelecimentos prisionais (celas físicas)', 'estabelecimentos', 'estabelecimentos com Tipo = Cela física no ciclo', 'não se aplica (contagem)', 'Contagem de estabelecimentos distintos do ciclo, não de registros de vários ciclos. Não inclui unidades domiciliares.', true);
    mk(2, 'cap', 'Capacidade (vagas) em celas físicas', 'vagas', 'capacidade declarada: masculino + feminino (soma do que foi declarado, como no relatório oficial; célula vazia em unidade de um só sexo = não aplicável)', 'não se aplica (contagem)', 'Σ do declarado. Unidade mista com um dos sexos esperado e vazio entra com o que declarou, leva o sinal de cobertura parcial e fica FORA da taxa de ocupação (capacidade incompleta).', true);
    mk(3, 'pop', 'População em celas físicas', 'pessoas', 'população prisional total (4.1) dos estabelecimentos com Tipo = Cela física', 'não se aplica (contagem)', 'Estoque na data de referência; NÃO inclui prisão domiciliar.', true);
    mk(4, 'occ', 'Taxa de ocupação das celas físicas', '% das vagas', 'população das unidades elegíveis', 'capacidade das unidades elegíveis', `${PRI_OCC_FORMULA}. Pode passar de 100 %.`, false);
    mk(5, 'exc_net', 'Excedente líquido de ocupação', 'pessoas', 'população das unidades elegíveis', 'capacidade das unidades elegíveis', 'Σ população − Σ capacidade das unidades elegíveis (negativo = vagas ociosas). É diferente do excedente bruto.', false);
    mk(6, 'exc_gross', 'Excedente bruto (soma dos excedentes positivos por unidade)', 'pessoas', 'Σ max(0, população − capacidade) por unidade elegível', 'não se aplica', 'Não compensa unidades com vagas ociosas. Indicador distinto do excedente líquido.', true);
    mk(7, 'no_cap', 'Estabelecimentos com população e sem capacidade utilizável', 'estabelecimentos', 'celas físicas com população > 0 e nenhuma capacidade declarada (ou zero)', 'não se aplica (contagem)', 'Ficam fora da taxa de ocupação; a população deles continua na população total.', true);
    mk(8, 'eligible', 'Estabelecimentos elegíveis à taxa de ocupação', 'estabelecimentos', 'celas físicas com capacidade completa (> 0)', 'não se aplica (contagem)', 'Denominador de cobertura da taxa de ocupação.', true);
  };
  fam(6000, 'E', 'sistema estadual'); fam(6100, 'F', 'sistema federal (unidades localizadas no território)');
  const ex = (id: number, kind: string, label: string, unit: string, num: string, note: string) => out.push({ id, code: `IND-PRI-E-${kind.toUpperCase()}`, label: `${label} — sistema estadual`, unit, sort: sort++, numerator: num, denominator: 'não se aplica (contagem)', scope: 'E', kind, additive: true, note: `${NOTE_BASE} ${note}` });
  ex(6020, 'cap_m', 'Capacidade masculina em celas físicas', 'vagas', 'Σ capacidade masculina total', 'Margem por sexo da capacidade; não somar à capacidade total.');
  ex(6021, 'cap_f', 'Capacidade feminina em celas físicas', 'vagas', 'Σ capacidade feminina total', 'Margem por sexo da capacidade; não somar à capacidade total.');
  ex(6022, 'pop_m', 'População masculina em celas físicas', 'pessoas', 'Σ das colunas masculinas de 4.1 (jurisdições estadual, federal e outras)', 'Margem por sexo do MESMO universo da população total; não somar à população total nem às margens por regime.');
  ex(6023, 'pop_f', 'População feminina em celas físicas', 'pessoas', 'Σ das colunas femininas de 4.1', 'Margem por sexo do MESMO universo da população total; não somar à população total nem às margens por regime.');
  POP_GROUPS.forEach(([k, name], i) => ex(6024 + i, `pop_${k}`, `População em celas físicas — ${name}`, 'pessoas', `4.1 Total do grupo "${name}"`, 'Margem por regime/situação processual do MESMO universo; as seis margens somam a população total. Não somar com sexo nem com outras margens.'));
  CAP_REGIMES.forEach(([k, name], i) => ex(6030 + i, `cap_${k}`, `Capacidade em celas físicas — ${name}`, 'vagas', `1.3 Total do regime "${name}"`, 'Margem por regime da capacidade; somam o total geral. Nunca somar ao total geral.'));
  const dom = (id: number, kind: string, label: string, unit: string, num: string) => out.push({ id, code: `IND-PRI-D-${kind.toUpperCase()}`, label, unit, sort: sort++, numerator: num, denominator: 'não se aplica (contagem)', scope: 'D', kind, additive: true, note: `${NOTE_BASE} Prisão domiciliar NÃO é pessoa em cela física e NÃO entra na taxa de ocupação.` });
  dom(6040, 'units_com', 'Estabelecimentos domiciliares com monitoramento eletrônico', 'estabelecimentos', 'Tipo = Domiciliar com monitoramento eletrônico');
  dom(6041, 'pop_com', 'Pessoas em prisão domiciliar com monitoramento eletrônico', 'pessoas', '4.1 Total dos estabelecimentos domiciliares com monitoramento');
  dom(6042, 'units_sem', 'Estabelecimentos domiciliares sem monitoramento eletrônico', 'estabelecimentos', 'Tipo = Domiciliar sem monitoramento eletrônico');
  dom(6043, 'pop_sem', 'Pessoas em prisão domiciliar sem monitoramento eletrônico', 'pessoas', '4.1 Total dos estabelecimentos domiciliares sem monitoramento');
  return out;
}
export const PRI_DEFS: PriDef[] = priDefs();
export const PRI_DEF_BY_ID = new Map(PRI_DEFS.map(d => [d.id, d]));
export const PRI_IDS: number[] = PRI_DEFS.map(d => d.id);
/** Indicadores aditivos (Σ municípios + não conciliados = UF; Σ UFs = Brasil). */
export const PRI_ADDITIVE_IDS: number[] = PRI_DEFS.filter(d => d.additive).map(d => d.id);

export async function seedPrisionalDefs(pool: Pool, defs: PriDef[] = PRI_DEFS): Promise<number> {
  for (const d of defs) {
    await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,1,$3,$4,$5,$6,'S',$7,$8,NULL,false,$9,$10,$11)
      ON CONFLICT (indicator_id) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit, numerator_desc = EXCLUDED.numerator_desc, denominator_desc = EXCLUDED.denominator_desc, aggregation_allowed = EXCLUDED.aggregation_allowed, null_semantics = EXCLUDED.null_semantics, methodology_note = EXCLUDED.methodology_note`,
      [d.id, d.code, DOMAIN.seguranca, d.sort, d.label, d.unit, d.numerator, d.denominator, d.additive,
        'sem linha = território sem estabelecimento no ciclo OU sem resposta no arquivo (a fonte só traz respostas validadas e não permite distinguir); nunca zero por ausência. Valor nulo + noDenominator = sem capacidade utilizável para calcular a taxa.',
        `${d.note}${d.kind === 'occ' || d.kind === 'exc_net' ? ' Fórmula: ' + PRI_OCC_FORMULA + '.' : ''}`]);
  }
  for (const m of PRI_MEASURES) await pool.query(`INSERT INTO civica_exec.exec_pri_measure (measure_id, code, block, label, note) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (measure_id) DO UPDATE SET label = EXCLUDED.label, note = EXCLUDED.note`, [m.id, m.code, m.block, m.label, m.note]);
  return defs.length;
}
