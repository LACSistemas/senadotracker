# Senado — proposições, relatorias, comissões, cargos e leis

Verificado em 08/09/2026 no serviço oficial `https://legis.senado.leg.br/dadosabertos/`. O lote implementado usa, por código do senador, `/senador/{codigo}/autorias.json`, `/relatorias.json`, `/comissoes.json` e `/cargos.json`. A amostra rastreável é o senador 5672 e está em `data/research/e-2.json` a `e-5.json`.

`Materia.Codigo` é a chave da matéria. Autoria preserva `IndicadorAutorPrincipal`; relatoria preserva tipo, designação, destituição, motivo e comissão; comissão e cargo preservam função e limites informados. A ausência de `DataFim` significa somente que a rota não informou fim. O perfil oficial da matéria é `https://www25.senado.leg.br/web/atividade/materias/-/materia/{codigo}`.

O recorte contém 453 matérias únicas, 383 autorias e 169 funções/relatorias. Ele é uma amostra funcional de um senador, não a cobertura completa do Senado. As respostas observadas anunciam rotas sucessoras nos metadados; a ampliação e reconciliação ficaram em F2.

As quatro rotas não oferecem, neste recorte, uma chave explícita de norma jurídica originada. Portanto nenhum vínculo com lei foi inferido de situação, ementa ou aprovação. A interface mostra zero com esta limitação.
