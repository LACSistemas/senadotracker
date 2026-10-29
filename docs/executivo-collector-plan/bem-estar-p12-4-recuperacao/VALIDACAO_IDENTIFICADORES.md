# Validação de identificadores

| Fonte | Linhas | Identificador | Únicos | Junção territorial |
|---|---:|---|---:|---|
| CRAS CSV | 8.546 | `NU_IDENTIFICADOR` | 8.546 | 8.546 IBGE7 válidos; 5.333 IBGE6 |
| IDCRAS unidade | 8.546 | `Nº IDENTIFICADOR do CRAS` | 8.546 | 8.546 IBGE7 |
| IDCREAS unidade | 2.881 | `Nº IDENTIFICADOR do CREAS` | 2.881 | 2.881 IBGE7 |
| IDConselho municipal | 5.570 | `IBGE7` | 5.570 | 5.570 códigos presentes |

O join CRAS↔IDCRAS é por identificador source-native, conforme `_carregamento.R`; não houve fuzzy matching. Os joins municipais usam exclusivamente IBGE7 (CRAS/IDCRAS/IDConselho) ou IBGE6 determinístico (IDCREAS municipal). O cadastro `exec_entity` possui 5.571 entidades municipais; todas as linhas fonte com valor não nulo resolveram para uma entidade.

Não foi criada tabela de inventário de equipamentos. Portanto, a validação do Produto B é de identidade e cobertura, não de situação operacional, sede histórica ou relações regionais.
