import {
  getInfrastructureFamilies, getInfrastructureIndicatorComparison, getInfrastructureIndicators, getInfrastructureWorksBySituation, getInfrastructureWorksOverview,
  type InfrastructureIndicator, type InfrastructureTerritory,
} from '@senadotracker/db';
import { webPostgresPool } from '../postgres-pool.ts';
import { instrument, memo, scopeFromEntity, scopeOf } from '../security/load.ts';
import { brlShort, centsToReais, fmt, formatIndicatorValue, indicatorUnitLabel } from './format.ts';
import { AVAILABILITY_LABEL, HERO_KPI_PRIORITY, MODULE_FAMILIES, parseEntornoCode, type EntornoUnit } from './catalog.ts';
import { bars, group, statFromIndicator, territoryCompareFromComparison } from './build.ts';
import { energyNarrative, heroLede, housingNarrative, mobilityNarrative, urbanNarrative, waterNarrative, waterSecurityNarrative, worksNarrative } from './narrative.ts';
import type {
  BarRow, EnergyChapter, ExplorerRow, FamilyCoverage, HeroData, HeroKpi, HousingChapter, IndicatorGroup, InfraScope, InfrastructurePageData, MobilityChapter,
  UrbanEnvironmentChapter, WaterSanitationChapter, WaterSecurityChapter, WorksOverviewChapter,
} from './types.ts';

function toTerritory(scope: InfraScope): InfrastructureTerritory {
  return scope.kind === 'uf' ? { level: 'UF', ufCode: scope.ufCode } : { level: 'MUNICIPIO', ibge7: String(scope.entityId) };
}
const byFamily = (all: InfrastructureIndicator[], families: readonly string[]): InfrastructureIndicator[] => all.filter(i => (families as readonly string[]).includes(i.sourceFamily));
const byCode = (all: InfrastructureIndicator[], code: string): InfrastructureIndicator | null => all.find(i => i.code === code) ?? null;
const notNull = <T,>(xs: Array<T | null | undefined>): T[] => xs.filter((x): x is T => x != null);

/** Carrega a página de Infraestrutura: 1 chamada a `getInfrastructureIndicators` sem filtro de família (que já cobre
 * os 108 indicadores auditados do território) mais 2 chamadas pontuais de obras — nunca uma consulta por indicador. */
