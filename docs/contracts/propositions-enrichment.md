# Contrato de enriquecimento de proposições

O enriquecimento preserva o identificador e a semântica publicados por cada Casa. Uma proposição, uma votação, um evento, uma tramitação e um documento são entidades diferentes. Relações entre elas são armazenadas com direção explícita e nunca inferidas apenas por semelhança textual.

Cada item tem `source`, `proposalId`, `kind`, `externalKey`, origem oficial, `rawId`, instante do fato quando publicado e o payload original normalizado. Campos ausentes ficam `null`. Um complemento herdado de uma matéria principal informa `inheritedFromProposalId`; a interface deve rotulá-lo como herdado.

## Entidades canônicas

| `kind` | Identidade | Conteúdo principal |
| --- | --- | --- |
| `proposal_detail` / `matter_detail` | proposição | ementa, situação, regime, forma de apreciação, órgão atual e texto explicativo |
| `theme` | proposição + código do tema | hierarquia, relevância e vocabulário da Casa |
| `author_detail` / `rapporteur_detail` | proposição + pessoa/órgão + papel | autoria, relatoria, ordem e período |
| `movement` / `situation` | proposição + sequência oficial | data, órgão, descrição, despacho, destino e situação |
| `relationship` | proposição origem + proposição destino + relação | principal, acessória, apensada, anterior, posterior ou relacionada |
| `document` | proposição + documento | tipo, título, versão, inteiro teor e URL oficial |
| `amendment` | proposição + emenda | identificação, autoria, texto e situação |
| `deadline` | proposição + prazo | início, fim, tipo, órgão e estado |
| `agenda_item` | evento + proposição | pauta, sequência, regime e resultado |
| `vote_effect` | votação + proposição | objeto possível, proposição afetada e efeito registrado |
| `resulting_norm` | proposição + norma | tipo, número, data, URN e URL oficial |

## Cobertura por Casa

| Dimensão | Câmara | Senado | Regra de ausência |
| --- | --- | --- | --- |
| cadastro e situação | `/proposicoes/{id}` | detalhamento de matéria por código | indisponível se o serviço não publicar |
| autoria | `/proposicoes/{id}/autores` | autoria de matéria | não inferir autor por texto |
| temas | `/proposicoes/{id}/temas` | assuntos geral e específico | acessório pode não ter tema próprio |
| tramitação | `/proposicoes/{id}/tramitacoes` | tramitação/movimentações do processo | lista vazia não significa ausência histórica |
| relações | detalhe, relacionadas e página oficial | matérias relacionadas/anexadas quando publicadas | direção precisa de evidência oficial |
| votações | `/proposicoes/{id}/votacoes`, detalhe, votos e orientações | votações da matéria e votações nominais | voto secreto nunca é convertido em escolha individual |
| documentos | `urlInteiroTeor`, URN e referências oficiais | textos de matéria | guardar URL, tipo e versão |
| emendas e prazos | quando expostos pelos recursos relacionados | serviços próprios de emendas e prazos | `unavailable` por serviço, não por parlamentar |
| comissão/pauta | eventos, pauta e órgãos | comissões, matéria em comissão e votações | plenário e comissão permanecem separados |

## Publicação e auditoria

Uma execução salva todos os objetos brutos antes de publicar. A troca de `active_complement_publications` ocorre na mesma transação dos itens normalizados. O escopo mínimo é `proposal:{id}`; falha de uma proposição não despublica lotes anteriores de outras proposições. A reconciliação registra requisições, sucessos, falhas por endpoint, contagens por `kind`, duplicatas e relações sem destino coletado.

O frontend consulta apenas lotes ativos, usa chaves e índices normalizados e nunca desserializa o universo inteiro para montar uma página. A cobertura exibida deve informar Casa, lote, período, quantidade e eventual herança da matéria principal.
