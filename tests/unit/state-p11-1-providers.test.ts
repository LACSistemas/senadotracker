import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProcess } from '../../apps/collector/src/state/providers/alba-nopapercloud/index.ts';
import { parseAlmgMembers } from '../../apps/collector/src/state/providers/almg-open-data/index.ts';

test('BA process parser is deterministic and keeps the official process ID', () => {
  const raw = { envelope: { house: 'BA' as any, provider: 'alba_nopapercloud' as any, resource: 'proposal' as any, endpoint: 'https://albalegis.nopapercloud.com.br/spl/processo.aspx?id=78524', params: { id: '78524' }, externalId: '78524' as any, fetchedAt: '2026-10-02T00:00:00.000Z', status: 200, contentType: 'text/html', sha256: 'a', rawId: 'raw:a', body: '<span id="ContentPlaceHolder1_sp_id">78524</span><span id="ContentPlaceHolder1_sp_numero_processo">PL 10/2026</span><span id="ContentPlaceHolder1_sp_data_apresentacao">24/09/2026 15:52:55</span><p id="ContentPlaceHolder1_p_ementa">Teste</p><p id="ContentPlaceHolder1_p_situacao">TRAMITANDO</p>' }, body: '<span id="ContentPlaceHolder1_sp_id">78524</span><span id="ContentPlaceHolder1_sp_numero_processo">PL 10/2026</span><span id="ContentPlaceHolder1_sp_data_apresentacao">24/09/2026 15:52:55</span><p id="ContentPlaceHolder1_p_ementa">Teste</p><p id="ContentPlaceHolder1_p_situacao">TRAMITANDO</p>' };
  const first = parseProcess(raw, 'PL 10/2026'); const second = parseProcess(raw, 'PL 10/2026'); assert.equal(first.proposal.key.externalId, '78524'); assert.deepEqual(JSON.parse(JSON.stringify(first.proposal)), JSON.parse(JSON.stringify(second.proposal))); const { externalId: _ignored, ...withoutExternalId } = raw.envelope; assert.throws(() => parseProcess({ ...raw, envelope: { ...withoutExternalId, endpoint: 'https://example.invalid/processo.aspx' } }, 'x'), /process ID missing/);
});

test('MG XML parser preserves idDeputado and deduplicates at provider boundary', () => {
  const xml = '<listaMembroComissaoHistorico><membroComissaoHistorico><idDeputadoTitular>22561</idDeputadoTitular><nomeParlamentarTitular>João Magalhães</nomeParlamentarTitular><partidoDeputadoTitular>MDB</partidoDeputadoTitular><idDeputadoSuplente>22607</idDeputadoSuplente><nomeParlamentarSuplente>Roberto Andrade</nomeParlamentarSuplente></membroComissaoHistorico></listaMembroComissaoHistorico>';
  const rows = parseAlmgMembers(xml); assert.equal(rows[0]?.id, '22561'); assert.equal(rows[0]?.name, 'João Magalhães'); assert.equal(rows[1]?.id, '22607'); assert.equal(parseAlmgMembers(xml).map(row => row.id).join(','), '22561,22607'); assert.deepEqual(parseAlmgMembers('<listaMembroComissaoHistorico/>'), []);
});
