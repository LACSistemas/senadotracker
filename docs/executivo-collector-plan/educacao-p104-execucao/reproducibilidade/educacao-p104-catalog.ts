import { writeFile } from 'node:fs/promises';
import {
  FLOW_METRIC_LABEL, FLOW_SCALE, FLOW_SEG_LABEL, IDEB_LABELS, IDEB_MEASURES, INSE_LEVEL_COLS, INSE_MEDIA_SCALE, INSE_SCALE, SAEB_LEVEL_COLS, SAEB_SCALE, TDI_COLS, TRN_COLS, TXR_COLS,
} from '../../packages/db/src/exec/index.ts';

/** Gera o CATALOGO_INDICADORES_APRENDIZAGEM.csv da P10.4 a partir dos catálogos do código (uma linha por medida gravada). */
const out = process.argv[2]!;
const csv = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const rows: string[][] = [];
const add = (...c: unknown[]) => rows.push(c.map(x => String(x ?? '')));
const IDEB_CMP = 'Metodologia inalterada desde 2007 (Nota Informativa do Ideb 2025); 2023 e 2025 sem meta; 2005 só em agregados e em escolas que existem de 2007 em diante; 2021 pandemia (Saeb 2021 com participação atípica)';
for (const m of IDEB_MEASURES) add('ideb', m, IDEB_LABELS[m], 'etapa: anos iniciais, anos finais, ensino médio', m === 'p' ? '0–1' : m.startsWith('nota_m') || m === 'nota_lp' ? 'escala Saeb 0–500' : m === 'nota_media' || m === 'ideb' || m === 'meta' ? '0–10' : '%', 'double precision (sem perda)', 'exec_edu_ideb_school; exec_edu_ideb_terr', 1, '2005–2025 (11 edições bienais; meta 2007–2021)', IDEB_CMP);
const SAEB_CMP = 'Escala própria por série × disciplina; 2º ano (alfabetização) com escalas diferentes em 2021 e 2023; sem comparar escalas entre séries ou disciplinas; 2017 LP 5º ano só tem níveis 1–9';
add('saeb', 'media', 'Proficiência média (escala Saeb)', 'série (2, 5, 9, 12–14) × disciplina (LP, MT, CH, CN) × rede × localização × capital', 'pontos', 'integer ×100', 'exec_edu_saeb_terr', SAEB_SCALE, '2017–2025', SAEB_CMP);
add('saeb', 'tx_alf', 'Alfabetização (2º ano; TX 2021, PC 2023)', '2º ano, LP', '%', 'smallint ×100', 'exec_edu_saeb_terr', SAEB_SCALE, '2021, 2023', 'Conceitos e escalas diferentes entre 2021 (TX_ALFABETIZADO) e 2023 (PC_ALFABETIZADO)');
for (const c of SAEB_LEVEL_COLS) add('saeb', c, `% de estudantes no nível ${c.slice(2)} da escala da série × disciplina`, 'série × disciplina', '%', 'smallint ×100', 'exec_edu_saeb_terr', SAEB_SCALE, '2017–2025', 'Os níveis variam por série × disciplina e edição; soma ≈ 100 (2017 LP 5º ano sem nível 0)');
const split = (c: string) => [c.slice(0, c.indexOf('_')), c.slice(c.indexOf('_') + 1)] as const;
const FLOW_CMP = 'Ensino fundamental de 9 anos (f1 = 1º ano); em 2007–2009 o INEP publica 8 e 9 anos e "1ª série/2º ano" é gravado como f2; rendimento do ano Y é do Censo de Y';
for (const c of TXR_COLS) { const [m, s] = split(c); add('rendimento', c, `${FLOW_METRIC_LABEL[m]} — ${FLOW_SEG_LABEL[s]}`, FLOW_SEG_LABEL[s], '%', 'smallint ×100', 'exec_edu_flow_school; exec_edu_flow_terr', FLOW_SCALE, '2007–2025', FLOW_CMP + '; aprovação + reprovação + abandono ≈ 100'); }
for (const c of TDI_COLS) { const [m, s] = split(c); add('distorcao', c, `${FLOW_METRIC_LABEL[m]} — ${FLOW_SEG_LABEL[s]}`, FLOW_SEG_LABEL[s], '%', 'smallint ×100', 'exec_edu_flow_school; exec_edu_flow_terr', FLOW_SCALE, '2006–2025 (escola 2007–2025)', FLOW_CMP + '; matrículas com 2 anos ou mais de atraso'); }
for (const c of TRN_COLS) { const [m, s] = split(c); add('transicao', c, `${FLOW_METRIC_LABEL[m]} — ${FLOW_SEG_LABEL[s]}`, FLOW_SEG_LABEL[s], '%', 'smallint ×100', 'exec_edu_trn_terr', FLOW_SCALE, '2007/2008–2021/2022 (year = ano de origem)', 'Transição do Censo Y para o Censo Y+1; só município, UF, região e Brasil; promoção + repetência + evasão + migração para a EJA ≈ 100'); }
add('inse', 'qtd', 'Alunos com INSE calculado', 'escola ou território × rede × localização × capital', 'alunos (agregado)', 'integer', 'exec_edu_inse_school; exec_edu_inse_terr', 1, '2019, 2021, 2023', 'Escala de 2019 ≠ 2021/2023');
add('inse', 'media', 'Média do INSE', 'idem', 'pontos', 'integer ×10000', 'exec_edu_inse_school; exec_edu_inse_terr', INSE_MEDIA_SCALE, '2019, 2021, 2023', 'Escala de 2019 ≠ 2021/2023; 2019 sem escala interpretativa por município/UF');
add('inse', 'cls', 'Classificação do INSE da escola (nível I–VIII)', 'escola', 'nível 1–8', 'smallint', 'exec_edu_inse_school', 1, '2019, 2021, 2023', 'Idem');
for (const c of INSE_LEVEL_COLS) add('inse', c, `% de estudantes no nível ${c.slice(2)} do INSE`, 'escola ou território', '%', 'smallint ×100', 'exec_edu_inse_school; exec_edu_inse_terr', INSE_SCALE, '2019, 2021, 2023', 'Idem');
const head = ['familia', 'codigo', 'rotulo', 'recorte', 'unidade', 'armazenamento', 'tabelas', 'escala_gravacao', 'edicoes', 'comparabilidade'];
await writeFile(out, [head, ...rows].map(r => r.map(csv).join(',')).join('\n') + '\n');
console.log(rows.length);
