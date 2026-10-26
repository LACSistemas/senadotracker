import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { storageConfig, readManifest } from '../../apps/collector/src/exec/storage.ts';
import { pncpBundleRel, readPncpBundle } from '../../apps/collector/src/exec/pncp.ts';
import { classifyEducationContract, EDU_CONFIDENCE_LABEL, EDU_CONTRACT_VERSION, PNCP_VALUE_OUTLIER_CENTS, type EduPncpContract } from '../../packages/db/src/exec/index.ts';

/**
 * Varredura SOMENTE LEITURA do RAW do PNCP (D:\Civica\raw\pncp\contratos) com a classificação educacional (EDU_CONTRACT_VERSION): contagens por ano × categoria × confiança,
 * lista de contratos educacionais para o planejamento de coleta complementar (D:) e amostras estratificadas com semente fixa para auditoria. Não escreve no banco.
 *   npx tsx scripts/exec/edu-contract-scan.ts <resumo.json> <contratos.jsonl> <amostras.json>
 */
const [outSummary, outList, outSamples] = process.argv.slice(2);
const cfg = storageConfig(); const man = await readManifest(cfg);
const SEED = Number(process.env.EDU_SEED ?? 20261026); let st = SEED;   // EDU_SEED diferente = amostra independente (verificação fora da amostra usada para ajustar regras)
const rnd = () => { st |= 0; st = (st + 0x6D2B79F5) | 0; let t = Math.imul(st ^ (st >>> 15), 1 | st); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const N_SAMPLE = 220;
const bands = new Map<string, { seen: number; items: Array<Record<string, unknown>> }>();
const sample = (band: string, item: Record<string, unknown>) => {
  const b = bands.get(band) ?? bands.set(band, { seen: 0, items: [] }).get(band)!; b.seen++;
  if (b.items.length < N_SAMPLE) b.items.push(item); else { const j = Math.floor(rnd() * b.seen); if (j < N_SAMPLE) b.items[j] = item; }
};
const bandOf = (cls: ReturnType<typeof classifyEducationContract>): string => {
  const conf = Math.min(...cls.classes.map(c => c.confidence)); const cats = new Set(cls.classes.map(c => c.category));
  if (conf === 3) return 'POSSIBLE';
  if (conf === 1) return 'CONFIRMED_OFFICIAL';
  const tema = [...cats].filter(c => c !== 16);
  if (!tema.length) return 'INSTITUCIONAL_SEM_TEMA';
  const first = tema[0]!;
  return first <= 2 ? 'OBRAS_1_2' : first === 3 || first === 13 ? 'MANUT_TERCEIR_3_13' : first === 8 ? 'ALIMENTACAO_8' : first === 9 ? 'TRANSPORTE_9' : first <= 7 || first === 14 || first === 15 ? 'EQUIP_TEC_4_7_14_15' : 'DIDATICO_UNIF_SERV_10_12';
};
type Acc = { n: number; valor: number; outliers: number };
const acc = <K extends string>(m: Map<K, Acc>, k: K, v: number | null) => { const a = m.get(k) ?? m.set(k, { n: 0, valor: 0, outliers: 0 }).get(k)!; a.n++; if (v != null) { if (v > PNCP_VALUE_OUTLIER_CENTS) a.outliers++; else a.valor += v; } };
const byYear = new Map<string, Acc>(), byCat = new Map<string, Acc>(), byConf = new Map<string, Acc>(), byBuyer = new Map<string, Acc>(), byEsfera = new Map<string, Acc>(), byBand = new Map<string, Acc>(), byTipo = new Map<string, Acc>();
let genericExpediente = 0; let total = 0, edu = 0, superior = 0, excluded = 0, noValue = 0, unclassifiedWithSchool = 0; const out = createWriteStream(outList!); await mkdir(dirname(outList!), { recursive: true }).catch(() => undefined);
for (let year = 2021; year <= 2026; year++) for (let m = 1; m <= 12; m++) {
  const rel = pncpBundleRel(year, m); if (!man.has(rel)) continue;
  for await (const page of readPncpBundle(cfg, rel)) {
    if (page.s !== 200) continue;
    for (const c of (JSON.parse(page.b) as { data?: EduPncpContract[] }).data ?? []) {
      total++; const org = c.orgaoEntidade ?? {}; const un = c.unidadeOrgao ?? {}; const esf = (org.esferaId ?? '?').toUpperCase();
      const cl = classifyEducationContract(c.objetoContrato ?? '', org.razaoSocial ?? '', un.nomeUnidade ?? '', esf);
      if (cl.superior) { superior++; continue; }
      if (cl.excluded) excluded++;
      const vg = c.valorGlobal == null ? null : Math.round(c.valorGlobal * 100);
      if (!cl.classes.length) {
        // negativos para estimar falso negativo: com termo escolar sem classificar (viés alto) e aleatório (prevalência)
        const upx = (c.objetoContrato ?? '').toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
        if (/\bMATERIA(L|IS) DE (EXPEDIENTE|ESCRITORIO)\b/.test(upx) && /\bESCOLAR/.test(upx)) { genericExpediente++; continue; }   // material de expediente/escolar genérico de prefeitura: decisão de projeto, fora da sonda de falso negativo
        if (/\b(ESCOLA|ESCOLAS|ESCOLAR|ESCOLARES|CRECHE|ALUNOS|MERENDA)\b/.test((c.objetoContrato ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))) { unclassifiedWithSchool++; sample('NEG_COM_TERMO_ESCOLAR', { id: c.numeroControlePNCP, orgao: org.razaoSocial, unidade: un.nomeUnidade, esfera: esf, objeto: (c.objetoContrato ?? '').slice(0, 260), valor: c.valorGlobal ?? null, excluded: cl.excluded }); }
        else if (rnd() < 0.0002) sample('NEG_ALEATORIO', { id: c.numeroControlePNCP, orgao: org.razaoSocial, unidade: un.nomeUnidade, esfera: esf, objeto: (c.objetoContrato ?? '').slice(0, 260), valor: c.valorGlobal ?? null });
        continue;
      }
      edu++; if (vg == null) noValue++;
      const conf = Math.min(...cl.classes.map(x => x.confidence)); const band = bandOf(cl);
      acc(byYear, String(year), vg); acc(byConf, EDU_CONFIDENCE_LABEL[conf]!, vg); acc(byBuyer, String(cl.buyer), vg); acc(byEsfera, esf, vg); acc(byBand, band, vg); acc(byTipo, String(c.tipoContrato?.id ?? 0), vg);
      for (const k of cl.classes) acc(byCat, `${k.category}:${EDU_CONFIDENCE_LABEL[k.confidence]}`, vg);
      sample(band, { id: c.numeroControlePNCP, orgao: org.razaoSocial, unidade: un.nomeUnidade, esfera: esf, objeto: (c.objetoContrato ?? '').slice(0, 260), valor: c.valorGlobal ?? null, classes: cl.classes.map(x => `${x.category}/${x.rule}/${x.confidence}/${x.evidence}`) });
      out.write(JSON.stringify({ id: c.numeroControlePNCP, y: year, compra: c.numeroControlePncpCompra ?? null, cnpj: org.cnpj, ano: c.anoContrato, seq: c.sequencialContrato, tipo: c.tipoContrato?.id ?? 0, cat: cl.classes.map(x => x.category), conf, v: vg, acum: c.valorAcumulado != null ? Math.round(c.valorAcumulado * 100) : null, retif: c.numeroRetificacao ?? 0, vend: c.dataVigenciaFim ?? null }) + '\n');
    }
  }
  console.log(`${year}-${String(m).padStart(2, '0')} total=${total} edu=${edu}`);
}
await new Promise<void>(r => out.end(r));
const dump = (m: Map<string, Acc>) => Object.fromEntries([...m.entries()].sort().map(([k, v]) => [k, { contratos: v.n, valor_reais: Math.round(v.valor) / 100, outliers_acima_10bi: v.outliers }]));
await writeFile(outSummary!, JSON.stringify({ version: EDU_CONTRACT_VERSION, seed: SEED, total_contratos_raw: total, educacionais: edu, ensino_superior_excluido: superior, objeto_excluido_por_regra: excluded, sem_valor: noValue, nao_classificados_com_termo_escolar: unclassifiedWithSchool, material_expediente_escolar_generico_nao_classificado: genericExpediente, por_ano: dump(byYear), por_categoria_confianca: dump(byCat), por_confianca: dump(byConf), por_comprador: dump(byBuyer), por_esfera: dump(byEsfera), por_faixa: dump(byBand), por_tipo_contrato: dump(byTipo) }, null, 1));
await writeFile(outSamples!, JSON.stringify({ seed: SEED, n_por_faixa: N_SAMPLE, faixas: Object.fromEntries([...bands.entries()].sort().map(([k, v]) => [k, { universo: v.seen, amostra: v.items }])) }, null, 1));
console.log(JSON.stringify({ total, edu, superior }));
