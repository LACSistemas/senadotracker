import { readFile } from 'node:fs/promises';
import { classifyEducationContract } from '../../packages/db/src/exec/index.ts';

/** Somente leitura: classifica e imprime (compacto) os detalhes buscados por edu-fetch-ids.ts, para revisão manual. */
const d = JSON.parse(await readFile(process.argv[2]!, 'utf8')) as Record<string, { orgao: string; esfera: string; unidade: string; objeto: string }>;
let i = 0;
for (const [id, x] of Object.entries(d)) {
  const cl = classifyEducationContract(x.objeto, x.orgao ?? '', x.unidade ?? '', String(x.esfera ?? '').toUpperCase());
  console.log(`${i++} ${(x.orgao ?? '').slice(0, 16)} | ${(x.unidade ?? '').slice(0, 14)} | ${x.objeto.slice(0, 105).replace(/\s+/g, ' ')} | ${cl.classes.map(c => `${c.category}r${c.rule}c${c.confidence}`).join(',')}`);
}
