# Prontidão do domínio Segurança para a P9.8 (frontend)

Gerado de `exec_ind_def`/`exec_ind_value` em produção em 23/10/2026 (`MATRIZ_INDICADORES_SEGURANCA_P98.csv`, `prontidao_casos_p98.json`, `CONTRATOS_FRONTEND_SEGURANCA_P98.json`). A classificação por indicador é **automática e conservadora** (regras no script `scripts/exec/security-matrix.ts`); a decisão editorial final é da P9.8.

## 1. Inventário por domínio
| Domínio | Indicadores | Linhas | UFs | Municípios (máx.) | Período | Prelim. | Suprimidas | Página UF | Página município |
|---|---:|---:|---:|---:|---|---:|---:|---|---|
| Criminalidade nacional (SIM/VDE) — P9.1 | 62 | 2.133.062 | 27 | 5.570 | 2013-01..2026-09 | 148.950 | 0 | READY_FOR_FRONTEND (62) | 30 READY, 1 com ressalva, 31 só contexto (VDE só-UF) |
| Trânsito — P9.2 | 122 | 3.267.659 | 27 | 5.571 | 2007-01..2026-09 | 520.511 | 0 | READY_FOR_FRONTEND (122) | 43 READY, 4 com ressalva, 75 só contexto |
| Efetivos e estrutura — P9.3 | 62 | 152.944 | 27 | 5.570 | 2018-12..2026-08 | 0 | 0 | READY_WITH_CAVEATS (62) | 18 READY (existência de guarda/delegacia), 44 só contexto |
| Sistema prisional — P9.4 | 37 | 458.577 | 27 | 1.162 | 2016-07..2025-07 | 0 | 0 | READY_WITH_CAVEATS (37) | 25 READY, 12 com ressalva |
| Finanças — P9.5 | 39 | 473.866 | 27 | 5.569 | 2009-01..2026-01 | 5.957 | 0 | READY_WITH_CAVEATS (39) | READY_WITH_CAVEATS (39) |
| Criminalidade estadual — P9.6 | 140 | 3.856.129 | 1 por fonte (7 UFs) | 853 (MG) | 2004-01..2026-09 | 260.864 | 32.732 | READY_WITH_CAVEATS (140) | READY_WITH_CAVEATS (140) |
| Crime organizado/atuação do Estado — P9.7 | 0 novos (22 reaproveitados, 9 famílias) | — | 27 (VDE) + RJ/RS/SP | 5.184 (mandados VDE) | 2012-01..2026-09 | — | 0 | READY_WITH_CAVEATS | READY_WITH_CAVEATS só onde a fonte tem município |

Periodicidade e last-competence por read model: ver `CONTRATOS_FRONTEND_SEGURANCA_P98.json`.

## 2. Testes de prontidão (consultas reais)
| Caso | Resultado | Leitura recomendada |
|---|---|---|
| Vitória/ES, Serra/ES, Alto Rio Novo/ES | P9.1, P9.2, P9.3, P9.5 e P9.6 (SESP-ES: 10, 10 e 7 indicadores); Serra tem P9.4; Vitória e Alto Rio Novo não (sem estabelecimento prisional na fonte) | ES é o caso-guia: mostrar SESP-ES como "ocorrências por tipo", último mês preliminar |
| São Paulo, Rio, Belo Horizonte, Recife, Porto Alegre | todas as ondas; P9.6 com 24, 55, 18, 11 e 15 indicadores | uma fonte estadual por município; células suprimidas (SP, PE) como "suprimido" |
| Salvador/BA, Curitiba/PR (UF sem fonte estadual) | P9.1, P9.2, P9.3, P9.4, P9.5 sem P9.6 | usar VDE (UF) como contexto; dizer que a UF não tem fonte municipal publicada |
| Município sem linha na fonte estadual da própria UF | série P9.6 vazia | "sem registro na fonte" ≠ zero |
| UF com série longa (RJ 2014+, PE 2004+) × UF só do ano corrente (CE 2026) | confirmado em `cobertura_estadual_municipal.csv` | não comparar janelas diferentes |
| Fontes parecidas (VDE × SSP estadual) | medidas distintas | nunca somar nem alinhar sem aviso |
| UF com competências diferentes entre ondas | P9.4 até 2025-07; P9.3 edições 2018–2025; demais até 2026-09 | cada bloco mostra sua data-base |

## 3. Pendências que a P9.8 deve respeitar
- Fonte estadual municipalizada em 7 UFs; AL bloqueio externo; DF por Região Administrativa não publicado; BA a validar; 10 UFs sem fonte aberta localizada.
- Nenhuma taxa por 100 mil criada (população do mesmo ano ausente em 2022–2023).
- PNCP 2026 é parcial; tarefa agendada desabilitada.
- Crime organizado: só atividade policial registrada; operações, financeiro e organizações não têm dado publicável.

## 4. Classificações usadas
READY_FOR_FRONTEND (cobertura ampla, sem ressalva estrutural) · READY_WITH_CAVEATS (ressalvas que o texto da página precisa carregar) · CONTEXT_ONLY (dado só em nível maior; serve de contexto) · NOT_READY (sem dado) · NOT_PUBLISHABLE (operações, financeiro, organizações, mapa de facções).
