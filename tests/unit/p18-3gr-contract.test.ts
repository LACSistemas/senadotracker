import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('P18.3GR aggregate gates are derived from provider results', () => {
  const report = JSON.parse(fs.readFileSync('artifacts/P18_3gr.json', 'utf8')) as any;
  const providers = Object.values(report.providers) as any[];
  assert.equal(report.aggregateDerivedFromProviderResults, 'YES');
  assert.equal(report.gates.sourceCompletenessProven, providers.filter(provider => provider.sourceCompleteness === 'PROVEN').length);
  assert.equal(report.gates.externalIdParityPass, providers.filter(provider => provider.externalIdParity === 'PASS').length);
  assert.equal(report.gates.sourceNativeKeyProven, providers.filter(provider => provider.sourceNativeKeyProven === true).length);
  assert.equal(report.summary.operationallyProven, providers.filter(provider => provider.finalStatus === 'OPERATIONALLY_PROVEN').length);
  for (const provider of providers) {
    if (provider.key?.semanticOverlaps === 0) assert.notEqual(provider.externalIdParity, 'PASS');
  }
});
