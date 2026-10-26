import { norm } from './pncp-build.ts';
import { EDU_CONFIDENCE } from './edu-contract-build.ts';
import type { Row } from './publication.ts';

/**
 * Obras educacionais do Obrasgov (P10.7). Obra ≠ contrato ≠ pagamento: o Obrasgov dá cadastro, situação, execução física e empenhos; o PNCP dá contratos e só se liga a ela pela chave oficial CIPI
 * (`identificadorCipi` do contrato = `idUnico` da obra). Regras (versionar EDU_WORK_VERSION):
 *  - educacional por EVIDÊNCIA: órgão de educação como executor/tomador/repassador (FNDE = oficial), unidade escolar nomeada no nome/descrição, ou contrato educacional do PNCP que aponta a obra;
 *    o `tipo`/`subtipo` do Obrasgov NÃO é usado (inconsistente: creches classificadas como infraestrutura hídrica);
 *  - valor previsto <= R$ 0,01 é placeholder (NULL + marca); data efetiva só existe quando o cadastrador a informou (nunca inferida de pagamento ou de prazo);
 *  - situação = a declarada; percentual físico = o último registro da execução física; empenhado ≠ pago;
 *  - sem código INEP e sem código IBGE de município na fonte: a obra fica na UF e NÃO é ligada a escola nem a município.
 */
export const EDU_WORK_VERSION = { classify: 'edu-work-v1', publish: 'edu-work-pub-1' } as const;
export interface ObraOrg { nome?: string | null; codigo?: number | null }
export interface ObraProject {
  idUnico: string; nome?: string | null; descricao?: string | null; funcaoSocial?: string | null; especie?: string | null; natureza?: string | null; situacao?: string | null; uf?: string | null;
  dataInicialPrevista?: string | null; dataFinalPrevista?: string | null; dataInicialEfetiva?: string | null; dataFinalEfetiva?: string | null; dataSituacao?: string | null; dataCadastro?: string | null;
  tomadores?: ObraOrg[] | null; executores?: ObraOrg[] | null; repassadores?: ObraOrg[] | null; fontesDeRecurso?: Array<{ origem?: string | null; valorInvestimentoPrevisto?: number | null }> | null;
}
export interface ObraFisica { idUnico?: string | null; percentual?: number | null; dataSituacao?: string | null; situacao?: string | null; emOperacao?: boolean | null }
export interface ObraEmpenho { idProjetoInvestimento?: string | null; valorEmpenho?: number | null; numeroNotaEmpenhoGerada?: string | null; nrNotaEmpenho?: string | null; ugEmitente?: string | null; naturezaDespesa?: string | null; fonteRecurso?: string | null }
export interface WorkCtx { ufCode: (acronym: string) => number | undefined; entityByUf: Map<number, number>; year: number }
export interface WorkSlice { works: Row[]; commits: Row[]; in: number; rejected: number; noValue: number }

const EDU_ORG = /\bSECRETARIA\b[A-Z0-9 ]{0,60}\bEDUCACAO\b|\bSEMED\b|\bSEDUC\b|\bFUNDO\b[A-Z0-9 ]{0,60}\b(EDUCACAO|ENSINO)\b|\bFUNDEB\b|\b(DEPARTAMENTO|DIRETORIA|COORDENADORIA)\b[A-Z0-9 ]{0,40}\bEDUCACAO\b|\bINSTITUTO FEDERAL\b/;
const FNDE = /^FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCACAO$|^MINISTERIO DA EDUCACAO$/;
const SCHOOL_NAME = /\b(ESCOLA|ESCOLAS|ESCOLAR|EMEF|EMEI|EMEIEF|CMEI|CEMEI|CEIM|CRECHE|CRECHES|PROINFANCIA|UNIDADE ESCOLAR|UNIDADES ESCOLARES|COLEGIO|QUADRA ESCOLAR|CENTRO DE EDUCACAO INFANTIL|EDUCACAO INFANTIL|CENTRO MUNICIPAL DE EDUCACAO)\b/;
const NOT_SCHOOL = /\b(ESCOLA (DE|DO|DA) (GOVERNO|SAUDE|MAGISTRATURA|GUERRA|POLICIA|CONTAS|ADMINISTRACAO|SERVICO PUBLICO|SUPERIOR)|ESCOLA (NAVAL|SUPERIOR|JUDICIAL|FAZENDARIA|NACIONAL)|HOSPITAL ESCOLA|HOSPITAL UNIVERSITARIO|UNIVERSIDADE|CAMPUS|AUTOESCOLA)\b/;
const day = (s: string | null | undefined): string | null => s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
const cents = (v: number | null | undefined): number | null => v == null || !Number.isFinite(v) ? null : Math.round(v * 100);
const names = (o: ObraOrg[] | null | undefined): string => (o ?? []).map(x => (x.nome ?? '').trim()).filter(Boolean).join('; ').slice(0, 500);

