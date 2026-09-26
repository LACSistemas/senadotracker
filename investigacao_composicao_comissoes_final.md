# InvestigaÃ§Ã£o — ComposiÃ§Ã£o das comissÃµes

## 1. Resumo executivo

A base jÃ¡ possui dados suficientes para mostrar uma composiÃ§Ã£o **identificada**, mas nÃ£o para afirmar um censo completo e uniforme de todas as comissÃµes.

O melhor caminho atual Ã© `legislative_appointments.payload.bodyId` → `legislative_bodies(source, external_id)` → `legislative_bodies.id`. No Senado, esse cruzamento funciona para appointments de comissÃ£o; na CÃ¢mara, os appointments usam `bodyId`, mas os bodies canÃ´nicos atualmente materializados nÃ£o cobrem esse universo.

A base atual registra explicitamente `Titular`, `Suplente`, `PRESIDENTE` e variantes de vice no payload. Portanto titulares/suplentes e cargos podem ser distinguidos quando o vÃ­nculo estÃ¡ coberto. Partido e UF precisam ser ligados ao perfil parlamentar, sempre deixando claro quando sÃ£o dados atuais e nÃ£o filiaÃ§Ã£o histÃ³rica na data do vÃ­nculo.

## 2. Como a composiÃ§Ã£o Ã© coletada hoje

`legislative_appointments` Ã© alimentada pelos lotes de cadastro/atividade das Casas. Cada registro preserva `payload` oficial, `rawId`, `source`, `personExternalId`, `kind`, `bodyId`, `bodyLabel`, `role`, `start`, `end` e `status`.

Kinds observados:

- Senado: `commission` 7.270, `office` 806, `rapporteurship` 21.222.
- CÃ¢mara: `commission` 25.340, `office` 1.288, `rapporteurship` 8.404.

## 3. legislative_appointments

Campos reais observados no payload:

```json
{"source":"senado","personExternalId":"1173","kind":"rapporteurship","bodyId":"1363","bodyLabel":"CCT","role":"Relator","start":"2026-07-16","end":null,"status":null,"proposalId":"174714","rawId":"..."}
```

Para comissÃ£o da CÃ¢mara:

```json
{"source":"camara","personExternalId":"100689","kind":"commission","bodyId":"2001","bodyLabel":"CAPADR","role":"Suplente","start":"2023-12-13","end":"2024-02-04","status":"encerrado"}
```

Roles de membros e mesa sÃ£o publicados explicitamente. O Senado usa capitalizaÃ§Ã£o alta em cargos de mesa; a CÃ¢mara usa variantes em title case.

## 4. RelaÃ§Ã£o appointment → body canÃ´nico

Query reproduzÃ­vel:

```sql
SELECT a.source,
       COUNT(*) AS total,
       SUM(b.id IS NOT NULL) AS matched,
       COUNT(DISTINCT b.id) AS bodies
FROM legislative_appointments a
LEFT JOIN legislative_bodies b
  ON b.source = a.source
 AND b.external_id = json_extract(a.payload, '$.bodyId')
GROUP BY a.source;
```

Resultado atual:

| Casa | Appointments | Com body correspondente | Bodiess com appointments |
|---|---:|---:|---:|
| Senado | 29.298 | 21.189 | 31 |
| CÃ¢mara | 35.032 | 0 | 0 |

A diferenÃ§a no Senado Ã© explicada principalmente por relatorias associadas a Ã³rgÃ£os/cÃ³digos que nÃ£o estÃ£o materializados como `legislative_bodies`. O cruzamento nÃ£o deve usar `bodyLabel` como substituto.

## 5. Senado — comissÃµes reais

| ComissÃ£o | external_id | appointments de commission | Pessoas distintas | Titulares | Suplentes |
|---|---:|---:|---:|---:|---:|
| CMA | 50 | 200 | 95 | 95 | 105 |
| CCJ | 34 | 577 | 129 | 235 | 342 |
| CAE | 38 | 349 | 116 | 172 | 177 |
| CEsp | 2615 | 52 | 18 | 25 | 27 |

Esses nÃºmeros sÃ£o vÃ­nculos registrados, nÃ£o necessariamente a composiÃ§Ã£o atual. Uma mesma pessoa pode aparecer como titular e suplente em perÃ­odos diferentes.

