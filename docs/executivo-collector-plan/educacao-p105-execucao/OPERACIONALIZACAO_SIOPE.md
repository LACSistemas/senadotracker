# Operacionalização SIOPE

Endpoint oficial FNDE Olinda OData, período anual 6, 2017–2025 quando publicado. Recursos: `Dados_Gerais_Siope`, `Despesas_Funcao_Educacao_Siope`, `Indicadores_Siope` e `Informacoes_Complementares_Siope`. `Despesas_Siope`, `Remuneracao_Siope` e `Dados_Responsaveis` ficam fora.

Cada resposta é comprimida em `D:\Civica\raw\siope\<ano>\<UF>\6-<funcao>.json.gz`; SHA-256 é persistido no fato/cobertura. A publicação usa hash semântico (`siope-v3`) sobre fatos ordenados, enquanto o SHA do payload continua na proveniência; isso evita republicar uma resposta apenas reserializada pelo OData. Falha de componente não apaga publicação anterior. A onda nacional encerrada registrou 243 fatias, 972 componentes e 3.395.269 fatos; o histórico nacional foi publicado pela versão v2 e o replay semântico ES/2024 passou com `NO_CHANGE`.