/** Evidência educacional da obra: base (1 órgão, 2 texto escolar, 3 contrato do PNCP, 4 mais de uma) e confiança. */
export function classifyWork(p: ObraProject, cipiSet: ReadonlySet<string>): { basis: number; confidence: number } | null {
  const orgs = [...(p.executores ?? []), ...(p.tomadores ?? []), ...(p.repassadores ?? [])]; let org = 0; let confirmed = false;
  for (const o of orgs) { const n = norm(o.nome ?? ''); if (FNDE.test(n)) { org = 1; confirmed = true; } else if (EDU_ORG.test(n)) org = 1; }
  const text = norm(`${p.nome ?? ''} ${p.descricao ?? ''} ${p.funcaoSocial ?? ''}`); const school = SCHOOL_NAME.test(text) && !NOT_SCHOOL.test(text);
  const strongSchool = school && /\b(ESCOLA|ESCOLAS|EMEF|EMEI|EMEIEF|CMEI|CEMEI|CEIM|CRECHE|CRECHES|PROINFANCIA|UNIDADE ESCOLAR|UNIDADES ESCOLARES|COLEGIO|QUADRA ESCOLAR)\b/.test(text);
  const contract = cipiSet.has(p.idUnico);
  const bases = [org ? 1 : 0, school ? 2 : 0, contract ? 3 : 0].filter(Boolean);
  if (!bases.length) return null;
  const confidence = confirmed ? EDU_CONFIDENCE.CONFIRMED_OFFICIAL : org || contract || strongSchool ? EDU_CONFIDENCE.HIGH_CONFIDENCE_DERIVED : EDU_CONFIDENCE.POSSIBLE_EDUCATION;
  return { basis: bases.length > 1 ? 4 : bases[0]!, confidence };
}

