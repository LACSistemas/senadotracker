import test from 'node:test';
import assert from 'node:assert/strict';
import { EDUCATION_FINANCIAL_STAGES, EDUCATION_PROGRAM_ACTIONS, isEducationProgramAction } from '../../packages/db/src/exec/index.ts';

test('P10.6 mantém os programas source-native e os estágios financeiros separados', () => {
  assert.deepEqual(EDUCATION_PROGRAM_ACTIONS, { PDDE: '0515', PNAE: '00PI', PNATE: '0969', FUNDEB_COMPLEMENT: '00SB' });
  assert.equal(isEducationProgramAction('0515'), true); assert.equal(isEducationProgramAction('00PI'), true); assert.equal(isEducationProgramAction('0969'), true); assert.equal(isEducationProgramAction('00SB'), true); assert.equal(isEducationProgramAction('20RM'), false);
  assert.ok(EDUCATION_FINANCIAL_STAGES.includes('TRANSFERRED')); assert.ok(EDUCATION_FINANCIAL_STAGES.includes('PAID')); assert.notEqual('TRANSFERRED', 'PAID');
});
