# Mapa de componentes — Educação P10.10

## Composição

| Camada | Implementação | Papel |
|---|---|---|
| shell territorial | `TerritoryFrame` | cabeçalho, breadcrumbs, navegação e identidade do território |
| tema | `territory-ui.tsx` | Educação habilitada na navegação existente |
| carregamento SSR | `apps/web/lib/education/load.ts` | resolve escopo e chama read models |
| página compartilhada | `components/education/education-page.tsx` | narrativa, capítulos, filtros, gráficos e estados |
| rota estadual | `app/estados/[uf]/educacao/page.tsx` | escopo UF |
| rota municipal | `app/municipios/[ibge]/educacao/page.tsx` | escopo município/IBGE |

## Contratos usados

Primeira leitura: `getEducationOverview`. Leituras complementares: `getEducationSection`, `getEducationSeries`, `getEducationComparison`, `getEducationList` e read models de oferta, infraestrutura, Ideb, Saeb, fluxo e docentes. Cada família é isolada por `safe()`, permitindo que um domínio indisponível não derrube o perfil.

## Reuso visual

Reutilizados `TerritoryFrame`, tokens tipográficos, cards, badges, bordas, espaçamento, navegação temática e padrões de estados já usados em Segurança. Não foi criado um design system paralelo.

