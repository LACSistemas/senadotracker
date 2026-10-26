import { norm, isDefenseOrgan, PNCP_VALUE_OUTLIER_CENTS, type ContractCtx, type PncpContract } from './pncp-build.ts';
import type { Row } from './publication.ts';

/**
 * Contratações educacionais sobre os contratos do PNCP já preservados no RAW (P10.7). Classificação DETERMINÍSTICA, auditável e versionada, em dois eixos nunca fundidos:
 *  - COMPRADOR (quem contrata): órgão ou unidade de educação, pelo nome; `FNDE`/`MEC`/`INEP` pelo nome oficial exato valem como `CONFIRMED_OFFICIAL`;
 *  - OBJETO (o que compra): categorias 1 a 15 por palavras-chave com contexto escolar explícito; a categoria 16 é "contratação de órgão de educação sem tema educacional identificado".
 * Regra central: palavra genérica (computador, obra, limpeza) NUNCA basta; precisa de contexto escolar no objeto OU de comprador de educação. Ensino superior (universidade, instituto federal, CEFET) fica fora do núcleo.
 * `valorGlobal` é valor CONTRATADO: nunca gasto, pago ou investido. Pessoa física nunca é persistida. Versionar EDU_CONTRACT_VERSION ao mudar qualquer regra.
 */
export const EDU_CONTRACT_VERSION = { classify: 'edu-ctr-v7', publish: 'edu-ctr-pub-1' } as const;

export const EDU_CATEGORY: Record<number, string> = {
  1: 'construção de escolas e creches', 2: 'reforma e ampliação escolar', 3: 'manutenção predial escolar', 4: 'mobiliário escolar', 5: 'equipamentos e materiais pedagógicos',
  6: 'computadores e tecnologia educacional', 7: 'internet e conectividade escolar', 8: 'alimentação escolar', 9: 'transporte escolar', 10: 'material didático',
  11: 'uniformes escolares', 12: 'serviços educacionais', 13: 'limpeza, vigilância e terceirização escolar', 14: 'infraestrutura esportiva escolar', 15: 'acessibilidade escolar',
  16: 'contratação educacional sem tema identificado (órgão de educação ou unidade escolar nomeada)',
};
/** Estado da evidência de cada classificação (armazenado como smallint). */
export const EDU_CONFIDENCE = { CONFIRMED_OFFICIAL: 1, HIGH_CONFIDENCE_DERIVED: 2, POSSIBLE_EDUCATION: 3 } as const;
export const EDU_CONFIDENCE_LABEL: Record<number, string> = { 1: 'CONFIRMED_OFFICIAL', 2: 'HIGH_CONFIDENCE_DERIVED', 3: 'POSSIBLE_EDUCATION' };
/** Eixo que sustenta a classificação: 1 comprador, 2 objeto, 3 os dois. */
export const EDU_VIA_LABEL: Record<number, string> = { 1: 'comprador (órgão de educação)', 2: 'objeto (marcador escolar explícito)', 3: 'comprador e objeto' };
/** Tipo do comprador de educação. */
export const EDU_BUYER: Record<number, string> = { 0: 'não é órgão de educação', 1: 'MEC / FNDE / INEP (oficial)', 2: 'secretaria de educação', 3: 'fundo de educação (FME, Fundeb)', 4: 'departamento, diretoria ou coordenadoria de educação', 5: 'unidade escolar (escola, creche, CMEI)' };

// ---------------------------------------------------------------- comprador
const MEC_EXACT = /^(FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCACAO|MINISTERIO DA EDUCACAO|INSTITUTO NACIONAL DE ESTUDOS E PESQUISAS EDUCACIONAIS ANISIO TEIXEIRA|COLEGIO PEDRO II)\b/;
const BUYER_SECRETARIA = /\bSECRETARIA\b[A-Z0-9 ]{0,60}\bEDUCACAO\b|\bSEC\b (MUN|EST)[A-Z]* (DE|DA) EDUCACAO\b|\bSEMED\b|\bSEDUC\b|\bSMED\b|\bSEEDUC\b/;
const BUYER_FUNDO = /\bFUNDACAO\b[A-Z0-9 ]{0,40}\bDESENVOLVIMENTO DA EDUCACAO\b|\bFUNDO\b[A-Z0-9 ]{0,60}\b(EDUCACAO|ENSINO)\b|\bFUNDEB\b|\bFME\b|\bFMDE\b/;
const BUYER_DEPT = /\b(DEPARTAMENTO|DIRETORIA|COORDENADORIA|GERENCIA|SUPERINTENDENCIA)\b[A-Z0-9 ]{0,40}\bEDUCACAO\b/;
const BUYER_SCHOOL = /\b(ESCOLA (MUNICIPAL|ESTADUAL|DISTRITAL|MUN|EST)|E ?M ?E ?F|EMEIEF|EMEI|CMEI|CEMEI|CEIM|CRECHE|COLEGIO ESTADUAL|COLEGIO MUNICIPAL|CENTRO (MUNICIPAL |ESTADUAL )?DE EDUCACAO|CEEP|CEEJA|EEEFM|EEEM|EEEF|CIEP|EEFM|EEMTI|EEEP|EEIEF|EEM|LICEU|ESCOLA INDIGENA|ESCOLA ESTADUAL)\b/;
const SUPERIOR = /\bUNIVERSIDADE\b|\bINSTITUTO FEDERAL\b|\bCEFET\b|\bUNIVERSITARIO\b|\bFACULDADE\b|\bCENTRO UNIVERSITARIO\b|\bINSTITUTO (FEDERAL )?DE EDUCACAO\b/;
/** Unidade com nome de escola que NÃO é escola básica (hospital-escola, escola de governo, militar, judiciária). */
const BUYER_EXCL = /\b(HOSPITAL|EBSERH|ESCOLA (DE|DO|DA|NACIONAL DE|SUPERIOR DE|NAVAL|DE GUERRA|JUDICIAL|DA MAGISTRATURA|DE GOVERNO|DE CONTAS|DE SAUDE|DE POLICIA|DE FORMACAO)|FUNDACAO ESCOLA|COMANDO|MARINHA|EXERCITO|AERONAUTICA|POLICIA|TRIBUNAL|DEFENSORIA|ASSEMBLEIA|CAMARA (MUNICIPAL|DE VEREADORES|LEGISLATIVA)|MINISTERIO PUBLICO)\b/;

