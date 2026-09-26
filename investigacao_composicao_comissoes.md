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
## Implementação da composição atual

### Câmara — catálogo materializado e crosswalk

O collector de atividade da Câmara passou a materializar órgãos oficiais a partir de `orgaosDeputados-L57.json`. A chave usada é `(source='camara', external_id=ID oficial)`, preservando sigla, nome, URL oficial e raw de origem. A operação é idempotente e converge com bodies previamente criados pela agenda.

Após a execução real do collector:

```yaml
commission appointments antes do backfill: 25.340 (auditoria anterior)
commission appointments observados no lote atual: 38.010
matched antes: 0
matched depois: 38.010
bodies canônicos com appointments: 210
```

Query de validação:

```sql
SELECT COUNT(*) total,
       SUM(b.id IS NOT NULL) matched,
       COUNT(DISTINCT b.id) bodies
FROM legislative_appointments a
LEFT JOIN legislative_bodies b
  ON b.source=a.source
 AND b.external_id=json_extract(a.payload,'$.bodyId')
WHERE a.source='camara'
  AND json_extract(a.payload,'$.kind')='commission';
```

Casos validados:

| Órgão | external_id | appointments | pessoas distintas |
|---|---:|---:|---:|
| CAPADR | 2001 | 1.536 | 184 |
| CCJC | 2003 | consultar por lote atual | materializado |
| CFT | 2010 | consultar por lote atual | materializado |
| CSAUDE | 2014 | consultar por lote atual | materializado |

O endpoint oficial de composição por órgão continua sendo:

```text
GET /api/v2/orgaos/{id}/membros
```

O collector atual materializou o catálogo e corrigiu o crosswalk dos appointments. Ele ainda não persiste um snapshot independente completo por órgão a partir de uma chamada individual a `/membros`; portanto os números de appointments não devem ser chamados automaticamente de composição oficial completa.

### Senado — endpoint e estado

O collector continua usando as rotas centradas no parlamentar:

```text
/senador/{id}/comissoes.json
/senador/{id}/cargos.json
```

Não foi confirmado no código ou nos raws existentes um endpoint por colegiado que possa ser usado com segurança como snapshot completo. O Senado permanece com composição identificada na cobertura dos parlamentares coletados.

### Snapshot atual versus histórico

A materialização de bodies da Câmara resolve identidade, mas não substitui `legislative_appointments`. O histórico continua preservado com `start`, `end`, `role`, `status` e raw de origem. Uma futura coleta de `/orgaos/{id}/membros` deverá ser tratada como snapshot atual versionado, com reconciliação apenas quando a resposta for completa.

### Contrato comum recomendado

```ts
commissionComposition(bodyId, referenceDate?) => {
  coverage: 'complete_current' | 'partial',
  observedAt,
  president,
  vicePresidents,
  titularMembers,
  alternateMembers,
  otherMembers,
  source,
  provenance
}
```

Na implementação atual, a Câmara pode retornar `partial` a partir de appointments ligados ao body. O Senado também deve permanecer `partial`.

### Decisão de produto

- **Câmara: podemos chamar de “Composição atual”? NÃO ainda.** O catálogo/crosswalk foi corrigido, mas o snapshot completo por órgão ainda não foi integrado.
- **Senado: podemos chamar de “Composição atual”? NÃO.** A coleta permanece centrada nos parlamentares atuais.

Nenhuma alteração de UI foi feita.

## Implementação P0 — composição da Câmara (estado final)

Foi criada a migration 51 (`commission_membership_snapshots`) para preservar snapshots por órgão, pessoa, função, payload hash, observação e proveniência. O collector recorrente de atividade da Câmara agora consulta `GET /api/v2/orgaos/{id}/membros`, pagina a resposta, salva o raw/cache já usado pelo `OfficialHttp` e materializa os membros no modelo canônico. A reconciliação só desativa uma função anterior quando a resposta completa contém a pessoa com outra função; respostas parciais ou com falha não removem membros.

