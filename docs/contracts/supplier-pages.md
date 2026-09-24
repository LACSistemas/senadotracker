# Contratos de leitura das páginas de fornecedores

## Separação obrigatória

`institutional` contém somente execução financeira oficial ligada a contratos. `parliamentary` contém despesas líquidas CEAP/CEAPS. Os universos nunca são somados em um único valor.

## `/fornecedores`

DTO compacto com filtros de Casa, ano e categoria: total pago comprovado, fornecedores, categoria líder, fornecedor líder, concentração Top 5, distribuição por categoria e série por Casa. Cada valor carrega período, `n`, revisão, atualização e estado de cobertura. Contrato, faturamento, empenho e liquidação não entram no KPI de pago.

## `/fornecedores/explorar`

Busca global paginada no SQL por nome normalizado ou documento, filtros de papel, Casa e ano, ordenação estável e nulos ao fim. Retorna identidade pública permitida, aliases, papéis, Casas e valores parlamentar/institucional em campos separados. A página inicial não carrega lançamentos, contratos ou movimentos individuais.

## `/fornecedores-parlamentares`

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