## 6. PresidÃªncia e mesa

Roles distintos relevantes observados:

- Senado: `PRESIDENTE`, `VICE-PRESIDENTE`, `1º VICE-PRESIDENTE`, `2º VICE-PRESIDENTE`, `RELATOR`, `Titular`, `Suplente`.
- CÃ¢mara: `Presidente`, `Vice-Presidente`, `1º Vice-Presidente`, `2º Vice-Presidente`, `3º Vice-Presidente`, `Titular`, `Suplente`.

FrequÃªncias globais de mesa:

- Senado: 335 `PRESIDENTE`, 178 `VICE-PRESIDENTE`, 17 `1º VICE-PRESIDENTE`, 16 `2º VICE-PRESIDENTE`.
- CÃ¢mara: 520 `Presidente`, 24 `Vice-Presidente`, 300 `1º Vice-Presidente`, 240 `2º Vice-Presidente`, 204 `3º Vice-Presidente`.

A regra conservadora para ocupante atual deve exigir `start <= data de referÃªncia`, `end` nulo ou posterior e ausÃªncia de status de encerramento. NÃ£o basta apenas `end IS NULL` sem considerar duplicidades e semÃ¢ntica do lote.

## 7. Titulares e suplentes

A distinÃ§Ã£o Ã© explÃ­cita no campo `role`, com valores `Titular` e `Suplente`. NÃ£o Ã© inferida por ordem ou texto.

A cobertura Ã© parcial por Casa: o Senado possui appointments de membros vinculados aos senadores atualmente coletados; a CÃ¢mara tem muitos vÃ­nculos histÃ³ricos, mas ainda nÃ£o possui crosswalk com os `legislative_bodies` canÃ´nicos atuais.

## 8. ComposiÃ§Ã£o atual e histÃ³rica

Datas `start` e `end` existem e permitem uma reconstruÃ§Ã£o parcial por data. A composiÃ§Ã£o atual pode ser calculada como vÃ­nculos de comissÃ£o com inÃ­cio anterior Ã  data de referÃªncia, fim ausente/futuro e status nÃ£o encerrado, deduplicando pessoa + body + papel.

A composiÃ§Ã£o histÃ³rica Ã© **parcial**: a cobertura depende dos parlamentares coletados e dos lotes disponÃ­veis. NÃ£o Ã© seguro afirmar que a ausÃªncia de um appointment significa que a pessoa nunca compÃ´s a comissÃ£o.

## 9. Partido e UF

O appointment traz `personExternalId`, que pode ser ligado ao perfil da Casa por `(source, external_id)`. Partido e UF do perfil atual podem ser mostrados com o rÃ³tulo “partido/UF do perfil atual”. NÃ£o devem ser apresentados silenciosamente como filiaÃ§Ã£o na data histÃ³rica.

Para histÃ³rico, usar `partyAtDate`/histÃ³rico de filiaÃ§Ãµes quando a data do vÃ­nculo estiver disponÃ­vel; caso contrÃ¡rio, omitir ou declarar que Ã© o partido atual.

## 10. Duplicatas e mÃºltiplos papÃ©is

Pessoa + body + `kind=commission` e pessoa + body + `kind=office` podem ser papÃ©is legÃ­timos simultÃ¢neos (membro e presidente). O presidente deve contar uma vez entre membros, com o cargo destacado separadamente.

A chave tÃ©cnica de appointment inclui Ã³rgÃ£o, pessoa, data, role e identificador da fonte; nÃ£o hÃ¡ evidÃªncia para colapsar papÃ©is distintos.

## 11. Cobertura por Casa

- **Senado:** 81 pessoas distintas nos appointments; 7.270 vÃ­nculos de comissÃ£o; 31 bodies canÃ´nicos com appointments ligados. A cobertura Ã© centrada nos senadores atualmente cadastrados.
- **CÃ¢mara:** 662 pessoas distintas em todos os appointments; 25.340 vÃ­nculos de comissÃ£o, mas nenhum encontrou body canÃ´nico pelo crosswalk atual. Isso impede preencher com seguranÃ§a a composiÃ§Ã£o por body da CÃ¢mara sem ampliar a materializaÃ§Ã£o de bodies.