O backfill real executado em 25/09/2026 concluiu sem falhas para os quatro órgãos solicitados:

| órgão | membros ativos | titulares | suplentes | partidos | UFs | observado em |
|---|---:|---:|---:|---:|---:|---|
| 2001 | 95 | 42 | 49 | 13 | 27 | 2026-09-25T20:57:38Z |
| 2003 | 130 | 60 | 66 | 19 | 25 | 2026-09-25T20:57:39Z |
| 2010 | 72 | 23 | 46 | 14 | 22 | 2026-09-25T20:57:39Z |
| 2014 | 99 | 45 | 50 | 16 | 24 | 2026-09-25T20:57:39Z |

Os totais de titulares e suplentes não somam todos os membros porque a fonte publica funções adicionais e registros sem uma dessas duas etiquetas. A tabela mantém cada pessoa/função como fato distinto e não transforma ausência de função em titularidade.

Foi adicionado o contrato de leitura `commissionComposition` em `packages/db/src/commissions.ts`, exportado pelo pacote de banco. Ele retorna cobertura, observação, titulares, suplentes, presidência, demais funções e proveniência sem alterar a UI. O typecheck de `packages/db` e `apps/collector` passou.

### Câmara: podemos chamar de “Composição atual”?

**SIM, para os quatro órgãos com snapshot completo acima.** A resposta oficial foi percorrida integralmente, o snapshot foi persistido e a reconciliação é idempotente. Para órgãos ainda não coletados por essa rota, a cobertura deve continuar marcada como indisponível/partial até a primeira resposta completa.

### Senado: podemos chamar de “Composição atual”?

**NÃO.** O Senado ainda não possui, neste fluxo, um endpoint por colegiado com snapshot completo equivalente; sua composição continua derivada da cobertura centrada nos parlamentares.

## Auditoria final de reconciliação e cobertura operacional

Foram adicionados testes determinísticos para os casos críticos de reconciliação: snapshot inicial, rerun idêntico, inclusão, remoção completa, troca Titular/Suplente, dois papéis simultâneos e respostas parcial/vazia. Todos os 4 testes passaram. A função de reconciliação só retorna remoções quando a resposta é marcada completa; uma resposta vazia é preservada como estado anterior por padrão (`allowEmpty=false`).

No backfill ampliado de 25/09/2026, o universo elegível foi definido por órgãos da Câmara cujo nome oficial contém “Comissão”. O resultado foi:

| métrica | quantidade |
|---|---:|
| bodies elegíveis | 164 |
| bodies com snapshot completo persistido | 79 |
| bodies sem snapshot ativo após resposta 200 vazia ou sem membros publicáveis | 85 |
| bodies com erro HTTP persistido | 0 |
| cobertura `complete_current / elegíveis` | 48,17% |
| membros ativos nos snapshots | 2.548 |
| última observação | 2026-09-25T21:04:06Z |

Os quatro órgãos originalmente validados permanecem completos. O collector normal agora cobre automaticamente o universo elegível, e não apenas aqueles quatro, em toda execução de `collect-activity --source camara`; respostas vazias não são convertidas em composição vazia nem desativam o snapshot anterior. A frequência é a frequência da execução recorrente do collector, com `observed_at` persistido por resposta; não existe TTL artificial de seis meses.

### Respostas aos critérios solicitados

- Reconciliação de pessoa removida: **SIM**, quando o snapshot completo não contém mais a pessoa/função.
- Bodies elegíveis: **164**.
- Bodies com `complete_current`: **79**.
- O collector normal cobre todos os elegíveis: **SIM**, consultando todos os nomes oficiais compatíveis; 85 respostas sem membros permanecem sem composição publicada.
- Frescor: atualizado a cada execução bem-sucedida do collector, com timestamp oficial persistido; falha/parcial não substitui o estado anterior.
