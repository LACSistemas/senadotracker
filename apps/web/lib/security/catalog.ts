/**
 * Catálogo editorial da experiência de Segurança (P9.8): quais indicadores contam a história, com nome em linguagem simples, e quais ficam só no modo "Explorar os dados".
 * A autoridade sobre o que cada dado representa são os read models e os contratos da P9.7; aqui só se escolhe e se nomeia. Nada é calculado neste arquivo.
 */
export const GROUP_LABEL: Record<string, string> = {
  LETAL: 'Violência letal', PESSOA: 'Violência contra a pessoa', SEXUAL: 'Violência sexual', PATRIMONIAL: 'Roubos, furtos e fraudes', POLICIAL: 'Atividade policial', TRANSITO: 'Trânsito', OUTROS: 'Outros registros',
};
export const GROUP_ORDER = ['Violência letal', 'Violência contra a pessoa', 'Violência sexual', 'Roubos, furtos e fraudes', 'Outros registros'];

/** Nome simples da instituição que publica o registro estadual. */
export const SOURCE_PLAIN: Record<string, string> = {
  'ISP-RJ': 'Instituto de Segurança Pública do Rio de Janeiro', 'SEJUSP-MG': 'Secretaria de Justiça e Segurança Pública de Minas Gerais', 'SESP-ES': 'Secretaria de Segurança Pública do Espírito Santo',
  'SSP-RS': 'Secretaria da Segurança Pública do Rio Grande do Sul', 'SDS-PE': 'Secretaria de Defesa Social de Pernambuco', 'SSPDS-CE': 'Secretaria da Segurança Pública do Ceará', 'SSP-SP': 'Secretaria da Segurança Pública de São Paulo',
};

/** Indicadores do Sinesp (VDE) que contam a história da criminalidade. `muni` = o arquivo traz município; os demais só existem para a UF e entram como contexto estadual. */
export interface VdeCrime { slug: string; plain: string; group: string; muni: boolean; sensitive?: boolean; definition: string; caveat?: string }
export const VDE_CRIME: VdeCrime[] = [
  { slug: 'homicidio-doloso', plain: 'Homicídios dolosos', group: 'Violência letal', muni: true, definition: 'Vítimas de homicídio doloso registradas pelas polícias e informadas ao Sinesp.' },
  { slug: 'tentativa-homicidio', plain: 'Tentativas de homicídio', group: 'Violência letal', muni: true, definition: 'Vítimas de tentativa de homicídio registradas pelas polícias.' },
  { slug: 'latrocinio', plain: 'Latrocínio (roubo seguido de morte)', group: 'Violência letal', muni: true, definition: 'Vítimas de roubo seguido de morte.' },
  { slug: 'lesao-corporal-morte', plain: 'Lesão corporal seguida de morte', group: 'Violência letal', muni: true, definition: 'Vítimas de lesão corporal seguida de morte.' },
  { slug: 'feminicidio', plain: 'Feminicídios', group: 'Violência letal', muni: true, sensitive: true, definition: 'Vítimas de feminicídio. Números pequenos oscilam muito de um ano para o outro.' },
  { slug: 'tentativa-feminicidio', plain: 'Tentativas de feminicídio', group: 'Violência contra a pessoa', muni: true, sensitive: true, definition: 'Vítimas de tentativa de feminicídio.' },
  { slug: 'estupro', plain: 'Estupros', group: 'Violência sexual', muni: false, sensitive: true, definition: 'Vítimas de estupro registradas. A subnotificação é alta: o registro não mede a ocorrência real.', caveat: 'Só existe para o estado.' },
  { slug: 'estupro-vulneravel', plain: 'Estupros de vulnerável', group: 'Violência sexual', muni: false, sensitive: true, definition: 'Vítimas de estupro de vulnerável registradas. A subnotificação é alta.', caveat: 'Só existe para o estado.' },
  { slug: 'furto-veiculo', plain: 'Furtos de veículos', group: 'Roubos, furtos e fraudes', muni: false, definition: 'Ocorrências de furto de veículo.', caveat: 'Só existe para o estado.' },
  { slug: 'roubo-veiculo', plain: 'Roubos de veículos', group: 'Roubos, furtos e fraudes', muni: false, definition: 'Ocorrências de roubo de veículo.', caveat: 'Só existe para o estado.' },
  { slug: 'roubo-carga', plain: 'Roubos de carga', group: 'Roubos, furtos e fraudes', muni: false, definition: 'Ocorrências de roubo de carga.', caveat: 'Só existe para o estado.' },
  { slug: 'roubo-instituicao-financeira', plain: 'Roubos a bancos e instituições financeiras', group: 'Roubos, furtos e fraudes', muni: false, definition: 'Ocorrências de roubo a instituição financeira.', caveat: 'Só existe para o estado.' },
  { slug: 'suicidio', plain: 'Suicídios (registro policial)', group: 'Outros registros', muni: true, definition: 'Suicídios registrados pelas polícias; a medida de saúde pública é a do SIM.' },
  { slug: 'mortes-a-esclarecer', plain: 'Mortes a esclarecer', group: 'Outros registros', muni: true, definition: 'Mortes sem indício de crime, ainda em apuração.' },
];
export const vdeCountCode = (slug: string) => `IND-SEG-VDE-${slug.toUpperCase()}-E`;
export const vdeRateCode = (slug: string) => `IND-SEG-VDE-${slug.toUpperCase()}-TAXA`;
/** Taxa anual do VDE (por 100 mil) por slug — ids publicados. */
export const VDE_RATE_ID: Record<string, number> = { 'homicidio-doloso': 3201, 'tentativa-homicidio': 3202, latrocinio: 3203, 'lesao-corporal-morte': 3204, suicidio: 3205, estupro: 3207, 'estupro-vulneravel': 3208 };

