# Reconciliação com a Sinopse Superior

Status: **PARTIAL / NOT_EVALUATED** nesta execução.

Os links oficiais 2022, 2023 e 2024 estão publicados pelo INEP na página de [Sinopses da Educação Superior](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-superior). Tentativas de baixar os ZIPs diretamente de `download.inep.gov.br` retornaram 502/erro de socket no ambiente desta execução; nenhum total da Sinopse foi inventado.

Reconciliação interna executada: linhas de oferta, chaves finais, IES-ano, cursos distintos, municípios resolvidos e somas por território foram comparados entre staging, tabelas factuais e rollup. Todos os deltas internos foram zero. A reconciliação externa deve ser executada antes de qualquer publicação pública e deve comparar a mesma definição de universo (incluindo tratamento de `TP_DIMENSAO`).
