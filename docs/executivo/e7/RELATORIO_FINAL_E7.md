# E7 — Editorial Excellence do Executivo — Relatório final

Mandato: resolver as últimas deficiências estruturais do portal `/executivo` identificadas na avaliação visual humana da E6 — a primeira tela parecia um atlas, mas a página retornava progressivamente ao padrão de catálogo nas seções seguintes. Documentos de fase: `E7_0_AUDITORIA.md`, `E7_1_CINCO_AREAS.md`, `E7_2_COMPETENCIAS_FEDERATIVAS.md`, `E7_3_ATLAS_CONTEXTUAL.md`, `E7_4_OBRAS_E_RITMO_EDITORIAL.md`, `E7_5_AUDITORIA_FINAL.md`.

## Arquivos alterados/criados
- `apps/web/app/executivo/page.tsx` — cinco áreas reconstruídas, seção federativa substituída, destaque numérico em obras, correção de overflow.
- `apps/web/components/executivo/federative-explorer.tsx` (novo) — seletor interativo "Quem cuida de quê" por área de política pública.
- `packages/db/src/exec/read.ts` — `getHealthBedsByUf` (nova função de leitura, mesmas tabelas, sem migration).
- `tests/e2e/executivo-portal.spec.ts` — 3 testes atualizados (consequência real da reconstrução, não regressão escondida).

## O que foi reconstruído

1. **Cinco áreas da gestão pública (E7-A)**: de 5 cards idênticos para 5 composições com linguagem visual própria — distribuição territorial de leitos/mil hab. (Saúde), evolução do Ideb por edição (Educação), evolução anual de registros de tráfico (Segurança), 3 dimensões reais não somadas (Bem-estar), comparação de 3 serviços com a mesma unidade (Infraestrutura). **Revisado após feedback real do usuário** (ver "Revisão pós-entrega" abaixo): grade de largura igual (`sm:grid-cols-2`), não mais assimétrica.
2. **"Quem cuida de quê" (E7-B)**: de 3 cartões estáticos para um seletor por área (5 políticas públicas), cada uma com texto institucional real (base legal citada) para União/Estados/Municípios + competências compartilhadas — nunca hierarquia nem exclusividade inventada.
3. **Continuidade territorial (E7-C)**: Saúde (único tema com contrato por UF elegível nesta fase) passa a refletir a UF selecionada no atlas, com destaque visual no ponto da distribuição e valor exato — sem implicar ranking de qualidade.
4. **Obras e ritmo editorial (E7-D)**: número derivado real (28,9% das obras concluídas) abre a seção; gráfico e dados preservados integralmente.

## Achados reais corrigidos (bugs introduzidos e resolvidos na própria fase)
- Ícones de `lucide-react` passados como prop de Server Component para Client Component quebravam a página (erro 500 real) — corrigido substituindo o componente por uma chave string resolvida dentro do componente client.
- Overflow horizontal real (até 356px em 320px) causado por `min-width: auto` padrão do CSS Grid em itens contendo gráficos de largura mínima — corrigido com `min-w-0` nos 5 itens do grid; confirmado por medição numérica em 9 larguras, não só inspeção visual.

## Revisão pós-entrega: cards do mesmo tamanho (feedback real do usuário)
Depois da entrega inicial, o usuário avaliou a variedade das 5 visualizações como positiva, mas pediu que os cards tivessem o mesmo tamanho (a grade original era assimétrica: Saúde 7/12, Educação 5/12, etc.). A grade foi trocada para colunas de largura igual (`sm:grid-cols-2`) e os 5 painéis passaram a seguir o mesmo esqueleto estrutural (cabeçalho → 1 caixa com borda → link). Essa mudança de largura expôs **3 bugs reais adicionais**, todos encontrados e corrigidos na própria verificação desta revisão (nenhum reportado externamente):
1. O gráfico de Educação (`BarChart`, 11 linhas) ficava muito mais alto que o de Saúde, desequilibrando a altura da 1ª linha — trocado por uma visualização de linha (mais apropriada para uma série temporal contínua de qualquer forma), com altura fixa e compacta.
2. Em meia largura (~550px), os componentes compartilhados `LineChart`/`AreaTrend` (`min-w-[620px]`) cortavam silenciosamente o ponto mais recente da série dentro do próprio scroll interno do gráfico — sem erro visível, só um dado ausente (confirmado por captura: o Ideb de 2025 não aparecia). Corrigido substituindo-os por SVGs próprios, sem `min-width`, 100% responsivos — mesmo padrão já usado na distribuição de Saúde e no hero do J7.
3. Com os novos gráficos, 2 problemas de rotulagem de eixo reais apareceram e foram corrigidos: o primeiro rótulo (2015) cortado pela borda esquerda do SVG (corrigido ancorando texto à esquerda/direita nas pontas, não ao centro) e os 2 últimos rótulos (2025/2026) sobrepostos (corrigido suprimindo o rótulo automático adjacente ao ponto final).
4. Um `<title>` de SVG com múltiplos filhos JSX (`{d.label}: {d.value}`) disparava um aviso real do React, que por sua vez acionava o overlay de dev do Next.js — isso fez o axe-core apontar 1 violação nova (`region`) nesta revisão, que não existia na entrega original. Corrigido usando template string; confirmado por nova execução do axe-core, violações voltaram a 2 (as mesmas pré-existentes).

