# Investigação — Matérias nas comissões

## Resumo executivo
A cadeia body → reunião → agenda_item → proposta prova que a matéria foi registrada em uma pauta de reunião associada ao órgão. Não prova discussão, votação, aprovação, tramitação formal completa ou permanência atual.

O título metodologicamente correto é **Matérias pautadas nesta comissão**.

## Baseline
| Casa | itens | ativos | removidos | reuniões | propostas distintas | com proposta |
|---|---:|---:|---:|---:|---:|---:|
| Senado | 2.348 | 2.348 | 0 | 233 | 1.734 | 100% |
| Câmara | 20.056 | 10.028 | 10.028 | 651 | 7.124 | 100% |

A Câmara preserva tombstones; o histórico inclui ativos e removidos, enquanto a pauta corrente usa apenas ativos.

## Casos reais — Senado
| Comissão | reuniões | itens | matérias | com resultado | sem resultado | primeira | última |
|---|---:|---:|---:|---:|---:|---|---|
| CMA 50 | 4 | 62 | 38 | 47 | 15 | 05/05/2026 | 01/09/2026 |
| CCJ 34 | 12 | 174 | 118 | 156 | 18 | 04/03/2026 | 02/09/2026 |
| CAE 38 | 26 | 207 | 130 | 176 | 31 | 03/02/2026 | 01/09/2026 |
| CEsp 2615 | 13 | 32 | 24 | 22 | 10 | 25/02/2026 | 01/09/2026 |

Não há itens associados no modelo atual para CAPADR 2001, CCJC 2003, CFT 2010 e CSAUDE 2014; a cobertura de agenda da Câmara não pode ser afirmada para esses bodies.

## Repetições e resultados
A mesma proposta aparece em várias reuniões. Exemplos: Câmara 2618177 (17 aparições), 2555920 (15) e 2589429 (15). Isso pode representar adiamento, retirada, nova inclusão ou outra ocorrência; o modelo não distingue todos os motivos. A repetição deve ser preservada como histórico.

`result_raw` é literal do item/reunião. Exemplos mais frequentes: “Aprovado o projeto.” (421), “Adiado” (242), “Aprovado” (226) e “Retirado de pauta” (67). Pode aparecer mais de uma vez para a mesma matéria e não é resultado final da matéria.

## Semântica e contrato
A unidade correta é `proposal + body`, com primeira aparição (`MIN(scheduled_date)`), última aparição (`MAX(scheduled_date)`), contagem, resultados e reuniões. O limite deve ser aplicado depois do agrupamento; ordenação por última aparição decrescente. A lista principal deve mostrar 8–12 matérias e, no futuro, paginação ou rota dedicada.

Itens removidos continuam no histórico, mas não na pauta corrente. Reuniões conjuntas devem ser atribuídas a todos os bodies apenas quando a relação N:N estiver publicada; não há reuniões conjuntas no recorte atual.

A Câmara e o Senado compartilham o modelo, mas a Câmara tem cobertura de vínculo evento → órgão insuficiente nos quatro casos testados e deve usar linguagem ainda mais conservadora.

## Matriz semântica
- Matéria apareceu em pauta: **suportado**.
- Primeira/última aparição: **suportado**.
- Número de aparições: **suportado**.
- Último resultado publicado: **suportado**, rotulado como resultado da pauta.
- Foi discutida: **não suportado**.
- Foi votada: **não suportado**.
- Passou formalmente pela comissão: **não suportado**.
- Está atualmente na comissão: **não suportado**.

## Respostas obrigatórias
“Podemos usar ‘Matérias que passaram por esta comissão’?” **NÃO** — “passaram” sugere tramitação ou apreciação formal.

“Podemos usar ‘Matérias pautadas nesta comissão’?” **SIM**.

“Podemos mostrar última aparição?” **SIM**.

“Podemos mostrar último resultado publicado?” **SIM**, como resultado registrado na pauta.

“Podemos afirmar que a matéria foi discutida?” **NÃO** — não há evidência estruturada.

“Podemos afirmar que a matéria foi votada?” **NÃO** — pauta e result_raw não bastam.

“Podemos afirmar que a matéria está atualmente na comissão?” **NÃO** — o modelo é histórico de pauta.

## Limitações
Não implementar pipeline processual, não inferir apreciação/votação e não usar relatoria como estágio da matéria. A resolução de proposta é 100% no recorte atual; itens sem proposal_id devem permanecer como itens não resolvidos, sem proposta fictícia.

## Auditoria dos tombstones da Câmara

O recorte contém 10.028 itens ativos e 10.028 removidos. Nenhum item removido compartilha o mesmo `external_id` com um item ativo; portanto a simetria não prova, por si só, que sejam 10.028 remoções oficiais. A tabela canônica não possui um marcador explícito `OFFICIAL_REMOVAL` versus `TECHNICAL_SUPERSEDED`, e o `removed_at` registra a reconciliação interna, não uma data oficial da Câmara.

Conclusão: os 10.028 removed são **PARCIALMENTE classificáveis**. Podem representar ausência em snapshot, mas a proveniência atual não permite afirmar remoção editorial individual nem contar todos como aparições históricas oficiais. Para a V1, o contrato usa ocorrências ativas canônicas; tombstones ficam disponíveis para auditoria e não aumentam `appearancesCount` sem evidência de reconciliação oficial.

A identidade de aparição é `source + meeting + proposal + external_id do item`; o row id interno nunca é usado. Reuniões diferentes são aparições distintas. A mesma reunião/proposta reapresentada por identidade técnica não deve ser contada duas vezes.

## Contrato e implementação
Foi criado `commissionMatters(bodyId, year?, limit?)`, que filtra pelo body canônico, agrupa por proposta, calcula primeira/última data por `scheduled_date`, conta aparições e limita depois do agrupamento. O detalhe da comissão agora usa o título “Matérias pautadas nesta comissão”, com cobertura anual e lista limitada.
