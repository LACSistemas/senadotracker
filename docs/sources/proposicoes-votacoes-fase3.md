# Proposições e votações publicáveis

As consultas usam somente lotes ativos. Uma proposição vem de `proposals`; autoria vem de `proposal_authors`; deliberação e voto individual vêm de `deliberations` e `legislative_votes`. Esses conceitos não são fundidos.

## Cobertura consultável

| Dado | Câmara | Senado | Ausência na interface |
| --- | --- | --- | --- |
| Identificador, tipo, número, ano, ementa, apresentação, situação | lote ativo de atividade | lote ativo de atividade | “não publicado” |
| Autoria | relação oficial do lote de atividade | relação oficial do lote de atividade | autoria indisponível |
| Tema e tramitação | complemento oficial, quando coletado | complemento oficial, quando coletado | complemento indisponível; não significa inexistência |
| Deliberação | lote legislativo anual ativo | lote legislativo anual ativo | nenhuma votação vinculada na cobertura ativa |
| Voto individual | registro nominal ligado à deliberação | registro nominal ligado à deliberação | não se infere ausência em sessão |
| Orientação partidária | complemento separado | complemento separado | orientação indisponível |

Cada lote conserva `batch_id`, publicação e origem bruta. A página de busca informa os escopos e volumes ativos por Casa. O detalhe liga votação à matéria somente quando `Deliberation.proposalId` coincide com o identificador oficial da proposição.

A agregação partidária soma exclusivamente votos individuais registrados. O denominador do percentual de cada partido é o total de votos registrados daquele partido na deliberação. Orientação partidária aparece em bloco próprio e não substitui votos individuais.