Após as correções: 44/44 testes e2e, axe-core 2 violações (mesmas pré-existentes), 0px de overflow em todas as larguras (exceto os 11px pré-existentes em 1024px), typecheck e build isolados limpos.

## Dados e fontes citados
Saúde: 2,47 leitos/mil hab., 6.636 hospitais (CNES/DataSUS); distribuição por UF min. 1,80 — mediana 2,43 — máx. 3,50. Educação: Ideb 6,3 (2025, anos iniciais, todas as redes), série 2005–2025 (INEP). Segurança: 215.948 registros de tráfico de drogas em 2025 (Sinesp VDE, abrangência Estadual, 27 UFs). Bem-estar: R$ 1.638,06 renda domiciliar per capita média (IBGE, 2022); 8.546 unidades da rede socioassistencial (Censo SUAS 2024); 59.970.945 vínculos formais ativos (fonte real do observation). Infraestrutura: Água 84,1%, Esgoto 62,3%, Resíduos sólidos 81,7% — % da população total atendida (SINISA, 2024). Obras: 154.449 registradas no Obrasgov, 28,9% concluídas.

## Testes
44/44 passaram na suíte combinada (`executivo-portal.spec.ts` + `p14-territorio-executivo.spec.ts` + `p148-judiciario.spec.ts`, 1,7 min). 3 testes precisaram de atualização real (ver `E7_5_AUDITORIA_FINAL.md`), nenhum teste foi enfraquecido para mascarar regressão. Typecheck e build isolados: limpos.

## Acessibilidade
axe-core real (via `D:\Civica\tools\a11y\...`): 2 violações, mesmas categorias pré-existentes do componente de mapa compartilhado desde H5 (`label-content-name-mismatch`, `nested-interactive`). 0 violações novas.

## Limitações
- Só Saúde reflete a UF selecionada nas cinco áreas — as outras 4 mostram dado nacional, por ausência honesta de contrato por UF já carregado (registrado, não escondido; estender isso exigiria novas consultas por UF fora do escopo desta fase).
- O console emite um warning pré-existente do componente compartilhado `charts.tsx` (`<svg> attribute height: Expected length, "auto"`) — confirmado reproduzível na página `/design-system`, intocada nesta fase; não é uma regressão de E7.
- Performance de campo não medida — sem RUM neste ambiente.

## Segurança arquitetural
Nenhuma migration, backfill, alteração de schema ou interrupção de coletor. A única mudança em `packages/db` foi uma função de leitura nova (`getHealthBedsByUf`) sobre tabelas já existentes. PNCP e demais coletores não foram tocados.

## Status dos gates (mandato §22)

| Gate | Resultado |
|---|---|
| G1 — Diferenciação temática | PASS |
| G2 — Experiência federativa | PASS |
| G3 — Continuidade cartográfica | PASS_WITH_CAVEATS (só Saúde reflete UF, registrado como limitação consciente) |
| G4 — Preservação do hero | PASS |
| G5 — Ritmo editorial | PASS |
| G6 — Mobile | PASS |
| G7 — Integridade estatística | PASS |
| G8 — Funcionalidade | PASS |
| G9 — Acessibilidade e performance | PASS (0 violações novas; performance de campo não medida) |
| G10 — Segurança arquitetural | PASS |

A aprovação visual final pertence ao usuário. Não declaro G1 aprovado unilateralmente — os gates acima são a minha própria verificação técnica, não uma aprovação humana.

## Status: E7_READY_FOR_USER_VISUAL_APPROVAL
