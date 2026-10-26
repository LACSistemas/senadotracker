# Relatório de execução · P10.2 · Matrículas, turmas e oferta educacional

Data: 2026-10-25 · Banco `projetoeleitor_db`, schema `civica_exec` (migration v10) · RAW e staging em `D:\Civica` · **Sem commit e sem push.** P10.3–P10.10 não iniciadas; nenhum frontend construído.

## 1. Resultado
O Cívica tem agora a **história nacional de matrículas, turmas e oferta da Educação Básica, 2007–2025**, em produção: **3.547.666 registros escola × edição**, 19 edições × 27 UFs = **513 fatias publicadas**, sem nenhuma linha rejeitada, todas ligadas à identidade e ao cadastro da P10.1 por chave estrangeira. Os totais **batem exatamente com a Sinopse Estatística do mesmo ano** (tabelas 1.1, 1.2, 4.1 e 4.2) no Brasil, nas 27 UFs e em todos os municípios: **0 divergências em 2.750.826 comparações de matrícula** e **uma única divergência explicada em turmas** (EJA fundamental de 2025, +4.696 turmas que a Sinopse atribui ao fundamental). O banco cresceu **658 MB** (previsto: 1,3 GB), o change log não cresceu, o piso de disco nunca foi ameaçado (C: livre mínimo 53,35 GiB; piso 20) e Saúde, Segurança, Finanças, PNCP, Legislativo e o cadastro da P10.1 permanecem **idênticos**.

## 2. Gates finais
| Gate | Estado | Base |
|---|---|---|
| G0_SAFETY | **PASS** | dump 515 MB (SHA-256 registrado) restaurado em cluster isolado (4.272.656 linhas de cadastro, 513 publicações); 20 arquivos de RAW reconferidos por SHA-256 (0 divergentes); fingerprints antes/depois; nenhum serviço reiniciado |
| G1_INEP_TERMS | **PASS_WITH_CAVEATS** | Manual do Usuário, Parecer PF-INEP 18/2022, RIP e Nota Técnica 5/2021 lidos; classificação por família em `LICENCA_E_USO_DADOS_INEP.md`; pendentes: cláusula CC BY-ND do portal e redistribuição de tabelas derivadas, educação especial por escola, NT ANPD 12/2023 (fora do ZIP) |
| G2_ENROLLMENT_SEMANTICS | **PASS** | partição exata de `QT_MAT_BAS` provada linha a linha (2023–2025: 100% das escolas); resto derivado ≥ 0 nas 19 edições; catálogo tipado de 33 medidas |
| G3_CLASSES_AND_OFFER | **PASS** | grão validado (uma linha por escola, 0 duplicados), turmas por etapa e modalidade, EJA 2025 tratado, tamanho de turma derivado e rotulado |
| G4_PERSISTENCE | **PASS** | 3 tabelas, FK composta, sem JSONB, sem tabela por ano/UF; 185 B por linha |
| G5_HISTORICAL_EXTRACTION | **PASS_WITH_CAVEATS** | 19/19 edições extraídas e publicadas, 0 rejeições; ressalvas: turno só de 2014, tempo integral descontínuo, campos profissionais separados só de 2023 (`NULL`, nunca zero) |
| G6_NATIONAL_RECONCILIATION | **PASS_WITH_CAVEATS** | matrículas 0 divergências; turmas 1 divergência explicada (2025); tempo integral, turno e turmas integrais sem tabela de referência incorporada |
| G7_PUBLICATION | **PASS** | dataset 71, fatia UF × edição, `publishSlice`, bootstrap + retificação com log, 513 `NO_CHANGE` |
| G8_STORAGE_BUDGET | **PASS** | medido antes/depois de cada edição; meta de 5 GB para P10.1–P10.3 com folga |
| G9_SERVING | **PASS** | 4 funções de leitura; Brasil 9 ms, UF 2–3 ms, município 3–517 ms (série de 19 edições), escola 0,8 ms |
| G10_PRIVACY | **PASS** | só contagens por escola; nenhuma coluna pessoal (teste automatizado); gestor/docente não baixados |
| G11_IDEMPOTENCY_ROLLBACK | **PASS** | replay 513/513 `NO_CHANGE`; retificação com log exato (10 linhas); rollback exato; falha injetada sem rastro; cadastro P10.1 intacto |
| G12_COMPARABILITY_FOUNDATION | **PASS_WITH_CAVEATS** | 10 medidas de comparação, redes separadas, proibições e pequenos números (`CONTRATOS_BENCHMARKS_P102.md`); taxas de atendimento dependem da P10.9 |
| G13_TERRITORIAL_TESTS | **PASS** | Brasil + 7 UFs + 11 municípios: 19/19 contra a Sinopse |
| G14_REGRESSION | **PASS** | fingerprints só com as diferenças autorizadas; P10.1 idêntico; `npm test` 495 aprovados, 0 falhas |
| G15_DOWNSTREAM_READINESS | **PASS** | `CONTRATOS_P103_P104.md` |