export interface BuyerClass { kind: number; confirmed: boolean; superior: boolean }
/** Tipo do comprador de educação (órgão + unidade, esfera F/E/D/M). 0 = não é órgão de educação. */
export function classifyBuyer(razaoSocial: string, unidade: string, esfera: string): BuyerClass {
  const org = norm(razaoSocial), un = norm(unidade), t = `${org} ${un}`;
  if (isDefenseOrgan(razaoSocial, unidade)) return { kind: 0, confirmed: false, superior: false };
  if (esfera === 'F' && MEC_EXACT.test(org)) return { kind: 1, confirmed: true, superior: false };
  if (SUPERIOR.test(org) || SUPERIOR.test(un)) return { kind: 0, confirmed: false, superior: true };
  if (BUYER_SECRETARIA.test(t)) return { kind: 2, confirmed: false, superior: false };
  if (BUYER_FUNDO.test(t)) return { kind: 3, confirmed: false, superior: false };
  if (BUYER_DEPT.test(t)) return { kind: 4, confirmed: false, superior: false };
  if (esfera !== 'F' && BUYER_SCHOOL.test(t) && !BUYER_EXCL.test(t)) return { kind: 5, confirmed: false, superior: false };
  return { kind: 0, confirmed: false, superior: false };
}

// ---------------------------------------------------------------- objeto
/** Contexto escolar EXPLÍCITO no objeto. */
const SCHOOL = '(ESCOLA|ESCOLAS|ESCOLAR|ESCOLARES|CRECHE|CRECHES|CMEI|CEMEI|CEIM|EMEF|EMEI|EMEIEF|EMEIF|EMUEF|EMUEI|EEEF|EEEFM|EEEM|CEEJA|CIEP|CENTRO MUNICIPAL DE EDUCACAO INFANTIL|CENTRO DE EDUCACAO INFANTIL|CENTRO DE EDUCACAO BASICA|CENTRO ESTADUAL DE EDUCACAO|CENTRO EDUCACIONAL|UNIDADE ESCOLAR|UNIDADES ESCOLARES|UNIDADE DE ENSINO|UNIDADES DE ENSINO|UNIDADE EDUCACIONAL|UNIDADES EDUCACIONAIS|REDE (MUNICIPAL |ESTADUAL |PUBLICA )?DE ENSINO|ALUNOS|ESTUDANTES|EDUCANDOS|PROINFANCIA|COLEGIO|COLEGIOS|PRE ESCOLA|EDUCACAO (INFANTIL|BASICA|ESPECIAL|INTEGRAL))';
const SCHOOL_RE = new RegExp(`\\b${SCHOOL}\\b`);
const near = (verb: string, ctx = SCHOOL, gap = 90): RegExp => new RegExp(`\\b(${verb})\\b.{0,${gap}}\\b${ctx}\\b|\\b${ctx}\\b.{0,${gap}}\\b(${verb})\\b`);
/** Exclusões do objeto: escola de governo/serviço público/magistratura, hospital-escola, ensino superior, forças armadas, ensino militar/judicial. */
const OBJ_EXCL = /\b(ESCOLA (DE|DO|DA) (GOVERNO|SAUDE PUBLICA|MAGISTRATURA|GUERRA|POLICIA|FORMACAO DE (SARGENTOS|OFICIAIS|SOLDADOS)|CONTAS|SUPERIOR|ADMINISTRACAO PUBLICA|ADMINISTRACAO|PRESERVACAO|SERVICO PUBLICO|PREFEITOS|FAZENDARIA|LEGISLATIVO|JUDICIARIA)|ESCOLA (NAVAL|SUPERIOR|JUDICIAL|NACIONAL|FAZENDARIA|JUDICIARIA|DO LEGISLATIVO|DE SERVICO PUBLICO)|HOSPITAL ESCOLA|HOSPITAL UNIVERSITARIO|ENSINO SUPERIOR|GRADUACAO|POS GRADUACAO|MEDICAMENTOS?|HOSPITALAR|CIRURGIC|ESCOLA DE (CONDUTORES|SAMBA|FUTEBOL|NATACAO)|AUTOESCOLA)\b/;
/** Objeto de ensino superior (universidade, campus, sigla de universidade federal): só entra se houver unidade escolar básica nomeada. */
const OBJ_SUPERIOR = /\b(UNIVERSIDADE|UNIVERSITARIO|UNIVERSITARIA|CAMPUS|INSTITUTO FEDERAL|UF(MS|MG|RJ|PR|SC|RS|BA|PE|CE|PA|AM|GO|MT|ES|RN|PB|AL|SE|PI|MA|F|U|SM|PEL|RPE|SCAR|LA|OP|V|JF|ABC)|UNIFESP|UNESP|UNICAMP|USP|UERJ|UEMG|UEPA|UEA)\b/;
/** Unidade escolar básica NOMEADA no objeto (evidência forte). */
const STRONG_SCHOOL = /\b(ESCOLA|ESCOLAS|EMEF|EMEI|EMEIEF|EMEIF|EMUEF|EMUEI|EEEF|EEEFM|EEEM|CEEJA|CIEP|CMEI|CEMEI|CEIM|CRECHE|CRECHES|UNIDADE ESCOLAR|UNIDADES ESCOLARES|COLEGIO ESTADUAL|COLEGIO MUNICIPAL|CENTRO MUNICIPAL DE EDUCACAO( INFANTIL)?|CENTRO DE EDUCACAO (INFANTIL|BASICA)|CENTRO ESTADUAL DE EDUCACAO|CENTRO EDUCACIONAL)\b/;
/** Marcador educacional explícito, porém mais genérico (evidência fraca): aluno, estudante, educação básica, rede de ensino. */
const WEAK_SCHOOL = /\b(ALUNOS|ESTUDANTES|EDUCANDOS|PROINFANCIA|EDUCACAO (INFANTIL|BASICA|ESPECIAL|INTEGRAL)|REDE (MUNICIPAL |ESTADUAL |PUBLICA )?DE ENSINO|UNIDADES? DE ENSINO|UNIDADES? EDUCACIONAIS?|PRE ESCOLA)\b/;

