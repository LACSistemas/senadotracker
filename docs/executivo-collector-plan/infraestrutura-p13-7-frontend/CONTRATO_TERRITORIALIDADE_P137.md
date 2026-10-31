# P13.7 — Contrato de territorialidade

## Conversão de escopo

`toTerritory(scope: InfraScope): InfrastructureTerritory` em `lib/infrastructure/load.ts`:
- `scope.kind === 'uf'` → `{level:'UF', ufCode: scope.ufCode}`
- `scope.kind === 'municipio'` → `{level:'MUNICIPIO', ibge7: String(scope.entityId)}`

`scope.entityId` de município **é** o ibge7 nesta base — confirmado por consulta direta (`exec_entity kind=4`: `entity_id` sempre igual a `ibge7` para municípios). Não é suposição: verificado com os 19 municípios do caso MMGD (G0.2) e reconfirmado pelo funcionamento correto de todas as páginas de município testadas.

## Brasil

Não há rota de overview nacional nesta fase (o brief autoriza "caso já exista rota nacional" — não existe precedente nas páginas territoriais atuais do Cívica, nenhum outro domínio tem `/brasil`). A família Atlas Águas (ISH-U), que só publica em nível Brasil hoje, fica sem exibição em nenhuma página desta fase — documentado como limitação conhecida em `CONTRATO_ESTADOS_DE_AUSENCIA_P137.md`, não escondido silenciosamente.

## Multimunicipalidade (obras)

Ver `CONTRATO_OBRAS_PUBLICAS_P137.md` — `territory_count`/`allocation_class` decidem exibição; nunca um valor por município quando há mais de um.

## Guarda do Atlas Águas (G0.5)

Tabela fonte `exec_dam_atlas_municipality` tem 5.572 códigos "ibge7"-like; dois (`4300001` "Lagoa Mirim", `4300002` "Lagoa dos Patos") não existem em `exec_entity kind=4` — já não são tratados como municípios comuns no catálogo territorial usado por toda a aplicação (`exec-territory.ts`, `security/load.ts`, `infrastructure-read.ts` todos leem do mesmo `exec_entity`). Hoje isso é moot para o frontend porque nenhum indicador Atlas Águas é servido em nível municipal — documentado como regra de guarda para quando/se isso mudar: qualquer consulta futura a `exec_dam_atlas_municipality` direto deve excluir esses dois códigos ou fazer `JOIN` com `exec_entity kind=4`.

## Município novo pós-Censo (G0.3)

Boa Esperança do Norte (MT, ibge7 5101837) é o único dos 5.571 municípios de `exec_entity kind=4` sem nenhuma linha em `exec_ind_value` para a família `ENTORNO_IBGE` (nem para `FAVELAS`/`INTERNET_DOMICILIAR`, as outras famílias do Censo 2022). Não há tratamento especial no código — a ausência honesta já emerge naturalmente de `scopedRows` não encontrar linha nenhuma para essa entidade nessas famílias. Testado explicitamente (screenshot + E2E): 10 capítulos em estado `Pending` simultâneo, zero erro.

## Município × UF — nunca confundidos

Rotas inteiramente separadas (`/municipios/[ibge]/infraestrutura` vs `/estados/[uf]/infraestrutura`), cada uma chamando `scopeOf('municipio', ...)` ou `scopeOf('uf', ...)` explicitamente — nenhum código compartilhado infere o nível a partir do outro. Testado: São Paulo município (`title` da página) é sempre diferente de São Paulo UF.
