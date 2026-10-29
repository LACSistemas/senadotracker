# P12.8 — Contratos de componentes e tipos

Todo o modelo de visualização é derivado do read model da P12.7; o cliente nunca recebe os 27 indicadores crus, só o que cada capítulo decidiu mostrar. Fonte da verdade dos tipos: [apps/web/lib/wellbeing/types.ts](../../../apps/web/lib/wellbeing/types.ts).

## Tipos de apresentação

```ts
interface StatItem { label: string; value: string; unit?: string; note?: string | null }
interface BarRow { label: string; value: number; display: string; note?: string | null }
interface TableRow { label: string; cells: Array<string | null> }
interface Table { title: string; columns: string[]; rows: TableRow[]; caption?: string }

interface ChapterBase {
  id: string; number: number; title: string; narrative: Narrative; available: boolean;
  emptyReason?: string; limits: string[]; sources: string;
  disclosures: WellbeingObservation[]; // adicionado nesta fase — ver seção "Divulgação por indicador"
}

interface ComparePoint { label: string; value: number | null; display: string; eligible: boolean; reason: string | null }
interface TerritoryCompare { unit: string; year: string | null; own: ComparePoint; state: ComparePoint | null; brazil: ComparePoint; restrictions: string[] }
```

Regras que o tipo já força (não dependem de disciplina do desenvolvedor lembrar):

- `available: boolean` em todo capítulo: a página nunca decide "mostrar ou não" fora desse campo — `WellbeingPage` olha só para `chapter.available` e renderiza `Pending` com `emptyReason` quando falso. Não existe caminho de código que mostre um capítulo com dado ausente como se fosse zero.
- `TerritoryCompare.state: ComparePoint | null` — nullable deliberadamente, para o caso de UF comparada consigo mesma (ver `DESIGN_SYSTEM_BEM_ESTAR.md`).
- `ComparePoint.eligible: boolean` sempre acompanha `value`: um consumidor do tipo não pode ler `value` sem checar `eligible` primeiro sem que o TypeScript avise (campo obrigatório, não opcional).

## `IndicatorDetails` (`components/wellbeing/indicator-disclosure.tsx`)

```ts
function IndicatorDetails({ o }: { o: WellbeingObservation }): JSX.Element
```

Renderiza um `<details>` com fonte, release, período, unidade, universo, cobertura (mapeada de `coverageStatus` para texto em português), revisão (se houver) e link oficial (`sourceUrl`, só se presente — nunca um link inventado). Quando `isComparable` é falso, mostra também `comparisonRejectionReason`.

**Limitação conhecida e documentada, não corrigida por invenção**: `WellbeingObservation` não tem um campo de "definição" textual separado do `label` do indicador — o catálogo (`civica_exec.exec_ind_def`) não publica uma descrição metodológica própria por indicador além do rótulo. `IndicatorDetails` usa `label` como título do bloco de divulgação e não fabrica uma frase de definição adicional. Isso está correto por construção: inventar uma definição que a fonte não publicou violaria a regra central da missão.

## `Disclosures` (em `components/wellbeing/wellbeing-page.tsx`)

Wrapper que recebe `WellbeingObservation[]` e renderiza um `IndicatorDetails` por item, ou nada quando a lista é vazia. `load.ts` popula `disclosures` por capítulo com as observações que realmente sustentam aquele capítulo:

| Capítulo | Disclosures |
|---|---|
| Condições de vida | renda média, renda mediana, Gini (só UF/Brasil), água, esgoto, lixo |
| Trabalho | último ponto válido de RAIS, estoque de referência do Caged, admissões, desligamentos, saldo, remuneração (só UF) |
| Rede socioassistencial | CRAS, CREAS, IDCRAS, IDCREAS, IDConselho — **só no escopo de município**; agregados de UF (soma de respondentes) não têm uma observação individual no mesmo formato |
| Cotidiano digital | os 5 indicadores MUNIC — **só no escopo de município**; a distribuição por UF é um agregado, não uma observação |
| Ação pública | `[]` — os dados vêm de `overview.finance`, que não tem o formato `WellbeingObservation` (sem `source`/`sourceUrl`/`coverageStatus` por linha); a fonte já está fixa em `sources` |
| Evolução | `[]` — capítulo inteiramente derivado dos capítulos 2 e 5, que já mostram suas próprias divulgações |

## `TerritoryCompareRow` (`components/wellbeing/territory-compare.tsx`)

```ts
function TerritoryCompareRow({ c }: { c: TerritoryCompare }): JSX.Element
```

Lida explicitamente com `c.state === null` (omite a marca de UF) e com `eligible === false` em qualquer ponto (mostra o motivo textual, nunca um valor substituto).

## `WellbeingPageData` — contrato de carga da página

```ts
interface WellbeingPageData {
  scope: WbScope;
  portrait: { lede: string; facts: PortraitFact[] };
  conditions: ConditionsChapter; work: WorkChapter; social: SocialChapter;
  digital: DigitalChapter; action: ActionChapter; evolution: EvolutionChapter;
  sources: Array<{ label: string; period: string }>;
  meta: { sqlStatements: number; dbMs: number; buildMs: number };
}
```

Produzido por `loadWellbeingPage(scope)` em `apps/web/lib/wellbeing/load.ts` com **uma** chamada a `getWellbeingOverview` (27 observações + cobertura + finanças) mais um conjunto fixo de chamadas pontuais (~10, nunca por indicador): 5 séries (`getWellbeingSeries` para RAIS estoque e as 4 métricas mensais do Caged), até 2 comparadores (renda e, só fora do município, Gini), e — só nas páginas de UF — as distribuições agregadas (MUNIC × 5 indicadores + CRAS + CREAS). `instrument()` conta exatamente quantas dessas chamadas disparam SQL por carga; ver `BENCHMARKS_FRONTEND_P128.json`.