interface ObjRule { id: number; category: number; label: string; re: RegExp; /** exige contexto escolar no objeto */ needsSchool: boolean; /** aceita comprador de educação como contexto quando o objeto não traz contexto escolar */ buyerOk: boolean; /** categoria quando só o comprador sustenta (objeto genérico, possivelmente administrativo): 16 = contratação do órgão sem tema */ buyerCat?: number }
const R = (id: number, category: number, label: string, re: RegExp, needsSchool: boolean, buyerOk: boolean, buyerCat?: number): ObjRule => ({ id, category, label, re, needsSchool, buyerOk, ...(buyerCat ? { buyerCat } : {}) });
export const EDU_OBJECT_RULES: ObjRule[] = [
  R(101, 1, 'construção de unidade escolar', near('CONSTRUCAO|CONSTRUIR|OBRAS? DE CONSTRUCAO', '(ESCOLA|ESCOLAS|CRECHE|CRECHES|CMEI|CEMEI|EMEF|EMEI|EMEIF|EMUEF|EMUEI|EEEF|EEEFM|EEEM|CENTRO MUNICIPAL DE EDUCACAO INFANTIL|CENTRO DE EDUCACAO INFANTIL|CENTRO DE EDUCACAO BASICA|CENTRO ESTADUAL DE EDUCACAO|UNIDADE ESCOLAR|UNIDADES ESCOLARES|UNIDADE EDUCACIONAL|UNIDADE DE ENSINO|PROINFANCIA|COLEGIO)'), true, false),
  R(102, 2, 'reforma ou ampliação de unidade escolar', near('REFORMA|REFORMAS|AMPLIACAO|REVITALIZACAO|REQUALIFICACAO', '(ESCOLA|ESCOLAS|CRECHE|CRECHES|CMEI|CEMEI|EMEF|EMEI|EMEIF|EMUEF|EMUEI|EEEF|EEEFM|EEEM|CENTRO MUNICIPAL DE EDUCACAO INFANTIL|CENTRO DE EDUCACAO INFANTIL|CENTRO DE EDUCACAO BASICA|CENTRO ESTADUAL DE EDUCACAO|UNIDADE ESCOLAR|UNIDADES ESCOLARES|UNIDADE EDUCACIONAL|UNIDADES EDUCACIONAIS|UNIDADE DE ENSINO|COLEGIO)'), true, false),
  R(103, 3, 'manutenção predial de unidades escolares', near('MANUTENCAO|CONSERVACAO|REPAROS?|SERVICOS DE ENGENHARIA', '(ESCOLAS|UNIDADES ESCOLARES|UNIDADES DE ENSINO|UNIDADES EDUCACIONAIS|REDE (MUNICIPAL |ESTADUAL )?DE ENSINO|CRECHES|CMEIS|PREDIOS ESCOLARES)'), true, false),
  R(122, 2, 'reforma ou obra em prédio escolar', near('REFORMA|REFORMAS|AMPLIACAO|COBERTURA|REVISAO DA COBERTURA|REPAROS?', 'PREDIOS? ESCOLAR(ES)?'), false, false),
  R(123, 1, 'implantação de unidade escolar', /\bIMPLANTACAO (DE|DA|DO) (UMA? )?(NOVA )?(ESCOLA|CRECHE|CMEI|CEMEI|EMEF|EMEI|UNIDADE ESCOLAR|UNIDADE DE ENSINO)\b/, false, false),
  R(126, 6, 'software ou sistema de gestão em contexto escolar ou de órgão de educação', /\b(SOFTWARE|SISTEMA DE GESTAO|SAAS|LICENCA DE USO)\b/, true, true, 16),
  R(127, 10, 'material didático (intrinsecamente educacional)', /\b(MATERIAL DIDATICO|MATERIAIS DIDATICOS|LIVROS? DIDATICOS?|PNLD)\b/, false, false),
  R(121, 3, 'material de construção para unidades escolares ou órgão de educação', /\bMATCONSTR\b/, true, true),
  R(104, 4, 'mobiliário escolar', /\b(MOBILIARIOS? ESCOLAR(ES)?|MOVEIS ESCOLARES|MOVEIS PARA (ESCOLAS|ALUNOS)|CARTEIRAS? ESCOLAR(ES)?|CONJUNTOS? ALUNOS?|CONJUNTOS? (ESCOLAR(ES)?|ALUNO E PROFESSOR)|MESAS? (E CADEIRAS? )?(ESCOLAR(ES)?|PARA ALUNOS)|QUADROS? (ESCOLAR(ES)?|BRANCOS? ESCOLAR)|CADEIRAS? (ESCOLAR(ES)?|PARA ALUNOS)|ARMARIOS? ESCOLAR(ES)?)\b/, false, false),
  R(105, 4, 'mobiliário para unidade escolar ou órgão de educação', /\b(MOBILIARIO|MESAS?|CADEIRAS?|ARMARIOS?|ESTANTES?|QUADROS? (BRANCOS?|NEGROS?)|BERCOS?|COLCHONETES?|COLCHOES?)\b/, true, true, 16),
  R(106, 5, 'material ou equipamento pedagógico', /\b(MATERIAL PEDAGOGICO|MATERIAIS PEDAGOGICOS|JOGOS? (PEDAGOGICOS?|EDUCATIVOS?)|BRINQUEDOS? (PEDAGOGICOS?|EDUCATIVOS?)|BRINQUEDOTECA|KITS? (PEDAGOGICOS?|ESCOLAR(ES)?|DE ROBOTICA)|MATERIAL ESCOLAR|MATERIAIS ESCOLARES|MATERIAL EDUCATIVO|MATERIAIS EDUCATIVOS|MATERIAL EDUCACIONAL|INSTRUMENTOS? MUSICAIS?|LOUSAS?|PARQUINHOS?|PLAYGROUND)\b/, true, true),
  R(107, 6, 'tecnologia educacional (marcador educacional explícito)', /\b(LOUSAS? DIGITAIS?|NOTEBOOKS? EDUCACIONA\w+|TABLETS? (EDUCACIONA\w+|PARA (ALUNOS|PROFESSORES|ESTUDANTES))|LABORATORIOS? DE (INFORMATICA|CIENCIAS|ROBOTICA|MATEMATICA)|SALAS? DE (INFORMATICA|TECNOLOGIA)|PLATAFORMA EDUCACIONAL|SOFTWARE EDUCACIONAL|SISTEMA DE GESTAO ESCOLAR)\b/, false, false),
  R(120, 6, 'equipamento de informática em unidade escolar ou órgão de educação', /\b(COMPUTADORES?|NOTEBOOKS?|TABLETS?|CHROMEBOOKS?|PROJETORES?|MICROCOMPUTADORES?|EQUIPAMENTOS? DE (INFORMATICA|TECNOLOGIA)|IMPRESSORAS?)\b/, true, true, 16),
  R(108, 7, 'internet e conectividade escolar', /\b(CONECTIVIDADE|LINK DE INTERNET|ACESSO A INTERNET|INTERNET|REDE (WIRELESS|WI FI|WIFI|LOCAL)|CABEAMENTO ESTRUTURADO|ACCESS POINTS?)\b/, true, true, 16),
  R(109, 8, 'alimentação escolar', /\b(MERENDA|MERENDAS|ALIMENTACAO ESCOLAR|PNAE|LEI (N )?11[ .]?947|REFEICOES? (PARA )?(ALUNOS|ESCOLAS|ESCOLAR))\b/, false, false),
  R(125, 8, 'agricultura familiar sem contexto escolar explícito (possível PNAE; pode ser PAA ou programa municipal)', /\bAGRICULTURA FAMILIAR\b/, false, false),
  R(110, 8, 'gêneros alimentícios para unidades escolares ou órgão de educação', /\b(GENEROS ALIMENTICIOS|ALIMENTOS|HORTIFRUTI\w*|HORTIGRANJEIROS?|CARNES?|FRANGO|LEITE|PAES?|OVOS|FRUTAS?|VERDURAS?|HORTALICAS|ARROZ|FEIJAO|MACARRAO|BISCOITOS?|BOLACHAS?|SUCOS?|POLPAS?|LATICINIOS|PROTEINA|GAS DE COZINHA|GLP|REFEICOES?|ALIMENTACAO PREPARADA|KIT ALIMENTAR|COZINHA INDUSTRIAL)\b/, true, true),
  R(111, 9, 'transporte escolar', /\b(TRANSPORTE (AUTOMOTIVO )?ESCOLAR|FROTA ESCOLAR|VEICULOS? ESCOLAR(ES)?|TRANSPORTE DOS? (ALUNOS|ESTUDANTES)|PNATE|TRANSPORTE DE (ALUNOS|ESTUDANTES|EDUCANDOS)|ONIBUS ESCOLAR(ES)?|VEICULOS? (DE )?TRANSPORTE ESCOLAR|ROTAS? ESCOLAR(ES)?|CONDUCAO ESCOLAR|TRANSPORTE DE PASSAGEIROS ESTUDANTES|CARTAO (DE )?(PASSE )?ESCOLAR|PASSE ESCOLAR)\b/, false, false),
  R(112, 9, 'transporte e locação de veículos para órgão de educação', /\b(TRANSPORTE DE|SERVICOS? DE TRANSPORTE|FRETAMENTO|ONIBUS|MICRO ONIBUS|VANS?|LOCACAO DE VEICULOS?|VEICULOS? (TIPO )?(VAN|ONIBUS))\b/, true, true, 16),
  R(113, 10, 'material didático', /\b(MATERIAL DIDATICO|MATERIAIS DIDATICOS|LIVROS? DIDATICOS?|PNLD|SISTEMAS? (DE|APOSTILADO)\b.{0,25}\bENSINO|APOSTILAS?|ACERVO (LITERARIO|BIBLIOGRAFICO)|LIVROS? PARADIDATICOS?|LITERATURA INFANTIL|COLECAO DE LIVROS|LIVROS?|OBRAS LITERARIAS)\b/, true, true),
  R(114, 11, 'uniformes escolares', /\b(UNIFORMES? ESCOLAR(ES)?|KITS? UNIFORMES?|FARDAMENTOS?( PERSONALIZADOS?)? ESCOLAR(ES)?|UNIFORMES?|CALCADOS? ESCOLAR(ES)?|MOCHILAS?)\b/, true, true),
  R(115, 12, 'serviço educacional', /\b(FORMACAO CONTINUADA|CAPACITACAO\b.{0,40}\b(PROFESSORES|DOCENTES|PROFISSIONAIS DA EDUCACAO)|SERVICOS? EDUCACIONAIS?|CURSOS?\b.{0,25}\b(EJA|ALFABETIZACAO)|MONITOR(ES)? ESCOLAR(ES)?|PROFISSIONAIS? DE APOIO ESCOLAR|SERVICOS? DE APOIO ESCOLAR|PROJETOS? ESCOLAR(ES)?|PSICOLOGIA ESCOLAR|PSICOPEDAGOG\w+|CONSORCIO INTERMUNICIPAL DE EDUCACAO|CUIDADOR(ES)? ESCOLAR(ES)?|MEDIADOR(ES)? ESCOLAR(ES)?|AULAS? DE (MUSICA|ESPORTES|IDIOMAS|INGLES|ROBOTICA|DANCA|ARTES)|ATIVIDADES (EXTRACURRICULARES|PEDAGOGICAS|COMPLEMENTARES)|EDUCACAO INCLUSIVA|ATENDIMENTO EDUCACIONAL ESPECIALIZADO|PROGRAMA (EDUCACIONAL|DE ALFABETIZACAO)|ASSESSORIA PEDAGOGICA|AVALIACAO (EDUCACIONAL|DA APRENDIZAGEM))\b/, true, true),
  R(116, 13, 'limpeza, vigilância e terceirização em unidades escolares', near('LIMPEZA|CONSERVACAO|VIGILANCIA|PORTARIA|MERENDEIROS?|MERENDEIRAS?|COPEIRAGEM|SERVICOS GERAIS|AGENTES? DE (LIMPEZA|PORTARIA|APOIO)|MAO DE OBRA|TERCEIRIZACAO|JARDINAGEM|DEDETIZACAO|CAIXA D AGUA|DESINSETIZACAO|CONTROLE DE PRAGAS', '(ESCOLAS|UNIDADES ESCOLARES|UNIDADES DE ENSINO|UNIDADES EDUCACIONAIS|REDE (MUNICIPAL |ESTADUAL )?DE ENSINO|CRECHES|CMEIS|PREDIOS ESCOLARES|ESCOLAR|ESCOLARES)'), true, false),
  R(117, 13, 'limpeza, vigilância e terceirização para órgão de educação', /\b(LIMPEZA|VIGILANCIA|PORTARIA|MERENDEIR\w+|COPEIRAGEM|SERVICOS GERAIS|AGENTES? DE (LIMPEZA|PORTARIA|APOIO)|MAO DE OBRA|TERCEIRIZACAO|JARDINAGEM|DEDETIZACAO|DESINSETIZACAO|CONTROLE DE PRAGAS|DESRATIZACAO)\b/, true, true, 16),
  R(118, 14, 'infraestrutura esportiva escolar', /\b(QUADRAS? (POLIESPORTIVAS?|ESCOLAR(ES)?|ESPORTIVAS?)|COBERTURAS? DE QUADRAS?|GINASIOS? (ESCOLAR(ES)?|POLIESPORTIVO)|MATERIAL ESPORTIVO|EQUIPAMENTOS? ESPORTIVOS?|GRAMADO SINTETICO|ARQUIBANCADAS?|PISCINAS?)\b/, true, true),
  R(119, 15, 'acessibilidade escolar', /\b(ACESSIBILIDADE|RAMPAS?|ELEVADORES?|PLATAFORMAS? ELEVATORIAS?|TECNOLOGIA ASSISTIVA|SALAS? DE RECURSOS MULTIFUNCIONAIS|BRAILLE|CADEIRAS? DE RODAS|PISO TATIL|BANHEIROS? ADAPTADOS?)\b/, true, true),
];

