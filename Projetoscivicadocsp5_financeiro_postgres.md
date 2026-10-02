
## P5B — Auditoria de fornecedores

A base P5A permanece íntegra. O inventário SQLite contém 34.606 suppliers, 39.201 supplier_names, 34.606 supplier_identifiers, 224.865 expense_supplier_links e agregados publicados de supplier. Esses dados derivados não foram carregados no schema PostgreSQL nesta rodada.

P5B = OPEN. A implementação dos DTOs de fornecedor, networks, busca, paginação, categorias e performance ainda requer adapter PostgreSQL independente e carga dos artefatos derivados. Nenhuma divergência foi declarada como PASS sem comparação.

## Continuação — blocker de DTO e adapter público

A prova reproduzida confirmou que o total PostgreSQL da Câmara era exatamente 2x o SQLite porque a consulta PG agregava o universo financeiro sem aplicar a seleção da publicação ativa de profiles antes do agrupamento. O SQLite encadeia active_publications → profiles → expenses; o SQL PG usado no comparator tinha apenas expenses. A correção mínima é materializar o conjunto de external_id da publicação ativa por source e aplicá-lo antes dos agregados/DTOs.

Supplier DTOs, networks, busca e paginação ainda não foram executados com adapter independente. Permanecem OPEN até a implementação desse vínculo de profile/publication e da camada PG canônica de supplier.

## Implementação do adapter PostgreSQL financeiro

Foi implementado `packages/db/src/postgres-finance.ts`, sem imports de SQLite, DatabaseSync, cache ou fallback. O adapter cobre anos publicados, comparação paginada de despesas, detalhe de despesa e explorer básico de fornecedores. A publicação ativa de perfis foi materializada no laboratório em `civica_finance_poc.active_profile_publications` (594 perfis), e o adapter aplica esse vínculo antes dos agregados.

Gates técnicos: DB typecheck PASS; Web typecheck PASS; Web build PASS.

A validação dos DTOs identificou que o contrato SQLite de comparação ainda precisa de uma conferência específica da fórmula de total antes de declarar parity final; supplier detail, networks e market ainda não foram implementados neste adapter. P5 permanece OPEN.

# ESTADO FINAL AUTORITATIVO P5

P5A e os gates atômicos/monetários derivados permanecem PASS. O adapter PostgreSQL financeiro aplica active_profile_publications, mas o comparator ainda não fechou o DTO de comparação: o total da Câmara continua divergente (SQLite 8.940.989.853; PostgreSQL 17.881.979.706) apesar de 398 itens em ambos. A causa permanece multiplicidade/seleção do vínculo de perfil/publicação e exige field diff antes de declarar DTO PASS.

Supplier explorer básico está implementado no adapter, mas supplier detail, market, networks, busca e paginação canônicas ainda não possuem parity executada. P5 = OPEN. Produção OFF; SQLite autoritativo.

## Continuação obrigatória após expense DTO

A correção do profile/publication join foi validada: Câmara 398 IDs e total 8.940.989.853 centavos em SQLite e PostgreSQL; Senado 78 IDs e total 2.032.527.218 em ambos. A cardinalidade anterior 2x vinha da ausência do filtro do batch financeiro ativo.

Supplier explorer: a primeira página real de 25 suppliers de 2026 teve IDs e ordenação idênticos entre SQLite e PostgreSQL. A busca/normalização e paginação completas ainda precisam de campanha integral; supplier detail, market e networks ainda não foram fechados. Não declarar P5 PASS prematuramente.

Technical gates continuam DB/Web typecheck e build PASS. Produção OFF.

## Campanha final solicitada — resultado operacional

O adapter foi ampliado com supplier detail e redes fornecedor/parlamentar, sempre usando PostgreSQL. O typecheck do DB passou. A campanha integral de 19.491 suppliers foi iniciada com páginas de 100 itens e persistência externa, mas não concluiu dentro do limite operacional: a consulta repetida de explorer sem agregação materializada excedeu vários minutos. Isso é um blocker de performance concreto do contrato público, não um gate omitido. A primeira página permanece equivalente; a campanha integral precisa de uma consulta batched/materialização de agregados para concluir search/sort/pagination sem N+1.

## Supplier explorer rollup — execução

Foi criada a read model PostgreSQL reproduzível `civica_finance_poc.supplier_explorer_rollup`, derivada exclusivamente de expenses ativos, links confirmados e suppliers PostgreSQL. A construção agrega uma vez por year/supplier e possui índice determinístico para ordenação e paginação.

O rollup parlamentar produziu 16.979 suppliers em 2026, enquanto o contrato SQLite do explorer retorna 19.491 porque inclui dimensões adicionais do modelo público (inclusive suppliers sem relação parlamentar confirmada/atividade institucional). Portanto o rollup reduz o custo da agregação, mas ainda não é semanticamente equivalente ao universo completo do explorer. A campanha integral foi interrompida neste ponto por blocker de cobertura do read model, não por timeout.

Blocker técnico: incorporar as dimensões derivadas reais usadas pelo SQLite (`supplier_global_yearly`/atividade institucional) ao read model PG antes de declarar explorer/search/pagination PASS. P5 permanece OPEN.

## Cobertura global do explorer corrigida

O universo SQLite `supplier_global_yearly` foi carregado no laboratório com a revisão ativa `b6e6e74e-f374-4616-8513-2d05308b92d0`, sem copiar DTOs nem usar SQLite no read path. O rollup global foi reconstruído filtrando a revisão ativa e ano 2026.

Resultado: `supplier_explorer_rollup` PostgreSQL = 19.491 suppliers, igual ao explorer SQLite. A diferença anterior (16.979) vinha de incluir todas as revisões de `supplier_global_yearly`, em vez da revisão ativa; não era ausência de fonte institucional adicional. O modelo parlamentar/institucional já estava representado nos campos globais da revisão.

Próximo passo imediato: apontar o método explorer do adapter para esse rollup global e executar a campanha de páginas/search/sort. P5 permanece aberta até essa campanha final.

## Rollup global — campanha integral

Após filtrar a revisão ativa, o universo passou a 19.491 suppliers e a campanha percorreu 195 páginas de 100 itens. Resultado da sequência completa: 16.850 posições coincidentes e 2.641 divergências de ordem/valor. O universo cardinal está correto, mas os campos/sort ainda não reproduzem integralmente o SQLite.

A diferença restante está concentrada na semântica de valores nulos e composição de `parliamentary_value`/atividade global: o read model PG precisa preservar `NULL` e usar exatamente o campo de sort do SQLite (`NULLS LAST` e métricas separadas), sem substituir ausência por zero nem somar institucional quando o DTO ordena apenas atividade parlamentar.

P5 permanece OPEN; este é o blocker concreto atual para search/sort/pagination e para o fechamento do explorer.
