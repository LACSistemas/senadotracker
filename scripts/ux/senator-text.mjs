import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(process.argv[2] + '/legislativo/senadores/4639/atuacao-parlamentar', { waitUntil: 'networkidle', timeout: 180000 });
const t = (await p.locator('main').innerText()).replace(/\s+/g, ' ');
for (const k of ['Presença em dias', 'Participação nas votações', 'Ele participa']) { const i = t.indexOf(k); console.log(k, '=>', i < 0 ? 'ausente' : t.slice(i, i + 260)); }
await b.close();
