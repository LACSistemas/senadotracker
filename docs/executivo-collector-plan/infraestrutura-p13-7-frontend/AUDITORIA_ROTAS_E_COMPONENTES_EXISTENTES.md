# P13.7 — Auditoria de rotas e componentes existentes

Projeto Next.js (App Router, Next 16.3.4 / React 19.2.8) em `apps/web`. Auditoria read-only antes de qualquer código novo.

## Rotas reais

- `apps/web/app/estados/[uf]/page.tsx` — overview estadual (`/estados/ES`).
- `apps/web/app/estados/[uf]/[tema]/page.tsx` — catch-all 404 para temas sem pasta própria.
- `apps/web/app/estados/[uf]/{saude,educacao,seguranca,bem-estar}/page.tsx` — uma pasta por tema já publicado.
- `apps/web/app/estados/[uf]/representacao/page.tsx` — "Quem me representa", **só estadual**.
- `apps/web/app/municipios/[ibge]/page.tsx` — overview municipal (ibge7, ex.: `/municipios/3205309`).
- `apps/web/app/municipios/[ibge]/[tema]/page.tsx` — mesmo catch-all.
- `apps/web/app/municipios/[ibge]/{saude,educacao,seguranca,bem-estar}/page.tsx`.
- **Não existe** `/municipios/[ibge]/representacao` — a página municipal linka para `/estados/{uf}/representacao` ([page.tsx:23](apps/web/app/municipios/[ibge]/page.tsx#L23)). Confirmado: não duplicar em município.

Para Infraestrutura: criar `app/estados/[uf]/infraestrutura/page.tsx` e `app/municipios/[ibge]/infraestrutura/page.tsx`, espelhando exatamente o par de `bem-estar/`.

## Navegação por tema

Fonte única: `THEMES` em [components/territory/territory-ui.tsx:127](apps/web/components/territory/territory-ui.tsx#L127):
```ts
export const THEMES = [
  { slug: 'saude', label: 'Saúde', ready: true },
  { slug: 'educacao', label: 'Educação', ready: true },
  { slug: 'seguranca', label: 'Segurança', ready: true },
  { slug: 'bem-estar', label: 'Bem-estar', ready: true },
  { slug: 'infraestrutura', label: 'Infraestrutura', ready: false },
] as const;
```
Ativar (`ready:true`) é o que faz o catch-all `[tema]` parar de interceptar `infraestrutura` e a pasta dedicada assumir. **Só ativar quando overview de UF e município estiverem prontos** (fim do Estágio 2 do plano de execução), nunca antes — do contrário a navegação aponta para uma seção incompleta. `THEME_PLAN` (linha ~138) tem um texto placeholder de infraestrutura a remover quando o módulo real entrar.

## Padrão de implementação de referência (Bem-estar, P12 — mais recente)

Idêntico em Educação: `lib/<domínio>/{types,catalog,load,build,narrative}.ts` + `components/<domínio>/{<domínio>-page.tsx,<domínio>-ui.tsx,...}`.

- Rota → `scopeOf('uf'|'municipio', id)` → `load<Domínio>PageCached(scope)` → `<TerritoryFrame active="<domínio>"><DomínioPage data={data}/></TerritoryFrame>`.
- Uma função só (`lib/wellbeing/load.ts:22`) faz 1 chamada de overview + `Promise.all` de chamadas pontuais (nunca N+1 por indicador), monta "capítulos" (`ChapterBase={id,number,title,narrative,available,emptyReason?,limits,sources,disclosures}`), memoiza via `memo()` (TTL 60s página/5min UF).
- `build.ts` tem helpers puros (`bars`,`stat`,`table`,`chart`,`territoryCompare`,`comparePoint`) — **deliberadamente duplicado por domínio**, não importado entre domínios (comentário explícito no código contra acoplamento cross-domain).
- `narrative.ts` gera texto por capítulo (`{question,answer,context,invite}`) a partir dos mesmos fatos — nunca texto hardcoded solto no componente.
- Componentes cross-domain reais (vivem em `components/security/` apesar do nome): `ChapterShell`, `EmptyNote`, `ChapterNav` (nav pill sticky, `IntersectionObserver`), `TrendChart`. Tipos cross-domain em `lib/security/types.ts` (`ChartView`,`ChartSeries`,`Narrative`,`ScopeInfo`,`BenchView`).
- Comparador UF/Brasil: `components/wellbeing/territory-compare.tsx` — até 3 pontos; omite o ponto de UF quando a página já é de UF; pontos inelegíveis → "não aplicável (motivo)", nunca zero.
- `components/wellbeing/indicator-disclosure.tsx` (`<IndicatorDetails>`) — `<details>` por indicador com fonte/período/unidade/universo/cobertura/revisão/link oficial, sem query extra.

## Mapa

`MunicipalMap` em [components/territory/territory-ui.tsx:89](apps/web/components/territory/territory-ui.tsx#L89) — choropleth SVG por município a partir de `public/geo/uf/{UF}.json` (arquivo, não banco). Único componente de mapa do projeto — sem suporte a coordenada de ponto/pin. Reutilizar para "distribuição de obras por município" como sombreamento; nunca inventar geolocalização de obra a partir de centroide.

## Design tokens

`app/globals.css` — `:root` claro, **sem dark mode** (`color-scheme: light`, nenhum `@media (prefers-color-scheme: dark)` no projeto). `--primary:#115b45` já é o token institucional. Convenção real nos componentes de capítulo (Segurança/Bem-estar/Educação) é hex cru (`#115b45`,`#14304f`) em vez de `var(--primary)` — já é uma inconsistência conhecida (ver memória do usuário sobre limpeza pendente em `education-ui StatGrid`), não é escopo desta fase corrigir, só seguir a mesma convenção por consistência visual.

`lib/security/format.ts` (`fmt`,`brl`,`periodLabel`) — **sem formatação compacta** (`155 mil`,`R$ 42,8 mi`,`1,2 GW`). `formatInt` em `territory-ui.tsx:28` usa `Intl.NumberFormat('pt-BR')` não-compacto. Nenhum domínio tem essa formatação hoje — precisa de helper novo (`lib/infrastructure/format.ts`).

## Lista grande paginada

`components/education/data-explorer.tsx` (`DataExplorer<T>`) é client-side (`'use client'`, `<details>` colapsado por padrão, `fetch` contra uma rota de API, sem filtros na URL). **Não serve** para a listagem de 155k obras: o brief exige paginação server-side e filtros preservados na URL. Usar o mesmo padrão `searchParams` server-side que `/estados/[uf]/page.tsx` já usa para `q`/`mapa`.

## Loading/empty states

Nenhuma rota territorial usa `loading.tsx`/skeleton — todas são `dynamic='force-dynamic'`, SSR completo. Ausência é tratada via `available`/`emptyReason`/`Pending`/`EmptyNote`, nunca via skeleton. Único `Suspense` encontrado tem `fallback={null}` (não um skeleton). Seguir o mesmo padrão para os capítulos de Infraestrutura; só introduzir skeleton real se a listagem de obras (sob demanda) precisar.

## Navegação global (não tocar)

`components/app-header.tsx`, `components/app-footer.tsx`, `app/layout.tsx`, `components/section-navigation.tsx`, `components/legislative-subnav.tsx` — chrome global, fora do escopo; nada nas páginas territoriais alcança esses componentes além de `TerritoryFrame` (`<Crumbs>`/`<ThemeTabs>`), então adicionar `infraestrutura` não os afeta estruturalmente.