## 12. Matriz de viabilidade

| InformaÃ§Ã£o | Senado | CÃ¢mara | ObservaÃ§Ã£o |
|---|---|---|---|
| Presidente atual | 🟡 parcial | 🟡 parcial | Cargo existe; crosswalk e vigÃªncia precisam ser filtrados |
| Vice-presidentes | 🟡 parcial | 🟡 parcial | Roles explÃ­citos, cobertura por body desigual |
| Membros atuais | 🟡 parcial | 🔴 nÃ£o seguro por body | Senado ligado a 31 bodies; CÃ¢mara sem mapping |
| Titulares | ✅ | ✅ no appointment | CÃ¢mara ainda sem body canÃ´nico |
| Suplentes | ✅ | ✅ no appointment | Mesmo limite de body na CÃ¢mara |
| Partido | 🟡 atual | 🟡 atual | Partido histÃ³rico exige `partyAtDate` |
| UF | ✅ perfil | ✅ perfil | Depende de perfil resolvido |
| InÃ­cio/fim | ✅ | ✅ | Campos publicados no payload |
| ComposiÃ§Ã£o histÃ³rica | 🟡 parcial | 🟡 parcial | Cobertura nÃ£o Ã© censo completo |
| ComposiÃ§Ã£o partidÃ¡ria | 🟡 parcial | 🔴 nÃ£o seguro por body | NÃ£o usar percentuais absolutos |

## 13. Ouro escondido na composiÃ§Ã£o

O payload jÃ¡ preserva `bodyId`, `bodyLabel`, `role`, `start`, `end`, `status`, `personExternalId`, `officialUrl` e `rawId`. NÃ£o foi identificado, nesta auditoria, um campo adicional persistido que permita afirmar titularidade alÃ©m do `role` ou completar automaticamente o crosswalk da CÃ¢mara.

## 14. Modelo canÃ´nico recomendado

No curto prazo, reutilizar `legislative_appointments` com crosswalk por `(source, bodyId)` e queries agregadas. NÃ£o criar `commission_membership` ainda.

Uma tabela materializada futura poderia melhorar performance, mas duplicaria datas, papÃ©is e proveniÃªncia e exigiria reconciliaÃ§Ã£o adicional.

## 15. O que jÃ¡ pode aparecer em /comissoes/[id]

Com seguranÃ§a, para bodies do Senado ligados:

- “Membros identificados na cobertura atual”;
- titulares e suplentes separados pelo `role` oficial;
- cargo de presidente/vice quando houver appointment compatÃ­vel;
- partido/UF do perfil atual com aviso explícito;
- início/fim publicados.

Para a CÃ¢mara, manter estado de composição indisponível até o body crosswalk ser resolvido.

## 16. Fonte nova necessária?

- Senado: provavelmente apenas query/reprocessamento dos appointments atuais, desde que o filtro de vigência e a ligação de pessoa sejam validados.
- CÃ¢mara: é necessário ampliar ou corrigir o crosswalk de `legislative_bodies`; não é seguro resolver por nome/sigla.
- Nenhuma fonte externa nova foi consultada nesta investigação.

## 17. Queries usadas

```sql
SELECT source, kind, COUNT(*)
FROM legislative_appointments
GROUP BY source, kind;

SELECT a.source, COUNT(*) total,
       SUM(b.id IS NOT NULL) matched,
       COUNT(DISTINCT b.id) bodies
FROM legislative_appointments a
LEFT JOIN legislative_bodies b
  ON b.source=a.source
 AND b.external_id=json_extract(a.payload,'$.bodyId')
GROUP BY a.source;

SELECT json_extract(payload,'$.role') role, COUNT(*)
FROM legislative_appointments
WHERE source='senado'
  AND json_extract(payload,'$.kind')='commission'
GROUP BY role;
```

## Conclusão

Podemos preencher “Quem compõe a comissão” de forma parcial e factual para o Senado, usando appointments ligados ao body canônico, com a ressalva de cobertura atual e partido histórico. Não podemos apresentar composição completa da Câmara ainda. Não foi feita nenhuma alteração de schema, collector ou UI.


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
