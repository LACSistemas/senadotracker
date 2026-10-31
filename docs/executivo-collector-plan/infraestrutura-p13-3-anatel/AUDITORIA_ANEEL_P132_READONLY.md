# Auditoria somente leitura da P13.2

## Resultado

- Banco confirmado: `projetoeleitor_db`.
- Tamanho antes da P13.2: `33.995.369.619` bytes.
- Tamanho depois da P13.2: `34.159.742.099` bytes.
- Crescimento correto: `164.372.480` bytes (`34159742099 - 33995369619`).
- A versão inicial do relatório P13.2 dizia `164.205.480`; o texto foi corrigido. Os artefatos de resultados e armazenamento já continham o valor correto.

## INDGER

O RAW oficial em `D:\Civica\raw\infraestrutura\energia\aneel\indger-dados-comerciais.csv` contém competências 2026-01 a 2026-08 (e 2026-09 parcial). A publicação P13.2 selecionou 2025-01..12 e 2026-08. Portanto, 2026-01..07 não estão ausentes da fonte; foram apenas omitidas pela seleção da P13.2. Não houve interpolação ou republish nesta fase.

## Território e código inválido

Consulta somente leitura da publicação INDGER confirma 5.086 municípios distintos em 27 UFs. O código `1403205` ocorre no RAW em 2026-02..08, mas a API oficial do IBGE retornou `[]` e não existe na lista oficial atual de municípios de Roraima. Foi mantido como código não resolvido/inválido da fonte; não houve fuzzy matching.

## Gate de continuidade

`READY_FOR_P13_3=false` na P13.2 não é bloqueio compartilhado: a P13.3 pode auditar e publicar famílias independentes. Nenhuma tabela ou fato da P13.2 foi alterado pela P13.3.
