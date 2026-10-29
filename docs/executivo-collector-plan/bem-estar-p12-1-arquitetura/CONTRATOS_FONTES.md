# Contratos das famílias de fontes

## Estados de validação

`SOURCE_DOCUMENTED` = página/dicionário oficial localizado.  
`RESOURCE_ACCESS_VERIFIED` = recurso legítimo baixado ou endpoint acessado.  
`LAYOUT_VERIFIED` = cabeçalho/estrutura amostrados.  
`SEMANTICS_VERIFIED` = unidade, universo e períodos conferidos.  
`TERRITORIAL_COVERAGE_VERIFIED` = chaves e cobertura observadas.  
`READY_FOR_COLLECTOR` = todas as anteriores + parser/replay definidos.  
`READY_FOR_PUBLICATION` = reconciliação, privacidade e publicação aprovadas.

## Matriz

| Família | Fonte/dataset | Chave e período | Estado nesta fase | Próxima prova |
|---|---|---|---|---|
| IBGE Censo/SIDRA | Censo 2022, tabelas de rendimento/moradia/Gini | IBGE7; referência 2022; tabelas/variáveis | `SOURCE_DOCUMENTED`, sem download P12.1 | amostra SIDRA, dicionário, universo e cobertura municipal |
| IBGE população | SIDRA/estimativas já reutilizadas | entity + ano | `RESOURCE_ACCESS_VERIFIED` no componente existente | confirmar edição/malha por indicador |
| RAIS | MTE microdados não identificados | município do estabelecimento + ano-base + CNAE/CBO | `SOURCE_DOCUMENTED` | FTP/arquivo, layout, volume, supressões e parser incremental |
| Novo Caged | MTE movimentações | município do estabelecimento + competência | `SOURCE_DOCUMENTED` | amostra mensal, ajustes, saldo e denominador de estoque |
| CadÚnico | MDS/SAGICAD agregados | município/UF + competência | `SOURCE_DOCUMENTED` | recurso agregado, situação cadastral, revisão e privacidade |
| Bolsa Família/BPC | Portal da Transparência/MDS | município SIAFI/IBGE + competência | `SOURCE_DOCUMENTED` | separar benefício, parcela, pagamento e repasse; deduplicar |
| Censo SUAS | MDS | equipamento/município/ano/questionário | `SOURCE_DOCUMENTED` | dicionário, códigos de equipamentos e comparabilidade |
| SINISA/SNIS | Ministério das Cidades | prestador/município/ano-base | `SOURCE_DOCUMENTED` | participação, municípios atendidos/sede e ruptura de série |
| Siconfi/finanças | componente financeiro existente | entidade + exercício/período + conta | `RESOURCE_ACCESS_VERIFIED`/`LAYOUT_VERIFIED` no collector existente | apenas mapear função/subfunção assistencial; não duplicar fatos |
| PNCP/contratos | componente financeiro existente | contrato/CNPJ + data | `RESOURCE_ACCESS_VERIFIED` no componente existente | consumir contextual, sem atribuir gasto social automaticamente |
| MUNIC/ESTADIC | IBGE | município/UF + edição | `SOURCE_DOCUMENTED` | validar edição e questionário antes de publicar |
| Anatel | mapa/indicadores de conectividade | localidade/UF + data | `SOURCE_DOCUMENTED` | endpoint/arquivo e unidade territorial |
| Cetic.br | microdados/agregados TIC | edição/recorte | `SOURCE_DOCUMENTED` | licença, amostra e recorte municipal |
| Atlas/IpeaData | índices/renda auxiliares | município/ano | `SOURCE_DOCUMENTED` | licença e não duplicação com Censo |

## Contratos específicos

### IBGE

Separar universo censitário de amostra preliminar. A tabela e a variável são parte da identidade do indicador. Rendimento domiciliar per capita deve declarar se a medida é média, mediana, distribuição de moradores ou domicílios, quais exclusões e se há ponderação. Gini é índice da distribuição do rendimento domiciliar per capita; não é “renda média” e não pode ser agregado por soma.

### RAIS e Caged

RAIS mede vínculos/estoque formal no estabelecimento e ano-base; Caged mede movimentações mensais e saldo. O município é do estabelecimento, não residência. Retificações devem gerar novo `source_hash`, mantendo o snapshot anterior. Taxas exigem estoque explícito; saldo absoluto pode ser publicado sem denominador.

### MDS

Somente agregados elegíveis. CadÚnico mede famílias/pessoas cadastradas em uma competência; Bolsa Família e BPC medem benefícios/pagamentos com semânticas próprias. Não somar pessoas e famílias, nem benefício concedido e parcela paga. CPF/NIS não são persistidos.

### Censo SUAS e SINISA

Equipamento, capacidade, atendimento, prestador e município atendido são dimensões diferentes. SINISA/SNIS é consumido contextualmente quando a área de Infraestrutura já possui o fato; Bem-Estar não duplica a linha.

