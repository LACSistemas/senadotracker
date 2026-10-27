import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const page = readFileSync('apps/web/components/education/education-page.tsx', 'utf8');
const loader = readFileSync('apps/web/lib/education/load.ts', 'utf8');
const serving = readFileSync('packages/db/src/exec/educacao-serving-read.ts', 'utf8');

test('P10.10: rotas estaduais e municipais usam o mesmo contrato visual', () => {
  assert.ok(existsSync('apps/web/app/estados/[uf]/educacao/page.tsx'));
  assert.ok(existsSync('apps/web/app/municipios/[ibge]/educacao/page.tsx'));
  assert.match(page, /EducationPage/);
  assert.match(loader, /getEducationOverview/);
  assert.match(loader, /getEducationSeries/);
});

test('P10.10: interface preserva ausência, cobertura e semântica financeira', () => {
  assert.match(page, /não é tratada como zero/);
  assert.match(page, /fontes separadas/);
  assert.match(page, /contrato observado não prova/i);
  assert.match(page, /Valores ausentes permanecem como lacunas/);
  assert.doesNotMatch(page, /https?:\/\//);
});

test('P10.10: cliente não acessa fontes externas nem o PostgreSQL', () => {
  assert.doesNotMatch(page, /webPostgresPool|fetch\(/);
});

test('P10.10: hover e medianas municipais preservam o contexto da comparação', () => {
  assert.match(page, /Passe o cursor ou use Tab/);
  assert.match(page, /BenchmarkStrip/);
  assert.match(page, /LearningComparisonChart/);
  assert.match(page, /enrollmentComparisonPoints/);
  assert.match(page, /teacherComparisonPoints/);
  assert.match(page, /índice base 100/);
  assert.match(page, /referência estadual e nacional/);
  assert.match(loader, /idebBenchmarks/);
  assert.match(loader, /offerBenchmarks/);
  assert.match(loader, /teacherBenchmarks/);
  assert.match(serving, /percentile_cont\(0\.5\)/);
  assert.match(serving, /medians/);
  assert.match(serving, /stateSample/);
});
