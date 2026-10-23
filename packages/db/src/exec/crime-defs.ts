import type { Pool } from 'pg';
import { DOMAIN } from './indicator-defs.ts';

/**
 * Contrato canônico da criminalidade ESTADUAL municipalizada (P9.6). Registros policiais divulgados pelas secretarias estaduais; NÃO são óbitos do SIM nem o VDE do Sinesp (P9.1).
 * Cada fonte tem sua faixa de indicadores (8000 + 100 × slot); o código ORIGINAL da fonte, a unidade de contagem e o grupo editorial acompanham cada indicador, e
 * "comparável entre estados" nunca é presumido por rótulo parecido.
 */
export const CRIME_VERSION = { contract: 'crime-state-v1', rj: 'isp-rj-v1' } as const;
export interface CrimeSource { slot: number; key: string; uf: string; ufCode: number; name: string }
export const CRIME_SOURCES: CrimeSource[] = [
  { slot: 0, key: 'ISP-RJ', uf: 'RJ', ufCode: 33, name: 'Instituto de Segurança Pública (RJ) — ISPdados, BaseMunicipioMensal' },
  { slot: 1, key: 'SEJUSP-MG', uf: 'MG', ufCode: 31, name: 'SEJUSP-MG — dados abertos (REDS/BISP)' },
  { slot: 2, key: 'SESP-ES', uf: 'ES', ufCode: 32, name: 'SESP-ES — microdados abertos de ocorrências (agregados pelo Cívica)' },
  { slot: 3, key: 'SSP-RS', uf: 'RS', ufCode: 43, name: 'SSP-RS — indicadores criminais por município' },
  { slot: 4, key: 'SSPDS-CE', uf: 'CE', ufCode: 23, name: 'SSPDS-CE — estatísticas (CVLI)' },
  { slot: 5, key: 'SDS-PE', uf: 'PE', ufCode: 26, name: 'SDS-PE — indicadores criminais (CVLI)' },
  { slot: 6, key: 'SSP-AL', uf: 'AL', ufCode: 27, name: 'SSP-AL — CVLI' },
  { slot: 7, key: 'SSP-SP', uf: 'SP', ufCode: 35, name: 'SSP-SP — dados criminais' },
  { slot: 8, key: 'SSP-DF', uf: 'DF', ufCode: 53, name: 'SSP-DF — por Região Administrativa' },
  { slot: 9, key: 'SSP-BA', uf: 'BA', ufCode: 29, name: 'SSP-BA' }, { slot: 10, key: 'SSP-GO', uf: 'GO', ufCode: 52, name: 'SSP-GO' }, { slot: 11, key: 'SESP-PR', uf: 'PR', ufCode: 41, name: 'SESP-PR' },
  { slot: 12, key: 'SEGUP-PA', uf: 'PA', ufCode: 15, name: 'SEGUP-PA' }, { slot: 13, key: 'SSP-PI', uf: 'PI', ufCode: 22, name: 'SSP-PI' }, { slot: 14, key: 'SESP-MT', uf: 'MT', ufCode: 51, name: 'SESP-MT' },
  { slot: 15, key: 'SEJUSP-MS', uf: 'MS', ufCode: 50, name: 'SEJUSP-MS' }, { slot: 16, key: 'SSP-TO', uf: 'TO', ufCode: 17, name: 'SSP-TO' }, { slot: 17, key: 'SSP-AM', uf: 'AM', ufCode: 13, name: 'SSP-AM' },
  { slot: 18, key: 'SSP-MA', uf: 'MA', ufCode: 21, name: 'SSP-MA' }, { slot: 19, key: 'SSP-SC', uf: 'SC', ufCode: 42, name: 'SSP-SC' },
];
export const CRIME_SOURCE_BY_KEY = new Map(CRIME_SOURCES.map(s => [s.key, s]));
export const crimeIdBase = (slot: number): number => 8000 + slot * 100;
export const crimeRange = (slot: number): [number, number] => [crimeIdBase(slot) + 1, crimeIdBase(slot) + 99];

