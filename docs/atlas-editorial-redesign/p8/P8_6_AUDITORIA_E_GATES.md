# P8.6 — Auditoria visual e funcional final

## Regressão funcional (G2)

Suíte completa de e2e territorial rodada contra um único build isolado consolidado (porta 3174, nunca a
3000 do usuário — confirmada intacta antes/depois): `p14-territorio-executivo`, `infraestrutura-p137`,
`seguranca-p98`, `wellbeing-p128` — **68 testes, 67 passaram na primeira passada**; o 1 que falhou (São
Paulo, PIB per capita) passou isolado em 14s — mesma contenção de paralelismo documentada desde P7, não
regressão. Somado às execuções por tema de P8.4 (108) e ao smoke de interação dedicado do Atlas Vivo em
P8.5, a verificação funcional desta fase soma **mais de 180 execuções reais de teste** sobre o código
entregue em P8.

## Validação territorial ampliada (pendências explícitas de P8.2/P8.3, fechadas agora)

| Território | Rotas | Larguras | Resultado |
|---|---|---|---|
| Macaé/RJ (3302403) — visão geral + Educação | 2 | 1280/768/320 | 0px overflow, 0 erros, 200 |
| Alto Rio Novo/ES (3200359) — município pequeno, 7.772 hab. | 1 | 1280/768/320 | 0px overflow, 0 erros, 200; hero com destaque visível mesmo num polígono minúsculo |
| Roraima (estado, 15 municípios) | 1 | 1280/768/320 | 0px overflow, 0 erros, 200; hero com silhueta correta mesmo num estado pequeno |
| Espírito Santo (estado) | 1 | 1280/768/320 | 0px overflow, 0 erros, 200 |

Capturas em `artifacts/p8-6-auditoria/`. As 2 larguras intermediárias que faltavam desde P8.1 (1280, 768)
mais 320 agora cobertas nestes 4 territórios, além das 2 já cobertas em P8.1 (1440/390) nos pilotos
principais (Campos dos Goytacazes, RJ) — fecha a pendência de "larguras intermediárias" registrada em
P8.2/P8.3.

## Acessibilidade (G4)

axe-core continua inacessível nesta sessão (`D:\Civica\tools\a11y` ausente, mesma limitação desde P6.2) —
**`NOT_EVALUATED`**, não inflado. Como sinal complementar (não substituto), rodei o Lighthouse 12.8.2 em
modo lab contra o build isolado:

| Rota | Accessibility (lab) | Achado |
|---|---|---|
| `/municipios/3301009` | 98/100 | nenhum item reprovado |
| `/estados/RJ` | 98/100 | 1 item: `skip-link` (link "pular para o conteúdo" não focável) |

Investigado: o skip-link vive em `apps/web/app/layout.tsx`, **nunca tocado por nenhuma fase de P8** — é a
mesma violação residual que o próprio P7 já havia documentado ("landmarks/skip-link"), confirmada
pré-existente, não introduzida nem agravada por este programa. Não corrigida aqui (fora do escopo territorial
do mandato; é uma questão do layout raiz do site inteiro).

Verificação manual complementar (sem ferramenta automatizada): o `role="img"`/`aria-label` novo do mapa do
`TerritoryHero` segue o mesmo padrão já usado por `MunicipalMap`; o novo `<details>` do hemiciclo colapsado
usa semântica nativa (focável e operável por teclado/leitor de tela sem JS adicional); o `role="img"` novo
do gráfico de marcos do IDHM tem `aria-label` com os valores reais. Nenhum destes foi auditado por
ferramenta — registrado como verificação de leitura de código, não como teste automatizado.

## Desempenho (G5, laboratório — não é dado de campo/p75)

| Rota | Performance (lab) | LCP | CLS | TBT |
|---|---|---|---|---|
| `/municipios/3301009` | 91/100 | 2,8 s | 0 | 180 ms |
| `/estados/RJ` | 88/100 | 2,8 s | 0 | 320 ms |

