# P10.6 — Programas, repasses e transferências educacionais

## Resultado executivo

Implementação nacional inicial publicada no `projetoeleitor_db`, com migração aditiva 15. Os RAWs permanecem exclusivamente em `D:\Civica\raw`; o PostgreSQL guarda fatos normalizados, hashes e metadados de proveniência, não os arquivos brutos.

Status: **PASS_WITH_CAVEATS**. O Portal da Transparência foi publicado para os 12 meses de 2025; PDDE foi publicado em nível escolar para um município do ES como piloto verificável. Não foi inventada cobertura escolar de PNAE/PNATE nem foi tratado o complemento `00SB` como todo o Fundeb.

## Respostas obrigatórias

1. **Programas publicados:** Portal: `0515` (PDDE), `00PI` (PNAE), `0969` (PNATE), `00SB` (complemento Fundeb); PDDE Info: fatos escolares `DUE` e `PAID`.
2. **Histórico disponível:** Portal completo para janeiro–dezembro de 2025; 2014–2024 continua apenas como capacidade de fonte. PDDE publicado em 2025.
3. **Entes atendidos:** em 2025, códigos fonte distintos: PNAE 5.565 beneficiários/5.538 municípios SIAFI; complemento 4.490/4.467; PDDE Portal 113.752/5.428; PNATE 5.287/5.273.
4. **Escolas INEP:** 10 no piloto PDDE, sem alocação artificial de repasses municipais a escolas.
5. **Valor por programa/ano:** PNAE R$ 5.513.939.170,61; complemento Fundeb R$ 57.318.407.239,16; PDDE Portal R$ 2.101.265.097,93; PNATE R$ 880.451.093,05; PDDE escolar piloto: devido R$ 122.556,00 e pago R$ 72.765,00.
6. **Previsão versus realizado:** Portal publica `TRANSFERRED` (repasse observado), não previsão; PDDE separa `DUE` de `PAID`; não houve preenchimento por aproximação.
7. **Cobertura nacional/estadual/municipal:** Portal cobre 27 UFs e códigos municipais SIAFI. Não se presumiu ligação a `entity_id`. PDDE tentou 78 municípios ES, obteve 69 arquivos, mas publicou apenas o coorte saudável do piloto; 9 HTTP 400 ficaram documentados.
8. **Fontes reutilizadas/novos downloads:** novos downloads foram 12 ZIPs oficiais do Portal e arquivos PDDE Info; foram reutilizados cadastro INEP/entidades, manifestos e infraestrutura existentes. Nenhum banco alternativo foi usado.
9. **Fundeb VAAF/VAAT/VAAR:** não estão separados nesta publicação; `00SB` é explicitamente apenas complemento observado no Portal. VAAF/VAAT/VAAR e SIOPE não foram somados nem inferidos.
10. **Divergências restantes:** cobertura histórica ainda não publicada; nove municípios PDDE ES retornaram HTTP 400; PNAE/PNATE permanecem no nível de transferência, sem escola; restore isolado não pôde ser executado pela role sem `CREATEDB`.
11. **Beneficiários sem identidade comprovada:** todos os códigos não resolvidos permanecem source-native; não foram promovidos a pessoa/empresa. O relatório de cobertura registra `unresolved_rows=0` para as 48 fatias publicadas, o que significa apenas ausência de rejeição de parsing, não identidade civil universal.
12. **Crescimento PostgreSQL:** 30.908.124.307 → 31.497.890.963 bytes, delta 589.766.656 bytes (~0,55 GiB), abaixo do limite de 5 GiB; RAW não ocupa PostgreSQL.
13. **Replay:** validação de replay sem alteração retornou `NO_CHANGE` para o caso SIOPE ES/2024; chaves de fatos não duplicaram.
14. **Rollback/falha injetada:** contratos existentes de `publishSlice`/rollback foram reutilizados; o teste unitário e validações P10.6 passaram. A execução completa de rollback no conjunto histórico não foi declarada como nova evidência além desses contratos.
15. **Ondas anteriores:** SIOPE 243 fatias ativas, Siconfi e publicações anteriores permaneceram; migração 15 foi aditiva e não sobrescreveu P10.5.
16. **Compatibilidade SIOPE v2/v3:** histórico v1/v2 preservado, v3 somente incremental; 243 fatias auditadas, replay sem mudança, evidência em `evidencias/siope_v2_v3_compatibilidade.json`.
17. **44 falhas da suíte:** 562 testes: 454 pass, 64 skipped, 44 fail. As 44 repetem falhas preexistentes de fixtures/pool (`undefined.connect/query`) em fases anteriores; não apontam para P10.6. Log integral em `reproducibilidade/full_test_p106.log`.
18. **Pronto para P10.7:** schema, publicação, cobertura e read models estão disponíveis com ressalvas; faltam backfills históricos e resolução de cobertura PDDE/FNDE antes de declarar cobertura escolar nacional. P10.7 ainda não começou.

## Modelo e regras

`exec_edu_program_fact` separa programa, competência, estágio financeiro, beneficiário, município, escola INEP opcional e proveniência. `exec_edu_program_cov` registra linhas fonte, parseadas, publicadas, rejeitadas e não resolvidas. A chave fonte é determinística e a publicação é por fatia mensal/coorte; valores não são multiplicados ao agregar itens de execução.

## Gates e handoff

| Gate | Estado |
|---|---|
| G0_SAFETY | PASS_WITH_CAVEATS |
| G1_SOURCES | PASS_WITH_CAVEATS |
| G2_PDDE | PASS_WITH_CAVEATS |
| G3_PNAE | PASS_WITH_CAVEATS |
| G4_PNATE | PASS_WITH_CAVEATS |
| G5_FUNDEB | PASS_WITH_CAVEATS |
| G6_DATA_MODEL | PASS |
| G7_PUBLICATION_RECONCILIATION | PASS_WITH_CAVEATS |
| G8_DATABASE_5GB | PASS |
| G9_SERVING | PASS |
| G10_REGRESSION | PASS_WITH_CAVEATS |
| G11_P107_READINESS | PASS_WITH_CAVEATS |

Não há frontend, P10.7 iniciado, acesso ao lab ou SQLite nesta fase. Pronto para P10.7 somente como `YES_WITH_CAVEATS`.
