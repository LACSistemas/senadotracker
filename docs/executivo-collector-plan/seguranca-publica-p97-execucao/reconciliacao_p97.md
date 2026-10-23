# Reconciliação (P9.7)

A P9.7 **não carregou fonte nova**: o resultado é reconciliar o que as famílias reaproveitam.

## Σ municípios + município ignorado = UF (por indicador × mês, consulta SQL sobre `exec_ind_value`)
| Indicador | Células UF×mês | Divergências | Observação |
|---|---:|---:|---|
| 3112 mandado de prisão — Estadual (VDE) | 3.795 | 0 | 387 células de UF sem linhas municipais (meses só com zero) |
| 3113 mandado de prisão — PF/PRF (VDE) | 1.159 | 0 | 768 sem linhas municipais |
| 8040, 8041, 8042, 8045, 8047 (ISP-RJ) | 153 cada | 0 | |
| 8313, 8314, 8315 (SSP-RS) | 175 cada | 0 | |
| 8720, 8721, 8722, 8723 (SSP-SP) | 56 / 44 / 44 / 44 | 0 | sem supressão nestas naturezas (não sensíveis) |

Diferença máxima: 0,000 em todos. Indicadores de UF apenas (VDE 3116, 3117, 3122–3127) não têm partição municipal: a UF é o próprio dado da fonte.

## Controles oficiais
- Brasil = Σ das 27 UFs do mesmo indicador do VDE (calculado na leitura, `complete` só com 27 UFs × 12 meses).
- ISP-RJ: as divergências estado × município e os compostos não aditivos da P9.6 (152 e 1.578) **não afetam** estas famílias: nenhum composto foi incluído e os indicadores usados reconciliam em 0.
- Massa de maconha estadual PR 2024: 482.868 (banco) × 483,7 mil kg (imprensa, não oficial) — corroboração, não controle oficial.

## Não reconciliável (e por quê)
- Estadual × PF/PRF: sobreposição não demonstrável; por isso nunca se soma.
- Operações, RIFs, condenações: sem dado.

## Retificações
O VDE e as fontes estaduais são reabertos a cada carga; a diferença entre versões fica no change log da publicação. Nada foi ajustado artificialmente.