/** Locação/cessão de imóvel e conserto de móveis: não são obra nem reforma predial. */
const LEASE = /\b(LOCACAO|CESSAO|SUBLOCACAO|ALUGUEL) (DE|DO|DA|DE UM|DE UMA) (IMOVEL|IMOVEIS|ESPACO|PREDIO|SALA|SALAS|TERRENO)\b|\bAQUISICAO DE (UM )?TERRENO\b/;
const FURNITURE_FIX = /\bREFORMA (EM|DE|DAS?|DOS?) (CAPAS?|COLCHONETES?|COLCHOES|ARMARIOS?|MOVEIS|CADEIRAS?|BEBEDOUROS?|MESAS?)\b/;
/** Regras cujo achado é educacional por si (merenda, mobiliário/transporte/material didático escolar): não são barradas pela guarda de comprador de outro setor. */
const INTRINSIC_RULES: ReadonlySet<number> = new Set([104, 109, 111, 113, 127]);
const OBRA_RULES: ReadonlySet<number> = new Set([101, 102, 103, 122, 123]);
const OBRA_VERB = /\b(REFORMA|REFORMAS|PINTURA|CONSTRUCAO|AMPLIACAO|ELETRIC\w+|COBERTURA|MURO|INSTALACAO|TROCA|PISO|REVESTIMENTO|OBRA|OBRAS)\b/;
/** Menção à secretaria de educação no próprio objeto (contexto escolar quando o comprador é a prefeitura). */
const EDU_SECRETARIA_OBJ = /\bSECRETARIA\b[A-Z ]{0,25}\bEDUCACAO\b/;
/** Objeto que atende vários setores/órgãos, e não só educação. */
const MIXED_ANY = /\b(SECRETARIAS|HOSPITAL|HOSPITAIS|UNIDADES? (BASICAS? )?DE SAUDE|DEMAIS (ORGAOS|SETORES)|PAVIMENTACAO|ASFALTIC\w+|ILUMINACAO PUBLICA|DEMANDA DO MUNICIPIO)\b/;
const MIXED_OBJ = /\b(VARIOS|DIVERSOS|DIVERSAS|TODOS OS|DEMAIS) (SETORES|DEPARTAMENTOS|ORGAOS|SECRETARIAS)\b|\bSECRETARIAS (MUNICIPAIS|DE (SAUDE|ASSISTENCIA|OBRAS|ADMINISTRACAO))\b|\bDIRETORIAS MUNICIPAIS\b|\bSERVIDORES PUBLICOS\b|\bADMINISTRACAO MUNICIPAL\b|\bSECRETARIA\b[A-Z ]{0,25}\b(SAUDE|ASSISTENCIA SOCIAL|OBRAS|ADMINISTRACAO|ESPORTE|AGRICULTURA)\b/;
/** Tribunal, câmara, assembleia, defensoria, ministério público, comando militar: só entram com unidade escolar básica nomeada. */
const LEGAL_BUYER = /\b(TRIBUNAL|CAMARA (MUNICIPAL|DE VEREADORES|LEGISLATIVA)|ASSEMBLEIA|DEFENSORIA|MINISTERIO PUBLICO|PODER JUDICIARIO|PROCURADORIA|CONSELHO REGIONAL|COMANDO)\b/;
/** Comprador de outro setor (saúde, assistência, obras…). */
const OTHER_BUYER = /\b(FUNDO|SECRETARIA|DIVISAO|DEPARTAMENTO|DIRETORIA)\b[A-Z ]{0,30}\b(SAUDE|ASSISTENCIA SOCIAL|AGRICULTURA|OBRAS|ESPORTES?|TURISMO|ADMINISTRACAO|FAZENDA|MEIO AMBIENTE)\b/;

