# Contratos de leitura das páginas de fornecedores

## Separação obrigatória

`institutional` contém somente execução financeira oficial ligada a contratos. `parliamentary` contém despesas líquidas CEAP/CEAPS. Os universos nunca são somados em um único valor.

## `/legislativo/fornecedores`

Hub unificado do universo de fornecedores do Congresso. Uma lente (`?lente=tudo|parlamentar|institucional`, default `tudo`) governa a página inteira sem disparar consultas adicionais: `congressSupplierOverview` busca as duas dimensões (`parliamentary_net_scaled` e `institutional_paid_scaled`) em uma única leitura por Casa/ano, e a lente apenas seleciona quais campos já carregados são exibidos. Modo `tudo` soma as duas dimensões em `totalObservedCents` — soma de universos com semânticas contábeis diferentes, nunca um gasto único reconciliado — e deduplica fornecedores por entidade (`suppliersLinked`) para a contagem, nunca por valor. Cada modo tem seu próprio total, contagem de fornecedores, fornecedor líder e Top 5, calculados a partir da mesma leitura. Categorias institucionais permanecem `unavailable` até a fonte publicar `natureza`/`elemento de despesa`; o produto mostra um estado NOT_READY explícito em vez de reaproveitar categorias de cota parlamentar. Sem tabela nesta rota — o CTA final leva a `/legislativo/fornecedores/explorar` (base completa) e `/legislativo/fornecedores-parlamentares` (mercado dos gabinetes).

## `/legislativo/fornecedores/explorar`

Busca global paginada no SQL por nome normalizado ou documento, filtros de papel, Casa e ano, ordenação estável e nulos ao fim. Retorna identidade pública permitida, aliases, papéis, Casas e valores parlamentar/institucional em campos separados. A página inicial não carrega lançamentos, contratos ou movimentos individuais.

## `/legislativo/fornecedores/radar`

Cruzamento de fornecedores por documento entre despesas parlamentares de múltiplos parlamentares (distinto do hub unificado). Detalhe por CNPJ em `/legislativo/fornecedores/radar/[documento]`.

## `/legislativo/fornecedores-parlamentares`

Agregados CEAP/CEAPS por fornecedor, ano, Casa, mês e categoria. Métricas: líquido com estornos, lançamentos, parlamentares, UFs, partidos, maior cliente, Top 5/20, primeiro/último registro, recorrência e marcos cumulativos. “Novo” significa primeiro registro observado na cobertura.

## Detalhe global

Identidade e aliases são carregados primeiro. Atividade parlamentar e institucional são painéis independentes e paginados. CPF não é exposto em URL ou título. Valores contratuais formam uma escada separada — estimado, proposto, adjudicado, original, atual, faturado, empenhado, liquidado e pago — sem soma transversal.

## Orçamentos

- consultas iniciais: uma consulta de dados e uma de contagem por bloco;
- paginação no banco;
- máximo de 100 linhas por página;
- séries e detalhes sob demanda;
- nenhum loop de entidades dispara SQL;
- filtros ficam na URL e só são aplicados no submit.
