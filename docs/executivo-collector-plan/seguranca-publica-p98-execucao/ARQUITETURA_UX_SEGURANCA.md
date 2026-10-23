# Arquitetura da experiência de Segurança (P9.8)

## Rotas e integração
| Rota | O que é |
|---|---|
| `/estados/[uf]/seguranca` e `/municipios/[ibge]/seguranca` | a história completa, mesmo desenho para estado e município (subpágina de tema, como a Saúde) |
| `/estados/[uf]` e `/municipios/[ibge]` | ganharam a vitrine `SecuritySummary` (os mesmos indicadores-chave em versão compacta, dentro de `Suspense`) e o cartão "Segurança" deixou de ser "em preparação" (`THEMES.seguranca.ready = true`) |
| `/api/seguranca/{opcao,benchmark,indicadores,serie,contratos,comparar}` | cargas sob demanda: o primeiro render só leva o necessário |

Nada de Legislativo, Saúde ou do restante do Executivo foi alterado além do cartão de tema e da vitrine.

## Fluxo de dados (sem N+1, sem payload bruto no cliente)
```
page.tsx (servidor) → loadSecurityPage(scope)
   ├─ 14 leituras em paralelo (read models P9.1–P9.7 + população + bounds + contratos)  ← memo de 5 min para leituras estaduais compartilhadas
   ├─ builders puros por capítulo (build-crime/structure/traffic/prison/finance/police)
   ├─ buildHero: indicadores-chave + benchmarks em paralelo
   └─ narrativas (frases sem causalidade) → SecurityPageData (80–180 KB de JSON)
cliente: componentes recebem só séries curadas; opções de crime "pesadas" chegam por /api/seguranca/opcao
```
Decisões de payload: dos 462 indicadores só os curados viajam; as 20+ opções de crime chegam como **esboço** (rótulo + último valor) e a série completa vem ao clicar; o índice do modo especialista (até 400 indicadores) só é carregado quando a seção é aberta.

## Camadas
- `packages/db/src/exec/security-bench.ts` — leituras de benchmark e exploração (somente SELECT): `readMunicipalRateBench`, `readUfRateBench`, `readCrimeRateBench`, `readIndicatorSeries`, `listExplorableIndicators`, `listSecurityContracts`, `readPopulationSeries`, `readIndicatorBounds`.
- `apps/web/lib/security/` — `catalog` (curadoria e nomes simples), `series` (estados de dado), `build-*` (capítulos), `bench` (contrato de comparação), `hero`, `narrative`, `load` (orquestração, cache, instrumentação de SQL).
- `apps/web/components/security/` — ver `MAPA_COMPONENTES.md`.

## Princípios aplicados
1. **Divulgação progressiva**: panorama (30 s) → capítulos → "Explore os dados".
2. **Ausência ≠ zero**: quatro estados visuais (preliminar, lacuna, ×, faixa de população) mais "sem comparação válida".
3. **Comparação só quando válida** (ver `CONTRATOS_BENCHMARKS.md`).
4. **Sem causalidade, sem índice único, sem "cidade segura/perigosa"** — há teste que varre o texto.
5. **Segurança do ambiente**: build em cópia isolada, servidor próprio na porta 3102, banco só em leitura.