/** Regras cujo achado é sempre POSSIBLE_EDUCATION (palavra com mais de um programa possível). */
const WEAK_RULES: ReadonlySet<number> = new Set([125]);
export interface EduClass { category: number; via: number; rule: number; confidence: number; evidence: string }
export interface EduClassification { buyer: number; superior: boolean; classes: EduClass[]; excluded: boolean }
const snippet = (t: string, re: RegExp): string => { const m = re.exec(t); return m ? m[0].slice(0, 80) : ''; };

/** Classifica um contrato (objeto + comprador). `classes` vazio = não é educação com evidência suficiente (não é persistido). */
export function classifyEducationContract(objeto: string, razaoSocial: string, unidade: string, esfera: string): EduClassification {
  const b = classifyBuyer(razaoSocial, unidade, esfera); const raw = norm(objeto);
  if (b.superior) return { buyer: 0, superior: true, classes: [], excluded: false };
  const t = raw.replace(/\bMATERIA(L|IS) DE CONSTRUCAO\b/g, 'MATCONSTR')   // "material de construção" não é "construção de escola"
    .replace(/\b(EQUIPAMENTOS?|MAQUINAS?) DE CONSTRUCAO( CIVIL)?\b/g, 'EQCONSTR').replace(/\b(EMPRESA|ENGENHARIA|ESPECIALIZADA|RAMO|SERVICOS?) (EM|DE|DA|DO) CONSTRUCAO CIVIL\b/g, 'CONSTRCIVIL')
    .replace(/\bMANUTENCAO (DA|DO|DE|DAS|DOS) (MERENDA|ALIMENTACAO|ENSINO|REDE ESCOLAR|REDE MUNICIPAL DE ENSINO|ATIVIDADES|PROGRAMA|BANDAS?|VEICULOS?|ONIBUS|MICRO ONIBUS|COMPUTADORES|FROTA)\b/g, 'MANUTSEMPREDIO $2')   // manutenção do ensino/merenda/veículo não é manutenção predial
    .replace(/\bMAO DE OBRA\b/g, m => OBRA_VERB.test(raw) ? 'MDO' : m);   // mão de obra de reforma/pintura não é terceirização (cat. 13)
  const strong = STRONG_SCHOOL.test(t); const weak = WEAK_SCHOOL.test(t);
  const superiorObj = OBJ_SUPERIOR.test(t) && !/\b(ESCOLA (MUNICIPAL|ESTADUAL|PADRAO)|EMEF|EMEI|CMEI|CRECHE)\b/.test(t);
  const excluded = OBJ_EXCL.test(t) || superiorObj; const hasSchool = SCHOOL_RE.test(t) || (EDU_SECRETARIA_OBJ.test(t) && !MIXED_OBJ.test(t)); const out = new Map<number, EduClass>();
  const otherBuyer = b.kind === 0 && !hasSchool && (OTHER_BUYER.test(`${norm(razaoSocial)} ${norm(unidade)}`) || LEGAL_BUYER.test(norm(razaoSocial)));   // fundo/secretaria de saúde, assistência, obras… sem contexto escolar
  const mixed = (b.kind > 0 && !SCHOOL_RE.test(t) && MIXED_OBJ.test(t)) || MIXED_ANY.test(t);   // comprador de educação, objeto para vários setores ⇒ só POSSIBLE
  const add = (c: EduClass) => { const cur = out.get(c.category); if (!cur || c.confidence < cur.confidence || (c.confidence === cur.confidence && c.via > cur.via)) out.set(c.category, c); };
  if (!excluded) {
    for (const r of EDU_OBJECT_RULES) {
      if (!r.re.test(t)) continue;
      if (otherBuyer && !INTRINSIC_RULES.has(r.id)) continue;
      if (OBRA_RULES.has(r.id) && (LEASE.test(t) || FURNITURE_FIX.test(t))) continue;
      const m = snippet(t, r.re); const buyerCtx = b.kind > 0;
      if (r.needsSchool && !(hasSchool || (r.buyerOk && buyerCtx))) continue;
      const confirmed = b.confirmed && buyerCtx;
      const viaObj = r.needsSchool ? hasSchool : true;
      const via = viaObj && buyerCtx ? 3 : buyerCtx ? 1 : 2;
      const confidence = confirmed ? EDU_CONFIDENCE.CONFIRMED_OFFICIAL : mixed || WEAK_RULES.has(r.id) ? EDU_CONFIDENCE.POSSIBLE_EDUCATION : EDU_CONFIDENCE.HIGH_CONFIDENCE_DERIVED;
      const category = !hasSchool && buyerCtx && r.buyerCat ? r.buyerCat : r.category;
      add({ category, via, rule: r.id, confidence, evidence: m });
    }
    // sem regra temática e sem comprador de educação: unidade escolar NOMEADA no objeto (evidência forte) ou marcador educacional genérico (fraco)
    if (!out.size && b.kind === 0 && !otherBuyer) {
      if (strong) out.set(16, { category: 16, via: 2, rule: 191, confidence: mixed ? EDU_CONFIDENCE.POSSIBLE_EDUCATION : EDU_CONFIDENCE.HIGH_CONFIDENCE_DERIVED, evidence: snippet(t, STRONG_SCHOOL) });
      else if (weak) out.set(16, { category: 16, via: 2, rule: 190, confidence: EDU_CONFIDENCE.POSSIBLE_EDUCATION, evidence: snippet(t, WEAK_SCHOOL) });
    }
  }
  if (!out.size && b.kind > 0 && !excluded) {
    out.set(16, { category: 16, via: 1, rule: 100 + b.kind, confidence: b.confirmed ? EDU_CONFIDENCE.CONFIRMED_OFFICIAL : mixed ? EDU_CONFIDENCE.POSSIBLE_EDUCATION : EDU_CONFIDENCE.HIGH_CONFIDENCE_DERIVED, evidence: EDU_BUYER[b.kind]!.slice(0, 80) });
  }
  return { buyer: b.kind, superior: false, classes: [...out.values()].sort((a, c) => a.category - c.category), excluded };
}