/** Registros estaduais (P9.6): quais indicadores têm gráfico pronto na primeira carga. O restante fica no modo "Explorar os dados". */
export const CRIME_FEATURED: Record<string, string[]> = {
  'ISP-RJ': ['hom_doloso', 'cvli', 'tentat_hom', 'lesao_corp_dolosa', 'estupro', 'total_roubos', 'roubo_transeunte', 'roubo_celular', 'roubo_veiculo', 'roubo_carga', 'roubo_comercio', 'roubo_residencia', 'total_furtos', 'furto_veiculos', 'estelionato', 'ameaca'],
  'SEJUSP-MG': ['HOMICIDIO_CONSUMADO_VITIMAS', 'HOMICIDIO_TENTADO', 'FEMINICIDIO_CONSUMADO_REGISTROS', 'LESAO_CORPORAL', 'ESTUPRO_CONSUMADO', 'ESTUPRO_DE_VULNERAVEL_CONSUMADO', 'ROUBO_CONSUMADO', 'FURTO', 'EXTORSAO_CONSUMADO'],
  'SESP-ES': ['ROUBO_PESSOA_VIA_PUBLICA', 'ROUBO_TRANSPORTE_COLETIVO', 'ROUBO_ESTABELECIMENTO_COMERCIAL', 'ROUBO_RESIDENCIA_CONDOMINIO', 'FURTO_PESSOA_VIA_PUBLICA', 'FURTO_TRANSPORTE_COLETIVO', 'FURTO_ESTABELECIMENTO_COMERCIAL', 'FURTO_RESIDENCIA_CONDOMINIO', 'ESTELIONATO_FRAUDE', 'CRIMES_INFORMATICOS'],
  'SSP-RS': ['HOMICIDIO_DOLOSO', 'VITIMAS_HOMICIDIO_DOLOSO', 'LATROCINIO', 'ROUBO', 'ROUBO_VEICULO', 'FURTO', 'FURTO_VEICULO', 'ESTELIONATO', 'ABIGEATO'],
  'SDS-PE': ['HOMICIDIO', 'LATROCINIO', 'FEMINICIDIO', 'CVP_TOTAL', 'ESTUPRO', 'ESTUPRO_DE_VULNERAVEL'],
  'SSPDS-CE': ['HOMICIDIO_DOLOSO', 'FEMINICIDIO', 'ROUBO_SEGUIDO_DE_MORTE_LATROCINIO', 'CVP_TOTAL'],
  'SSP-SP': ['HOMICIDIO_DOLOSO', 'LATROCINIO', 'LESAO_CORPORAL_DOLOSA', 'ROUBO_OUTROS', 'ROUBO_DE_VEICULO', 'ROUBO_DE_CARGA', 'FURTO_OUTROS', 'FURTO_DE_VEICULO', 'ESTUPRO', 'ESTUPRO_DE_VULNERAVEL', 'TENTATIVA_DE_HOMICIDIO'],
};
/** Rótulos simples que substituem o texto técnico da fonte quando o técnico atrapalha a leitura. */
export const CRIME_PLAIN: Record<string, string> = {
  'ISP-RJ:hom_doloso': 'Homicídios dolosos', 'ISP-RJ:cvli': 'Mortes violentas intencionais (indicador composto)', 'ISP-RJ:tentat_hom': 'Tentativas de homicídio', 'ISP-RJ:lesao_corp_dolosa': 'Lesões corporais dolosas',
  'ISP-RJ:estupro': 'Estupros', 'ISP-RJ:total_roubos': 'Roubos (total da fonte)', 'ISP-RJ:total_furtos': 'Furtos (total da fonte)', 'ISP-RJ:estelionato': 'Estelionatos', 'ISP-RJ:ameaca': 'Ameaças',
  'SEJUSP-MG:HOMICIDIO_CONSUMADO_VITIMAS': 'Vítimas de homicídio consumado', 'SEJUSP-MG:HOMICIDIO_TENTADO': 'Homicídios tentados', 'SEJUSP-MG:ROUBO_CONSUMADO': 'Roubos consumados', 'SEJUSP-MG:FURTO': 'Furtos consumados',
  'SEJUSP-MG:LESAO_CORPORAL': 'Lesões corporais consumadas', 'SEJUSP-MG:ESTUPRO_CONSUMADO': 'Estupros consumados', 'SEJUSP-MG:ESTUPRO_DE_VULNERAVEL_CONSUMADO': 'Estupros de vulnerável consumados', 'SEJUSP-MG:FEMINICIDIO_CONSUMADO_REGISTROS': 'Feminicídios consumados',
  'SSP-RS:ROUBO': 'Roubos', 'SSP-RS:LATROCINIO': 'Latrocínios (ocorrências)', 'SSP-RS:ROUBO_VEICULO': 'Roubos de veículos', 'SSP-RS:FURTO_VEICULO': 'Furtos de veículos', 'SSP-RS:ESTELIONATO': 'Estelionatos', 'SSP-RS:ABIGEATO': 'Abigeato (furto de gado)', 'SSP-RS:FURTO': 'Furtos (inclui abigeato)', 'SSP-RS:HOMICIDIO_DOLOSO': 'Homicídios dolosos (ocorrências)', 'SSP-RS:VITIMAS_HOMICIDIO_DOLOSO': 'Vítimas de homicídio doloso',
  'SDS-PE:HOMICIDIO': 'Vítimas de homicídio (CVLI)', 'SDS-PE:LATROCINIO': 'Vítimas de latrocínio (CVLI)', 'SDS-PE:CVP_TOTAL': 'Roubos e outros crimes violentos patrimoniais (CVP)', 'SDS-PE:ESTUPRO': 'Vítimas de estupro', 'SDS-PE:ESTUPRO_DE_VULNERAVEL': 'Vítimas de estupro de vulnerável', 'SDS-PE:FEMINICIDIO': 'Vítimas de feminicídio',
  'SSPDS-CE:HOMICIDIO_DOLOSO': 'Vítimas de homicídio doloso (CVLI)', 'SSPDS-CE:CVP_TOTAL': 'Roubos e outros crimes violentos patrimoniais (CVP)', 'SSPDS-CE:FEMINICIDIO': 'Vítimas de feminicídio', 'SSPDS-CE:ROUBO_SEGUIDO_DE_MORTE_LATROCINIO': 'Vítimas de latrocínio (CVLI)',
  'SSP-SP:HOMICIDIO_DOLOSO': 'Homicídios dolosos (B.O.)', 'SSP-SP:ROUBO_OUTROS': 'Roubos (exceto veículo e carga)', 'SSP-SP:ROUBO_DE_VEICULO': 'Roubos de veículos', 'SSP-SP:ROUBO_DE_CARGA': 'Roubos de carga', 'SSP-SP:FURTO_OUTROS': 'Furtos (exceto veículo e carga)',
  'SSP-SP:FURTO_DE_VEICULO': 'Furtos de veículos', 'SSP-SP:LESAO_CORPORAL_DOLOSA': 'Lesões corporais dolosas', 'SSP-SP:ESTUPRO': 'Estupros', 'SSP-SP:ESTUPRO_DE_VULNERAVEL': 'Estupros de vulnerável', 'SSP-SP:TENTATIVA_DE_HOMICIDIO': 'Tentativas de homicídio',
};
/**
 * Roubo por fonte: categorias EXCLUSIVAS da mesma fonte cuja soma é o "roubo" que o herói mostra. Onde a fonte publica o total, o total é o próprio indicador (nunca reconstruído por nós).
 * `label` diz exatamente o que a soma cobre; a lista parcial de modalidades do ES é declarada como tal.
 */
