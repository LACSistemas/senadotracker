# Câmara: cadastro de deputados

Validado em 08/09/2026 por HTTPS sem autenticação. Responsável: Câmara dos Deputados. Escopo: T012; histórico em [camara-historico.md](camara-historico.md).

## Referências e consultas

- [Portal oficial](https://dadosabertos.camara.leg.br/swagger/api.html).
- [OpenAPI efetivo](https://dadosabertos.camara.leg.br/api/v2/api-docs), descoberto no HTML do portal; [extrato](evidence/camara-openapi.json).
- GET `https://dadosabertos.camara.leg.br/api/v2/deputados?itens=2&pagina=1&ordem=ASC&ordenarPor=nome`: HTTP 200, JSON UTF-8.
- A chamada seguinte usou o `href` de `links[rel=next]`: `https://dadosabertos.camara.leg.br/api/v2/deputados?ordem=ASC&ordenarPor=nome&pagina=2&itens=2`, também HTTP 200.
- GET `https://dadosabertos.camara.leg.br/api/v2/deputados/204554`: HTTP 200, objeto `dados` com `ultimoStatus`; contém dados pessoais adicionais que não foram incluídos nas fixtures.
- [Página 1](../../tests/fixtures/sources/camara-lista.json), [página 2](../../tests/fixtures/sources/camara-page2.json), acompanhadas de arquivos `.provenance.json`.

Os IDs observados nas duas páginas são 204379, 220714, 221328 e 204560. Somente duas páginas foram coletadas: isso valida a transição de página, não o cadastro completo. `last` apontava à página 257 com dois itens por página; não multiplicar isso para anunciar total de deputados.

## Semântica e campos

Segundo o OpenAPI, `/deputados` sem parâmetro temporal lista exercício no momento da consulta. Com `idLegislatura` ou intervalo, pode incluir quem exerceu em algum momento do período: não rotular todos como atualmente em exercício.

Envelope de lista: `{ dados: [...], links: [...] }`. Envelope de detalhe: `dados` é um objeto. Campos de uma linha:

| Campo | Tipo observado | Regra |
| --- | --- | --- |
| `id` | número inteiro | Converter sem perda a string externa com namespace `camara` |
| `uri` | string HTTPS | Referência do recurso oficial; ID deve concordar com o caminho |
| `nome` | string | Nome parlamentar; não usar como chave |
| `siglaPartido`, `uriPartido` | strings | Preservar ID/URI partidária; siglas podem mudar ou ser reutilizadas |
| `siglaUf` | string | UF no contexto retornado |
| `idLegislatura` | número inteiro | Contexto institucional, não identificador de pessoa ou de exercício |
| `urlFoto` | string HTTPS | Referência oficial |
| `email` | string ou nulo conforme rota | Contato institucional; omitido das fixtures |

Detalhe de pessoa existente historicamente não comprova exercício atual. `ultimoStatus` é o último estado cadastrado, não substitui a coleção histórica.

## Parâmetros e paginação

O OpenAPI documenta `id`, `nome`, `idLegislatura`, `siglaUf`, `siglaPartido`, `siglaSexo`, `dataInicio`, `dataFim`, `pagina`, `itens`, `ordem` e `ordenarPor`. Datas de filtro: `YYYY-MM-DD`. IDs e alguns filtros aceitam listas separadas por vírgulas. Foram exercitados apenas página/tamanho/ordenação nesta rodada; limites máximos de `itens` não foram confirmados.

Seguir `links.rel=next` até sua ausência, validando HTTPS e o host/caminho oficiais. Impedir ciclos e repetições. `dados=[]` com próxima página inesperada ou erro não equivale a fim válido. Como uma coleta pode atravessar mudanças no cadastro, reconciliar IDs e contagens antes de publicar; não há garantia de snapshot transacional entre requisições.

O OpenAPI anuncia JSON/XML. JSON foi testado, sem cabeçalho de autenticação. Não pressupor frequência, SLA ou acesso ilimitado; proposta de consulta diária com concorrência conservadora. A licença específica de redistribuição e limites precisam de confirmação antes de exportação em massa. Atribuir sempre a fonte.

## Descoberta e falhas relevantes

`/api/v2/swagger.json` retornou 405; `/swagger/swagger.json` retornou 200 com HTML. Nenhum deles é a especificação validada. Esse caso reforça a necessidade de validar tipo de conteúdo e envelope, além do status HTTP. O endereço comprovado é `/api/v2/api-docs`.