/** Saneamento do objeto: CPF mascarado em qualquer contrato; em contrato com pessoa física, o nome do contratado (campo do fornecedor) também é mascarado. */
export function sanitizeObjeto(text: string, supplierName: string | null | undefined, isPj: boolean): string {
  let t = (text ?? '').replace(/\s+/g, ' ').trim().replace(/\b\d{3}[. ]?\d{3}[. ]?\d{3}[-. ]?\d{2}\b/g, '[CPF]');
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!isPj && supplierName && supplierName.trim().length > 4) {
    t = t.replace(new RegExp(esc(supplierName.trim()).replace(/\s+/g, '\\s+'), 'gi'), '[pessoa física]');
    for (const part of supplierName.trim().split(/\s+/).filter(w => w.length > 3 && !/^(DOS|DAS|DE|DA|DO)$/i.test(w))) t = t.replace(new RegExp(`\\b${esc(part)}\\b`, 'gi'), '[pessoa física]');
  }
  return t.slice(0, 1000);
}
export type EduContractDrop = 'nao_educacao' | 'ensino_superior' | 'sem_cnpj_orgao' | 'sem_ente';
export interface EduContractRow extends Row { pncp_id: string }
export interface EduContractBuild { row: Row; classes: Row[]; supplier: { cnpj: number; name: string } | null }
export type EduPncpContract = PncpContract & {
  numeroControlePncpCompra?: string | null; sequencialContrato?: number | null; valorAcumulado?: number | null; dataVigenciaInicio?: string | null; dataVigenciaFim?: string | null;
  niFornecedor?: string | null; nomeRazaoSocialFornecedor?: string | null; tipoPessoa?: string | null; informacaoComplementar?: string | null; identificadorCipi?: string | null;
};
/** Valor negativo no PNCP (erro de digitação na origem, ex.: valorAcumulado = -2.058,77) não é representável como contratado: vira NULL (conta como "sem valor"). */
const cents = (v: number | null | undefined): number | null => v == null || !Number.isFinite(v) || v < 0 ? null : Math.round(v * 100);
const day = (s: string | null | undefined): string | null => s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;

