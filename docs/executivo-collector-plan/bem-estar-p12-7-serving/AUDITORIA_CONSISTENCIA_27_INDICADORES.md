# Auditoria de consistência dos 27 indicadores

## Contagens observadas no banco oficial

| Família | Indicadores | Linhas por indicador | Semântica principal |
|---|---:|---:|---|
| Censo 2022 | 9001–9006 | 5.598 cada; Gini 28 | municípios/UF/Brasil; Gini somente UF/Brasil |
| Censo SUAS 2024 | 9101–9106 | 5.333–5.570 | universos de respondentes distintos |
| Censo SUAS 2024 | 9201–9203 | 2.609 | unidades/instrumentos com cobertura própria |
| Censo SUAS 2024 | 9301 | 4.976 | conselho/gestão conforme fonte |
| RAIS 2025 | 9401 | 16.797 | estoque anual, 2023–2025 |
| RAIS 2025 | 9402 | 27 | remuneração média real, UF |
| Novo Caged | 9500–9503 | 44.792 cada | 2026-01–2026-08, município/UF/Brasil |
| MUNIC 2024 | 9601–9605 | 5.570 cada | resposta administrativa municipal |

Os valores e nulos foram preservados: 9004 tem 8 nulos, 9005 tem 25, Caged estoque 9500 tem 430, MUNIC 9601–9604 têm 15–16 nulos e MUNIC 9605 tem 2.892 respostas não aplicáveis. Nulo não é zero.

## Auditorias específicas

- **RAIS:** os fatos conferem com a Tabela 2/4 da edição 2025. O residual 2024 é 10.899 na linha UF `999999`; em 2025 a linha `999999` é 3.065 e o residual de reconciliação documental é 102.377. Nenhum fato foi alterado.
- **MUNIC:** os cinco indicadores usam o dicionário real da planilha `Informática e comunicação`; `Sim/Não` é o denominador de respostas válidas e `-` permanece ausente.
- **Censo 2022:** cinco indicadores municipais cobrem as 5.570 linhas censitárias; Boa Esperança do Norte não recebe imputação. Gini é 28 territórios.
- **SUAS:** não há equiparação artificial entre respondentes CRAS, CREAS, conselhos e indicadores IDCRAS/IDCREAS.
- **Financeiro:** EMP, LIQ e PAG de função 08 são reusados da camada Siconfi e não entram nos 27 fatos como novos indicadores.

## Veredito

`INDICATOR_CONSISTENCY=PASS_WITH_DOCUMENTED_LIMITATIONS`.
