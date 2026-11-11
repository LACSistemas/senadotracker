# Matriz de territorialidade judiciária

## Regra central

Localização física não é jurisdição. O Cívica deve guardar relações separadas:

| Relação | Significado | Evidência disponível | Tratamento |
|---|---|---|---|
| `PHYSICAL_LOCATION` | município da sede/unidade | DataJud `codigoMunicipioIBGE`; TJBA/TJES | pode ligar ao município |
| `ADMINISTRATIVE_SEAT` | sede institucional | portal/ato do tribunal | dimensão institucional |
| `PROCESSING_UNIT_LOCATION` | onde o processo é processado | `orgaoJulgador` no DataJud | não é origem do fato |
| `JURISDICTION_TERRITORY` | comarca/subseção/zona atendida | APIs/atos de tribunais; não nacional | só publicar com fonte |
| `PROCESS_ORIGIN_TERRITORY` | local do fato/parte | não vem no DataJud | `NULL`, nunca inferir |
| `POPULATION_POTENTIALLY_SERVED` | população sob competência | cálculo territorial oficial | não dividir acervo |

## Cobertura por estrutura

- Justiça estadual: comarca pode abranger vários municípios; cadastro nacional público e histórico não comprovados.
- Justiça federal: seção/subseção/região e JEF têm competência própria; sede do TRF não representa a região inteira.
- Trabalho: vara/foro e região trabalhista não equivalem ao município da sede.
- Eleitoral: zona eleitoral pode abranger vários municípios; TRE não é unidade municipal.
- Segundo grau e superiores: competência frequentemente estadual/nacional; não municipalizar.

## Respostas às perguntas P0

Existe cadastro nacional completo? **Não comprovado.** Há códigos CNJ/MPM e cadastros tribunal-específicos. DataJud informa município associado ao órgão julgador, não município do fato. Uma unidade pode atender múltiplos municípios. Demanda por município só é válida quando a fonte fornece atribuição oficial; caso contrário, apresentar localização da unidade e declarar ausência de origem territorial.

## Contrato territorial futuro

`judicial_unit` tem localização física; `jurisdiction_area` tem fonte, vigência, tipo de relação e lista de municípios; `process_origin` é opcional e source-native. Nenhuma linha deve ser criada por imputação proporcional ou pelo nome da comarca.
