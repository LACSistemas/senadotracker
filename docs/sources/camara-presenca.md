# Câmara — eventos e presença

Verificado em 08/09/2026 no catálogo oficial da Câmara. O arquivo `eventos-2026.json` contém 1.564 eventos; `eventosPresencaDeputados-2026.json` contém 58.718 relações entre evento e deputado. A documentação oficial esclarece que eventos realizados retornam presença registrada e eventos futuros retornam pessoas esperadas. Por isso o lote ignora eventos que não estejam encerrados.

Para o indicador de presença plenária, o universo foi limitado a 72 eventos cujo tipo literal é `Sessão Deliberativa` e cuja situação começa por `Encerrada`. Sessões não deliberativas, reuniões de comissão, audiências, eventos cancelados, testes e eventos futuros ficam fora. O denominador individual contém somente sessões dentro de um intervalo de exercício publicado. Foram vinculadas 56.603 relações a identidades atuais da Câmara; registros de pessoas fora do cadastro publicado permanecem no bruto e não entram na consulta.

Chaves: `evento.id` e `(idEvento,idDeputado)`. O estado conservado é `presença registrada`; ausência de relação não recebe justificativa inventada. As URLs canônicas são `https://dadosabertos.camara.leg.br/arquivos/eventos/json/eventos-{ano}.json` e `.../eventosPresencaDeputados/json/eventosPresencaDeputados-{ano}.json`.