Nenhum gate FAIL, PARTIAL ou NOT_EVALUATED.

## 3. O que foi implementado
- `packages/db/src/exec/ddl-v10.ts` (migration), `educacao-oferta-build.ts` (validação e fatias, puro), `educacao-oferta-catalog.ts` (catálogo de medidas e aditividade), `educacao-oferta-read.ts` (read models), `specs.ts` (`DATASET.edu_oferta = 71`, tableIds 83–85).
- `apps/collector/src/exec/educacao-oferta.ts` (localização no RAW, extração, publicação com verificação do bit0) e ajuste de `inep-censo.ts` (inclui `Tabela_Turma`).
- `scripts/exec/`: `censo_oferta_extract.py`, `educacao-pilot.ts` (`oferta-extract`, `oferta-publish`, `register-docs`), `educacao-oferta-report.ts`, `educacao-oferta-bench.ts`, `educacao-oferta-g11.ts`, `educacao-oferta-numeros.ts`.
- Testes: `tests/unit/educacao-oferta-p102.test.ts` e `tests/integration/educacao-oferta-p102.test.ts` (registrados no `npm test`).

## 4. Perguntas obrigatórias
**Q1. Matrículas na Educação Básica em 2025?** **46.018.380** (matrículas, não alunos) em 178.772 escolas, 2.233.976 turmas.

**Q2. Matrículas por etapa (2025)?** Creche 4.182.646 · pré-escola 5.103.536 (infantil 9.286.182) · anos iniciais 14.514.244 · anos finais 11.292.523 (fundamental 25.806.767) · ensino médio 7.370.879 · EJA 2.252.069 (fundamental 1.406.442, médio 845.627) · educação profissional não integrada ao médio 1.302.483 (derivada). **A soma das sete é 46.018.380 = o total.** Transversais, que não somam: educação profissional total 3.187.976 (inclui o técnico integrado, já no médio), educação especial 2.458.159.

**Q3. Por rede (2025)?** Federal 383.526 (716 escolas) · estadual 13.330.302 (29.733) · municipal 23.059.168 (106.572) · privada 9.245.384 (41.751). "Escolas localizadas", não "rede municipal do município".

**Q4. Urbanas e rurais (2025)?** Urbana 40.871.166 (88,8%) · rural 5.147.214 (11,2%).

**Q5. Turmas por etapa e dependência (2025)?**
| Dependência | Infantil | Fundamental | Médio | EJA | Total |
|---|---:|---:|---:|---:|---:|
| Federal | 192 | 969 | 8.227 | 601 | 14.198 |
| Estadual | 4.000 | 227.518 | 225.884 | 44.669 | 515.570 |
| Municipal | 404.535 | 686.509 | 1.637 | 59.147 | 1.152.596 |
| Privada | 205.666 | 258.355 | 42.765 | 8.767 | 551.612 |
| **Brasil** | 614.393 | 1.173.351 | 278.513 | 113.184 | **2.233.976** |
O resto (54.535) é educação profissional não integrada; turma multietapa conta em cada etapa (as etapas podem somar mais que o total, nunca menos). Médias nacionais derivadas: 20,6 matrículas por turma na básica (infantil 15,1; médio 26,5), **não é o indicador oficial do INEP**.

**Q6. Histórico 2007–2025?** Matrículas 53,03 mi → 46,02 mi (−13%). Infantil 6,57 → 9,29 mi (+41%); fundamental 32,35 → 25,81 mi (−20%); médio 8,37 → 7,37 mi (−12%); EJA 5,03 → 2,25 mi (−55%); educação especial 0,65 → 2,46 mi (3,8×); profissional não integrada 0,70 → 1,30 mi. Turmas 2,10 → 2,23 mi (+6%); escolas com oferta 198.397 → 178.772. Série completa por UF/rede em `exec_edu_offer_agg` e `getEducationNationalOffer`.

**Q7. Indicadores somáveis × sobrepostos?** Somam o total: as 7 etapas (creche, pré, anos iniciais, anos finais, médio, EJA fundamental e médio, profissional não integrada). Também somam, entre si, diurno + noturno + EAD (2014+) e a educação especial (classes comuns + exclusivas). **Sobrepostos/transversais, nunca somar às etapas:** educação profissional total (técnico integrado conta em médio e em profissional), educação especial, tempo integral, turno. Catálogo: `educacao-oferta-catalog.ts` e `MATRIZ_INDICADORES_P102.csv`.

