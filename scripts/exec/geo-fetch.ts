import { mkdir, writeFile } from 'node:fs/promises';
import { UF_CODE } from '../../apps/collector/src/exec/cnes.ts';

/**
 * Malhas municipais oficiais do IBGE (API de malhas v3, qualidade mínima), UMA UF POR ARQUIVO, projetadas em SVG.
 * Gera apps/web/public/geo/uf/{UF}.json = { uf, viewBox, source, items: [{ id: ibge7, d: path }] }. Não inventa fronteiras.
 * Uso: node --import tsx scripts/exec/geo-fetch.ts [UF ...]
 */
interface Geo { features: Array<{ properties: { codarea: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }> }
const only = process.argv.slice(2).map(u => u.toUpperCase());
await mkdir('apps/web/public/geo/uf', { recursive: true });
for (const [uf, code] of Object.entries(UF_CODE)) {
  if (only.length && !only.includes(uf)) continue;
  const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${code}?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=minima`;
  const geo = await (await fetch(url, { headers: { 'User-Agent': 'civica-exec/1.0' } })).json() as Geo;
  const rings = (g: Geo['features'][number]['geometry']): number[][][] => g.type === 'Polygon' ? g.coordinates as number[][][] : (g.coordinates as number[][][][]).flat();
  let minX = 180, maxX = -180, minY = 90, maxY = -90;
  for (const f of geo.features) for (const ring of rings(f.geometry)) for (const [x, y] of ring as number[][]) { minX = Math.min(minX, x!); maxX = Math.max(maxX, x!); minY = Math.min(minY, y!); maxY = Math.max(maxY, y!); }
  const k = Math.cos(((minY + maxY) / 2) * Math.PI / 180); const W = 1000; const scale = W / ((maxX - minX) * k); const H = Math.round((maxY - minY) * scale);
  const px = (x: number) => ((x - minX) * k * scale).toFixed(1); const py = (y: number) => ((maxY - y) * scale).toFixed(1);
  const items = geo.features.map(f => ({ id: Number(f.properties.codarea), d: rings(f.geometry).map(r => 'M' + (r as number[][]).map(([x, y]) => `${px(x!)} ${py(y!)}`).join('L') + 'Z').join('') }));
  await writeFile(`apps/web/public/geo/uf/${uf}.json`, JSON.stringify({ uf, viewBox: `0 0 ${W} ${H}`, source: 'IBGE Malhas v3 (qualidade mínima)', items }));
  console.log(uf, items.length, `${W}x${H}`);
}
