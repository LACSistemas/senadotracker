import type { Row } from './publication.ts';

/**
 * Classificação dos contratos do PNCP para a Segurança Pública (P9.5). DUAS classificações independentes, nunca fundidas:
 *  - `org_kind`: o ÓRGÃO contratante é uma instituição de segurança, por NOME (confiança alta, não exata: o PNCP não traz função orçamentária);
 *  - `theme`: o OBJETO sugere um tema de segurança, por palavras-chave (derivado; NÃO é "despesa oficial da função Segurança Pública").
 * Palavras genéricas (uniforme, câmera, rádio) só viram tema com contexto policial no próprio objeto ou órgão de segurança contratante; vigilância/segurança
 * patrimonial (escolas, prédios) é tema 99 e nunca conta como segurança pública. O texto do objeto não é persistido.
 */
export const PNCP_VERSION = { classify: 'pncp-sec-v1', publish: 'pncp-pub-v2' } as const;
export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

export const ORG_KINDS: Record<number, string> = { 0: 'não identificado como órgão de segurança', 1: 'secretaria de segurança', 2: 'polícia militar', 3: 'polícia civil', 4: 'corpo de bombeiros', 5: 'polícia penal / administração penitenciária', 6: 'perícia / polícia científica', 7: 'guarda municipal / secretaria municipal de segurança', 8: 'órgão federal de segurança (PF, PRF, MJSP, SENAPPEN, FNSP)', 9: 'defesa civil' };
/** Forças Armadas e Defesa Nacional: função 05, não 06; seus contratos NUNCA entram, nem por tema. */
export const DEFENSE_ORG = /COMANDO DO (EXERCITO|MARINHA|AERONAUTICA)|COMANDO DA (MARINHA|AERONAUTICA)|MINISTERIO DA DEFESA|EXERCITO BRASILEIRO|MARINHA DO BRASIL|FORCA AEREA|ESTADO MAIOR|FORCAS ARMADAS|HOSPITAL (MILITAR|NAVAL|DE AERONAUTICA)/;
const EXCL_ORG = /SEGURANCA (ALIMENTAR|DO TRABALHO|DA INFORMACAO|SOCIAL|HIDRICA|NUTRICIONAL|VIARIA|NO TRANSITO)|SEGURIDADE|MEDICINA E SEGURANCA/;
const ORG_RULES: Array<[number, RegExp]> = [
  [4, /CORPO DE BOMBEIRO|BOMBEIRO MILITAR|BOMBEIROS/], [2, /POLICIA MILITAR|\bPOLICIA MILITAR\b/], [3, /POLICIA CIVIL|DEPARTAMENTO DE POLICIA CIVIL/], [6, /POLICIA CIENTIFICA|INSTITUTO (GERAL )?DE PERICIAS?|PERICIA OFICIAL|CRIMINALISTICA|INSTITUTO MEDICO LEGAL/],
  [5, /POLICIA PENAL|ADMINISTRACAO PENITENCIARIA|SISTEMA PENITENCIARIO|SISTEMA PRISIONAL|ADMINISTRACAO PRISIONAL|DEPARTAMENTO PENITENCIARIO|SECRETARIA NACIONAL DE POLITICAS PENAIS|FUNDO PENITENCIARIO|SENAPPEN|SECRETARIA DE ESTADO DE JUSTICA E (CIDADANIA|DIREITOS HUMANOS)/],
];
const FEDERAL = /POLICIA FEDERAL|POLICIA RODOVIARIA FEDERAL|MINISTERIO DA JUSTICA E SEGURANCA PUBLICA|FUNDO NACIONAL DE SEGURANCA PUBLICA|FORCA NACIONAL DE SEGURANCA|SECRETARIA NACIONAL DE SEGURANCA PUBLICA|SENAPPEN|DEPARTAMENTO PENITENCIARIO NACIONAL/;
const SEC_ORG = /SECRETARIA (DE ESTADO |EXTRAORDINARIA |MUNICIPAL )?(DA |DE |DO |DOS )?(SEGURANCA|DEFESA SOCIAL|ORDEM PUBLICA|JUSTICA E SEGURANCA)|SEGURANCA PUBLICA|SEGURANCA URBANA|SEGURANCA CIDADA|SEGURANCA COMUNITARIA|DEFESA SOCIAL|ORDEM PUBLICA|GUARDA (CIVIL |MUNICIPAL |METROPOLITANA )/;
const GM_NAME = /GUARDA (CIVIL |MUNICIPAL |METROPOLITANA )|SECRETARIA .{0,40}(SEGURANCA (PUBLICA|URBANA|CIDADA|COMUNITARIA)|DEFESA SOCIAL|ORDEM PUBLICA)|FUNDO .{0,30}SEGURANCA (PUBLICA|URBANA)/;
/** Tipo de órgão por nome (órgão + unidade) e esfera (F federal, E estadual, D distrital, M municipal). 0 = não identificado. */
export function classifyOrgan(razaoSocial: string, unidade: string, esfera: string): number {
  const t = norm(`${razaoSocial} ${unidade}`); if (!t || EXCL_ORG.test(t) || DEFENSE_ORG.test(t)) return 0;
  if (/GUARDA (CIVIL |MUNICIPAL |METROPOLITANA )/.test(t) && esfera !== 'F') return 7;
  if (esfera === 'F' && FEDERAL.test(t)) return 8;
  for (const [k, re] of ORG_RULES) if (re.test(t)) return k;
  if (/DEFESA CIVIL/.test(t) && !/SEGURANCA PUBLICA/.test(t)) return 9;
  if (esfera === 'M') return GM_NAME.test(t) ? 7 : 0;
  return SEC_ORG.test(t) ? 1 : 0;
}