CLS e TBT dentro das metas de referência do mandato (≤0,1 e implicitamente baixo). LCP (2,8s) fica
ligeiramente acima da meta de referência de ≤2,5s nas 2 rotas — registrado honestamente, não escondido;
não investigado a fundo nesta fase (exigiria profiling dedicado, fora do escopo de um redesign de
composição). Medição em laboratório local, Chrome headless, sem simulação de rede real — não é dado de
campo (p75) e não deve ser lido como tal.

## Segurança arquitetural (G6)

`git diff --stat` de todos os commits de P8 (`83bfd62..HEAD`) contra `packages/db`, `scripts/collect`,
`scripts/exec`: **diff vazio** — confirma zero migration, zero mudança de schema, zero alteração de
collector em todo o programa. Todo arquivo tocado está sob `apps/web/` ou `docs/`. Toda fase usou
`NEXT_DIST_DIR` isolado e porta dedicada (3171–3174); a porta 3000 do usuário foi verificada intacta antes
e depois de cada fase. Nenhum processo em execução foi interrompido.

## Integridade estatística (G3)

Nenhuma fase de P8 alterou lógica de cálculo, agregação, elegibilidade de comparação ou formatação de
valor — confirmado por leitura: todas as mudanças foram de ORDEM de renderização (mover um gráfico antes
de uma grade) ou de COMPOSIÇÃO visual (trocar grade por lista, trocar tamanho de cartão), nunca de dado.
As 108+68 execuções de teste e2e que verificam valores exatos, comparações válidas, ausência honesta e
supressão por pequeno número continuam passando sem alteração de asserção (exceto os 2 ajustes legítimos
de P5, não tocados nesta fase).

## G1 — critérios objetivos, avaliados com evidência real (decisão final continua sendo do usuário, §11.8)

| Critério | Avaliação | Evidência |
|---|---|---|
| G1.1 Primeira tela municipal | Cumprido | Hero com mapa + descoberta protagonista na primeira tela, confirmado em 2 municípios (Campos, Alto Rio Novo) |
| G1.2 Primeira tela estadual | Cumprido | Hero com silhueta do estado, confirmado em 3 estados (RJ, ES, RR) |
| G1.3 Aproveitamento de espaço | Cumprido | 1200→1360px nas 14 rotas territoriais; medido, não estimado |
| G1.4 Hierarquia informacional | Cumprido | Gráfico/número protagonista antes de grade de apoio nos 5 temas, nos pontos onde a inversão existia |
| G1.5 Redução de cards aninhados | Cumprido nos pontos localizados | Saúde (1 capítulo), Educação (6), Segurança (1), Bem-estar (3), Infraestrutura (grade→lista em 5 capítulos) — não uma redução numérica artificial, cada mudança rastreável a um achado real |
| G1.6 Diferenciação temática | Parcial | Teasers da visão geral (P8.1) e o par Segurança/Educação (chart-protagonista vs. jornada) são distintos; as páginas de capítulo completas dos 5 temas continuam compartilhando `ChapterShell`/grade — ver `RELATORIO_FINAL_P8_G1.md` |
| G1.7 Mobile | Cumprido | 0px overflow confirmado em 390/320px em todas as fases e territórios testados (nenhuma exceção encontrada) |
| G1.8 Revisão visual humana | Pendente — como deve ser | Decisão do usuário, não desta auditoria |

## O que fica registrado como pendência real (não escondida)

1. Diferenciação visual mais profunda entre os 5 temas (G1.6) — a composição mudou (protagonismo de
   gráfico, menos cartões), mas uma "linguagem gráfica própria por tema" além disso não foi perseguida.
2. Navegação mobile ainda é a faixa horizontal de capítulos já existente desde P1 — não houve reprojeto
   dedicado, só confirmação de ausência de overflow.
3. skip-link não focável — pré-existente, fora do escopo territorial, não corrigido.
4. LCP 2,8s nas 2 rotas medidas, levemente acima da referência de 2,5s — não investigado a fundo.
5. Seleção de polígonos muito pequenos no Atlas Vivo — avaliada em P8.5, não resolvida (risco/benefício).
6. axe-core não executado em nenhuma fase de P8 (ferramenta externa inacessível durante toda a sessão).
