# Prestadores, municípios e territorialidade

## Resultado da coleta real

As linhas municipais foram ligadas deterministicamente por `Cod_IBGE`/código IBGE de sete dígitos a `exec_entity`; água cobriu 5.144 municípios e esgoto 2.749, enquanto resíduos, drenagem e gestão municipal trouxeram 5.570 linhas. Não houve fuzzy matching nem replicação de prestador regional. Brasília e municípios criados após o ano-base permanecem sujeitos ao universo explícito da fonte; não houve imputação retrospectiva.

O texto de plano abaixo é histórico e foi superado pela execução real no D:.

O modelo canônico usa `exec_entity` e IDs IBGE existentes. Uma linha SINISA pode ser municipal, de prestador local/regional, titular ou agregado. A chave de prestador deve ser mantida separada da chave municipal; uma linha regional não pode ser replicada para cada município sem relação oficial.

Piloto planejado (registro histórico, superado): Vitória, Vila Velha, Serra, Cariacica, Colatina, Alto Rio Novo, Campos dos Goytacazes, Rio de Janeiro, João Pessoa, Recife, São Paulo, Belo Horizonte, Água Boa, Boa Esperança do Norte e Brasília. A execução final processou o universo completo disponível nos arquivos oficiais. Brasília e municípios criados após o ano-base exigem universo explícito; não houve imputação retrospectiva.