export const SEC_THEMES: Array<{ id: number; code: string; label: string; strong: boolean; re: RegExp }> = [
  { id: 1, code: 'VIATURAS', label: 'viaturas e veículos policiais/ostensivos', strong: false, re: /VIATURA|AUTOMOVEL.{0,30}(POLICIAL|OSTENSIV)|VEICULO.{0,30}(POLICIAL|OSTENSIV|DE POLICIA)|CAMINHONETE.{0,30}(POLICIAL|OSTENSIV)|MOTOCICLETA.{0,30}(POLICIAL|POLICIAMENTO)|CARRO.{0,10}POLICIA/ },
  { id: 2, code: 'PROTECAO_BALISTICA', label: 'proteção balística', strong: true, re: /COLETE.{0,15}(BALISTIC|A PROVA DE BALA)|PROTECAO BALISTICA|CAPACETE.{0,10}BALISTIC|ESCUDO.{0,10}BALISTIC/ },
  { id: 3, code: 'ARMAMENTO_MUNICAO', label: 'armamento, munição e equipamentos de menor potencial ofensivo', strong: true, re: /ARMAMENTO|MUNICAO|MUNICOES|PISTOLA|FUZIL|CARABINA|ESPINGARDA|REVOLVER|ARMAS? DE FOGO|ARMAS? (NAO LETA|MENOS LETA)|TASER|ESPARGIDOR|GAS LACRIMOGENEO|GRANADA/ },
  { id: 4, code: 'UNIFORMES_EQUIP_INDIVIDUAL', label: 'uniformes e equipamentos individuais', strong: false, re: /UNIFORME|FARDAMENTO|COTURNO|ALGEMA/ },
  { id: 5, code: 'RADIOCOMUNICACAO', label: 'radiocomunicação', strong: false, re: /RADIOCOMUNICACAO|RADIO COMUNICACAO|RADIOS? (PORTATE|MOVE|DIGITA)|TETRA\b/ },
  { id: 6, code: 'TECNOLOGIA_MONITORAMENTO', label: 'tecnologia e monitoramento', strong: false, re: /VIDEOMONITORAMENTO|CAMERAS? (CORPORA|DE (MONITORAMENTO|SEGURANCA|VIGILANCIA))|CFTV|RECONHECIMENTO FACIAL|LEITURA DE PLACAS|CENTRO DE (COMANDO|CONTROLE)|DRONES?|SISTEMA DE (INFORMACOES? )?(DE )?SEGURANCA PUBLICA/ },
  { id: 7, code: 'INSTALACOES', label: 'obras e instalações de unidades de segurança', strong: true, re: /(CONSTRUCAO|REFORMA|AMPLIACAO|MANUTENCAO PREDIAL).{0,80}(DELEGACIA (DE )?(POLICIA|POLICIAL)|DELEGACIA E UOP|BATALHAO DE (POLICIA|BOMBEIRO)|QUARTEL (DA|DO) (POLICIA|CORPO DE BOMBEIRO)|PRESIDIO|PENITENCIARIA|CADEIA PUBLICA|UNIDADE PRISIONAL|CENTRO DE DETENCAO|POSTO POLICIAL|BASE COMUNITARIA|COMPANHIA DE POLICIA|CORPO DE BOMBEIROS|SEDE DA GUARDA)/ },
  { id: 8, code: 'SERVICOS_PENITENCIARIOS', label: 'serviços e insumos do sistema prisional', strong: true, re: /(ALIMENTACAO|REFEICAO|REFEICOES|LAVANDERIA|FORNECIMENTO DE (GENEROS )?ALIMENTICIOS).{0,80}(PRESIDIO|PENITENCIARIA|UNIDADE PRISIONAL|SISTEMA PRISIONAL|CADEIA|CUSTODIAD|APENAD)|MONITORAMENTO ELETRONICO.{0,30}(PRESOS|APENADOS|CUSTODIADOS)|TORNOZELEIRA/ },
  { id: 9, code: 'PERICIA_FORENSE', label: 'perícia e criminalística', strong: true, re: /PERICIA CRIMINAL|LABORATORIO (FORENSE|DE CRIMINALISTICA)|PAPILOSCOP|DNA FORENSE|ANALISE FORENSE|CRIMINALISTICA|LOCAL DE CRIME/ },
  { id: 10, code: 'DEFESA_CIVIL', label: 'defesa civil (subfunção 182)', strong: true, re: /DEFESA CIVIL/ },
];
const POLICE_CONTEXT = /POLICI|GUARDA (CIVIL|MUNICIPAL|METROPOLITANA)|BOMBEIRO|PENITENCIAR|PRISIONAL|SEGURANCA PUBLICA|VIATURA POLICIAL|DELEGACIA (DE )?POLICIA/;
const PATRIMONIAL = /VIGILANCIA (PATRIMONIAL|ARMADA|DESARMADA|OSTENSIVA|ELETRONICA)|SEGURANCA PATRIMONIAL|VIGILANTE|CONTROLE DE ACESSO|CERCA ELETRICA|MONITORAMENTO DE ALARME|SEGURANCA PRIVADA|PORTARIA/;
export const THEME_PATRIMONIAL = 99;
/** Tema do objeto (0 = nenhum; 99 = vigilância/segurança patrimonial: fora do tema). `orgKind > 0` dá o contexto policial às palavras genéricas. */
export function classifyTheme(objeto: string, orgKind: number): number {
  const t = norm(objeto); if (!t) return 0;
  const ctx = orgKind > 0 && orgKind !== 9 || POLICE_CONTEXT.test(t);
  for (const th of SEC_THEMES) if (th.re.test(t) && (th.strong || ctx)) { if (th.id === 10 && PATRIMONIAL.test(t)) continue; return th.id; }
  return PATRIMONIAL.test(t) ? THEME_PATRIMONIAL : 0;
}

