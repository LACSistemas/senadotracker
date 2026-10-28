'use client';

import { fmt } from '@/lib/security/format';
import { DataExplorer, type ExplorerColumn } from './data-explorer';

/** Linhas cruas devolvidas pelas rotas /api/educacao/*: nomes de coluna exatamente como o SQL devolve (snake_case). */
export type IesRow = { co_ies: number; name: string; sigla: string | null; uf: string; tp_rede: number | null; qt_doc_total: number | null };
export type CourseRow = { nome_curso: string; uf: string; tp_modalidade: number; enrollments: number | null; graduates: number | null; vacancies: number | null };
export type QualityRow = { course_name: string; area_name: string; reference_year: number; band: number | null; uf: string };
export type ProgramRow = { current_name: string; institution_name: string | null; institution_sigla: string | null; municipality_name: string | null; degree: string; situation: string; concept: string | null };

const cap = (s: string | null | undefined): string => !s ? '—' : s.toLowerCase().replace(/(^|\s|\/)\p{L}/gu, c => c.toUpperCase());
const num = (v: number | null | undefined): string => v == null ? '—' : fmt(v);

export const IES_COLUMNS: ExplorerColumn<IesRow>[] = [
  { key: 'name', label: 'Instituição' }, { key: 'sigla', label: 'Sigla', render: r => r.sigla ?? '—' }, { key: 'uf', label: 'UF' },
  { key: 'tp_rede', label: 'Rede', render: r => r.tp_rede === 1 ? 'Pública' : r.tp_rede === 2 ? 'Privada' : '—' },
  { key: 'qt_doc_total', label: 'Docentes', align: 'right', render: r => num(r.qt_doc_total) },
];

export const COURSE_COLUMNS: ExplorerColumn<CourseRow>[] = [
  { key: 'nome_curso', label: 'Curso' }, { key: 'uf', label: 'UF' },
  { key: 'tp_modalidade', label: 'Modalidade', render: r => r.tp_modalidade === 1 ? 'Presencial' : r.tp_modalidade === 2 ? 'A distância' : '—' },
  { key: 'enrollments', label: 'Matrículas', align: 'right', render: r => num(r.enrollments) }, { key: 'graduates', label: 'Concluintes', align: 'right', render: r => num(r.graduates) },
];

export const QUALITY_COLUMNS: ExplorerColumn<QualityRow>[] = [
  { key: 'course_name', label: 'Curso' }, { key: 'area_name', label: 'Área' }, { key: 'uf', label: 'UF' }, { key: 'reference_year', label: 'Ciclo' },
  { key: 'band', label: 'Faixa (Enade)', render: r => r.band == null ? '—' : `Faixa ${r.band} de 5` },
];

export const PROGRAM_COLUMNS: ExplorerColumn<ProgramRow>[] = [
  { key: 'current_name', label: 'Programa' }, { key: 'institution_name', label: 'Instituição', render: r => r.institution_sigla ? `${r.institution_name} (${r.institution_sigla})` : (r.institution_name ?? '—') },
  { key: 'municipality_name', label: 'Município', render: r => r.municipality_name ?? '—' }, { key: 'degree', label: 'Nível', render: r => cap(r.degree) },
  { key: 'situation', label: 'Situação', render: r => cap(r.situation) }, { key: 'concept', label: 'Conceito', render: r => r.concept ?? '—' },
];

/**
 * As colunas trazem funções de formatação, que não cruzam a fronteira servidor→cliente como prop: por isso cada
 * capítulo (Server Component) recebe só o `entityId` e estes componentes-wrapper já embutem a configuração certa.
 */
export function IesExplorer({ entityId }: { entityId: number }) {
  return <DataExplorer title="Buscar instituições" endpoint="/api/educacao/ies" entityId={entityId} columns={IES_COLUMNS} fileSlug="ies" placeholder="Nome da instituição" emptyText="Nenhuma instituição encontrada para esta busca." />;
}
export function CourseExplorer({ entityId }: { entityId: number }) {
  return <DataExplorer title="Buscar cursos" endpoint="/api/educacao/cursos" entityId={entityId} columns={COURSE_COLUMNS} fileSlug="cursos" placeholder="Nome do curso" emptyText="Nenhum curso encontrado para esta busca." />;
}
export function QualityExplorer({ entityId }: { entityId: number }) {
  return <DataExplorer title="Buscar cursos avaliados (Conceito Enade)" endpoint="/api/educacao/qualidade" entityId={entityId} columns={QUALITY_COLUMNS} fileSlug="qualidade" placeholder="Nome do curso ou área" emptyText="Nenhum curso avaliado encontrado para esta busca." />;
}
export function ProgramExplorer({ entityId }: { entityId: number }) {
  return <DataExplorer title="Buscar programas de pós-graduação" endpoint="/api/educacao/programas" entityId={entityId} columns={PROGRAM_COLUMNS} fileSlug="programas" placeholder="Nome do programa ou instituição" emptyText="Nenhum programa encontrado para esta busca." />;
}