export type CrimeGroup = 'LETAL' | 'SEXUAL' | 'PATRIMONIAL' | 'PESSOA' | 'POLICIAL' | 'TRANSITO' | 'OUTROS';
export const CRIME_GROUPS: Record<CrimeGroup, string> = { LETAL: 'Violência letal', SEXUAL: 'Violência sexual', PATRIMONIAL: 'Crimes patrimoniais', PESSOA: 'Violência contra a pessoa', POLICIAL: 'Atividade policial', TRANSITO: 'Crimes de trânsito', OUTROS: 'Outros registros' };
export type CrimeUnit = 'vitima' | 'caso' | 'ocorrencia' | 'autor' | 'adolescente' | 'evento';
export type Comparability = 'SAME_SOURCE_COMPARABLE' | 'OFFICIAL_EQUIVALENCE_PROVEN' | 'SIMILAR_LABEL_NOT_PROVEN' | 'NOT_COMPARABLE';
export interface CrimeDef {
  id: number; source: string; slot: number; ufCode: number; code: string; label: string; group: CrimeGroup; canonical: string | null; unit: CrimeUnit; composite: string[] | null; sensitive: boolean;
  comparability: Comparability; temporal: string; zero: string; derived: boolean; note: string;
}
/** Linha da tabela de definição de uma fonte: [código original, rótulo oficial, unidade, grupo, canônico, componentes, sensível, nota]. */
export type DefRow = [string, string, CrimeUnit, CrimeGroup, string | null, string[] | null, boolean, string?];
export function buildDefs(src: CrimeSource, rows: DefRow[], o: { temporal: string; zero: string; derived: boolean; note: string }): CrimeDef[] {
  if (rows.length > 99) throw new Error(`fonte ${src.key}: mais de 99 indicadores`);
  return rows.map(([code, label, unit, group, canonical, composite, sensitive, extra], i) => ({
    id: crimeIdBase(src.slot) + 1 + i, source: src.key, slot: src.slot, ufCode: src.ufCode, code, label, group, canonical, unit, composite, sensitive,
    comparability: composite ? 'NOT_COMPARABLE' : canonical ? 'SIMILAR_LABEL_NOT_PROVEN' : 'SAME_SOURCE_COMPARABLE', temporal: o.temporal, zero: o.zero, derived: o.derived, note: [o.note, extra].filter(Boolean).join(' '),
  }));
}
const NOTE_COMMON = 'Registro policial divulgado pela secretaria estadual: não é condenação, não é óbito do SIM e não equivale ao VDE do Sinesp (P9.1). Vítimas, casos/ocorrências, autores e adolescentes são unidades diferentes e nunca se somam. Um indicador composto soma outros da mesma fonte e não se soma a seus componentes. A comparação entre estados exige equivalência oficial comprovada: rótulo parecido não basta.';