export interface PncpContract {
  numeroControlePNCP: string; anoContrato?: number; orgaoEntidade?: { cnpj?: string; esferaId?: string; razaoSocial?: string }; unidadeOrgao?: { ufSigla?: string; codigoIbge?: string; nomeUnidade?: string };
  niFornecedor?: string | null; nomeRazaoSocialFornecedor?: string | null; tipoPessoa?: string | null; tipoContrato?: { id?: number } | null; categoriaProcesso?: { id?: number } | null;
  numeroContratoEmpenho?: string | null; objetoContrato?: string | null; valorInicial?: number | null; valorGlobal?: number | null; dataAssinatura?: string | null; numeroRetificacao?: number | null; dataPublicacaoPncp?: string | null;
}
export interface ContractCtx { ufCode: (acronym: string) => number | undefined; entityByIbge7: Map<number, number>; entityByUf: Map<number, number>; brEntity: number }
export interface ContractBuild { row: Row; supplier: { cnpj: number; name: string } | null }
const cents = (v: number | null | undefined): number => v == null || !Number.isFinite(v) ? 0 : Math.round(v * 100);
export type ContractDrop = 'sem_cnpj_orgao' | 'sem_ente' | 'nao_seguranca';
/** Classifica um contrato; devolve null (com o motivo) quando não é de segurança ou não tem ente. Pessoa física NUNCA é persistida. */
/** Órgão da Defesa Nacional (função 05): fora do tema por qualquer caminho. */
export const isDefenseOrgan = (razaoSocial: string, unidade: string): boolean => DEFENSE_ORG.test(norm(`${razaoSocial} ${unidade}`));
export function buildContract(c: PncpContract, year: number, ctx: ContractCtx): ContractBuild | { drop: ContractDrop } {
  const org = c.orgaoEntidade ?? {}; const un = c.unidadeOrgao ?? {}; const esfera = (org.esferaId ?? '').toUpperCase();
  if (isDefenseOrgan(org.razaoSocial ?? '', un.nomeUnidade ?? '')) return { drop: 'nao_seguranca' };
  const kind = classifyOrgan(org.razaoSocial ?? '', un.nomeUnidade ?? '', esfera); let theme = classifyTheme(c.objetoContrato ?? '', kind);
  const inst = kind > 0; const thematic = theme > 0 && theme !== THEME_PATRIMONIAL;
  if (!inst && !thematic) return { drop: 'nao_seguranca' };
  if (!/^\d{14}$/.test(org.cnpj ?? '')) return { drop: 'sem_cnpj_orgao' };
  const ufC = un.ufSigla ? ctx.ufCode(un.ufSigla.toUpperCase()) : undefined; const ibge = Number(un.codigoIbge);
  let entity: number | undefined;
  if (esfera === 'F') entity = ctx.brEntity; else if (esfera === 'M') entity = Number.isInteger(ibge) ? ctx.entityByIbge7.get(ibge) : undefined; else if (esfera === 'E' || esfera === 'D') entity = ufC ? ctx.entityByUf.get(ufC) : undefined;
  if (entity === undefined) return { drop: 'sem_ente' };
  if (!inst && theme === THEME_PATRIMONIAL) theme = 0;
  const isPj = (c.tipoPessoa ?? '').toUpperCase() === 'PJ' && /^\d{14}$/.test(c.niFornecedor ?? '');
  const tipo = Number(c.tipoContrato?.id ?? 0);
  return {
    row: { pncp_id: c.numeroControlePNCP, year, uf: ufC ?? 0, entity_id: entity, esfera: esfera || '?', org_cnpj: Number(org.cnpj), org_kind: kind, theme: theme === THEME_PATRIMONIAL ? THEME_PATRIMONIAL : theme, link: inst && thematic ? 3 : inst ? 1 : 2,
      tipo, categoria: Number(c.categoriaProcesso?.id ?? 0), valor_global: cents(c.valorGlobal), valor_inicial: cents(c.valorInicial), signed: c.dataAssinatura ?? null, supplier: isPj ? Number(c.niFornecedor) : null,
      empenho: tipo === 7 && c.numeroContratoEmpenho ? c.numeroContratoEmpenho : null, retif: Number(c.numeroRetificacao ?? 0) },
    supplier: isPj ? { cnpj: Number(c.niFornecedor), name: (c.nomeRazaoSocialFornecedor ?? '').slice(0, 200) } : null,
  };
}

