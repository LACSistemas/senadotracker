# Comparabilidade temporal 2023–2025

## O que é comparável

- `CO_MUNICIPIO_ESC`, `NO_MUNICIPIO_ESC`, `CO_UF_ESC` e `TP_DEPENDENCIA_ADM_ESC` aparecem nos três ciclos de resultados.
- Presença e notas das quatro áreas mantêm nomes e semântica (`TP_PRESENCA_*`, `NU_NOTA_*`).
- `TP_STATUS_REDACAO` e `NU_NOTA_REDACAO` permanecem disponíveis; a regra de redação válida (`status = 1`) reconcilia exatamente com as Sinopses.
- As categorias de dependência são estáveis: 1 federal, 2 estadual, 3 municipal e 4 privada.

## Quebras e ressalvas

1. 2023 publica uma base única e não tem `CO_ESCOLA`; 2024 e 2025 separam `PARTICIPANTES` e `RESULTADOS` e incluem `CO_ESCOLA`.
2. A partir de 2024 o código da escola pode ser mascarado para escolas com menos de dez participantes. A coluna não é uma chave territorial segura e não deve ser exibida.
3. O município de residência foi removido do modelo simplificado; não existe série municipal de residência nestes arquivos.
4. 2024 e 2025 não possuem chave comum entre participantes/questionário e resultados/escola. Não é permitido juntar as tabelas por ordem de linha, `NU_SEQUENCIAL` ou `NU_INSCRICAO`.
5. O ciclo de 2025 distribui notas de redação por avaliador, mas a nota final e o status continuam disponíveis; o produto deve usar a nota final.

## Regra de publicação

Comparações 2023–2025 são aceitáveis para município da escola, rede administrativa e áreas/reda­ção, desde que mostrem o denominador e a alteração de cobertura. A série deve ser apresentada como “resultados de participantes cuja escola de conclusão está no município”, nunca como desempenho de residentes.
