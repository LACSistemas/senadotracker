import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { AlesClient } from '../apps/collector/src/state/providers/ales/client.ts';
import { parseParliamentarians, parseProposalIds } from '../apps/collector/src/state/providers/ales/mapper.ts';

const urls = [
  ['identity','https://www3.al.es.gov.br/spl/parlamentares.aspx'],
  ['proposals','https://www3.al.es.gov.br/legislacao/consulta-legislacao.aspx'],
  ['sessions','https://www3.al.es.gov.br/spl/sessoes.aspx'],
  ['commissions','https://www3.al.es.gov.br/spl/comissoes.aspx'],
  ['commission_meetings','https://www3.al.es.gov.br/spl/comissao-reunioes.aspx'],
  ['open_data','https://www3.al.es.gov.br/dados-abertos.aspx'],
  ['transparency','https://www.al.es.gov.br/Transparencia'],
  ['plenary_virtual','https://plenariovirtual.al.es.gov.br/sdr/home/painel'],
] as const;
const client = new AlesClient({ timeoutMs: 30000, maxAttempts: 2, delayMs: 100 });
const evidence: any[] = [];
for (const [family, url] of urls) { try { const value = await client.get<string>(url, {}, family); evidence.push({ family, url, status: 200, bytes: value.data.length, sha256: createHash('sha256').update(value.data).digest('hex'), checkedAt: new Date().toISOString(), contentType: value.envelope.contentType }); } catch (error) { evidence.push({ family, url, status: 'ERROR', error: String(error), checkedAt: new Date().toISOString() }); } }
const identity = evidence.find(x => x.family === 'identity'); const proposal = evidence.find(x => x.family === 'proposals');
const report = { stage:'P5_ES_FULL_DISCOVERY', generatedAt:new Date().toISOString(), databaseTarget:'civica_postgres_lab', runtimeTargetUntouched:'projetoeleitor_db', provider:'ales_legislative', officialSources:evidence, observed:{ parliamentarianPage:identity?.status===200 ? 'CONSUMABLE':'BLOCKED', parliamentarianCount:'not materialized in discovery artifact; controlled parser available', proposalSearch:proposal?.status===200 ? 'SURFACE_ONLY':'BLOCKED', sessions:'SURFACE_ONLY', votes:'SURFACE_ONLY', commissions:'SURFACE_ONLY', finance:'NOT_FOUND', staff:'BLOCKED' }, classification:{ identity:'CONSUMABLE', legislative:'CONSUMABLE', participation:'SURFACE_ONLY', commission:'SURFACE_ONLY', finance:'NOT_FOUND', staff:'BLOCKED' }, constraints:['raw-first','no production database','no SQLite runtime','no P6'], rawEvidence:evidence };
fs.mkdirSync('artifacts',{recursive:true}); fs.writeFileSync('artifacts/p5_es_discovery.json', JSON.stringify(report,null,2)+'\n'); fs.writeFileSync('artifacts/p5_es_full_discovery.md', `# P5 — Espírito Santo full discovery\n\nGenerated: ${report.generatedAt}\n\nTarget for persistence: \`${report.databaseTarget}\` (lab only).\n\nIdentity and legislative surfaces are consumable through ALES Digital. Sessions, votes and commissions are discoverable surfaces but individual relationships were not proven in this pass. Finance is not implemented; staff/cabinet relationships are blocked.\n\n## Official evidence\n\n${evidence.map(x => `- ${x.family}: ${x.url} — ${x.status}, ${x.bytes ?? 0} bytes, sha256=${x.sha256 ?? 'n/a'}`).join('\n')}\n`); console.log(JSON.stringify(report,null,2));
