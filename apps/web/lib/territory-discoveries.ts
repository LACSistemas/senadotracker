import type { Kpi } from '@/lib/security/types';
import type { HeroKpi } from '@/lib/infrastructure/types';
import { scopeOf } from '@/lib/security/load';
import { loadEducationPageCached } from '@/lib/education/load';
import { loadSecurityPageCached } from '@/lib/security/load';
import { loadInfrastructurePageCached } from '@/lib/infrastructure/load';
import { loadWellbeingPageCached } from '@/lib/wellbeing/load';

export interface KpiDiscovery { kind: 'kpi'; themeLabel: string; href: string; heading: string; sentence: string; note: string; value: string; unit: string }
export interface FactDiscovery { kind: 'fact'; themeLabel: string; href: string; label: string; value: string; unit: string; meta: string }
export type Discovery = KpiDiscovery | FactDiscovery;
export interface DiscoveryResult { headline: KpiDiscovery | null; supporting: Discovery[] }

/**
 * Elegibilidade para Educação/Segurança: `caveat === null` descarta qualquer KPI com ressalva metodológica
 * própria (ex.: "Contagem bruta: não é comparada entre territórios de porte diferente"). O sinal de
 * comparação é lido de `compare.valid` quando o campo existe (Segurança sempre define `compare`, mesmo
 * que `null`) — só cai para `secondary` quando `compare` está ausente (Educação nunca define `compare`;
 * `secondary` ali é a string "UF: X · Brasil: Y" já calculada por `cmpLine`, no mesmo ano e escala).
 */
function eduSecComparable(k: Kpi): boolean {
  if (k.state !== 'ok' || k.caveat !== null) return false;
  if (k.compare) return k.compare.valid;
  return k.secondary !== null;
}
/** Fragmento de comparação já validado (nunca "Comparado a Brasil" genérico: mostra o que foi de fato
 * comparado — percentil, UF, ou Brasil, conforme o que `compare`/`secondary` realmente diz). */
function eduSecNote(k: Kpi): string {
  return (k.compare?.valid ? k.compare.text : k.secondary) ?? '';
}
function eduSecSentence(k: Kpi, scopeName: string): string {
  const compareText = eduSecNote(k);
  return `${k.plain}, em ${scopeName}: ${k.value} ${k.unit} (${k.basis})` +
    (k.delta ? `. ${k.delta.text}` : '') +
    (compareText ? `. ${compareText}` : '');
}

/** Infraestrutura: `TerritoryCompare` já vem com elegibilidade calculada por ponto (`eligible`) e uma
 * lista de restrições — só é tratado como comparável quando o Brasil é elegível e não há restrição ativa. */
function infraComparable(k: HeroKpi): boolean {
  return !!k.compare && k.compare.brazil.eligible && k.compare.restrictions.length === 0;
}
function infraNote(k: HeroKpi, stateName: string): string {
  const c = k.compare!;
  const parts: string[] = [];
  if (c.state?.eligible) parts.push(`${stateName}: ${c.state.display}`);
  parts.push(`Brasil: ${c.brazil.display}`);
  return parts.join(' · ');
}
function infraSentence(k: HeroKpi, scopeName: string, stateName: string): string {
  return `${k.label}, em ${scopeName}: ${k.value}${k.unit ? ` ${k.unit}` : ''}. ${infraNote(k, stateName)}`;
}

export interface DiscoveryInputs {
  scopeName: string; stateName: string;
  education: { kpis: Kpi[]; href: string } | null;
  security: { kpis: Kpi[]; href: string } | null;
  infrastructure: { kpis: HeroKpi[]; href: string } | null;
  wellbeingFacts: Array<{ label: string; value: string; unit: string; source: string; period: string }>;
  wellbeingHref: string;
}

/**
 * Seleção determinística de descobertas (Parte V.10.1 do mandato) — nunca pelo maior número.
 * Ordem fixa de prioridade editorial: Educação, Segurança, Infraestrutura — são os 3 temas cujo contrato
 * de dado já carrega um sinal de comparabilidade validado contra UF/Brasil (ver *Comparable acima). A
 * primeira KPI elegível (na ordem em que o próprio tema já prioriza seus KPIs) de cada tema concorre; a
 * primeira do primeiro tema com alguma KPI elegível vira manchete — nunca a de maior valor absoluto.
 * Bem-estar não entra nessa disputa: `PortraitFact` não tem sinal de comparação territorial (confirmado em
 * P0/P1), por isso aparece só como complementar, sem nenhuma frase de comparação anexada.
 * Sem nenhuma KPI elegível em nenhum tema, `headline` é `null` — a página abre com um texto editorial
 * neutro em vez de uma descoberta inventada.
 */
export function selectDiscoveries(input: DiscoveryInputs): DiscoveryResult {
  const comparable: KpiDiscovery[] = [];
  if (input.education) {
    const k = input.education.kpis.find(eduSecComparable);
    if (k) comparable.push({ kind: 'kpi', themeLabel: 'Educação', href: input.education.href, heading: k.label, sentence: eduSecSentence(k, input.scopeName), note: eduSecNote(k), value: k.value, unit: k.unit });
  }
  if (input.security) {
    const k = input.security.kpis.find(eduSecComparable);
    if (k) comparable.push({ kind: 'kpi', themeLabel: 'Segurança Pública', href: input.security.href, heading: k.label, sentence: eduSecSentence(k, input.scopeName), note: eduSecNote(k), value: k.value, unit: k.unit });
  }
  if (input.infrastructure) {
    const k = input.infrastructure.kpis.find(infraComparable);
    if (k) comparable.push({ kind: 'kpi', themeLabel: 'Infraestrutura', href: input.infrastructure.href, heading: k.label, sentence: infraSentence(k, input.scopeName, input.stateName), note: infraNote(k, input.stateName), value: k.value, unit: k.unit ?? '' });
  }
  const [headline, ...restComparable] = comparable;
  const facts: FactDiscovery[] = input.wellbeingFacts.slice(0, 2).map(f => ({ kind: 'fact', themeLabel: 'Bem-estar', href: input.wellbeingHref, label: f.label, value: f.value, unit: f.unit, meta: `${f.source} · ${f.period}` }));
  const supporting: Discovery[] = [...restComparable, ...facts].slice(0, 3);
  return { headline: headline ?? null, supporting };
}

/** Monta os insumos de `selectDiscoveries` para um município, reaproveitando os mesmos loaders cacheados
 * (60 s) que os teasers de domínio da visão geral já chamam — mesma chave de memoização, nenhuma consulta
 * nova ao banco além das 4 que a página já faz. */
export async function loadMunicipalityDiscoveries(code: string, entityId: number, stateName: string): Promise<DiscoveryResult> {
  const scope = await scopeOf('municipio', code);
  if (!scope) return { headline: null, supporting: [] };
  const base = `/municipios/${entityId}`;
  const [edu, sec, infra, well] = await Promise.all([
    loadEducationPageCached(scope),
    loadSecurityPageCached(scope),
    loadInfrastructurePageCached(scope),
    loadWellbeingPageCached(scope),
  ]);
  return selectDiscoveries({
    scopeName: scope.name, stateName,
    education: edu.hero.kpis.length ? { kpis: edu.hero.kpis, href: `${base}/educacao` } : null,
    security: sec.hero.kpis.length ? { kpis: sec.hero.kpis, href: `${base}/seguranca` } : null,
    infrastructure: infra.hero.kpis.length ? { kpis: infra.hero.kpis, href: `${base}/infraestrutura` } : null,
    wellbeingFacts: well.portrait.facts,
    wellbeingHref: `${base}/bem-estar`,
  });
}