export function buildWorks(projects: ObraProject[], fisica: ObraFisica[], empenhos: ObraEmpenho[], cipiSet: ReadonlySet<string>, ctx: WorkCtx): { bySlice: Map<number, WorkSlice>; stats: Record<string, number> } {
  const stats: Record<string, number> = { projetos: 0, duplicados: 0, educacionais: 0, nao_educacao: 0, sem_uf: 0, sem_ente: 0, valor_placeholder: 0, com_fisica: 0, com_empenho: 0 };
  const latest = new Map<string, ObraProject>();
  for (const p of projects) { stats.projetos!++; const prev = latest.get(p.idUnico); if (prev) { stats.duplicados!++; if ((day(p.dataSituacao) ?? '') < (day(prev.dataSituacao) ?? '')) continue; } latest.set(p.idUnico, p); }
  const phys = new Map<string, ObraFisica>(); for (const f of fisica) { if (!f.idUnico) continue; const prev = phys.get(f.idUnico); if (!prev || (day(f.dataSituacao) ?? '') >= (day(prev.dataSituacao) ?? '')) phys.set(f.idUnico, f); }
  const emp = new Map<string, ObraEmpenho[]>(); const seenEmp = new Set<string>();
  for (const e of empenhos) { if (!e.idProjetoInvestimento) continue; const key = `${e.idProjetoInvestimento}|${e.numeroNotaEmpenhoGerada ?? e.nrNotaEmpenho ?? ''}|${e.ugEmitente ?? ''}|${e.valorEmpenho ?? ''}|${e.naturezaDespesa ?? ''}`; if (seenEmp.has(key)) continue; seenEmp.add(key); (emp.get(e.idProjetoInvestimento) ?? emp.set(e.idProjetoInvestimento, []).get(e.idProjetoInvestimento)!).push(e); }
  const bySlice = new Map<number, WorkSlice>(); const slice = (u: number) => bySlice.get(u) ?? bySlice.set(u, { works: [], commits: [], in: 0, rejected: 0, noValue: 0 }).get(u)!;
  for (const p of [...latest.values()].sort((a, b) => a.idUnico < b.idUnico ? -1 : 1)) {
    const ufc = p.uf ? ctx.ufCode(p.uf.toUpperCase()) : undefined; const s = slice(ufc ?? 0); s.in++;
    const cl = classifyWork(p, cipiSet); if (!cl) { stats.nao_educacao!++; continue; }
    if (!ufc) { stats.sem_uf!++; s.rejected++; continue; }
    const entity = ctx.entityByUf.get(ufc); if (entity === undefined) { stats.sem_ente!++; s.rejected++; continue; }
    const vals = (p.fontesDeRecurso ?? []).map(f => f.valorInvestimentoPrevisto).filter((v): v is number => v != null && Number.isFinite(v));
    const real = vals.filter(v => v > 0.01); const placeholder = vals.length > 0 && real.length === 0; if (placeholder) stats.valor_placeholder!++;
    const valor = real.length ? cents(real.reduce((a, b) => a + b, 0)) : null; if (valor == null) s.noValue++;
    const ph = phys.get(p.idUnico); if (ph) stats.com_fisica!++;
    const es = emp.get(p.idUnico) ?? []; if (es.length) stats.com_empenho!++;
    const committed = es.length ? es.reduce((a, e) => a + (cents(e.valorEmpenho) ?? 0), 0) : null;
    s.works.push({
      work_id: p.idUnico, uf: ufc, entity_id: entity, name: (p.nome ?? '').trim().slice(0, 300), descricao: (p.descricao ?? '').trim().slice(0, 600), especie: p.especie ?? null, natureza: p.natureza ?? null, situacao: p.situacao ?? null,
      d_start_prev: day(p.dataInicialPrevista), d_end_prev: day(p.dataFinalPrevista), d_start_eff: day(p.dataInicialEfetiva), d_end_eff: day(p.dataFinalEfetiva), d_situacao: day(p.dataSituacao), d_cadastro: day(p.dataCadastro),
      valor_previsto: valor, valor_placeholder: placeholder, tomadores: names(p.tomadores), executores: names(p.executores), repassadores: names(p.repassadores), edu_basis: cl.basis, edu_confidence: cl.confidence,
      phys_percent: ph?.percentual != null && ph.percentual >= 0 && ph.percentual <= 100 ? Math.round(ph.percentual) : null, phys_situacao: ph?.situacao ?? null, phys_date: day(ph?.dataSituacao), em_operacao: ph?.emOperacao ?? null,
      committed, commits: es.length, year: ctx.year,
    });
    es.forEach((e, i) => s.commits.push({ work_id: p.idUnico, idx: i + 1, uf: ufc, year: ctx.year, nota: e.numeroNotaEmpenhoGerada ?? e.nrNotaEmpenho ?? null, ug_emitente: e.ugEmitente ?? null, natureza: e.naturezaDespesa ?? null, fonte: e.fonteRecurso ?? null, valor: cents(e.valorEmpenho) }));
    stats.educacionais!++;
  }
  return { bySlice, stats };
}
