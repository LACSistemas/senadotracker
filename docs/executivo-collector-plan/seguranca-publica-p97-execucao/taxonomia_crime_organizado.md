# Taxonomia conceitual — crime organizado e atuação do Estado (P9.7)

Cada conceito tem universo, unidade e fonte próprios. **Nenhum é sinônimo de outro, e nenhum indicador publicado afirma organização criminosa.**

| Conceito | O que é | Exemplo de medida no Cívica | O que NÃO prova |
|---|---|---|---|
| Organização criminosa | conceito jurídico com requisitos legais | **nenhum indicador** | — |
| Associação criminosa | categoria jurídica distinta | nenhum | — |
| Tráfico de drogas | tipo de registro policial | `OC.DRUG.TRAFFICKING_RECORDS` (VDE, RJ, RS, SP) | participação em organização/facção |
| Posse/porte de drogas | tipo de registro; universo diferente do tráfico | `OC.DRUG.POSSESSION_RECORDS` | tráfico |
| Apreensão (evento) | contagem de registros de apreensão | `OC.DRUG.SEIZURE_EVENTS` | quantidade apreendida |
| Apreensão (massa) | peso informado | `OC.DRUG.SEIZED_MASS_*` | número de apreensões; kg não declarado pela fonte |
| Armas apreendidas | armas retiradas em ação policial | `OC.WEAPON.FIREARMS_SEIZED` | porte, posse, recolhimento ou entrega voluntária |
| Delito com armas | B.O./ocorrência por porte ilegal e afins | `OC.WEAPON.OFFENSE_RECORDS` | arma apreendida |
| Mandado cumprido | ato processual | `OC.ENFORCEMENT.ARREST_WARRANTS_SERVED` | culpa ou vínculo organizacional |
| Prisão em flagrante | ato policial | `OC.ENFORCEMENT.FLAGRANT_ARRESTS` | condenação; integrante de organização |
| Operação policial | ação estatal oficialmente registrada | **nenhum indicador** (sem série oficial estruturada) | organização confirmada |
| Investigação / condenação | procedimento / resultado judicial | nenhum | crime comprovado / culpa |
| Lavagem de dinheiro / RIF do COAF | delito / informação financeira | nenhum (sem recorte territorial) | crime comprovado |

## Proibições aplicadas (testadas)
- Sem tabela "município → facção", sem fronteiras, rotas, endereços, estrutura de comando ou filiação individual; o teste varre colunas do schema por termos proibidos.
- Apreensão, prisão, operação, investigação e condenação nunca se somam.
- Estadual × PF/PRF (VDE) podem registrar o mesmo fato: séries separadas.
- Massa × número de apreensões × B.O.: unidades distintas, sem conversão (o VDE não declara a unidade do peso).
- Município com registro = local do registro, não território de organização; atividade federal não é atribuída ao município sede de unidade policial.
