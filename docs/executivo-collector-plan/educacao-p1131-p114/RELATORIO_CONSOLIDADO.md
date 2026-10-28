# P11.3.1 + P11.4 — Relatório consolidado

**Data:** 27/10/2026 · **Banco:** `projetoeleitor_db` · **schema:** `civica_exec` · **RAW:** `D:\Civica`

## Resultado executivo

`P11_3_1_STATUS = PASS_WITH_CAVEATS` e `P11_4_STATUS = BLOCKED_EXTERNAL`.

O fechamento interno dos indicadores de qualidade superior passou com conservação de linhas, linkage por chave oficial e independência entre CPC, Enade, IDD e IGC. O Censo externo permanece sem reconciliação por indisponibilidade das Sinopses na janela. A fundação ProUni/FIES foi aplicada no banco oficial e os contratos de leitura estão prontos, mas os 20 arquivos oficiais tentados (10 ProUni e 10 FIES) foram bloqueados na recuperação programática; não há fatos publicados nem cobertura fictícia.

Fontes oficiais de autoridade: [catálogo ProUni do MEC](https://dadosabertos.mec.gov.br/prouni), [catálogo FIES do MEC](https://dadosabertos.mec.gov.br/fies) e [dicionário FIES](https://dadosabertos.mec.gov.br/fies/item/81-dicionario-de-dados).

## Respostas objetivas

1. **Censo 2022–2024 externo:** não reconciliado; `BLOCKED_EXTERNAL`. A reconciliação interna permanece reproduzível.
2. **Matrículas 2024:** 10.227.266 no Censo source-native; não há confirmação contra Sinopse externa nesta fase.
3. **TP_DIMENSAO:** a identidade inclui a dimensão; dimensões territoriais/nacionais não são somadas como uma observação única.
4. **EAD/nacional:** dimensões 3/4 totalizam 11.769 linhas e 2.539 matrículas, sem município/UF artificial.
5. **IGC:** 431 IES não encontram correspondência no cadastro operacional; 365 são históricas fora da janela Censo operacional e 66 ficam `NOT_IN_OPERATIONAL_CENSO_WINDOW`. Nenhum caso foi encerrado por inferência.
6. **CPC 2023:** 9.812 linhas válidas; 9.803 links oficiais; 1 `UNRESOLVED`; 8 `NEEDS_VALIDATION`.
7. **Enade/IDD:** fontes, SHA, fatos e distribuições são independentes; um não substitui o outro.
8. **Integridade P11.3.1:** `PASS_WITH_CAVEATS`, com deltas e não resolvidos documentados nos CSVs de evidência.
9. **ProUni:** catálogo e edições 2017–2026 foram inventariados; nenhum arquivo foi publicado por bloqueio externo.
10. **ProUni integral/parcial:** não observado nesta fase; não é apresentado como zero.
11. **ProUni municipal/UF:** não observado; contratos aceitam território somente quando source-native.
12. **IES/cursos:** contratos preservam IES por `CO_IES` exato; curso sem código oficial permanece source-native/`NEEDS_VALIDATION`.
13. **FIES:** edições de oferta, inscrições e resultado foram inventariadas; nenhum arquivo publicado.
14. **Etapas FIES:** permanecem separadas; não se infere pagamento, contrato ou matrícula efetiva.
15. **Instrumentos/contratos:** não publicados no modelo P11.4, e não são inventados.
16. **Desembolso:** ProUni/FIES não são tratados como execução financeira; nenhuma quantia financeira foi criada.
17. **Crosswalk:** regra determinística por código oficial; sem fuzzy e sem taxa de linkage fabricada quando não há linhas.
18. **Não resolvidos:** em P11.4 o bloqueio é de fonte, portanto não há fato-level unresolved; erros e estados estão nos source runs.
19. **Reconciliação externa:** nenhum total ProUni/FIES nem Sinopse foi declarado reconciliado.
20. **Performance:** read contracts foram validados estruturalmente em tabelas vazias; benchmark com dados reais depende da liberação do MEC.
21. **Crescimento do banco:** migração v24 adicionou apenas tabelas/índices da fundação; fatos ProUni/FIES = 0.
22. **Disco:** C livre observado em `35.532.304.384` bytes; D livre em `407.550.599.168` bytes.
23. **Privacidade:** não há CPF, nome de candidato ou microdado pessoal no PostgreSQL; qualquer futura carga exige revisão LGPD.
24. **Frontend:** não iniciado nem alterado; a indisponibilidade externa não é mascarada na UI.
25. **CAPES/P11.5:** não iniciado; `READY_FOR_P11_5_CAPES = NO`.

## Gates finais

| Gate | Resultado |
|---|---|
| DATABASE_GUARD | PASS |
| SOURCE_AUTHORITY | PASS |
| P11.3.1 internal integrity | PASS_WITH_CAVEATS |
| Censo external reconciliation | BLOCKED_EXTERNAL |
| ProUni coverage | BLOCKED_EXTERNAL |
| FIES coverage | BLOCKED_EXTERNAL |
| NO_PII_PERSISTENCE | PASS |
| READ_CONTRACTS | PASS_EMPTY_WITH_COVERAGE_STATE |
| READY_FOR_ACCESS_PROGRAMS_FRONTEND | NO |
| READY_FOR_P11_5_CAPES | NO |

Detalhes reproduzíveis estão em `educacao-p1131-execucao/` e `educacao-p114-execucao/`. Não houve alteração de frontend, P11.5 ou collector de ENEM.
