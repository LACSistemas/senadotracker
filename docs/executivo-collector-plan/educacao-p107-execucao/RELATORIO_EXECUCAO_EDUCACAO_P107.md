# Relatório de execução: P10.7 Contratações, obras e investimentos na Educação

Sem commit e sem push. Frontend, P10.8–P10.10 e lab/SQLite não foram tocados.

## Gates
| Gate | Estado | Nota |
|---|---|---|
| G0_SAFETY | PASS_WITH_CAVEATS | baseline, backup, restore isolado verificado por fingerprints, piloto antes do backfill. Pendências da P10.6 classificadas (backlog); 16 falhas de teste herdadas, nenhuma de educação |
| G1_PNCP_REUSE | PASS | RAW existente reaproveitado, 0 contratos rebaixados |
| G2_EDUCATION_CLASSIFICATION | PASS_WITH_CAVEATS | precisão 97,9% (alta confiança), revisor único; ~8% de falso negativo entre textos com "escolar" sem unidade nomeada; POSSIBLE à parte |
| G3_CONTRACTS_SUPPLIERS | PASS_WITH_CAVEATS | 428.192 contratos; contratações e termos só amostra por valor |
| G4_EDUCATION_WORKS | PARTIAL | 6.637 obras de 9 UFs, sem execução física/empenho; cobertura nacional não declarada |
| G5_CROSS_DOMAIN_LINKAGE | PASS_WITH_CAVEATS | só chave oficial; 0 escola, 0 pagamento |
| G6_MODEL_PUBLICATION | PASS | migration v16, publicação idempotente, rollback, falha injetada |
| G7_RECONCILIATION | PASS_WITH_CAVEATS | exata; amostra independente 100/100 |
| G8_DATABASE_5GB | PASS | +335.577.088 B (0,34 GB) |
| G9_SERVING | PASS | p95 máx 601 ms (Brasil), mediana 6,8 ms |
| G10_REGRESSION | PASS_WITH_CAVEATS | fingerprints iguais; ver testes |
| G11_P108_READINESS | PASS_WITH_CAVEATS | `CONTRATOS_P108.md` |

## As 22 perguntas
1. **Contratos PNCP reutilizados:** 5.111.306 (RAW local). 2. **Anos:** 2021–2026 (até out/2026). 3. **Classificados:** 431.788; publicados 428.192 (3.596 sem município/CNPJ do órgão).
4. **Valor contratado por categoria (alta confiança, R$ bi):** ver `evidencias/resultados_banco.json` (cat. 1: 32,3; 2: 14,6; 3: 22,1; 8: 19,2; demais no arquivo). Total alta+oficial ≈ R$ 215 bi, **valor contratado, não gasto**; concentrado em poucos contratos gigantes.
5. **Municípios/UFs:** 3.890 municípios, 27 UFs, 5.585 órgãos. 6. **Fornecedores PJ:** 75.578.
7. **Precisão:** 97,9% estratificada (IC por faixa 88–99%), categoria primária 99,1%. 8. **Possíveis sem confirmação:** 44.482 contratos (precisão 37–74%).
9. **Obras identificadas:** 6.637 (9 UFs). 10. **Fontes de obras operacionalizadas:** só Obrasgov (parcial); PNCP por CIPI; FNDE/SIMEC/Transferegov NOT_EVALUATED.
11. **Obras com situação/valor/datas:** todas com situação; 2.971 com valor previsto real (3.666 placeholder); datas em `exec_edu_work`. 12. **Escolas com vínculo comprovado:** 0 (sem INEP).
13. **Contrato–empenho–pagamento:** 0 comprovadas. 14. **Duplicidades resolvidas:** 0 chaves repetidas; 995 contratos comuns com Segurança sinalizados.
15. **Divergências:** nenhuma entre RAW e banco além dos 3.596 rejeitados registrados. 16. **RAW novo:** ~1 GB em D: (staging e coletas parciais). 17. **Crescimento do PG:** 335.577.088 B.
18. **Replay NO_CHANGE:** sim, todas as fatias. 19. **Retificação/rollback/falha injetada:** testados em dados reais isolados e em fixtures; passam.
20. **Ondas anteriores intactas:** sim (fingerprints). 21. **Desempenho:** `BENCHMARK_READ_MODELS_P107.json`; carga completa dos contratos em ~10 min.
22. **Pronto para P10.8:** sim, com os limites de `CONTRATOS_P108.md`.

## O que NÃO foi entregue
Cobertura nacional de obras, compras e termos completos (limite de requisições do PNCP/Obrasgov), vínculo escola/pagamento, segundo revisor humano da precisão, recall nacional. Os coletores são retomáveis (`scripts/exec/pncp-complement.ts`, coleta Obrasgov) e foram parados.

Testes pedidos (Vitória, Serra, Alto Rio Novo, SP, RJ, BH, Recife, município pequeno, Brasil, UFs) estão no benchmark e em `resultados_banco.json` (`casos`).