export const ROBBERY_FAMILY: Record<string, { codes: string[]; label: string; note: string | null }> = {
  'ISP-RJ': { codes: ['total_roubos'], label: 'Roubos registrados', note: 'Total publicado pelo próprio ISP.' },
  'SEJUSP-MG': { codes: ['ROUBO_CONSUMADO'], label: 'Roubos consumados', note: null },
  'SESP-ES': { codes: ['ROUBO_PESSOA_VIA_PUBLICA', 'ROUBO_TRANSPORTE_COLETIVO', 'ROUBO_ESTABELECIMENTO_COMERCIAL', 'ROUBO_RESIDENCIA_CONDOMINIO'], label: 'Roubos registrados (4 modalidades publicadas)', note: 'A fonte publica 4 modalidades de roubo (pessoa em via pública, transporte coletivo, comércio e residência); roubo de veículo e outros não estão no arquivo.' },
  'SSP-RS': { codes: ['ROUBO'], label: 'Roubos registrados', note: null },
  'SDS-PE': { codes: ['CVP_TOTAL'], label: 'Crimes violentos contra o patrimônio (roubos e afins)', note: 'CVP é o grupo de crimes violentos patrimoniais da SDS-PE; a fonte não separa a composição.' },
  'SSPDS-CE': { codes: ['CVP_TOTAL'], label: 'Crimes violentos contra o patrimônio (roubos e afins)', note: 'Só 2026 está disponível.' },
  'SSP-SP': { codes: ['ROUBO_OUTROS', 'ROUBO_DE_VEICULO', 'ROUBO_DE_CARGA', 'ROUBO_A_BANCO'], label: 'Roubos registrados (B.O.)', note: 'Soma das quatro naturezas de roubo da SSP-SP; conta boletins de ocorrência, não vítimas.' },
};

