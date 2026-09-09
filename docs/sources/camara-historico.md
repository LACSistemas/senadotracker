# Câmara: histórico de exercício e partido

Escopo: T013. GET [histórico de 204554](https://dadosabertos.camara.leg.br/api/v2/deputados/204554/historico), HTTP 200, JSON UTF-8 em 08/09/2026 às 12:21:22 UTC. [Fixture](../../tests/fixtures/sources/camara-historico.json) e [proveniência](../../tests/fixtures/sources/camara-historico.provenance.json).

## Contrato observado

Envelope `dados` array e `links` array. No [OpenAPI consultado](https://dadosabertos.camara.leg.br/api/v2/api-docs), a rota `/deputados/{id}/historico` documenta `id` e `Accept`; não documenta filtros temporais ou paginação. A amostra retornou oito registros e apenas link `self`. Se a fonte passar a retornar paginação, isso precisa de verificação explícita antes de assumir completude.

Cada evento repete `id`, `uri`, `nome`, `siglaPartido`, `uriPartido`, `siglaUf`, `idLegislatura` e acrescenta `dataHora`, `situacao`, `condicaoEleitoral`, `descricaoStatus`. `situacao` e `condicaoEleitoral` podem ser nulos. A sequência registra mudanças de estado, não intervalos prontos nem datas jurídicas de filiação eleitoral.

Recorte real para 204554:

| `dataHora` | `siglaPartido` | `situacao` | `condicaoEleitoral` |
| --- | --- | --- | --- |
| 2019-02-01T11:45 | PHS | Exercício | Titular |
| 2019-02-26T17:28 | PR | Exercício | Titular |
| 2019-05-22T17:05 | PL | Exercício | Titular |
| 2022-04-19T17:43 | PSC | Exercício | Titular |
| 2022-07-13T18:01 | PSC | Licença | Titular |
| 2022-11-11T00:00 | PSC | Exercício | Titular |
| 2023-01-31T23:59 | PSC | FIM_MANDATO | Titular |
| 2023-02-01T00:00 | PSC | nulo | nulo |

O último registro tem descrição de nome/partido no início da legislatura. Não significa reassunção, não deve virar “Exercício” e não deve apagar silenciosamente a evidência de fim de mandato.

## Reconstrução planejada

- Guardar os eventos como retornados, inclusive espaços nos nomes e estados nulos. Normalizar para busca em campo separado.
- Ordenar por `dataHora` para derivar estados; empates com conteúdo divergente são ambíguos. A ordem original é evidência, não desempate semântico.
- O payload não informa ID único do evento. Chave candidata: pessoa + legislatura + dataHora + fingerprint dos campos; preservar revisões por coleta para que correção não pareça novo fato independente.
- Derivar intervalos de estado com começo inclusivo e término no próximo evento relevante exclusivo, rotulados como derivados. Mudança só de nome/partido não encerra exercício. Evento de exercício desconhecido exige incerteza explícita.
- Não projetar estado anterior ao primeiro evento nem além de término de mandato comprovado. O contrato de presença terá de validar a precisão temporal necessária.
- `dataHora` não contém offset. Preservar como data/hora civil da fonte; não adicionar `Z`, nem usar o fuso do computador. O fuso do evento precisa de confirmação antes de conversão a instante UTC.
- Não equiparar `siglaPartido`/alteração cadastral a data oficial de filiação ao TSE. Preservar `uriPartido`, pois uma alteração de sigla pode refletir mudança da organização, não troca voluntária de partido.

## Cobertura e limites

A fixture foi escolhida por conter mudança partidária, licença, retorno, fim de mandato e nulo. A coleta integral do cadastro em 08/09/2026 observou também `CONVOCADO`, `SUPLENCIA`, `VACANCIA`, `SUSPENSO` e `Afastado`; os valores são preservados literalmente. Isso valida os estados encontrados naquela execução, não a completude de toda a história ou todas as condições eleitorais. A codificação da Câmara permanece independente da suplência do Senado.

Responsável, acesso sem token e limites operacionais seguem [cadastro da Câmara](camara-cadastro.md). Cadência proposta: diária para alterações e semanal para reconciliação; sem frequência garantida pela fonte. Não inferir ausência em sessão/votação a partir destes eventos.