**Q8. Educação especial?** Recorte transversal da matrícula básica (classes comuns 2.298.005 + exclusivas 160.154 = 2.458.159; 5,3% da matrícula), nunca maior que ela (0 violações), nunca somada às etapas. Pública só em agregados de município, UF e Brasil, com supressão de células de 1–4; **por escola `NEEDS_LEGAL_VALIDATION`** (`LICENCA_E_USO_DADOS_INEP.md`).

**Q9. Educação integral?** Tempo integral é subconjunto de cada etapa (nunca maior): 2025 infantil 3.476.726 + fundamental 4.824.584 + médio 1.809.737 = 10.111.047 matrículas (22,0%); turmas de tempo integral (só de 2023): 400.674 (17,9%). A série de matrículas é **descontínua** (fundamental: 4,65 mi em 2015 → 2,51 mi em 2016): só comparar de 2016 em diante, com aviso.

**Q10. Os 46.018.380 de 2025 conferem?** **Sim, exatamente**, e também por etapa, rede, localização, UF e município (`RECONCILIACAO_MATRICULAS_2007_2025.md`).

**Q11. Divergências na reconciliação histórica?** Matrículas: **0** em 2.750.826 comparações municipais (19 edições, Brasil e UFs incluídos). Turmas: **528** células municipais e 21 UFs, todas em **uma coluna de 2025** (EJA fundamental): Sinopse 80.528 × arquivo 75.832; causa comprovada, a Sinopse atribui ao fundamental as 4.696 turmas de EJA que o arquivo não classifica (80.528 = 113.184 − 32.656). Nada foi ajustado.

**Q12. Escolas com matrícula, turmas e oferta válidas?** 2025: **178.766** escolas com matrícula e turma, mais 6 só com turma (178.772 com oferta). 3.547.666 linhas de oferta válidas nas 19 edições, 0 rejeitadas.

**Q13. Indisponível em certos anos?** Turno (noturno e EAD): só de 2014. Turmas em tempo integral: só de 2023. Campos profissionais separados (concomitante, subsequente, FIC): só de 2023 (antes, o resto derivado). Tempo integral de matrículas existe em todas as edições, mas com descontinuidade até 2015. Nada foi preenchido com zero.

**Q14. Mudanças de layout com tratamento especial?** 2025 em tabelas (Matrícula + Turma unidas por `CO_ENTIDADE`); 2025 tem 4.696 turmas de EJA sem etapa (partição de turmas pelo total de EJA); mudanças de colunas entre edições não afetam as colunas lidas (`headers_todas_edicoes.json`); 2007–2013 sem partição de turno; o dicionário de 2025 repete, na nota de `QT_TUR_BAS`, o texto de docentes (erro do dicionário).

**Q15. Relação com os 299.547 códigos da P10.1?** Toda linha de oferta tem FK para o cadastro (escola × edição). **265.591** dos 299.547 códigos (88,7%) têm oferta em pelo menos uma edição; **125.331** em todas as 19; **33.956** nunca têm matrícula nem turma no arquivo (escolas só paralisadas, extintas ou sem matrícula básica). 3.547.666 das 4.272.656 linhas de cadastro (83,0%) têm oferta; o resto é cadastro sem oferta.

**Q16. O bit0 da P10.1 permaneceu consistente?** **Sim, em 513/513 fatias:** `bit0 ⇔ existe oferta com mat_bas > 0`, verificado dentro de cada publicação (a fatia só entra se bater) e conferido em `COBERTURA_EDUCACAO_P102.csv` (`diferenca_bit0 = 0`). O cadastro da P10.1 não foi alterado (hashes idênticos).

**Q17. Quanto o PostgreSQL cresceu?** **+658,4 MB** (25,318 → 25,977 GB).

**Q18. Tabelas, índices, WAL e change log?** `exec_edu_offer_year`: heap 552,3 MB + índice 103,6 MB (656,1 MB); agregados 1,3 MB; cobertura 0,1 MB, change log **0**, WAL gerado 1,60 GB (77–118 MB por edição), pico de `pg_wal` 1,06 GB.

**Q19. A meta de 5 GB para P10.1–P10.3 continua viável?** **Sim.** Acumulado real 1,21 GB (0,55 + 0,66); P10.3 projetada em 0,5/1,0/1,8 GB (conservador/provável/pessimista): total 1,7/2,2/3,0 GB.

**Q20. O replay produziu `NO_CHANGE`?** Sim, **513/513** fatias, sem novos runs e sem linhas de log; no banco isolado, também com dados reais.

