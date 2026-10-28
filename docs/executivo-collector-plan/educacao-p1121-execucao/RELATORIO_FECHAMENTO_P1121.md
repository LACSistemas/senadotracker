# P11.2.1 — Fechamento do Censo Superior

**Banco:** `projetoeleitor_db` · **schema:** `civica_exec` · **data:** 27/10/2026

`P11_2_1_STATUS = PASS_WITH_CAVEATS`.

O baseline P11.2 permanece íntegro: 2022–2024, 2.792 IES estáveis, 50.577 cursos e 1.964.978 ofertas anuais. A chave publicada continua sendo `(year, co_ies, co_curso, co_municipio, tp_modalidade, tp_dimensao)`.

As Sinopses não puderam ser baixadas nesta máquina (rotas `download.inep.gov.br` retornaram 502/socket); as tentativas estão em `SINOPSES_OFICIAIS_EVIDENCIAS.md`. Não há declaração artificial de paridade externa.

| ano | ofertas | matrículas | linhas 1/2 | matrículas 1/2 | linhas 3/4 | matrículas 3/4 |
|---:|---:|---:|---:|---:|---:|---:|
| 2022 | 573.019 | 9.444.116 | 563.417 | 9.441.298 | 9.602 | 2.818 |
| 2023 | 671.610 | 9.977.217 | 660.575 | 9.974.451 | 11.035 | 2.766 |
| 2024 | 720.349 | 10.227.266 | 708.580 | 10.224.727 | 11.769 | 2.539 |

`entity_id IS NULL AND co_municipio <> 0` foi zero nos três anos. O serving territorial não soma município/UF/Brasil como categorias independentes.

## Gates

| gate | resultado |
|---|---|
| A0 segurança | PASS |
| A1 sinopses | BLOCKED_EXTERNAL |
| A2 reconciliação externa | PARTIAL |
| A3 TP_DIMENSAO/EAD | PASS_WITH_CAVEATS |
| A4 territorial | PASS |
| A5 read contracts | PASS |
| A6 performance | PASS (SQL) / PARTIAL (carga) |
| A7 resiliência | PASS_WITH_CAVEATS |
| A8 testes | PASS |

`P11_2_1_READY_FOR_PUBLICATION = NO` enquanto A1/A2 permanecerem externos.
