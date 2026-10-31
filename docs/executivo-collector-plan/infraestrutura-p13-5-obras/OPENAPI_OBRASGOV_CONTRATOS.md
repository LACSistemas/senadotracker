# Contrato OpenAPI Obrasgov

Endpoint de contrato: `GET https://api-publica.obrasgov.gestao.gov.br/obras/openapi.json`.

- título: API de dados abertos do Obrasgov
- versão: 1.0
- paginação: `pagina` (mínimo 1) e `tamanho_da_pagina` (1–200; padrão 50)
- envelope: `data`, `total_pages`, `total_items`, `page_number`, `page_size`
- endpoints observados: `/data-atualizacao`, `/projeto-investimento`, `/empenho`, `/execucao-fisica`, `/contrato`, `/geometria`, `/historico-situacao-cancelada-paralisada`, `/estudo-viabilidade`.

Não foram inventados endpoints de PAC, Transferegov ou de intervenção separados. O projeto Obrasgov é o identificador de ligação entre os recursos.