**Q21. Rollback e falha injetada?** Passaram, com dados reais (ES 2025): retificação de 10 linhas revertida com hashes idênticos; falha injetada sem rastro; republicar o original `NO_CHANGE`.

**Q22. Saúde, Segurança, Finanças, PNCP e Legislativo intactos?** Sim: fingerprints idênticos, exceto as diferenças autorizadas (migration v10 e +513 publicações do dataset 71). `npm test`: 0 falhas (30 ignorados do Legislativo, preexistentes).

**Q23. Tempos de resposta dos read models?** Brasil 9 ms; UF 2,4–3,3 ms; município 2,6–517 ms com série de 19 edições (São Paulo 473 ms, Rio 517 ms; sem série: ≤ 157 ms); escola 0,8 ms.

**Q24. Comparações válidas e enganosas?** Válidas: composição da matrícula por etapa e rede, participação da educação infantil, matrículas e turmas por escola e razão de somas por etapa dentro do mesmo recorte, evolução com ano-base explícito. Enganosas: rankings por número absoluto, "taxa de atendimento"/universalização sem população por idade, somar etapas com modalidades transversais, "alunos" no lugar de "matrículas", tamanho de turma entre etapas ou como substituto do indicador oficial, tempo integral antes de 2016, rede municipal × escolas localizadas, zero no lugar de `NULL`. Detalhe: `CONTRATOS_BENCHMARKS_P102.md`.

**Q25. Os termos do INEP permitem a exposição pública planejada?** **Com condições.** Cadastro e agregados territoriais de matrículas e turmas: sim, com citação da fonte, rotulando derivados e respeitando a privacidade. Não habilitar ainda: educação especial por escola, download/API de tabelas derivadas (cláusula CC BY-ND do portal gov.br) e células pequenas de categorias pessoais. Documentos lidos: Manual, Parecer PF-INEP 18/2022, RIP e Nota Técnica 5/2021; ficam pendentes a NT ANPD 12/2023 (fora do ZIP) e um parecer jurídico.

**Q26. Contratos disponíveis para a P10.3?** Universo de escolas por etapa (denominador), matrículas e turmas por escola, chaves `(inep, year)` com FK, regra de ausência, dataset ≥ 72 e `table_id` ≥ 86, verificação cruzada com a oferta e o tamanho de turma derivado para conferir contra o indicador oficial (`CONTRATOS_P103_P104.md` §2).

**Q27. Contratos disponíveis para a P10.4?** Chave e ano do Censo = ano do Ideb; etapas do Ideb = partições `mat_fund_ai`, `mat_fund_af`, `mat_med`; dependência da edição; matrícula como peso de cobertura e nunca para recalcular Ideb de rede; migration v11 (`CONTRATOS_P103_P104.md` §3).

**Q28. Estado final dos gates e evidência?** Ver §2: 11 PASS e 4 PASS_WITH_CAVEATS (G1, G5, G6, G12), nenhum PARTIAL/FAIL. Evidências em `evidencias/` e scripts em `reproducibilidade/`.

## 5. Limitações e pendências
1. **Licença:** classe `NEEDS_LEGAL_VALIDATION` para educação especial por escola e para redistribuição de tabelas derivadas; NT ANPD 12/2023 e TED não lidos (decisão antes da P10.10). Nada foi exposto publicamente.
2. **Tempo integral e turno** não têm tabela de referência incorporada: não reconciliados com a Sinopse (marcados na matriz).
3. **Educação profissional não integrada** é derivada (resto da partição) antes de 2023; exata e conferida de 2023 em diante.
4. **Tamanho de turma** é derivado e não substitui o indicador oficial (P10.3).
5. **Município grande com série de 19 edições** leva ≈ 0,5 s (São Paulo, Rio); resolvido, se necessário, com tabela de agregados por município (~15 MB) ou `series: false`.
6. A carga inicial não tem change log (decisão de custo): a recuperação é por replay a partir do RAW, preservado com SHA-256 e manifesto no banco.
7. Cluster de teste `D:\Civica\pgtest_edu2` removido ao final; backup `pre-educacao-p102-20261025.dump` mantido em `D:\Civica\backups`.

## 6. Evidências e reprodução
`evidencias/` (hash e identidades, cobertura de colunas, partição exata, resíduos, reconciliação com a Sinopse, G11 com dados reais, benchmark, números de produção, fingerprints antes/depois, medições de armazenamento, saída do `npm test`, log da publicação em produção) e `reproducibilidade/` (ver `README.md`). Reexecução em produção: `reproducibilidade/p102_producao.sh`.