export async function loadInfrastructurePage(scope: InfraScope): Promise<InfrastructurePageData> {
  const t0 = performance.now(); const { q: pool, stats } = instrument(webPostgresPool()); const dbStart = performance.now();
  const t = toTerritory(scope);

  const [all, works, worksBySituation, families] = await Promise.all([
    getInfrastructureIndicators(pool, t, { limit: 200 }),
    getInfrastructureWorksOverview(pool, t),
    getInfrastructureWorksBySituation(pool, t),
    getInfrastructureFamilies(pool, t),
  ]);

  // ======================================================================= Hero
  const heroKpis: HeroKpi[] = notNull(HERO_KPI_PRIORITY.map(k => {
    const ind = byCode(all, k.code); if (!ind || ind.value == null) return null;
    const st = statFromIndicator(ind, k.label);
    return { code: k.code, label: k.label, value: st.value, ...(st.unit ? { unit: st.unit } : {}), note: st.note ?? null, sourceFamily: ind.sourceFamily, year: ind.referenceYear };
  }));
  // Comparador UF/Brasil: só município é elegível no backend; limitado aos indicadores que a própria definição
  // marca como agregáveis, para não multiplicar consultas em cima dos 8 KPIs do hero.
  if (scope.kind === 'municipio') {
    const comparable = heroKpis.filter(k => byCode(all, k.code)?.comparisonEligible).slice(0, 3);
    const compares = await Promise.all(comparable.map(async k => {
      const ind = byCode(all, k.code)!;
      const cmp = await getInfrastructureIndicatorComparison(pool, t, k.code);
      if (!cmp || !cmp.eligible) return null;
      const format = (v: number) => formatIndicatorValue({ value: v, unit: ind.unit, territory: ind.territory });
      return { code: k.code, compare: territoryCompareFromComparison({
        ownLabel: scope.name, stateLabel: scope.stateName, unit: indicatorUnitLabel(ind.unit), year: ind.referenceYear != null ? String(ind.referenceYear) : null, note: cmp.note, format,
        municipality: cmp.municipality as { value: number | null; status: string } | null, uf: cmp.uf as { value: number | null; status: string } | null, brazil: cmp.brazil as { value: number | null; status: string } | null,
      }) };
    }));
    for (const c of notNull(compares)) { const kpi = heroKpis.find(k => k.code === c.code); if (kpi && c.compare) kpi.compare = c.compare; }
  }
  const worksTotal = works?.projects != null ? Number(works.projects) : null;
  if (worksTotal != null && worksTotal > 0 && heroKpis.length < 8) {
    heroKpis.push({ code: 'OBRASGOV-PROJECTS', label: 'Obras públicas registradas', value: fmt(worksTotal), sourceFamily: 'OBRASGOV', year: null });
  }
  const worksChart: BarRow[] | null = worksBySituation.length ? bars(worksBySituation.map(s => ({ label: s.label, value: s.count }))) : null;
  const hero: HeroData = {
    lede: heroLede(scope, heroKpis.length, worksTotal),
    coverageNote: 'Ausência de indicador significa ausência de publicação ou cobertura, nunca zero sintético.',
    kpis: heroKpis.slice(0, 8), worksChart, worksTotal,
  };

  // ======================================================================= Capítulo 1 — Água e saneamento
  const sinisa = byFamily(all, MODULE_FAMILIES.water);
  const waterGroups: IndicatorGroup[] = notNull([
    group('Abastecimento de água', sinisa, ['IAG0001', 'IAG0002', 'IAG2006', 'IAG2013']),
    group('Esgotamento sanitário', sinisa, ['IES0001', 'IES0002', 'IES0007', 'IES0008']),
    group('Resíduos sólidos', sinisa, ['IRS0001', 'IRS0002', 'IRS0005', 'IRS3002']),
    group('Gestão dos serviços', sinisa, ['OGM3004', 'OGM3013', 'OGM3201', 'OGM3301']),
  ]);
  const waterSanitation: WaterSanitationChapter = {
    id: 'agua-saneamento', number: 1, title: 'Água e saneamento', narrative: waterNarrative(scope, waterGroups.length > 0),
    available: waterGroups.length > 0, emptyReason: 'O SINISA não publicou indicadores de água e saneamento para este território.',
    limits: ['Indicadores declarados pelos prestadores de serviço ao SINISA; não medem qualidade da água entregue nem continuidade do fornecimento.', 'Rede de serviço declarada não é a mesma coisa que cobertura domiciliar efetiva.'],
    sources: 'Fonte: SINISA (Ministério das Cidades), referência 2024.',
    groups: waterGroups, disclosures: sinisa.filter(i => i.value != null),
  };

  // ======================================================================= Capítulo 2 — Ruas e ambiente urbano
  const entorno = byFamily(all, MODULE_FAMILIES.urban);
  const byUnit: { FACE: BarRow[]; HOUSEHOLD: BarRow[]; RESIDENT: BarRow[] } = { FACE: [], HOUSEHOLD: [], RESIDENT: [] };
  for (const ind of entorno) {
    if (ind.value == null) continue;
    const parsed = parseEntornoCode(ind.code); if (!parsed) continue;
    byUnit[parsed.unit].push({ label: parsed.themeLabel, value: ind.value, display: `${fmt(ind.value, 1)}%` });
  }
  (Object.keys(byUnit) as EntornoUnit[]).forEach(u => byUnit[u].sort((a, b) => b.value - a.value));
  const entornoAvailable = entorno.some(i => i.value != null);
  const urbanEnvironment: UrbanEnvironmentChapter = {
    id: 'ruas-entorno', number: 2, title: 'Ruas e ambiente urbano', narrative: urbanNarrative(scope, entornoAvailable),
    available: entornoAvailable, emptyReason: 'O Censo 2022 não registrou características de entorno para este território.',
    limits: ['FACES, DOMICÍLIOS e MORADORES são três unidades estatísticas diferentes — nunca compare os números entre unidades.', 'Observação do recenseador sobre o entorno declarado durante o Censo 2022, não uma auditoria de engenharia.'],
    sources: 'Fonte: IBGE, Censo Demográfico 2022 (Entorno dos Domicílios).',
    byUnit, highlightTheme: byUnit.HOUSEHOLD[0]?.label ?? byUnit.FACE[0]?.label ?? null, disclosures: entorno.filter(i => i.value != null),
  };

  // ======================================================================= Capítulo 3 — Habitação
  const housingAll = byFamily(all, MODULE_FAMILIES.housing);
  const housingGroups: IndicatorGroup[] = notNull([
    group('Favelas e Comunidades Urbanas', housingAll, ['INF-FAVELAS-COMUNIDADES', 'INF-FAVELAS-POPULACAO', 'INF-FAVELAS-DOMICILIOS', 'INF-FAVELAS-AREA', 'INF-FAVELAS-DENSIDADE'], 'Registro só existe em municípios onde o IBGE identificou essas áreas; ausência de registro não é ausência de precariedade.'),
    group('Internet domiciliar', housingAll, ['INF-INTERNET-DOMICILIOS', 'INF-INTERNET-MORADORES'], 'Domicílios conectados não é o mesmo que moradores em domicílios conectados — os dois números aparecem separados de propósito.'),
    group('Déficit habitacional (FJP)', housingAll, ['INF-FJP-DEFICIT-HABITACIONAL', 'INF-FJP-DEFICIT-RELATIVO']),
  ]);
  const housing: HousingChapter = {
    id: 'habitacao', number: 3, title: 'Habitação', narrative: housingNarrative(scope, housingGroups.length > 0),
    available: housingGroups.length > 0, emptyReason: 'Não há indicadores de habitação publicados para este território.',
    limits: [
      scope.kind === 'municipio' ? 'Déficit habitacional (Fundação João Pinheiro) só é publicado para UF e Brasil — não existe valor por município nesta base.' : 'Déficit habitacional (Fundação João Pinheiro) é um indicador de UF/Brasil; não compare diretamente entre municípios.',
      'A classificação de uma área como favela ou comunidade urbana não se estende automaticamente à condição individual de cada morador.',
    ],
    sources: 'Fontes: IBGE (Favelas e Comunidades Urbanas, Internet domiciliar — Censo 2022) e Fundação João Pinheiro (déficit habitacional).',
    groups: housingGroups, disclosures: housingAll.filter(i => i.value != null),
  };

  // ======================================================================= Capítulo 4 — Energia e conectividade
  const energyAll = byFamily(all, MODULE_FAMILIES.energy);
  const energyGroups: IndicatorGroup[] = notNull([
    group('Geração distribuída (MMGD)', energyAll, ['ENERGY-MMGD-ENTERPRISES', 'ENERGY-MMGD-INSTALLED-KW', 'ENERGY-MMGD-SOLAR-ENTERPRISES', 'ENERGY-MMGD-SOLAR-KW'], 'Potência instalada não é geração nem consumo de energia; sem identificação de titulares individuais.'),
    group('Serviços elétricos (ANEEL)', energyAll, ['energy_indger_uc_active', 'energy_indger_uc_active_billed', 'energy_indger_invoices', 'energy_indger_invoices_without_reading', 'energy_indger_suspensions_nonpayment', 'energy_indger_damage_requests', 'energy_indger_damage_paid_brl']),
    group('Combustíveis (ANP)', energyAll, ['ANP-FUEL-STATIONS', 'ANP-GLP-RESELLERS'], 'Cadastro de revendedores de GLP é parcial na fonte coletada; preços de combustível não são publicados nesta base.'),
  ]);
  const energy: EnergyChapter = {
    id: 'energia', number: 4, title: 'Energia e conectividade', narrative: energyNarrative(scope, energyGroups.length > 0),
    available: energyGroups.length > 0, emptyReason: 'Não há indicadores de energia publicados para este território.',
    limits: ['Geração distribuída (MMGD), serviço elétrico (ANEEL) e combustíveis (ANP) são fontes diferentes e não se substituem.', 'Internet domiciliar está no capítulo de Habitação (fonte: Censo 2022, não ANATEL) — cobertura 4G/5G não é publicada nesta base.'],
    sources: 'Fontes: ANEEL (MMGD e INDGER) e ANP.',
    groups: energyGroups, disclosures: energyAll.filter(i => i.value != null),
  };

  // ======================================================================= Capítulo 5 — Mobilidade e logística
  const mobilityAll = byFamily(all, MODULE_FAMILIES.mobility);
  const mobilityGroups: IndicatorGroup[] = notNull([
    group('Transporte sob gestão municipal (PEMOB)', mobilityAll, ['IND-MOB-PEMOB-SERVICOS-MUNICIPAIS', 'IND-MOB-PEMOB-FROTA-ONIBUS-OPERACIONAL', 'IND-MOB-PEMOB-PONTOS-EMBARQUE', 'IND-MOB-PEMOB-PONTOS-GEOREFERENCIADOS', 'IND-MOB-PEMOB-TERMINAIS-RODOVIARIOS', 'IND-MOB-PEMOB-TARIFA-PREDOMINANTE', 'IND-MOB-PEMOB-PESQUISA-SATISFACAO'], 'A PEMOB teve apenas 96 municípios respondentes no Brasil nesta edição — não é uma média universal.'),
    group('Estrutura de mobilidade (MUNIC)', mobilityAll, ['IND-MOB-MUNIC-CICLOVIA', 'IND-MOB-MUNIC-CICLOFAIXA', 'IND-MOB-MUNIC-CICLORROTA', 'IND-MOB-MUNIC-BICICLETARIO', 'IND-MOB-MUNIC-PLANO-CICLOVIARIO', 'IND-MOB-MUNIC-ONIBUS-INTRAMUNICIPAL', 'IND-MOB-MUNIC-ONIBUS-INTERMUNICIPAL', 'IND-MOB-MUNIC-INTERMUNICIPAL-DESLOCAMENTO-LOCAL', 'IND-MOB-MUNIC-CONSELHO-TRANSPORTE', 'IND-MOB-MUNIC-FUNDO-TRANSPORTE', 'IND-MOB-MUNIC-ESTRUTURA-TRANSPORTE', 'IND-MOB-MUNIC-PLANO-TRANSPORTE']),
    group('Logística', mobilityAll, ['LOG-ANAC-PUBLIC-AERODROMES', 'LOG-DNIT-SNV-LENGTH', 'LOG-DNIT-PAVEMENT-SEGMENTS', 'LOG-DNIT-PAVEMENT-ICM'], 'Aeródromo cadastrado não é aeroporto com operação comercial regular. Extensão da malha (SNV, jul/2024) e condição do pavimento (set/2026) têm referências temporais diferentes — nunca leia as duas como do mesmo momento.'),
  ]);
  const mobility: MobilityChapter = {
    id: 'mobilidade', number: 5, title: 'Mobilidade e logística', narrative: mobilityNarrative(scope, mobilityGroups.length > 0),
    available: mobilityGroups.length > 0, emptyReason: 'Não há indicadores de mobilidade ou logística publicados para este território.',
    limits: ['ANTT e ANTAQ (rodovias concedidas e hidrovias) não estão disponíveis nesta base — não aparece como zero, simplesmente não é mostrado.', 'Movimentação aeroportuária, quando existir, não representa passageiros únicos de um município.'],
    sources: 'Fontes: IBGE (MUNIC 2024), Pesquisa de Mobilidade Urbana (PEMOB), ANAC e DNIT.',
    groups: mobilityGroups, disclosures: mobilityAll.filter(i => i.value != null),
  };

  // ======================================================================= Capítulo 6 — Segurança hídrica (barragens)
  const waterSecAll = byFamily(all, MODULE_FAMILIES.waterSecurity);
  const waterSecGroups: IndicatorGroup[] = notNull([
    group('Barragens (SNISB)', waterSecAll, ['INF-DAMS-SNISB-TOTAL', 'INF-DAMS-SNISB-CRI-ALTO', 'INF-DAMS-SNISB-DPA-ALTO', 'INF-DAMS-SNISB-PAE']),
    group('Barragens de mineração (SIGBM/ANM)', waterSecAll, ['INF-DAMS-ANM-TOTAL', 'INF-DAMS-ANM-CRI-ALTO', 'INF-DAMS-ANM-DPA-ALTO'], 'Cadastro de fonte diferente do SNISB; os dois não foram deduplicados entre si.'),
    group('Atlas Águas — Índice de Segurança Hídrica Urbana (ISH-U)', waterSecAll, ['INF-ATLAS-ISHU-MUNICIPIOS', 'INF-ATLAS-ISHU-MAXIMA', 'INF-ATLAS-ISHU-ALTA', 'INF-ATLAS-ISHU-MEDIA', 'INF-ATLAS-ISHU-BAIXA', 'INF-ATLAS-ISHU-MINIMA']),
  ]);
  const waterSecurity: WaterSecurityChapter = {
    id: 'seguranca-hidrica', number: 6, title: 'Segurança hídrica e barragens', narrative: waterSecurityNarrative(scope, waterSecGroups.length > 0),
    available: waterSecGroups.length > 0, emptyReason: 'Não há barragens cadastradas no SNISB ou SIGBM para este território.',
    limits: ['Classificação de risco (CRI) e dano potencial associado (DPA) altos não são previsão de rompimento.', 'O Atlas Águas (ISH-U) publica este indicador só em nível Brasil nesta edição — não há valor por UF ou município. Lagoa Mirim e Lagoa dos Patos são unidades especiais da fonte, não municípios, e não entram em nenhuma contagem municipal.'],
    sources: 'Fontes: SNISB (ANA), SIGBM (ANM) e Atlas Águas (ANA).',
    groups: waterSecGroups, disclosures: waterSecAll.filter(i => i.value != null),
  };

  // ======================================================================= Capítulo 7 — Obras públicas (visão geral; lista e detalhe em páginas próprias)
  const financial = works ? [
    { key: 'planned', label: 'Previsto', value: centsToReais(works.allocated_planned), display: works.allocated_planned != null ? brlShort(centsToReais(works.allocated_planned)!) : null },
    { key: 'contracted', label: 'Contratado', value: centsToReais(works.allocated_contracted), display: works.allocated_contracted != null ? brlShort(centsToReais(works.allocated_contracted)!) : null },
    { key: 'committed', label: 'Empenhado', value: centsToReais(works.allocated_committed), display: works.allocated_committed != null ? brlShort(centsToReais(works.allocated_committed)!) : null },
    { key: 'liquidated', label: 'Liquidado', value: works.allocated_liquidated != null ? Number(works.allocated_liquidated) : null, display: works.allocated_liquidated != null ? brlShort(Number(works.allocated_liquidated)) : null },
    { key: 'paid', label: 'Pago', value: works.allocated_paid != null ? Number(works.allocated_paid) : null, display: works.allocated_paid != null ? brlShort(Number(works.allocated_paid)) : null },
  ] : [];
  const multiTerritory = works ? Number(works.multi_territory_projects ?? 0) : 0;
  const worksChapter: WorksOverviewChapter = {
    id: 'obras', number: 7, title: 'Obras públicas', narrative: worksNarrative(scope, worksTotal ?? 0, multiTerritory),
    available: !!worksTotal && worksTotal > 0, emptyReason: 'Não há projetos de obra pública do Obrasgov registrados para este território.',
    limits: [
      'Valores previstos, contratados, empenhados, liquidados e pagos são estágios diferentes da mesma obra e nunca são somados entre si.',
      'Projetos com mais de um município vinculado mantêm o valor total do projeto, sem rateio — os valores financeiros abaixo contam só projetos de um único município.',
      'Percentual físico informado não significa obra entregue.', 'Não há vínculo externo verificado com o PNCP nesta base.',
    ],
    sources: 'Fonte: Obrasgov (Ministério da Gestão e da Inovação em Serviços Públicos).',
    totals: { projects: worksTotal ?? 0, singleMunicipality: works ? Number(works.single_municipality_projects ?? 0) : 0, multiTerritory, withoutValidLocation: works ? Number(works.projects_without_valid_location ?? 0) : 0 },
    bySituation: worksChart ?? [], financial, disclosures: [],
  };

  // ======================================================================= Explorador e proveniência (sem consulta extra — reaproveita `all`/`families`)
  const explorer: ExplorerRow[] = all
    .map(ind => ({ code: ind.code, title: ind.title, display: formatIndicatorValue(ind), unit: indicatorUnitLabel(ind.unit), sourceFamily: ind.sourceFamily, dimension: ind.dimension, period: ind.period, statusLabel: AVAILABILITY_LABEL[ind.valueStatus] ?? ind.valueStatus }))
    .sort((a, b) => a.sourceFamily === b.sourceFamily ? a.title.localeCompare(b.title) : a.sourceFamily.localeCompare(b.sourceFamily));
  const familyCoverage: FamilyCoverage[] = (families as Array<{ family: string; dimension: string; indicators: number; observations: number; latestPeriod: string | null }>)
    .map(f => ({ family: f.family, dimension: f.dimension, indicators: f.indicators, observations: f.observations, latestPeriod: f.latestPeriod }))
    .sort((a, b) => a.family.localeCompare(b.family));

  const sources: Array<{ label: string; period: string }> = notNull([
    waterSanitation.available ? { label: 'SINISA (Ministério das Cidades)', period: '2024' } : null,
    urbanEnvironment.available ? { label: 'IBGE, Censo Demográfico (Entorno dos Domicílios)', period: '2022' } : null,
    housing.available ? { label: 'IBGE / Fundação João Pinheiro', period: '2022–2024' } : null,
    energy.available ? { label: 'ANEEL / ANP', period: '2025–2026' } : null,
    mobility.available ? { label: 'IBGE (MUNIC) / PEMOB / ANAC / DNIT', period: '2024–2026' } : null,
    waterSecurity.available ? { label: 'SNISB / SIGBM / Atlas Águas', period: '2026' } : null,
    worksChapter.available ? { label: 'Obrasgov', period: 'cadastro corrente' } : null,
  ]);

  const dbWall = performance.now() - dbStart; const buildMs = performance.now() - t0;
  return {
    scope, hero, waterSanitation, urbanEnvironment, housing, energy, mobility, waterSecurity, works: worksChapter, familyCoverage, explorer, sources,
    meta: { sqlStatements: stats.n, dbMs: Math.round(dbWall), buildMs: Math.round(buildMs) },
  };
}

const cachedLoad = (scope: InfraScope) => memo(`infrastructure:${scope.entityId}`, () => loadInfrastructurePage(scope), 60_000);
export { scopeOf, scopeFromEntity, cachedLoad as loadInfrastructurePageCached };
