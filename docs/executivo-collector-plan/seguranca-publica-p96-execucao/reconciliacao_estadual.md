# Reconciliação estadual (P9.6)

Método: para cada fatia (fonte × UF × ano) o construtor garante **Σ municípios + "município ignorado da UF" = total da UF** por indicador × mês (a UF é a soma construída, ou o controle da própria fonte quando existe) e a verificação transacional falha a publicação se o número de linhas persistidas difere do construído. Com células suprimidas a igualdade não é testada (a UF mantém o total).

| Fonte | Controle independente | Divergências | Observação |
|---|---|---:|---|
| ISP-RJ | série estadual `DOMensalEstadoDesde1991.csv` | 152 | divergências da própria fonte (município × estado); **documentadas, nunca ajustadas** |
| ISP-RJ | compostos (cvli, letalidade_violenta, roubo_rua, total_roubos, total_furtos) × componentes | 1.578 violações | composto da fonte ≠ soma dos componentes em parte dos meses; mantido como publicado, composto `NOT_COMPARABLE`, nunca somado |
| SEJUSP-MG | — (sem total estadual separado) | 0 | grade completa de 853 municípios |
| SESP-ES | — | 0 | UF construída |
| SSP-RS | linha `Total RS` de cada aba mensal | 0 | |
| SDS-PE, SSPDS-CE, SSP-SP | — | 0 | UF construída por soma dos municípios + ignorado; "NÃO INFORMADO" vai ao ignorado |

Município sem correspondência no IBGE vai ao "município ignorado da UF" (nunca distribuído); mais de 5 nomes distintos sem correspondência derruba a carga. Aliases de PE (5 grafias oficiais) estão em `crime-pe.ts`.

Não foi feita reconciliação com o VDE/Sinesp (P9.1) nem com óbitos do SIM: são medidas diferentes e permanecem separadas.