import { FLAG } from './indicator-defs.ts';
import type { IndicatorRow } from './publication.ts';
export interface TransferRow { entity_id: number | null; year: number; conv_status: number; v_global_conv: number | null; v_repasse_conv: number | null; v_desembolsado_conv: number | null }
/** Indicadores por ente × ano a partir dos contratos classificados (só >0: ausência não é zero). Ano corrente é preliminar. */
/** Valor global acima de R$ 10 bilhões num contrato é erro de digitação na origem (visto: R$ 1,03 tri): o dado bruto é mantido, mas fica fora das SOMAS de valor dos indicadores. */
export const PNCP_VALUE_OUTLIER_CENTS = 1_000_000_000_000;
export function contractIndicators(rows: Row[], year: number, preliminary: boolean): IndicatorRow[] {
  const by = new Map<number, { n: number; v: number; sup: Set<number>; tn: number; tv: number; emp: number }>();
  for (const r of rows) {
    const e = Number(r.entity_id); const a = by.get(e) ?? { n: 0, v: 0, sup: new Set<number>(), tn: 0, tv: 0, emp: 0 }; by.set(e, a);
    const val = Number(r.valor_global) > PNCP_VALUE_OUTLIER_CENTS ? 0 : Number(r.valor_global);
    if (Number(r.link) !== 2) { a.n++; a.v += val; if (r.supplier != null) a.sup.add(Number(r.supplier)); if (r.empenho != null) a.emp++; }
    if (Number(r.link) !== 1) { a.tn++; a.tv += val; }
  }
  const out: IndicatorRow[] = []; const ps = `${year}-01-01`, pe = `${year + 1}-01-01`; const fl = preliminary ? FLAG.preliminary : 0;
  for (const [e, a] of [...by.entries()].sort((x, y) => x[0] - y[0])) {
    const mk = (id: number, v: number) => out.push({ indicator_id: id, entity_id: e, period_start: ps, period_end: pe, status: preliminary ? 1 : 2, numerator: v, denominator: null, value: v, flags: fl });
    if (a.n) { mk(7061, a.n); mk(7062, a.v / 100); if (a.sup.size) mk(7063, a.sup.size); if (a.emp) mk(7066, a.emp); }
    if (a.tn) { mk(7064, a.tn); mk(7065, a.tv / 100); }
  }
  return out;
}
/** Indicadores de transferências por ente beneficiário × ano de assinatura (só convênios assinados com ente identificado). */
export function transferIndicators(rows: TransferRow[], year: number, preliminary: boolean): IndicatorRow[] {
  const by = new Map<number, { n: number; g: number; r: number; d: number }>();
  for (const r of rows) { if (r.entity_id == null || r.conv_status === 0 || r.v_global_conv == null) continue; const a = by.get(r.entity_id) ?? { n: 0, g: 0, r: 0, d: 0 }; by.set(r.entity_id, a); a.n++; a.g += r.v_global_conv; a.r += r.v_repasse_conv ?? 0; a.d += r.v_desembolsado_conv ?? 0; }
  const out: IndicatorRow[] = []; const ps = `${year}-01-01`, pe = `${year + 1}-01-01`; const fl = preliminary ? FLAG.preliminary : 0;
  for (const [e, a] of [...by.entries()].sort((x, y) => x[0] - y[0])) {
    const mk = (id: number, v: number) => out.push({ indicator_id: id, entity_id: e, period_start: ps, period_end: pe, status: preliminary ? 1 : 2, numerator: v, denominator: null, value: v, flags: fl });
    mk(7071, a.n); mk(7072, a.g / 100); mk(7073, a.r / 100); if (a.d > 0) mk(7074, a.d / 100);
  }
  return out;
}
