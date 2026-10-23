import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
/**
 * Verificações de acessibilidade em navegador real (sem axe): nomes acessíveis, hierarquia de títulos, gráficos com rótulo, contraste WCAG calculado, foco visível por teclado, alvos de toque.
 * Uso: node scripts/security/a11y-check.mjs <base> <saida.json>
 */
const [base, out] = process.argv.slice(2); const PAGES = ['/municipios/3205309/seguranca', '/estados/ES/seguranca', '/municipios/3200359/seguranca']; const VIEWS = [{ w: 1440, h: 900, touch: false }, { w: 390, h: 800, touch: true }];
const browser = await chromium.launch({ channel: 'chrome' }); const results = [];
for (const path of PAGES) for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, hasTouch: v.touch, locale: 'pt-BR', reducedMotion: 'reduce' }); const page = await ctx.newPage(); await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
  const r = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const bgOf = (el) => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c.rgb; e = e.parentElement; } return [250, 249, 245]; };
    const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || el.innerText || el.getAttribute('title') || (el.labels && el.labels[0]?.textContent) || el.getAttribute('placeholder') || '').trim();
    const controls = [...document.querySelectorAll('button, a[href], select, input, summary')].filter(e => e.getBoundingClientRect().width > 0);
    const unnamed = controls.filter(e => !name(e)).map(e => e.outerHTML.slice(0, 90));
    const heads = [...document.querySelectorAll('h1, h2, h3, h4')].map(h => Number(h.tagName[1])); let skips = 0; for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) skips++;
    const svgs = [...document.querySelectorAll('svg[role="img"]')]; const svgNoLabel = svgs.filter(s => !s.getAttribute('aria-label')).length;
    const texts = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (t.length < 2) continue; const el = n.parentElement; if (!el || el.closest('script,style,svg') || getComputedStyle(el).visibility === 'hidden' || !el.getBoundingClientRect().width) continue; texts.push(el); }
    const seen = new Set(); let checked = 0, fails = []; for (const el of texts) { if (seen.has(el)) continue; seen.add(el); const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el); const fgc = fg.rgb.map((c, i) => Math.round(c * fg.a + bg[i] * (1 - fg.a))); const ratio = (Math.max(lum(fgc), lum(bg)) + 0.05) / (Math.min(lum(fgc), lum(bg)) + 0.05); const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold); checked++; if (ratio < (large ? 3 : 4.5)) fails.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, size }); }
    const small = controls.filter(e => { const b = e.getBoundingClientRect(); return b.height < 24 || b.width < 24; }).map(e => e.outerHTML.slice(0, 80));
    const smallComfort = controls.filter(e => { const b = e.getBoundingClientRect(); return b.height < 32; }).length;
    return { controls: controls.length, unnamed, headingSkips: skips, h1: document.querySelectorAll('h1').length, svgImg: svgs.length, svgNoLabel, contrastChecked: checked, contrastFails: fails.slice(0, 12), contrastFailCount: fails.length, targetsBelow24: small.slice(0, 8), targetsBelow24Count: small.length, controlsBelow32px: smallComfort, landmarks: { main: document.querySelectorAll('main').length, nav: document.querySelectorAll('nav').length }, lang: document.documentElement.lang };
  });
  // foco visível por teclado nos primeiros 40 elementos focáveis
  let noFocusRing = 0, tabbed = 0; for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); const ok = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); return !!ring; }); if (ok === null) continue; tabbed++; if (!ok) noFocusRing++; }
  results.push({ path, width: v.w, ...r, keyboard: { tabbed, withoutVisibleFocus: noFocusRing } }); console.log(path, v.w, JSON.stringify({ unnamed: r.unnamed.length, skips: r.headingSkips, svgNoLabel: r.svgNoLabel, contrastFail: r.contrastFailCount + '/' + r.contrastChecked, below24: r.targetsBelow24Count, noFocus: noFocusRing + '/' + tabbed })); await ctx.close();
}
await browser.close(); writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), base, reducedMotionEmulated: true, results }, null, 1));
