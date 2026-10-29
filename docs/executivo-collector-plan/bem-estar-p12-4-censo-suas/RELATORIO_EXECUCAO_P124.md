# P12.4 — Relatório de execução do Censo SUAS

## Resultado

`P12_4_STATUS=PARTIAL_WITH_DOCUMENTED_SOURCE_LIMITATION`

O Censo SUAS 2024 foi validado como fonte oficial e foi baixado em um recorte nacional de relatório + 11 relatórios municipais piloto. A prova é suficiente para confirmar edição, layout e semântica dos indicadores publicados pelo MDS, mas não para publicar uma tabela nacional de equipamentos: os relatórios estáticos não expõem chave estável da unidade, universo de respondentes nem relação sede–municípios atendidos.

Nenhuma escrita foi feita em `projetoeleitor_db`. RAW ficou em `D:\Civica\raw\bem-estar\censo-suas\2024\reports`.

## Fontes acessadas

* Observatório público 2024: <https://paineis.mds.gov.br/public/extensions/observatorio-do-censo-suas-2024/index.html>. HTTP 200; a interface contém a ação pública “Exportar tabela”. O export interno Qlik não foi chamado.
* Relatórios oficiais SAGICAD: <https://sagicad-mds.github.io/indicadores-de-desenvolvimento/index.html>. HTTP 200; índice com 5.570 links municipais e relatório nacional na própria página.
* Catálogo antigo: <https://aplicacoes.mds.gov.br/sagi/snas/vigilancia/index2>. Redirecionou para avisos de manutenção; download de planilha não foi comprovado.
* Página institucional: <https://www.gov.br/mds/pt-br/orgaos/SAGICAD/estudos-e-pesquisas/censo-suas>. Confirma levantamento anual desde 2007, questionários de unidades/gestão/conselhos e uso em indicadores.

O HTML público do Observatório foi preservado em `D:\Civica\raw\bem-estar\censo-suas\2024\observatorio\index.html` (484.620 bytes, SHA-256 `A394CA37D42C66E00E677BE908D677B1ED82B8721191D31279CF56CBD5E2B6F3`). O script público da página foi preservado apenas para comprovar a existência do controle de exportação (`carregar.js`, 41.950 bytes, SHA-256 `FA021E02C8676076124522100DF96F07D2935D9A6CD7F03BBBEAFAF759018BEC`); nenhum endpoint interno Qlik foi chamado.

## Piloto territorial

Foram obtidos 11 de 12 territórios pedidos. Todos os 7 estados/DF representados no pedido aparecem no piloto. `Boa Esperança do Norte/MT` não aparece no índice 2024 e foi mantido como ausente, sem preenchimento por inferência.

As páginas municipais contêm uma tabela HTML de capacidade de referenciamento do CRAS e gráficos/imagens de níveis IDCRAS/IDCREAS/IDConselho. Não há identificador de equipamento, campo de respondente, status de funcionamento ou lista de municípios atendidos por CREAS regional.

## Manifesto de integridade (arquivos em D:)

| Arquivo | bytes | SHA-256 |
|---|---:|---|
| índice/nacional | 1.724.732 | `1D186BC94F0EF8DF10487A331804D3AA62986FEBABCDC081966EEBF5A7E29220` |
| Alto Rio Novo/ES | 33.316 | `A91C2EF809479F9B39E8C2A0B35973B7F600BB419AD2B45D7479CACBA0A19DDE` |
| Cariacica/ES | 57.422 | `D4562686B13F2850A7A3CAD075145CE670796F74009E884D2AA07395BAAC88CE` |
| Serra/ES | 60.441 | `19192E3AECDE3013F46602DD14B1F152350AB9BD5217CA8580C2DF3E87D91A29` |
| Vila Velha/ES | 58.884 | `FED6781FD23D814B76236C46195F817A43503CC6EB47573C4A95098B71543D4E` |
| Vitória/ES | 60.163 | `C94B412AB841FFB07292F40B4484A367758E475525658C10483BB95EFF86C781` |
| Campos dos Goytacazes/RJ | 62.362 | `D1479331B34C89C8337A013139D30D6DC23F70B56EEB9B31AF0B97D19430FDB4` |
| João Pessoa/PB | 65.943 | `9A5D406D92C7EF9DB66BF7E33F0451CF9B566A0B42A1D3EA3EEB5B3876F0A23D` |
| Recife/PE | 63.844 | `63277B46E89392BF60B45258A9AE71467D4DBDE7DC96501D9D4FDA19E355771B` |
| São Paulo/SP | 67.565 | `36289969886FBF7012164D99DC859FA4B7DA8E04B65C88C919C08899949B208D` |
| Água Boa/MT | 55.786 | `0E4BE574D2BBB1CDF9C8ED6BAB2A3D347262DCE42C0719FA38448B59D4D90E28` |
| Brasília/DF | 66.609 | `304C359E59C884718E590706D634B16B0D694735CC4AE1E4AE9CDDC010DF694A` |

## Decisão de publicação

`SUAS_INDICATORS_PUBLISHED=0` e `EQUIPMENT_ROWS_VALIDATED=0`. Publicar os números piloto como rede nacional criaria falsa precisão e violaria a distinção entre indicador agregado e inventário físico. Os IDs `WB-SUAS-CRAS` e `WB-SUAS-CREAS` não foram alterados nem reutilizados sem definição source-native confirmada.

## Orçamento

Tamanho observado do banco: `33.870.138.515` bytes. Baseline: `33.861.332.115`. Crescimento observado cumulativo: `8.806.400` bytes. Crescimento P12.4: `0` bytes. Envelope de P12.4 (500 MB) permanece integralmente disponível.

## Pendência objetiva

Obter um arquivo/exportação oficial de 2024 em formato tabular com chave da unidade, município sede, universo respondente e campos de regionalização. Depois disso, repetir o piloto, medir cardinalidade e só então planejar carga nacional.