// ------------------------------------------------------------------ ISP-RJ (BaseMunicipioMensal.csv; dicionário oficial de jan/2021, "Contagem" por variável)
const RJ: DefRow[] = [
  ['hom_doloso', 'Homicídio doloso', 'vitima', 'LETAL', 'homicidio_doloso', null, false],
  ['lesao_corp_morte', 'Lesão corporal seguida de morte', 'vitima', 'LETAL', 'lesao_corporal_seguida_de_morte', null, false],
  ['latrocinio', 'Latrocínio (roubo seguido de morte)', 'vitima', 'LETAL', 'latrocinio', null, false],
  ['cvli', 'Crimes Violentos Letais Intencionais (CVLI)', 'vitima', 'LETAL', 'cvli', ['hom_doloso', 'lesao_corp_morte', 'latrocinio'], false],
  ['hom_por_interv_policial', 'Morte por intervenção de agente do Estado', 'vitima', 'LETAL', 'morte_intervencao_policial', null, false],
  ['feminicidio', 'Feminicídio', 'vitima', 'LETAL', 'feminicidio', null, true, 'Não consta no dicionário de jan/2021; unidade presumida (vítima) pela família de letalidade violenta. Série a partir de 2024 (antes, vazio na fonte).'],
  ['letalidade_violenta', 'Letalidade violenta', 'vitima', 'LETAL', null, ['hom_doloso', 'lesao_corp_morte', 'latrocinio', 'hom_por_interv_policial'], false],
  ['tentat_hom', 'Tentativa de homicídio', 'vitima', 'PESSOA', 'tentativa_homicidio', null, false],
  ['tentativa_feminicidio', 'Tentativa de feminicídio', 'vitima', 'PESSOA', 'tentativa_feminicidio', null, true, 'Não consta no dicionário de jan/2021; unidade presumida (vítima). Série a partir de 2024.'],
  ['lesao_corp_dolosa', 'Lesão corporal dolosa', 'vitima', 'PESSOA', 'lesao_corporal_dolosa', null, false],
  ['estupro', 'Estupro', 'vitima', 'SEXUAL', 'estupro', null, true, 'Antes de 2009 inclui o antigo Atentado Violento ao Pudor (Art. 214 do CP): a série não é contínua em 2009.'],
  ['hom_culposo', 'Homicídio culposo (trânsito)', 'vitima', 'TRANSITO', 'homicidio_culposo_transito', null, false],
  ['lesao_corp_culposa', 'Lesão corporal culposa (trânsito)', 'vitima', 'TRANSITO', 'lesao_corporal_culposa_transito', null, false],
  ['roubo_transeunte', 'Roubo a transeunte', 'caso', 'PATRIMONIAL', 'roubo_transeunte', null, false],
  ['roubo_celular', 'Roubo de telefone celular', 'caso', 'PATRIMONIAL', 'roubo_celular', null, false],
  ['roubo_em_coletivo', 'Roubo em coletivo', 'caso', 'PATRIMONIAL', 'roubo_coletivo', null, false],
  ['roubo_rua', 'Roubo de rua', 'caso', 'PATRIMONIAL', 'roubo_rua', ['roubo_transeunte', 'roubo_celular', 'roubo_em_coletivo'], false],
  ['roubo_veiculo', 'Roubo de veículo', 'caso', 'PATRIMONIAL', 'roubo_veiculo', null, false],
  ['roubo_carga', 'Roubo de carga', 'caso', 'PATRIMONIAL', 'roubo_carga', null, false],
  ['roubo_comercio', 'Roubo a estabelecimento comercial', 'caso', 'PATRIMONIAL', 'roubo_estabelecimento_comercial', null, false],
  ['roubo_residencia', 'Roubo a residência', 'caso', 'PATRIMONIAL', 'roubo_residencia', null, false],
  ['roubo_banco', 'Roubo a banco', 'caso', 'PATRIMONIAL', 'roubo_banco', null, false],
  ['roubo_cx_eletronico', 'Roubo de caixa eletrônico', 'caso', 'PATRIMONIAL', 'roubo_caixa_eletronico', null, false],
  ['roubo_conducao_saque', 'Roubo com condução da vítima para saque em instituição financeira', 'caso', 'PATRIMONIAL', null, null, false],
  ['roubo_apos_saque', 'Roubo após saque em instituição financeira', 'caso', 'PATRIMONIAL', null, null, false],
  ['roubo_bicicleta', 'Roubo de bicicleta', 'caso', 'PATRIMONIAL', 'roubo_bicicleta', null, false],
  ['outros_roubos', 'Outros roubos', 'caso', 'PATRIMONIAL', null, null, false, 'Inclui contagem de ocorrências de latrocínio (nota do dicionário).'],
  ['total_roubos', 'Total de roubos', 'caso', 'PATRIMONIAL', 'roubo_total', ['roubo_transeunte', 'roubo_celular', 'roubo_em_coletivo', 'roubo_veiculo', 'roubo_carga', 'roubo_comercio', 'roubo_residencia', 'roubo_banco', 'roubo_cx_eletronico', 'roubo_conducao_saque', 'roubo_apos_saque', 'roubo_bicicleta', 'outros_roubos'], false],
  ['furto_veiculos', 'Furto de veículo', 'caso', 'PATRIMONIAL', 'furto_veiculo', null, false],
  ['furto_transeunte', 'Furto a transeunte', 'caso', 'PATRIMONIAL', 'furto_transeunte', null, false],
  ['furto_coletivo', 'Furto em coletivo', 'caso', 'PATRIMONIAL', 'furto_coletivo', null, false],
  ['furto_celular', 'Furto de telefone celular', 'caso', 'PATRIMONIAL', 'furto_celular', null, false],
  ['furto_bicicleta', 'Furto de bicicleta', 'caso', 'PATRIMONIAL', 'furto_bicicleta', null, false],
  ['outros_furtos', 'Outros furtos', 'caso', 'PATRIMONIAL', null, null, false],
  ['total_furtos', 'Total de furtos', 'caso', 'PATRIMONIAL', 'furto_total', ['furto_veiculos', 'furto_transeunte', 'furto_coletivo', 'furto_celular', 'furto_bicicleta', 'outros_furtos'], false],
  ['sequestro', 'Extorsão mediante sequestro (sequestro clássico)', 'vitima', 'PESSOA', null, null, false],
  ['extorsao', 'Extorsão', 'caso', 'PATRIMONIAL', null, null, false],
  ['sequestro_relampago', 'Extorsão com momentânea privação da liberdade (sequestro relâmpago)', 'vitima', 'PESSOA', null, null, false],
  ['estelionato', 'Estelionato', 'caso', 'PATRIMONIAL', 'estelionato', null, false],
  ['apreensao_drogas', 'Apreensão de drogas', 'caso', 'POLICIAL', 'apreensao_drogas', null, false, 'Aglutina os títulos de uso/porte, tráfico e apreensão de substância entorpecente: registros, não quantidade de droga.'],
  ['posse_drogas', 'Registros com título de posse de drogas', 'caso', 'POLICIAL', null, null, false, 'A soma com tráfico e sem autor pode exceder o número de apreensões (um registro pode ter mais de um título).'],
  ['trafico_drogas', 'Registros com título de tráfico de drogas', 'caso', 'POLICIAL', null, null, false, 'Ver nota de posse_drogas.'],
  ['apreensao_drogas_sem_autor', 'Registros com título de apreensão de drogas sem autor', 'caso', 'POLICIAL', null, null, false, 'Ver nota de posse_drogas.'],
  ['recuperacao_veiculos', 'Recuperação de veículo', 'caso', 'POLICIAL', 'recuperacao_veiculos', null, false, 'Não são necessariamente veículos roubados/furtados no mesmo mês ou na mesma área.'],
  ['apf', 'Auto de Prisão em Flagrante', 'autor', 'POLICIAL', 'prisao_flagrante', null, false],
  ['aaapai', 'Auto de Apreensão de Adolescente por Prática de Ato Infracional', 'adolescente', 'POLICIAL', null, null, false],
  ['cmp', 'Cumprimento de Mandado de Prisão', 'autor', 'POLICIAL', 'mandado_prisao_cumprido', null, false],
  ['cmba', 'Cumprimento de Mandado de Busca e Apreensão', 'adolescente', 'POLICIAL', null, null, false, 'O dicionário oficial classifica a contagem como "adolescente infrator", exatamente assim; mantida sem reinterpretação.'],
  ['ameaca', 'Ameaça', 'vitima', 'PESSOA', 'ameaca', null, false],
  ['pessoas_desaparecidas', 'Pessoas desaparecidas', 'vitima', 'OUTROS', null, null, false],
  ['encontro_cadaver', 'Encontro de cadáver', 'vitima', 'OUTROS', null, null, false],
  ['encontro_ossada', 'Encontro de ossada', 'vitima', 'OUTROS', null, null, false],
  ['pol_militares_mortos_serv', 'Policiais militares mortos em serviço', 'vitima', 'POLICIAL', null, null, false],
  ['pol_civis_mortos_serv', 'Policiais civis mortos em serviço', 'vitima', 'POLICIAL', null, null, false],
  ['registro_ocorrencias', 'Registro de ocorrências (total divulgado no mês)', 'caso', 'OUTROS', null, null, false, 'Total de registros divulgados no mês; é a base de todas as demais contagens por caso, não um crime.'],
];
export const RJ_DEFS: CrimeDef[] = buildDefs(CRIME_SOURCES[0]!, RJ, { temporal: 'comunicação (data da comunicação da ocorrência)', zero: 'O arquivo traz os 92 municípios em todos os meses: 0 é zero declarado. Célula vazia = variável ainda não existia (sem linha, nunca zero).', derived: false,
  note: `${NOTE_COMMON} Fonte: ISPdados — BaseMunicipioMensal.csv, dicionário oficial (jan/2021). Fase 3 = consolidado com errata; fase 2 = consolidado sem errata (revisável, publicado como preliminar).` });

