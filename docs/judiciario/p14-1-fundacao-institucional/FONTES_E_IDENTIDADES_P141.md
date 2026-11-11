# Fontes e identidades — P14.1

A fundação catalogou 93 instituições. Os 91 aliases do catálogo CNJ/DataJud foram registrados como identidade institucional documentada; isso não autoriza chamadas DataJud nem prova cobertura de unidades. STF e CNJ foram mantidos como instituições de controle sem alias.

## Fontes operacionais

- TJBA unidades: https://transparencia-service-api.tjba.jus.br/unidades
- TJBA comarcas: https://transparencia-service-api.tjba.jus.br/comarcas
- TJBA metas: https://transparencia-service-api.tjba.jus.br/metas
- TJRJ comarcas: https://www3.tjrj.jus.br/orgaoservicepub/api/ServicoPub/Comarca
- TJRJ órgãos: https://www3.tjrj.jus.br/orgaoservicepub/api/ServicoPub/Orgao

TJBA e TJRJ usam IDs source-native determinísticos. Não houve fuzzy matching, não houve CNPJ/CPF, e não houve chamadas DataJud. TJES ficou explicitamente bloqueado por ausência de recurso estruturado operacional no recorte.

## Estados de identidade

DOCUMENT_VERIFIED significa que a instituição/unidade foi confirmada no catálogo ou resposta oficial e preserva a chave da fonte. EXACT_OFFICIAL é reservado aos IDs source-native nas tabelas de external IDs. O campo CNJ code permanece nulo até crosswalk oficial verificável.
