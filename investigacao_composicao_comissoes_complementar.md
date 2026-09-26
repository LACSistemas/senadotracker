# InvestigaÃ§Ã£o complementar — coleta integral de composiÃ§Ã£o

## Resumo

A direÃ§Ã£o `comissÃ£o → membros` Ã© mais adequada para composiÃ§Ã£o atual, mas os endpoints atualmente usados pelo projeto nÃ£o oferecem a mesma cobertura nas duas Casas.

NÃ£o implementei collector, migration, schema ou UI nesta investigaÃ§Ã£o.

## Senado — endpoints disponÃ­veis no projeto

O collector atual usa principalmente:

```text
https://legis.senado.leg.br/dadosabertos/senador/{id}/comissoes.json
https://legis.senado.leg.br/dadosabertos/senador/{id}/cargos.json
https://legis.senado.leg.br/dadosabertos/senador/{id}/relatorias.json
```

Essas rotas sÃ£o centradas no parlamentar. O payload preserva `bodyId`, `bodyLabel`, papel e datas, mas a coleta nÃ£o consulta um endpoint de composiÃ§Ã£o por colegiado.

Na base atual, nÃ£o foi encontrado collector existente para uma rota oficial `comissÃ£o → membros` do Senado. Portanto nÃ£o Ã© seguro afirmar que jÃ¡ buscamos integralmente a composiÃ§Ã£o do colegiado.

Para CMA (50), CCJ (34), CAE (38) e CEsp (2615), os appointments de membros encontrados continuam sendo uma amostra derivada dos 81 senadores consultados. Eles sÃ£o Ãºteis para `membros identificados`, mas nÃ£o comprovam censo oficial completo.

## CÃ¢mara — endpoint jÃ¡ conhecido

O projeto jÃ¡ usa:

```text
GET https://dadosabertos.camara.leg.br/api/v2/orgaos/{id}/membros
```

O raw `f2-camara-orgao-4-membros.json` possui objetos com:

```text
id
uri
nome
siglaPartido
siglaUf
idLegislatura
urlFoto
```

O arquivo possui 15 registros no exemplo do Ã³rgÃ£o 4. O arquivo anual `camara-orgaos-membros-L57.json` possui 13.314 registros e traz a relaÃ§Ã£o publicada entre Ã³rgÃ£o e deputado, com partido, UF, legislatura, datas/cargo conforme o registro.

Esse endpoint representa uma rota `Ã³rgÃ£o → membros` mais adequada para estado atual/legislatura. Contudo, o catÃ¡logo de `legislative_bodies` materializado pelo P0 veio principalmente de eventos de agenda, por isso os `bodyId` dos appointments da CÃ¢mara ainda nÃ£o encontram bodies canÃ´nicos. O problema Ã© crosswalk/materializaÃ§Ã£o, nÃ£o ausÃªncia de dados.

## Parlamentar → comissÃµes versus comissÃ£o → membros

| Uso | Parlamentar → comissÃµes | ComissÃ£o → membros |
|---|---|---|
| ComposiÃ§Ã£o atual | parcial, centrada nos parlamentares coletados | mais adequada se endpoint for snapshot completo |
| Titular/suplente | explÃ­cito quando publicado | explÃ­cito quando endpoint retorna cargo |
| PresidÃªncia | cargo pode aparecer em `cargos`/`office` | mais natural por Ã³rgÃ£o |
| HistÃ³rico individual | melhor | geralmente snapshot atual |
| DetecÃ§Ã£o de mudanÃ§as | limitada ao universo consultado | boa se snapshots completos forem versionados |

A soluÃ§Ã£o correta Ã© manter appointments histÃ³ricos e adicionar, quando comprovado, snapshots atuais de composiÃ§Ã£o com a mesma proveniÃªncia oficial. NÃ£o substituir histÃ³rico por snapshot.

## Crosswalk da CÃ¢mara

Os `bodyId` dos appointments da CÃ¢mara sÃ£o IDs oficiais de Ã³rgÃ£os, por exemplo `2001`/`CAPADR`. O endpoint `/orgaos/{id}/membros` confirma a semÃ¢ntica oficial do ID. O crosswalk atual falha porque esses Ã³rgÃ£os ainda nÃ£o foram materializados em `legislative_bodies`.

A correÃ§Ã£o futura deve:

```text
catÃ¡logo oficial de Ã³rgÃ£os
→ legislative_bodies(source='camara', external_id=bodyId)
→ appointments.bodyId
```

NÃ£o deve resolver por nome ou sigla.

## Cobertura antes

- Senado: 7.270 appointments de commission; 21.189 appointments totais encontram algum body canÃ´nico, mas o universo inclui relatorias e nem todos os cÃ³digos sÃ£o bodies de comissÃ£o.
- CÃ¢mara: 25.340 appointments de commission; nenhum encontra body canÃ´nico pelo crosswalk atual.
- Nenhum snapshot completo por colegiado foi persistido pelo fluxo recorrente atual.

## MudanÃ§as necessÃ¡rias nos collectors

1. Materializar o catÃ¡logo oficial de Ã³rgÃ£os da CÃ¢mara antes de publicar appointments.
2. Reprocessar appointments da CÃ¢mara contra o body canÃ´nico.
3. Investigar e validar uma rota oficial por colegiado do Senado antes de introduzi-la; ela nÃ£o estÃ¡ presente no collector atual.
4. Se houver snapshot por colegiado, versionÃ¡-lo separadamente da sÃ©rie histÃ³rica de appointments.
5. Somente chamar de `composiÃ§Ã£o atual` quando houver snapshot completo, fresco e reconciliado.

## Before × After

Ainda nÃ£o hÃ¡ After: a instruÃ§Ã£o desta etapa era investigar sem implementar ou coletar novamente.

O ganho esperado apÃ³s a materializaÃ§Ã£o da CÃ¢mara Ã© tornar os 25.340 appointments relacionÃ¡veis aos bodies oficiais. Isso nÃ£o deve ser apresentado como resultado jÃ¡ obtido.

## Podemos chamar de “composiÃ§Ã£o atual”?

**Senado:** nÃ£o com os dados atuais derivados somente de parlamentar → comissÃµes. Usar `membros identificados na cobertura atual`.

**CÃ¢mara:** nÃ£o antes de resolver o catÃ¡logo/crosswalk e confirmar a completude da legislatura.

## DecisÃ£o

- Senado jÃ¡ busca integralmente a composiÃ§Ã£o por comissÃ£o? **NÃƒO**.
- Senado consegue ampliar com as fontes atuais? **Possivelmente**, mas Ã© necessÃ¡rio confirmar endpoint oficial por colegiado; nÃ£o foi implementado nem assumido.
- CÃ¢mara jÃ¡ busca integralmente a composiÃ§Ã£o por body? **NÃƒO**.
- CÃ¢mara consegue ampliar com as fontes atuais? **SIM, em princÃ­pio**, usando o catÃ¡logo `/orgaos` e `/orgaos/{id}/membros`, sem fonte externa nova.

Nenhuma alteraÃ§Ã£o de cÃ³digo foi feita nesta etapa.