// ------------------------------------------------------------------ SESP-ES (MICRODADOS_OCORRENCIAS.csv: Data;Hora;TipoIncidente;TipoLocal;Municipio;Bairro; SEM identificador de ocorrência, SEM pessoas)
const ES: DefRow[] = [
  ['ESTELIONATO_FRAUDE', 'Estelionato/fraude', 'ocorrencia', 'PATRIMONIAL', 'estelionato', null, false],
  ['CRIMES_INFORMATICOS', 'Crimes informáticos', 'ocorrencia', 'PATRIMONIAL', null, null, false],
  ['ROUBO_PESSOA_VIA_PUBLICA', 'Roubo: a pessoa em via pública', 'ocorrencia', 'PATRIMONIAL', 'roubo_transeunte', null, false],
  ['ROUBO_TRANSPORTE_COLETIVO', 'Roubo: em transporte coletivo', 'ocorrencia', 'PATRIMONIAL', 'roubo_coletivo', null, false],
  ['ROUBO_ESTABELECIMENTO_COMERCIAL', 'Roubo: em estabelecimento comercial', 'ocorrencia', 'PATRIMONIAL', 'roubo_estabelecimento_comercial', null, false],
  ['ROUBO_RESIDENCIA_CONDOMINIO', 'Roubo: em residência/condomínio', 'ocorrencia', 'PATRIMONIAL', 'roubo_residencia', null, false],
  ['FURTO_PESSOA_VIA_PUBLICA', 'Furto: a pessoa em via pública', 'ocorrencia', 'PATRIMONIAL', 'furto_transeunte', null, false],
  ['FURTO_TRANSPORTE_COLETIVO', 'Furto: em transporte coletivo', 'ocorrencia', 'PATRIMONIAL', 'furto_coletivo', null, false],
  ['FURTO_ESTABELECIMENTO_COMERCIAL', 'Furto: em estabelecimento comercial', 'ocorrencia', 'PATRIMONIAL', null, null, false],
  ['FURTO_RESIDENCIA_CONDOMINIO', 'Furto: em residência/condomínio', 'ocorrencia', 'PATRIMONIAL', null, null, false],
];
export const ES_DEFS: CrimeDef[] = buildDefs(CRIME_SOURCES[2]!, ES, { temporal: 'fato (coluna Data do microdado)', zero: 'Fonte de EVENTOS: município-mês sem linha = nenhuma ocorrência registrada naquele tipo (não é zero declarado pela secretaria). O último mês é parcial (arquivo atualizado diariamente).', derived: true,
  note: `${NOTE_COMMON} Fonte: microdados abertos de OCORRÊNCIAS da SESP-ES (S3 do governo do ES), 10 tipos de incidente; agregados pelo Cívica em município × mês × tipo, sem hora, bairro ou local. O arquivo não tem identificador de ocorrência: cada linha conta como UMA ocorrência (linhas idênticas são indistinguíveis de ocorrências simultâneas e não são deduplicadas). Não traz homicídios, crimes sexuais nem vítimas.` });

