# P12.8 — Relatório de implementação: Frontend de Bem-Estar

## Objetivo e escopo

Conectar os 27 indicadores de Bem-estar publicados pela P12.7 (Censo IBGE 2022 renda/moradia, RAIS 2023–2025, Novo Caged jan–ago/2026, Censo SUAS 2024, MUNIC 2024, Siconfi função 08) às páginas territoriais reais (`/estados/[uf]` e `/municipios/[ibge]`), com qualidade editorial equivalente à de Segurança (P9.8) e Educação (P11): panorama seletivo + 6 capítulos, benchmarks honestos, ausência tratada como ausência (nunca zero), nenhuma estatística, ranking ou índice inventado. Fase só de leitura — zero migration, zero escrita no banco.

## O que foi construído

**Ativação de rota** — `apps/web/components/territory/territory-ui.tsx` (Bem-estar `ready: true`) + duas rotas literais novas (`estados/[uf]/bem-estar`, `municipios/[ibge]/bem-estar`), que automaticamente herdam precedência sobre o placeholder dinâmico `[tema]`. Nenhuma página de visão geral precisou de alteração — ver `MAPA_ROTAS_E_INTEGRACAO.md`.

**Read model, camada aditiva** (`packages/db/src/exec/wellbeing-read.ts`) — duas funções novas, `getWellbeingMunicDistribution` e `getWellbeingSocialDistribution`, para agregar respostas MUNIC e contagens CRAS/CREAS por UF (lacuna real: o read model original só agregava quando o território de referência era o próprio município perguntando sobre sua UF, não quando a UF pergunta sobre si mesma). Zero migration, zero mudança no código existente.

**Camada de apresentação, nova** (`apps/web/lib/wellbeing/*`, `apps/web/components/wellbeing/*`) — espelhando a estrutura já comprovada de Educação (`types.ts`, `catalog.ts`, `build.ts`, `narrative.ts`, `load.ts`) e reaproveitando sem alteração os componentes de base de Segurança (`ChapterShell`, `ChapterNav`, `TrendChart`, `fmt`/`brl`/`periodLabel`, `instrument`/`memo`/`scopeOf`). Uma peça genuinamente nova: `TerritoryCompareRow`, porque o comparador de Bem-estar é 3 pontos diretos (território/UF/Brasil), não uma distribuição de percentis — forçar isso em `BenchRuler` teria inventado uma distribuição que o dado não tem.

**Divulgação por indicador** (`IndicatorDetails`, ligado a 4 dos 6 capítulos) — fonte, período, unidade, universo, cobertura, revisão e link oficial, extraídos direto das observações já carregadas, sem nenhuma consulta extra. Os 2 capítulos sem divulgação individual (ação pública, evolução) não têm uma "observação" no mesmo formato — documentado, não escondido.

## Gate obrigatório: MUNIC 9601

Investigado e resolvido (ver `AUDITORIA_MUNIC_9601.md`): a divergência entre "627/5.563" (um doc da P12.6) e "627/5.554" (código vivo, P12.7, e este frontend) é um erro de redação isolado no documento — esqueceu de excluir "Não informou" do denominador depois de excluir "Recusa". O código está correto; o par canônico fixado é **627/5.554 ≈ 0,112892**. Nenhuma alteração de dado foi feita; a correção é de registro, citando o código como fonte canônica.

## Verificação real (não só compilação)

- **Typecheck**: limpo no monorepo inteiro; os únicos erros remanescentes (`educacao-p113`/`p114`) são pré-existentes, de uma fase anterior, não relacionados.
- **Testes unitários**: 16 casos novos (`tests/unit/wellbeing-page-build.test.ts`) cobrindo a lógica pura de montagem e narrativa — todos passando. Suíte completa com 494 passando / 44 falhas pré-existentes (ambiente de cluster de teste não disponível nesta sessão, nenhuma relacionada a Bem-estar) — ver `REGRESSOES_P128.md`.
- **E2E real em navegador** (`tests/e2e/wellbeing-p128.spec.ts`, Playwright/Chromium): 15 testes, 15 passando, contra um build isolado e, na verificação final, contra o servidor de desenvolvimento real — cobrindo os 8 territórios pedidos pela missão mais Distrito Federal, larguras de 320 a 1920px, foco de teclado, movimento reduzido, e ausência de erro de console.
- **9 screenshots reais** (não mockados) em `artifacts/p128-frontend/`, inspecionados visualmente, não só confirmados por tamanho de arquivo.
- **2 bugs reais** encontrados só ao renderizar de verdade (overflow em 320px por valor sem ponto de quebra; heading de município e UF idênticos por um ternário com os dois ramos iguais) e corrigidos, com reteste confirmando a correção.
- **1 erro de dado corrigido durante esta auditoria**: o id usado para "Boa Esperança do Norte, MT" em uma nota anterior desta sessão (`5102504`) era na verdade Cáceres, MT. Detectado só pela inspeção visual do screenshot (não teria sido pego por `curl` ou por um teste que só checasse HTTP 200), corrigido para o id real (`5101837`) e re-testado.

## Orçamento de armazenamento

`pg_database_size` idêntico antes e depois (33.960.234.131 bytes) — crescimento zero, como exigido para uma fase só de leitura. Detalhe em `ARMAZENAMENTO_P128.json`.

## O que fica de fora, deliberadamente

- Nenhum dado de CadÚnico, Bolsa Família ou BPC (fontes ainda não publicadas neste domínio).
- Nenhuma média estadual simples de IDCRAS/IDCREAS/IDConselho (exigiria ponderação por população que o read model não calcula) — a UF mostra só agregados de soma (válidos independente de ponderação).
- Nenhum índice composto de bem-estar, nenhum ranking entre territórios.
- `components/education/education-ui.tsx` tem o mesmo padrão de `StatGrid` do bug #1 acima e provavelmente o mesmo risco em 320px — não corrigido aqui, fora do escopo de uma fase sobre Bem-estar; registrado em `REGRESSOES_P128.md` para decisão própria.

## Status

Funcionalidade completa, testada com dados reais (não mockados), sem crescimento de banco, sem regressão detectada em outras áreas temáticas ou coletores. Nada desta fase foi commitado — aguardando decisão do usuário sobre o commit, consistente com o padrão já estabelecido nas fases anteriores de Bem-estar (P12.1–P12.7), todas em produção sem commit.
