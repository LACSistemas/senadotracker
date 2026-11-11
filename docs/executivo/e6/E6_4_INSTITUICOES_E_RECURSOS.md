# E6.4 — "Quem cuida de quê" e recursos/entregas

## "Quem cuida de quê no Brasil?"
Antes: 3 `<div>` com borda própria, cada uma uma "ilha" visual (grid `gap-4 sm:grid-cols-3`). Depois: uma única faixa conectada (`overflow-hidden rounded-2xl border`, divisores internos em vez de bordas separadas, cor alternada entre as 3 colunas), com uma nota de rodapé explícita dentro da própria faixa: "As três esferas não têm relação de subordinação administrativa entre si". Mesmo texto de cada esfera, preservado integralmente (nenhuma competência federativa foi reescrita ou simplificada) — a mudança é só de composição, não de conteúdo. Nenhum organograma hierárquico foi criado (o mandato veda implicar subordinação inexistente); a faixa é deliberadamente horizontal e simétrica, não uma árvore.

## Recursos, contratos e entregas
Esta era a seção mais textual da página inteira — 2 parágrafos e 2 links, nenhum gráfico. Investigação real (mandato §19) confirmou dado elegível já existente no pacote `@senadotracker/db`, nunca chamado nesta página:

- `getInfrastructureWorksOverview({level:'BRASIL'})`: 155.037 projetos cadastrados no Obrasgov nacionalmente, com estágios financeiros reais (planejado R$958bi, contratado R$107,7bi, empenhado R$109,4bi, liquidado R$1,07bi, pago R$24,3bi).
- `getInfrastructureWorksBySituation({level:'BRASIL'})`: 6 situações **mutuamente exclusivas** (cada obra tem exatamente 1 situação) — Cadastrada 83.143, Concluída 44.577, Em execução 20.967, Cancelada 3.911, Inacabada 1.026, Paralisada 825.

### Por que viraram um gráfico e os estágios financeiros não
As 6 situações são categorias reais de um mesmo universo (projetos), por isso viraram uma barra ranqueada real. Os 5 estágios financeiros (planejado→contratado→empenhado→liquidado→pago) **não** foram transformados num funil ou somados: são o MESMO valor avançando por etapas do processo orçamentário, e os números reais não seguem uma progressão monotônica limpa nesta base (liquidado, R$1,07bi, é menor que pago, R$24,3bi — provavelmente por como o Obrasgov registra cada etapa, não uma simplificação nossa) — construir um funil forçaria uma narrativa que o dado não sustenta. Em vez disso, uma nota explícita no card afirma a regra: "estágios distintos do mesmo recurso avançando — não somados aqui, nunca tratados como despesa realizada até a etapa de pagamento confirmada" (mandato §19, veda exatamente essa soma).

## Achado real corrigido: 2 links para `/obras`, rota inexistente
`/obras` não existe como índice nacional (só `/obras/[projectId]`, uma página de detalhe — 404 sem um ID real). Usado em 2 lugares: a pergunta investigativa "Quais obras e serviços de infraestrutura estão em andamento?" e a lista de "Recursos". Corrigidos: a pergunta agora aponta para `#recursos` (a nova seção, na mesma página, com a resposta real); a lista de recursos agora linka para `/estados` (onde cada estado tem sua própria aba de obras territoriais, rota real).
