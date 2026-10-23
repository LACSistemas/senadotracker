# Mapa de componentes (P9.8)

Todos em `apps/web/components/security/` (reaproveitam os tokens, fontes, `TerritoryFrame` e `ThemeTabs` da Saúde; nenhuma biblioteca nova).

| Componente | Tipo | Responsabilidade |
|---|---|---|
| `security-page.tsx` | servidor | compõe a narrativa: herói → nav → legenda → 6 capítulos → explorar → fontes; capítulo sem dado vira cartão "sem dados publicados aqui" |
| `security-hero.tsx` | servidor | 3–4 `KpiCard` (1º destacado), `BenchRuler`, sparkline, variação neutra, "Explorar" |
| `bench-ruler.tsx` | servidor | régua: faixa central (azul), mediana (traço), território (ponto) + legenda do grupo |
| `chapter-nav.tsx` | cliente | pílulas fixas, capítulo ativo via `IntersectionObserver` |
| `security-ui.tsx` | servidor | `ChapterShell` (pergunta → resposta → evidência → "Fontes e limites"), `Sparkline`, `DeltaChip`, `EmptyNote`, `Stat`, `DataStatesLegend` |
| `trend-chart.tsx` | cliente | gráfico SVG próprio: tooltip por ponteiro/teclado, janela (3/5/10 anos/tudo), por ano × por mês, faixa de benchmark, marcos (PRF), faixas sem população, estados de ponto (vazado/×/lacuna), tabela alternativa, região `aria-live` |
| `crime-explorer.tsx` | cliente | seletor de crime (lista no desktop, `<select>` no mobile), medida quantidade × taxa, cargas sob demanda, benchmark sob demanda, variações equivalentes, distribuição, comparação com outro município |
| `structure-chapter.tsx` | servidor | cidade × estado, previsto × existente, edições MUNIC, bloco "E o Detran?" |
| `traffic-chapter.tsx` | cliente | mortes (moradores/local/taxa), usuários da via, frota, frota × mortes (índice), PRF, RENAEST, infrações (UF) |
| `prison-chapter.tsx` | servidor | unidades, vagas × pessoas, ocupação, regimes, contexto estadual, domiciliar |
| `finance-chapter.tsx` | cliente | modo (R$, por habitante, % da despesa), etapa (orçado/empenhado/liquidado/pago), subfunções por ano, contexto estadual, contratos do PNCP (API paginada) |
| `police-chapter.tsx` | servidor | famílias da P9.7 em gráficos separados por abrangência, totais nacionais por medida, "o que não existe" |
| `explorer-panel.tsx` | cliente | modo especialista: índice, busca, série exata, tabela com numerador/denominador/marcas, **exportar CSV** com metadados |
| `security-summary.tsx` | servidor | vitrine nas páginas de visão geral (estado e município) |

Camada de dados correspondente: `apps/web/lib/security/*` (ver `ARQUITETURA_UX_SEGURANCA.md`).
