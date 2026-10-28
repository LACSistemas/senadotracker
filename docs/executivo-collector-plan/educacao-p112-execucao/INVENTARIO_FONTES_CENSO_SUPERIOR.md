# Inventário de fontes — P11.2

Fonte principal: [Microdados do Censo da Educação Superior — INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-da-educacao-superior). Os ZIPs 2022–2024 foram obtidos previamente e preservados em `D:\Civica\raw\inep\censo_superior`.

| ano | ZIP SHA-256 | CSV IES | CSV cursos | bytes ZIP |
|---:|---|---|---|---:|
| 2022 | `f30830c26956a3575c3786634e51c9a643faa3907f5f895c8c326386ff1df6e8` | 81 colunas | 200 colunas | 33.161.794 |
| 2023 | `a7a3b905777a7ddbaf287c242bf6ed55c056f17350d042a4199fb1e10cf3b2c5` | 84 colunas | 202 colunas | 38.411.202 |
| 2024 | `e8e11899efe2b348a7e80e3a3c610c3bdd1ced3362ccdf2c9f9abe9bf8988386` | 84 colunas | 223 colunas | 456.807.449 |

Os CSVs são `latin1`, delimitados por `;`. O dicionário oficial 2023 confirmou `TP_DIMENSAO`: 1 presencial no Brasil, 2 EAD no Brasil, 3 EAD somente Brasil e 4 EAD de instituições brasileiras no exterior.

Fonte de reconciliação prevista: [Sinopses Estatísticas da Educação Superior](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-superior), com links oficiais 2022–2024 registrados no contrato. O download retornou indisponibilidade de rede nesta execução e ficou pendente.
