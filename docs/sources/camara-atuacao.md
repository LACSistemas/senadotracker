# Câmara — proposições, autorias, relatorias, órgãos, cargos e leis

Verificado em 08/09/2026 nos arquivos oficiais descritos no [Swagger da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html): `proposicoes-2026.json`, `proposicoesAutores-2026.json` e `orgaosDeputados-L57.json`. Os snapshots ficam em `data/research/` e seus bytes são publicados na auditoria por hash.

`proposicoes.id` é a chave. O lote preserva tipo, número, ano, ementa, apresentação e `ultimoStatus.descricaoSituacao`. Autorias são N:N, mantêm ordem, proponente, tipo do autor, partido e UF. Apenas autores cujo `uriAutor` termina em um ID de deputado podem ser ligados ao perfil; os demais continuam identificados pelo nome no banco. A coleta reteve 44.356 proposições e 55.549 autorias cujas proposições existem no mesmo arquivo; 41 linhas órfãs foram recusadas.

Uma relatoria é criada somente quando `ultimoStatus.uriRelator` identifica um deputado. Ela representa a relatoria informada no último estado, não histórico completo. `orgaosDeputados-L57` preserva órgão, cargo, início e fim; composição sem fim informado não prova permanência fora da data do arquivo. O lote contém 17.516 relatorias e vínculos em órgãos.

`ultimoStatus.url` aponta para documento/tramitação e não comprova conversão em norma. Os arquivos delimitados não oferecem uma relação explícita proposição–lei; por isso o lote não publica leis. As rotas de detalhe, tramitações e relacionadas serão reconciliadas no complemento F2.
