import { chromium } from 'playwright';
const base = process.argv[2]; const b = await chromium.launch(); const p = await b.newPage();
for (const r of ['/atuacao-parlamentar', '/carreira-politica', '/gastos-equipe', '']) {
  await p.goto(`${base}/legislativo/deputados/204379${r}`, { waitUntil: 'networkidle', timeout: 120000 });
  const h = p.getByRole('heading', { name: /Como isso mudou/ });
  console.log(r || '(visão geral)', 'histórico visível:', await h.isVisible().catch(() => false), '| abas:', await p.getByRole('tab').allInnerTexts().catch(() => []));
}
await b.close();
