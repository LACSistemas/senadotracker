# Fontes validadas

## Obrasgov

Fonte oficial: `https://api-publica.obrasgov.gestao.gov.br/obras/openapi.json` (HTTP 200, JSON, 61.655 bytes, versão 1.0). A documentação declara os endpoints `/data-atualizacao`, `/projeto-investimento`, `/empenho`, `/execucao-fisica`, `/contrato`, `/geometria`, `/historico-situacao-cancelada-paralisada` e `/estudo-viabilidade`.

Com `pagina=1&tamanho_da_pagina=1`, os totais efetivos observados foram: projetos 155.037; execução física 74.342; contratos 7.629; geometrias 241.018; histórico 8.368; empenhos 89.777. `data-atualizacao` retornou `2026-10-30T00:00:00`.

## Complementares

PAC e Transferegov permanecem documentados como fontes complementares, sem download nesta execução. PNCP e Siconfi foram apenas reutilizados por estruturas já existentes; nenhum fato financeiro foi copiado entre domínios.