/** Constrói a linha do contrato educacional e suas classificações. O objeto é texto público do contrato (limitado a 1.000 caracteres); pessoa física nunca é persistida. */
export function buildEduContract(c: EduPncpContract, year: number, ctx: ContractCtx): EduContractBuild | { drop: EduContractDrop } {
  const org = c.orgaoEntidade ?? {}; const un = c.unidadeOrgao ?? {}; const esfera = (org.esferaId ?? '').toUpperCase();
  const cl = classifyEducationContract(c.objetoContrato ?? '', org.razaoSocial ?? '', un.nomeUnidade ?? '', esfera);
  if (cl.superior) return { drop: 'ensino_superior' };
  if (!cl.classes.length) return { drop: 'nao_educacao' };
  if (!/^\d{14}$/.test(org.cnpj ?? '')) return { drop: 'sem_cnpj_orgao' };
  const ufC = un.ufSigla ? ctx.ufCode(un.ufSigla.toUpperCase()) : undefined; const ibge = Number(un.codigoIbge);
  let entity: number | undefined;
  if (esfera === 'F') entity = ctx.brEntity; else if (esfera === 'M') entity = Number.isInteger(ibge) ? ctx.entityByIbge7.get(ibge) : undefined; else if (esfera === 'E' || esfera === 'D') entity = ufC ? ctx.entityByUf.get(ufC) : undefined;
  if (entity === undefined) return { drop: 'sem_ente' };
  const isPj = (c.tipoPessoa ?? '').toUpperCase() === 'PJ' && /^\d{14}$/.test(c.niFornecedor ?? '');
  const tipo = Number(c.tipoContrato?.id ?? 0); const best = cl.classes.reduce((a, x) => x.confidence < a ? x.confidence : a, 9);
  const vg = cents(c.valorGlobal);
  const row: Row = {
    pncp_id: c.numeroControlePNCP, year, uf: ufC ?? 0, entity_id: entity, esfera: esfera || '?', org_cnpj: Number(org.cnpj), buyer: cl.buyer, best_confidence: best,
    tipo, categoria: Number(c.categoriaProcesso?.id ?? 0), valor_global: vg, valor_inicial: cents(c.valorInicial), valor_acumulado: cents(c.valorAcumulado), outlier: vg != null && vg > PNCP_VALUE_OUTLIER_CENTS,
    signed: day(c.dataAssinatura), vig_start: day(c.dataVigenciaInicio), vig_end: day(c.dataVigenciaFim), supplier: isPj ? Number(c.niFornecedor) : null, empenho: tipo === 7 && c.numeroContratoEmpenho ? c.numeroContratoEmpenho : null,
    retif: Number(c.numeroRetificacao ?? 0), compra: c.numeroControlePncpCompra ?? null, cipi: c.identificadorCipi && c.identificadorCipi.trim() ? c.identificadorCipi.trim().slice(0, 40) : null, seq: Number(c.sequencialContrato ?? 0), objeto: sanitizeObjeto(c.objetoContrato ?? '', c.nomeRazaoSocialFornecedor, isPj),
  };
  return {
    row, classes: cl.classes.map(x => ({ pncp_id: c.numeroControlePNCP, year, uf: ufC ?? 0, entity_id: entity, esfera: esfera || '?', valor: vg, outlier: vg != null && vg > PNCP_VALUE_OUTLIER_CENTS, category: x.category, via: x.via, rule: x.rule, confidence: x.confidence, evidence: x.evidence })),
    supplier: isPj ? { cnpj: Number(c.niFornecedor), name: (c.nomeRazaoSocialFornecedor ?? '').slice(0, 200) } : null,
  };
}
