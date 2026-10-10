import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { temporalPhrase } from '../../packages/domain/src/temporal.ts';
import { classifyAuthorship, actorKindFromCamaraTipoAutor } from '../../packages/domain/src/authorship.ts';

/** Regressões de /legislativo/proposicoes: universo por presentedYear, suporte fora, soma por Casa, composição, ritmo, autoria e textos. */
const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);

test('números de /proposicoes: presentedYear inclui ano do número nulo, suporte fica fora, somas e ritmo reconciliam', { skip: !hasDb && 'requer o PostgreSQL local (DB_*)', timeout: 180_000 }, () => {
  // as asserções relacionais vivem no script (rodam contra o SQL do catálogo); aqui garantimos que passam e inspecionamos o resumo
  const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-overview-numbers.ts'], { encoding: 'utf8', env: process.env, cwd: process.cwd() });
  assert.equal(run.status, 0, run.stderr.split('\n').filter(l => !/ExperimentalWarning|trace-warnings/.test(l)).slice(0, 12).join('\n'));
  const out = JSON.parse(run.stdout.trim().split('\n').at(-1)!);
  assert.equal(out.congress, out.camara + out.senado);
  assert.equal(out.camara, out.sql.camara); assert.equal(out.senado, out.sql.senado);
  assert.ok(out.sql.identifierNullPresented > 0, 'presentedYear inclui identifierYear NULL');
  assert.equal(out.checks.supportIdsInCatalog, 0, 'proposal_support não entra'); assert.equal(out.checks.duplicates, 0, 'sem external_id duplicado');
  assert.deepEqual(out.rhythm.totals, [out.camara, out.senado]);
  assert.ok(out.camaraGroups.pareceres_relatorios > out.sql.pareceresByIdentifier * 10, 'pareceres sem ano entram em 2026 por presentedYear');
  assert.equal(out.dna.rowsWithPareceres, 0, 'relatoria/parecer não entra na autoria do DNA'); assert.equal(out.dna.rowsWithInstrumentos, 0);
  assert.ok(out.plan.usesPresentedYearIndex, 'consulta por presentedYear usa o índice');
  assert.equal(out.basis.flow, 'identifier_year'); assert.equal(out.basis.rhythmEvents, 'identifier_year');
});

test('autoria legislativa não inclui relatoria: PRL do Altineu é relatoria, PEC é autoria legislativa', () => {
  const role = (type: string) => classifyAuthorship({ house: 'camara', type, actor: actorKindFromCamaraTipoAutor('Deputado(a)'), proponent: 1 }).role;
  assert.equal(role('PRL'), 'rapporteurship'); assert.notEqual(role('PRL'), 'legislative_authorship');
  assert.equal(role('PEC'), 'legislative_authorship');
  for (const type of ['PRL', 'PRLP', 'PAR', 'SBT', 'EMR', 'RPD', 'DTQ']) assert.ok(!['legislative_authorship', 'request_authorship', 'amendment_authorship'].includes(role(type)), `${type} fora do DNA`);
});

test('textos: presented_at usa "apresentadas"; identifier_year nunca', () => {
  assert.match(temporalPhrase('presented_at', 2026), /apresentadas em 2026/);
  assert.doesNotMatch(temporalPhrase('identifier_year', 2026), /apresentad/i);
  assert.doesNotMatch(temporalPhrase('activity', 2026), /apresentad/i);
});

test('componentes de /proposicoes derivam o texto anual da base temporal (sem "apresentadas" fixo)', () => {
  const read = (name: string) => readFileSync(`apps/web/components/proposicoes/${name}.tsx`, 'utf8');
  for (const name of ['hero', 'composition-section', 'stage-section', 'stage-river', 'rhythm-section']) {
    const source = read(name);
    assert.match(source, /temporalPhrase\(/, `${name} usa temporalPhrase`);
    assert.doesNotMatch(source, /apresentadas em|com ano \$\{|com ano \{/, `${name} não fixa o texto anual`);
  }
  assert.doesNotMatch(read('hero'), /Atividade legislativa/, 'hero não chama de atividade o que mede apresentações');
  assert.match(read('rhythm-section'), /coletados/, 'eventos são descritos como coletados');
});
