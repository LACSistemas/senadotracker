# Mapeamento municipal — Portal de Transferências → entidade canônica

## Regra executada

O código `municipality_siafi` foi preservado como chave source-native. O vínculo ao município canônico usa somente a chave determinística `(UF, nome normalizado)`:

1. normalização Unicode NFD, remoção de diacríticos, maiúsculas e remoção de caracteres não alfanuméricos;
2. busca de correspondência exata no cadastro `civica_exec.exec_entity` com `kind=4`;
3. vínculo somente quando há exatamente uma entidade candidata;
4. nenhum fuzzy matching, distância textual ou inferência por valor.

## Resultado observado

| Situação | Códigos | Entidades | Regra |
|---|---:|---:|---|
| `LINKED` | 5.537 | 5.537 | nome+UF normalizados, correspondência única |
| `UNRESOLVED` | 30 | 0 | preservados sem `entity_id` |
| `AMBIGUOUS` | 0 | 0 | não publicar vínculo ambíguo |
| `NON_MUNICIPAL` | 0 | 0 | nenhum caso classificado |

O resultado **não é tratado como prova de equivalência oficial SIAFI→IBGE**: a fonte não forneceu, nesta execução, tabela oficial de conversão. Os 30 códigos sem correspondência permanecem explicitamente não resolvidos.

Tabela persistida: `civica_exec.exec_edu_program_municipality_map`, migration 20. O rollup municipal usa `entity_id`/`ibge7` apenas para linhas `LINKED`.
