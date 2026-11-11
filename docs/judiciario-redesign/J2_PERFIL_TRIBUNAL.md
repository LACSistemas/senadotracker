# J2 — Perfil de tribunal como dossiê investigativo

Reconstrução de `apps/web/app/judiciario/tribunais/[id]/page.tsx`, validada no TJES (Justiça Estadual) e no STF (tribunal superior, com capítulos exclusivos de P14.9–P14.12).

## O que mudou

- **Trilha + cabeçalho institucional compacto** (novo): `Judiciário / Tribunais / {sigla}` acima de uma barra verde com ícone, nome oficial + sigla, ramo/UF, descrição de uma linha e 3 chips (UF, ano-base, fonte) — substitui o `InstitutionHero` genérico de banner grande, que o próprio mandato pede para evitar aqui (§6.1).
- **Navegação por capítulo**: trocado `ChapterNav layout="sidebar"` por `layout="inline"` (barra horizontal sticky, mesmo componente já usado nas páginas de tema — não foi criado nada novo nem alterado o componente compartilhado, usado também pelo domínio de Segurança).
- **"Retrato institucional"** (capítulo Visão geral): 4 KPIs — casos novos, processos baixados, processos pendentes e, agora, **taxa de congestionamento própria do tribunal** (válida neste grão, ao contrário do nacional — ver `J0_AUDITORIA_E_CONTRATOS.md` §4.2). Substituiu "Magistrados atuantes" nesse card específico; magistrados continua em Estrutura.
- **"Movimentação processual" + "Tempo e desempenho"** lado a lado (novo layout de 2 colunas): o gráfico existente (`TribunalIndicatorSeries`) ganhou companhia — um card com índice de atendimento à demanda e tempo médio dos baixados (reaproveitados da antiga seção "Tempo", só reposicionados) — e um CTA "Comparar com outros tribunais" linkando pro comparador já filtrado por este tribunal.
- **"Em destaque"** (novo): 3 cards-teaser (Estrutura e pessoas / Finanças / Assuntos) com um número real de cada seção, só renderizados quando a seção correspondente existe — evita o problema explícito do mandato de "não renderizar seção vazia por simetria" (no STF, só "Estrutura e pessoas" aparece, porque Finanças/Temas não têm dado nesse tribunal).
- **Capítulos preservados sem alteração de conteúdo**: Estrutura, Finanças, Temas, Metodologia — e, criticamente, **Jurisprudência** (STJ: precedentes; STF: Repercussão Geral + acórdãos/decisões monocráticas) e **Ministros** (STF, P14.12: grade de cards com foto oficial, situação e remuneração bruta real) sobrevivem intactos, no mesmo lugar na composição adaptativa (`activeChapters.filter(...)`).

## Achado real durante a implementação

Um achado real de layout: a aba nova "Movimentação processual"/"Tempo e desempenho" em grid de 2 colunas quebrava a 390px (overflow de 286px) porque o item de grid sem `min-w-0` herda `min-width: auto` e se recusa a encolher abaixo da largura intrínseca do SVG do gráfico — clássico bug de CSS Grid. Corrigido com `min-w-0` na grid e na primeira coluna; confirmado por medição real (overflow caiu para 0) antes de prosseguir.

## Verificação

- Typecheck limpo (`@senadotracker/web`, dist isolado).
- Capturas reais: TJES desktop/mobile, STF desktop (`artifacts/j0-judiciario-redesign/tjes-j2-*.png`, `stf-j2-desktop.png`) — inspecionadas visualmente, sem sobreposição, sem card vazio renderizado indevidamente.
- Suíte e2e completa do Judiciário: **52/52 passando** (`p148`, `p150`, `p151`, `p152`) — incluindo a restauração de "Despesa com magistrados" nacional (ver nota abaixo) e o capítulo de Ministros do STF com fotos.

## Nota de integridade (G2)

A reconstrução do panorama nacional (J1) tinha inicialmente removido o 5º KPI "Despesa com magistrados" do topo para bater com a composição de 4 cards do mock — isso quebrou um teste e2e de P14.9 que validava esse número real. Em vez de apagar o teste ou o dado, o valor foi reintroduzido como uma nota abaixo da grade de KPIs (`R$ 34,5 bi`, com link pro comparador), preservando o conteúdo sem voltar a um 5º card que descaracterizaria a composição aprovada.

## Pendência conhecida (polimento, não bloqueante)

Quando só 1 dos 3 cards "Em destaque" tem dado (caso do STF, só "Estrutura e pessoas"), o grid de 3 colunas deixa um card estreito e duas colunas vazias — visualmente correto (nenhuma seção falsa aparece) mas não ideal esteticamente. Fica registrado para o polimento de J5.
