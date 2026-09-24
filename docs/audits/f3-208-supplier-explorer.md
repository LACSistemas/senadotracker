# F3-208 — consulta global paginada

`publishedSupplierExplorer` usa `supplier_global_yearly` ou `supplier_global_house_yearly`, ambas materializadas na revisão ativa. A consulta faz contagem e página diretamente no banco, com filtros de ano, Casa, tipo de atividade e busca prefixada por nome/CNPJ. Os valores `parliamentary` e `institutional` são DTOs independentes; não existe soma implícita.

Cada página faz uma consulta principal e três consultas fixas em lote para aliases, CNPJ público e Casas observadas. Não há consulta por item. CPF, identificadores mascarados e identificadores não validados não aparecem no DTO público.

O endpoint CSV reutiliza a mesma consulta em páginas de 100 registros e escreve a resposta em streaming, com proteção contra formula injection.
