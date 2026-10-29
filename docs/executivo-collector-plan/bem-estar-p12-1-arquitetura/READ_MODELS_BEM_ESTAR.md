# Read models de Bem-Estar

Os contratos abaixo são interfaces propostas; nenhum endpoint ou rota foi criado. A integração deve seguir as páginas territoriais existentes (`apps/web/app/municipios/[ibge]`, `apps/web/app/estados/[uf]`) e os padrões de `apps/web/lib/exec-territory.ts`, `health-*` e `education/*`.

```ts
type CoverageState = 'FULL'|'PARTIAL'|'MISSING'|'NOT_APPLICABLE'|'BLOCKED'|'SUPPRESSED'|'UNDER_REVIEW';
type MeasureType = 'STOCK'|'FLOW'|'MEAN'|'MEDIAN'|'SHARE'|'RATE'|'INDEX'|'CURRENCY';
interface Methodology { source: string; dataset: string; release: string; table?: string; universe: string; unit: string; method: string; url?: string; }
interface Observation { indicatorCode: string; label: string; periodStart: string; periodEnd: string; value: number|null; numerator: number|null; denominator: number|null; unit: string; measureType: MeasureType; status: 'PRELIMINARY'|'FINAL'; coverage: CoverageState; methodology: Methodology; dataThrough: string|null; }
interface Comparator { scope: 'SELF_SERIES'|'UF'|'BRAZIL'|'PEERS'; value: number|null; periodStart: string|null; eligible: boolean; reason: string|null; coverage: CoverageState; }
interface Chapter { id: string; title: string; observations: Observation[]; comparators: Comparator[]; narrative: string|null; coverage: CoverageState; }
interface WellbeingOverview { entity: Territory; asOf: string|null; chapters: Chapter[]; sources: Methodology[]; coverage: CoverageState; }
interface Territory { entityId: number; ibge7: number; name: string; kind: 1|2|3|4|5; uf: string|null; geographyVersion: string|null; }
```

## Contratos de leitura

- **Overview:** um payload compacto já agregado; não consulta `exec_ind_value` milhares de vezes.
- **Condições materiais:** renda, Gini, faixas e moradia com unidade/ano/denominador visíveis.
- **Trabalho:** RAIS estoque separado de Caged fluxo; saldo não é desemprego.
- **Vulnerabilidade/proteção:** CadÚnico, Bolsa Família, BPC, CRAS/CREAS com cobertura própria.
- **Cotidiano/inclusão:** fontes TIC e cultura somente quando o recurso e a licença estiverem validados.
- **Ação pública:** consumo contextual de Siconfi/PNCP/Infraestrutura; sem duplicar fatos.
- **Evolução:** série temporal com lacunas explícitas e comparação elegível.
- **Metodologia:** disclosure compacto com fonte, tabela, universo, edição e data-through.

Comparador proibido retorna `eligible:false` e `reason`, nunca desaparece silenciosamente.