/** Etiquetas simples para o seletor de usuários das mortes no trânsito (SIM). */
export const TRAFFIC_USER: Array<{ id: number; oco: number; label: string }> = [
  { id: 4013, oco: 4113, label: 'Motociclistas' }, { id: 4015, oco: 4115, label: 'Ocupantes de automóvel' }, { id: 4011, oco: 4111, label: 'Pedestres' }, { id: 4012, oco: 4112, label: 'Ciclistas' },
  { id: 4017, oco: 4117, label: 'Veículos pesados' }, { id: 4018, oco: 4118, label: 'Ônibus' }, { id: 4016, oco: 4116, label: 'Camionetes' }, { id: 4014, oco: 4114, label: 'Triciclos motorizados' }, { id: 4019, oco: 4119, label: 'Outros terrestres' },
];
export const FLEET_TYPE_PLAIN: Record<string, string> = { automovel: 'Automóveis', motocicleta: 'Motocicletas', motoneta: 'Motonetas', caminhonete: 'Caminhonetes', camioneta: 'Camionetas', caminhao: 'Caminhões', caminhao_trator: 'Caminhões-trator', onibus: 'Ônibus', micro_onibus: 'Micro-ônibus', reboque: 'Reboques', semi_reboque: 'Semirreboques', utilitario: 'Utilitários', ciclomotor: 'Ciclomotores', triciclo: 'Triciclos', quadriciclo: 'Quadriciclos', outros: 'Outros' };

/** Descontinuidade metodológica da PRF: a série de sinistros muda de critério entre 2015 e 2016 (P9.2). */
export const PRF_BREAK = { from: '2015', to: '2016', label: 'Mudança de metodologia da PRF (2015→2016): a série anterior não é comparável.' };
/** Ressalva fixa sobre infrações (Senatran). */
export const INFRACTION_NOTE = 'As infrações são contadas na UF de jurisdição do veículo, não necessariamente onde ocorreram.';

/** Fontes que informam a grade completa município × mês (zero é zero declarado). As demais são de eventos: mês sem linha é lacuna. */
export const EXPLICIT_ZERO = new Set(['ISP-RJ', 'SEJUSP-MG', 'SSP-RS']);

/** "do Espírito Santo", "de São Paulo", "da Bahia": preposição + nome, para frases corretas em português. */
export const STATE_DE: Record<string, string> = { AC: 'do Acre', AL: 'de Alagoas', AP: 'do Amapá', AM: 'do Amazonas', BA: 'da Bahia', CE: 'do Ceará', DF: 'do Distrito Federal', ES: 'do Espírito Santo', GO: 'de Goiás', MA: 'do Maranhão', MT: 'de Mato Grosso', MS: 'de Mato Grosso do Sul', MG: 'de Minas Gerais', PA: 'do Pará', PB: 'da Paraíba', PR: 'do Paraná', PE: 'de Pernambuco', PI: 'do Piauí', RJ: 'do Rio de Janeiro', RN: 'do Rio Grande do Norte', RS: 'do Rio Grande do Sul', RO: 'de Rondônia', RR: 'de Roraima', SC: 'de Santa Catarina', SP: 'de São Paulo', SE: 'de Sergipe', TO: 'do Tocantins' };
export const stateDe = (uf: string, fallback: string): string => STATE_DE[uf.toUpperCase()] ?? `de ${fallback}`;
