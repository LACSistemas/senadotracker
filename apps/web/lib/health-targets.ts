/**
 * Metas de cobertura vacinal do Programa Nacional de Imunizações (Ministério da Saúde) usadas no painel de Saúde.
 * Editorial e versionado: 95 % para as vacinas do calendário infantil prioritárias e 90 % para a BCG. Para ajustar uma meta, altere só este arquivo.
 * `slug` é o rótulo canônico do arquivo oficial do SI-PNI (IND-SAU-07:<slug>).
 */
export const VACCINE_TARGETS_REVISION = '2026-10-21';
export const VACCINE_PRIORITY: ReadonlyArray<{ slug: string; short: string; target: number }> = [
  { slug: 'bcg', short: 'BCG', target: 90 },
  { slug: 'hepatite_a_infantil', short: 'Hepatite A Infantil', target: 95 },
  { slug: 'meningococica_conjugada', short: 'Meningocócica Conjugada', target: 95 },
  { slug: 'penta_dtp_hepb_hib', short: 'Penta (DTP/HepB/Hib)', target: 95 },
  { slug: 'pneumococica_conjugada', short: 'Pneumocócica Conjugada', target: 95 },
  { slug: 'poliomielite', short: 'Poliomielite', target: 95 },
  { slug: 'triplice_viral_1_dose', short: 'Tríplice Viral — 1ª dose', target: 95 },
  { slug: 'varicela', short: 'Varicela', target: 95 },
];
export const VACCINE_SLUGS = VACCINE_PRIORITY.map(v => v.slug);

export type CardTone = 'blue' | 'pink' | 'teal' | 'violet' | 'green';
export interface PanelCardMeta { code: string; title: string; icon: 'bed' | 'baby' | 'clipboard' | 'pregnant' | 'scissors'; tone: CardTone; digits: number; unit: '' | '%'; suffix?: string; note: string }
export const PANEL_CARDS: ReadonlyArray<PanelCardMeta> = [
  { code: 'IND-SAU-05', title: 'Leitos hospitalares existentes por 1.000 habitantes', icon: 'bed', tone: 'blue', digits: 2, unit: '', note: 'Leitos por residente: ignoram o fluxo regional (cidades-polo atendem moradores de outros municípios).' },
  { code: 'IND-SAU-05S', title: 'Leitos SUS por 1.000 habitantes', icon: 'bed', tone: 'blue', digits: 2, unit: '', note: 'Leitos por residente: ignoram o fluxo regional.' },
  { code: 'IND-SAU-08', title: 'Mortalidade infantil', icon: 'baby', tone: 'pink', digits: 1, unit: '', suffix: ' por mil', note: 'Óbitos de menores de 1 ano por mil nascidos vivos, por município de residência. Números pequenos são instáveis.' },
  { code: 'IND-SAU-10', title: 'ICSAP', icon: 'clipboard', tone: 'teal', digits: 1, unit: '%', note: 'Internações SUS por condições sensíveis à atenção primária, em % das internações de residentes. Proporção, não taxa padronizada.' },
  { code: 'IND-SAU-11', title: '6+ consultas de pré-natal', icon: 'pregnant', tone: 'violet', digits: 1, unit: '%', note: 'Nascidos de mães com 6 ou mais consultas, entre os com informação válida.' },
  { code: 'IND-SAU-12', title: 'Partos cesáreos', icon: 'scissors', tone: 'violet', digits: 1, unit: '%', note: 'Taxa bruta, sem ajuste pelo perfil das gestantes. Nenhuma faixa de referência é aplicada.' },
];
