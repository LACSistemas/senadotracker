# Fase 3 — matriz de dados para a interface

| Tela/bloco | Campo | Fonte | Granularidade | Chave/vínculo | Estado alternativo |
| --- | --- | --- | --- | --- | --- |
| Perfil · eleição | candidatura, cargo, partido, situação | TSE `consulta_cand` | eleição + turno + candidatura | vínculo composto confirmado com pessoa | pendente/ambíguo não aparece como pertencente à pessoa |
| Perfil · eleição | detalhe jurídico/urna/diploma | TSE complementar 2022 | candidatura + turno | eleição + `SQ_CANDIDATO` | parcial em 2018 |
| Perfil · patrimônio | bem, tipo e valor declarado | TSE `bem_candidato` | bem na eleição | eleição + candidato + ordem | lista vazia distingue “declarou não possuir” de arquivo ausente quando o campo permitir |
| Perfil · campanha | receita e despesa | não fornecida | transação | futura chave oficial | indisponível, sem zero |
| Perfil Câmara · equipe | nome funcional, cargo, função, nomeação | CSV funcionários | snapshot diário | lote + ponto/lotação; unidade conciliada ao deputado | ambíguo fica fora do gabinete e entra no relatório |
| Perfil Câmara · verba | limite e gasto | página de verba | deputado + mês | ID Câmara + ano + mês | mês ausente é nulo |
| Perfil Senado · equipe | nome, vínculo, cargo/função | página pessoal + base consolidada futura | snapshot/recorte anual | ID senador + `fcodigo`/chave oficial | fonte divergente gera parcial |
| Perfil Senado · folha | remuneração e rubricas | CSV mensal | servidor + competência + tipo de folha | chave funcional + lotação + gabinete | pessoa sem vínculo seguro fica fora do agregado |
| Listagem por Casa | tamanho do gabinete | snapshot da respectiva Casa | mesma data por universo | somente gabinetes vinculados | indisponível/desatualizado separado de zero |
| Comparação | composição de equipe | snapshot da mesma Casa | mesma data | pessoas elegíveis | Casas/períodos incompatíveis bloqueados |
| Comparação | gasto/verba ou folha | fonte própria da Casa | mesma competência | deputado/mês ou senador/competência | conceitos de Casas diferentes não compartilham ranking |

## Cobertura obrigatória

Cada retorno inclui disponibilidade, fonte, início/fim, grão, lote, amostra e nota. Séries conservam lacunas. Snapshots exibem “posição observada em”, nunca “durante todo o ano”. Valores de bens recebem “declarados ao TSE na eleição”. Valores de gabinete recebem o nome da rubrica, sem rótulo de custo total.