// ------------------------------------------------------------------ SSP-RS (planilha anual "site geral e municípios": uma aba por mês; ocorrências de crimes CONSUMADOS; colunas "Vítimas…" contam vítimas)
const RS: DefRow[] = [
  ['HOMICIDIO_DOLOSO', 'Homicídio doloso', 'ocorrencia', 'LETAL', 'homicidio_doloso', null, false],
  ['VITIMAS_HOMICIDIO_DOLOSO', 'Vítimas de homicídio doloso', 'vitima', 'LETAL', 'homicidio_doloso', null, false],
  ['LATROCINIO', 'Latrocínio', 'ocorrencia', 'LETAL', 'latrocinio', null, false],
  ['VITIMAS_LATROCINIO', 'Vítimas de latrocínio', 'vitima', 'LETAL', 'latrocinio', null, false],
  ['VITIMAS_LESAO_CORPORAL_SEGUIDA_DE_MORTE', 'Vítimas de lesão corporal seguida de morte', 'vitima', 'LETAL', 'lesao_corporal_seguida_de_morte', null, false],
  ['VITIMAS_CVLI', 'Total de vítimas de CVLI', 'vitima', 'LETAL', null, null, false, 'Definição da SSP-RS, MAIS ampla que a do RJ: contém vítimas de homicídio doloso de trânsito, aborto, induzimento/auxílio ao suicídio, infanticídio, homicídio decorrente de oposição à intervenção policial, lesão corporal seguida de morte, feminicídio, homicídio doloso e latrocínio. Série a partir de 2018. NÃO comparável ao CVLI de outras fontes.'],
  ['FURTO', 'Furtos', 'ocorrencia', 'PATRIMONIAL', 'furto_total', null, false, 'Contém as ocorrências de abigeato (nota da planilha): nunca somar com ABIGEATO.'],
  ['ABIGEATO', 'Abigeato', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Já contido em FURTO.'],
  ['FURTO_VEICULO', 'Furto de veículo', 'ocorrencia', 'PATRIMONIAL', 'furto_veiculo', null, false],
  ['ROUBO', 'Roubos', 'ocorrencia', 'PATRIMONIAL', 'roubo_total', null, false],
  ['ROUBO_VEICULO', 'Roubo de veículo', 'ocorrencia', 'PATRIMONIAL', 'roubo_veiculo', null, false],
  ['ESTELIONATO', 'Estelionato', 'ocorrencia', 'PATRIMONIAL', 'estelionato', null, false],
  ['ARMAS_MUNICOES', 'Delitos relacionados a armas e munições', 'ocorrencia', 'POLICIAL', null, null, false],
  ['ENTORPECENTES_POSSE', 'Entorpecentes: posse', 'ocorrencia', 'POLICIAL', null, null, false],
  ['ENTORPECENTES_TRAFICO', 'Entorpecentes: tráfico', 'ocorrencia', 'POLICIAL', null, null, false],
];
export const RS_DEFS: CrimeDef[] = buildDefs(CRIME_SOURCES[3]!, RS, { temporal: 'crime consumado por mês (a planilha não declara a data-base; o ZIP de ocorrências da SSP-RS usa Data Fato)', zero: 'A planilha traz os 497 municípios em todos os meses fechados: 0 é zero declarado. Meses ainda não ocorridos têm abas vazias e não são publicados.', derived: false,
  note: `${NOTE_COMMON} Fonte: SSP-RS, Indicadores Criminais por município (planilha anual oficial, aba por mês). Só crimes CONSUMADOS. Colunas "ocorrências" e "vítimas" são unidades distintas (ex.: homicídio doloso × vítimas de homicídio doloso).` });

// ------------------------------------------------------------------ SDS-PE (microdados abertos em XLSX: CVLI por vítima, CVP já agregado, estupro por vítima; agregados pelo Cívica em município × mês × natureza)
const PE: DefRow[] = [
  ['HOMICIDIO', 'CVLI: homicídio (vítimas)', 'vitima', 'LETAL', 'homicidio_doloso', null, false, 'Natureza jurídica HOMICIDIO do microdado de CVLI; feminicídio é natureza separada.'],
  ['LATROCINIO', 'CVLI: latrocínio (vítimas)', 'vitima', 'LETAL', 'latrocinio', null, false],
  ['FEMINICIDIO', 'CVLI: feminicídio (vítimas)', 'vitima', 'LETAL', 'feminicidio', null, true],
  ['LESOES_CORPORAIS_SEGUIDA_DE_MORTE', 'CVLI: lesão corporal seguida de morte (vítimas)', 'vitima', 'LETAL', 'lesao_corporal_seguida_de_morte', null, false],
  ['ESTUPRO_VULNERAVEL_COM_RESULTADO_MORTE', 'CVLI: estupro de vulnerável com resultado morte (vítimas)', 'vitima', 'LETAL', null, null, true],
  ['INFANTICIDIO', 'CVLI: infanticídio (vítimas)', 'vitima', 'LETAL', null, null, true],
  ['CVP_TOTAL', 'Crimes violentos contra o patrimônio (CVP), total', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Total de CVP já agregado por município e mês na fonte; a planilha não detalha a composição nem declara a unidade (tratada como ocorrência).'],
  ['ESTUPRO', 'Estupro (vítimas)', 'vitima', 'SEXUAL', 'estupro', null, true],
  ['ESTUPRO_DE_VULNERAVEL', 'Estupro de vulnerável (vítimas)', 'vitima', 'SEXUAL', 'estupro_vulneravel', null, true],
  ['ESTUPRO_POR_VIOLENCIA_DOMESTICA_FAMILIAR', 'Estupro por violência doméstica/familiar (vítimas)', 'vitima', 'SEXUAL', null, null, true],
  ['ESTUPRO_DE_VULNERAVEL_POR_VIOLENCIA_DOMESTICA_FAMILIAR', 'Estupro de vulnerável por violência doméstica/familiar (vítimas)', 'vitima', 'SEXUAL', null, null, true],
  ['ESTUPRO_COLETIVO', 'Estupro coletivo (vítimas)', 'vitima', 'SEXUAL', null, null, true],
  ['ESTUPRO_CORRETIVO', 'Estupro corretivo (vítimas)', 'vitima', 'SEXUAL', null, null, true],
];
export const PE_DEFS: CrimeDef[] = buildDefs(CRIME_SOURCES[5]!, PE, { temporal: 'fato (coluna DATA/DATA DO FATO, primeiro dia do mês)', zero: 'Fonte de EVENTOS/vítimas: município-mês sem linha = nenhuma vítima/ocorrência registrada naquela natureza (não é zero declarado). Pequenas contagens (1–2) de categorias sensíveis são suprimidas (value NULL + flag).', derived: true,
  note: `${NOTE_COMMON} Fonte: SDS-PE, microdados abertos (XLSX) de CVLI, CVP e estupro; agregados pelo Cívica em município × mês × natureza SEM sexo, idade, região ou qualquer atributo individual. A fonte só cobre CVLI, CVP e estupro: não há roubos/furtos detalhados.` });

// ------------------------------------------------------------------ SEJUSP-MG (dados.mg.gov.br, CKAN; REDS/BISP já agregado por município × mês × natureza, zeros declarados)
const MG: DefRow[] = [
  ['HOMICIDIO_CONSUMADO_VITIMAS', 'Homicídio consumado (vítimas)', 'vitima', 'LETAL', 'homicidio_doloso', null, false, 'Banco de vítimas de homicídio consumado (2012 em diante). Unidade distinta de HOMICIDIO_CONSUMADO_REGISTROS.'],
  ['HOMICIDIO_CONSUMADO_REGISTROS', 'Homicídio consumado (registros)', 'ocorrencia', 'LETAL', null, null, false, 'Contagem de registros REDS do Banco de Crimes Violentos (2019 em diante), não de vítimas.'],
  ['FEMINICIDIO_CONSUMADO_REGISTROS', 'Feminicídio consumado (registros)', 'ocorrencia', 'LETAL', 'feminicidio', null, true],
  ['HOMICIDIO_TENTADO', 'Homicídio tentado', 'ocorrencia', 'PESSOA', 'tentativa_homicidio', null, false],
  ['FEMINICIDIO_TENTADO', 'Feminicídio tentado', 'ocorrencia', 'PESSOA', 'tentativa_feminicidio', null, true],
  ['LESAO_CORPORAL', 'Lesão corporal consumada', 'ocorrencia', 'PESSOA', null, null, false, 'Banco de lesão corporal consumada (2012 em diante); a SEJUSP não separa dolosa de culposa neste conjunto.'],
  ['ESTUPRO_CONSUMADO', 'Estupro consumado', 'ocorrencia', 'SEXUAL', 'estupro', null, true],
  ['ESTUPRO_TENTADO', 'Estupro tentado', 'ocorrencia', 'SEXUAL', null, null, true],
  ['ESTUPRO_DE_VULNERAVEL_CONSUMADO', 'Estupro de vulnerável consumado', 'ocorrencia', 'SEXUAL', 'estupro_vulneravel', null, true],
  ['ESTUPRO_DE_VULNERAVEL_TENTADO', 'Estupro de vulnerável tentado', 'ocorrencia', 'SEXUAL', null, null, true],
  ['ROUBO_CONSUMADO', 'Roubo consumado', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Roubo em geral, sem separar alvo (veículo, carga, etc.).'],
  ['ROUBO_TENTADO', 'Roubo tentado', 'ocorrencia', 'PATRIMONIAL', null, null, false],
  ['FURTO', 'Furto consumado', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Banco de furtos consumados (2012 em diante).'],
  ['EXTORSAO_CONSUMADO', 'Extorsão consumada', 'ocorrencia', 'OUTROS', null, null, false],
  ['EXTORSAO_TENTADO', 'Extorsão tentada', 'ocorrencia', 'OUTROS', null, null, false],
  ['EXTORSAO_MEDIANTE_SEQUESTRO_CONSUMADO', 'Extorsão mediante sequestro consumada', 'ocorrencia', 'OUTROS', null, null, false],
  ['SEQUESTRO_E_CARCERE_PRIVADO_CONSUMADO', 'Sequestro e cárcere privado consumado', 'ocorrencia', 'PESSOA', null, null, false],
  ['SEQUESTRO_E_CARCERE_PRIVADO_TENTADO', 'Sequestro e cárcere privado tentado', 'ocorrencia', 'PESSOA', null, null, false],
];
export const MG_DEFS: CrimeDef[] = buildDefs(CRIME_SOURCES[1]!, MG, { temporal: 'fato (campos mês e ano do banco REDS/BISP)', zero: 'Os CSV trazem os 853 municípios em todos os meses publicados: 0 é zero declarado. Meses futuros preenchidos com zero são descartados (nunca publicados).', derived: false,
  note: `${NOTE_COMMON} Fonte: SEJUSP-MG, bancos abertos do portal dados.mg.gov.br (REDS/BISP: PM, PC, CBM, sistema prisional e socioeducativo). Os bancos têm períodos diferentes: crimes violentos de 2019, demais de 2012.` });

// ------------------------------------------------------------------ SSPDS-CE (planilhas abertas de CVLI por vítima e CVP por ocorrência; agregadas pelo Cívica em município × mês × natureza)
const CE: DefRow[] = [
  ['HOMICIDIO_DOLOSO', 'CVLI: homicídio doloso (vítimas)', 'vitima', 'LETAL', 'homicidio_doloso', null, false],
  ['FEMINICIDIO', 'CVLI: feminicídio (vítimas)', 'vitima', 'LETAL', 'feminicidio', null, true],
  ['LESAO_CORPORAL_SEGUIDA_DE_MORTE', 'CVLI: lesão corporal seguida de morte (vítimas)', 'vitima', 'LETAL', 'lesao_corporal_seguida_de_morte', null, false],
  ['ROUBO_SEGUIDO_DE_MORTE_LATROCINIO', 'CVLI: roubo seguido de morte (latrocínio) (vítimas)', 'vitima', 'LETAL', 'latrocinio', null, false],
  ['CVP_TOTAL', 'Crimes violentos contra o patrimônio (CVP), total', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Uma linha por ocorrência na planilha da SSPDS; a natureza não é detalhada.'],
];
export const CE_DEFS: CrimeDef[] = buildDefs(CRIME_SOURCES[4]!, CE, { temporal: 'fato (coluna Data)', zero: 'Fonte de EVENTOS: município-mês sem linha = nenhum registro naquela natureza (não é zero declarado). Pequenas contagens (1–2) de categorias sensíveis são suprimidas (value NULL + flag).', derived: true,
  note: `${NOTE_COMMON} Fonte: SSPDS-CE, planilhas abertas de CVLI e CVP do ano corrente, agregadas pelo Cívica SEM gênero, idade, raça, escolaridade, meio ou hora. A página só publica o ano corrente (2026); não há série histórica oficial aberta. Intervenção policial e unidade prisional não são publicados.` });

// ------------------------------------------------------------------ SSP-SP (SPDadosCriminais_AAAA.xlsx: um B.O. por linha; agregado pelo Cívica em município × mês estatístico × natureza apurada; endereço e coordenadas descartados na leitura)
const SP: DefRow[] = [
  ['HOMICIDIO_DOLOSO', 'Homicídio doloso (B.O.)', 'ocorrencia', 'LETAL', null, null, false, 'Natureza apurada HOMICÍDIO DOLOSO; conta B.O. (ocorrências), não vítimas, e não inclui o homicídio doloso por acidente de trânsito.'],
  ['HOMICIDIO_DOLOSO_POR_ACIDENTE_DE_TRANSITO', 'Homicídio doloso por acidente de trânsito (B.O.)', 'ocorrencia', 'TRANSITO', null, null, false],
  ['LATROCINIO', 'Latrocínio (B.O.)', 'ocorrencia', 'LETAL', null, null, false],
  ['LESAO_CORPORAL_SEGUIDA_DE_MORTE', 'Lesão corporal seguida de morte (B.O.)', 'ocorrencia', 'LETAL', null, null, false],
  ['TENTATIVA_DE_HOMICIDIO', 'Tentativa de homicídio (B.O.)', 'ocorrencia', 'PESSOA', null, null, false],
  ['LESAO_CORPORAL_DOLOSA', 'Lesão corporal dolosa (B.O.)', 'ocorrencia', 'PESSOA', null, null, false],
  ['LESAO_CORPORAL_CULPOSA_POR_ACIDENTE_DE_TRANSITO', 'Lesão corporal culposa por acidente de trânsito (B.O.)', 'ocorrencia', 'TRANSITO', null, null, false],
  ['LESAO_CORPORAL_CULPOSA_OUTRAS', 'Lesão corporal culposa, outras (B.O.)', 'ocorrencia', 'PESSOA', null, null, false],
  ['HOMICIDIO_CULPOSO_POR_ACIDENTE_DE_TRANSITO', 'Homicídio culposo por acidente de trânsito (B.O.)', 'ocorrencia', 'TRANSITO', null, null, false],
  ['HOMICIDIO_CULPOSO_OUTROS', 'Homicídio culposo, outros (B.O.)', 'ocorrencia', 'PESSOA', null, null, false],
  ['ESTUPRO', 'Estupro (B.O.)', 'ocorrencia', 'SEXUAL', null, null, true],
  ['ESTUPRO_DE_VULNERAVEL', 'Estupro de vulnerável (B.O.)', 'ocorrencia', 'SEXUAL', null, null, true],
  ['ROUBO_OUTROS', 'Roubo, outros (B.O.)', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Roubos que não são de veículo nem de carga.'],
  ['ROUBO_DE_VEICULO', 'Roubo de veículo (B.O.)', 'ocorrencia', 'PATRIMONIAL', null, null, false],
  ['ROUBO_DE_CARGA', 'Roubo de carga (B.O.)', 'ocorrencia', 'PATRIMONIAL', null, null, false],
  ['FURTO_OUTROS', 'Furto, outros (B.O.)', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Furtos que não são de veículo nem de carga.'],
  ['FURTO_DE_VEICULO', 'Furto de veículo (B.O.)', 'ocorrencia', 'PATRIMONIAL', null, null, false],
  ['FURTO_DE_CARGA', 'Furto de carga (B.O.)', 'ocorrencia', 'PATRIMONIAL', null, null, false],
  ['EXTORSAO_MEDIANTE_SEQUESTRO', 'Extorsão mediante sequestro (B.O.)', 'ocorrencia', 'OUTROS', null, null, false],
  ['TRAFICO_DE_ENTORPECENTES', 'Tráfico de entorpecentes (B.O.)', 'ocorrencia', 'POLICIAL', null, null, false],
  ['PORTE_DE_ENTORPECENTES', 'Porte de entorpecentes (B.O.)', 'ocorrencia', 'POLICIAL', null, null, false],
  ['APREENSAO_DE_ENTORPECENTES', 'Apreensão de entorpecentes (B.O.)', 'ocorrencia', 'POLICIAL', null, null, false],
  ['PORTE_DE_ARMA', 'Porte de arma (B.O.)', 'ocorrencia', 'POLICIAL', null, null, false],
  // ids são posicionais: novas naturezas entram SEMPRE no fim
  ['ROUBO_A_BANCO', 'Roubo a banco (B.O.)', 'ocorrencia', 'PATRIMONIAL', null, null, false, 'Presente apenas nos arquivos de 2022–2025.'],
];
export const SP_DEFS: CrimeDef[] = buildDefs(CRIME_SOURCES[7]!, SP, { temporal: 'mês estatístico do B.O. (MES_ESTATISTICA/ANO_ESTATISTICA), não a data do fato', zero: 'Fonte de EVENTOS (um B.O. por linha): município-mês sem linha = nenhum B.O. daquela natureza (não é zero declarado). Pequenas contagens (1–2) de categorias sensíveis são suprimidas (value NULL + flag).', derived: true,
  note: `${NOTE_COMMON} Fonte: SSP-SP, SPDadosCriminais (B.O.), agregados pelo Cívica por município (COD IBGE), mês estatístico e natureza apurada; endereço, coordenadas, bairro, número do B.O., hora e local são descartados na leitura. A série aberta começa em 2022. Natureza apurada é a classificação da SSP-SP e não equivale ao VDE do Sinesp.` });

export const ALL_CRIME_DEFS: CrimeDef[] = [...RJ_DEFS, ...MG_DEFS, ...ES_DEFS, ...RS_DEFS, ...PE_DEFS, ...CE_DEFS, ...SP_DEFS];
export const CRIME_DEF_BY_ID = new Map(ALL_CRIME_DEFS.map(d => [d.id, d]));
export const crimeDefsOf = (slot: number): CrimeDef[] => ALL_CRIME_DEFS.filter(d => d.slot === slot);
export const crimeIdsOf = (slot: number): number[] => crimeDefsOf(slot).map(d => d.id);

export async function seedCrimeDefs(pool: Pool, defs: CrimeDef[] = ALL_CRIME_DEFS): Promise<number> {
  let n = 0;
  for (const d of defs) {
    const unitLabel = d.unit === 'vitima' ? 'vítimas' : d.unit === 'caso' ? 'casos (registros)' : d.unit === 'autor' ? 'autores' : d.unit === 'adolescente' ? 'adolescentes' : d.unit === 'ocorrencia' ? 'ocorrências' : 'eventos';
    await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,1,$3,$4,$5,$6,'M',$7,'não se aplica (contagem)',NULL,false,false,$8,$9)
      ON CONFLICT (indicator_id) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit, numerator_desc = EXCLUDED.numerator_desc, null_semantics = EXCLUDED.null_semantics, methodology_note = EXCLUDED.methodology_note`,
      [d.id, `IND-CRIME-${d.source}-${d.code}`.toUpperCase().replace(/[^A-Z0-9-]+/g, '-'), DOMAIN.seguranca, d.id, `${d.label} — ${d.source}`, unitLabel, `${d.source}: ${d.code}${d.composite ? ' = ' + d.composite.join(' + ') : ''}`, d.zero, d.note]);
    await pool.query(`INSERT INTO civica_exec.exec_crime_indicator (indicator_id, source, source_slot, uf, source_code, source_label, group_code, canonical, unit, composite_of, comparability, temporal, zero_semantics, derived_from_microdata, sensitive, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (indicator_id) DO UPDATE SET source_label = EXCLUDED.source_label, group_code = EXCLUDED.group_code, canonical = EXCLUDED.canonical, unit = EXCLUDED.unit, composite_of = EXCLUDED.composite_of, comparability = EXCLUDED.comparability,
        temporal = EXCLUDED.temporal, zero_semantics = EXCLUDED.zero_semantics, derived_from_microdata = EXCLUDED.derived_from_microdata, sensitive = EXCLUDED.sensitive, note = EXCLUDED.note`,
      [d.id, d.source, d.slot, d.ufCode, d.code, d.label, d.group, d.canonical, d.unit, d.composite, d.comparability, d.temporal, d.zero, d.derived, d.sensitive, d.note]);
    n++;
  }
  return n;
}
