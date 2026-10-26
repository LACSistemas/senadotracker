# Testes e regressões (G10_REGRESSION): PASS_WITH_CAVEATS

- Unitários P10.7: 16/16 (`tests/unit/educacao-contratos-p107.test.ts`: comprador, objeto, exclusões, confiança, PF/CPF, valores negativos, obras, 7 regressões de regra).
- Integração P10.7 em cluster isolado: 6/6 (migração v16; publicar/NO_CHANGE/retificar/rollback/falha injetada; contratação e termos; obras; leituras; ondas anteriores intactas).
- Typecheck: `packages/db`, `apps/collector`, `tsconfig.tests.json` e web sem erros.
- `npm test` completo (584 testes): 538 passam, 16 falham, 30 ignorados. **Nenhuma das 16 falhas é de educação/P10.7**; todas são testes P9 (migração/contagem de tabelas, publicação de Segurança/Finanças, leituras) já falhando antes, por fixtures e contagens desatualizadas (eram 44 na P10.6). Não foram corrigidas (fora do escopo).
- Ondas anteriores: fingerprints de todas as ondas idênticos antes e depois (`fingerprints_antes.json` × `fingerprints_depois.json`), exceto `migrations` (+v16) e `publicationsCrime`, cuja faixa de datasets passou a incluir os datasets 114–118 criados agora (valores de indicadores de crime inalterados).
- Restore do backup em cluster isolado com credencial administrativa: concluído; fingerprints idênticos aos de antes (`fingerprints_restore_edu7.json`), exceto o schema legislativo, que não faz parte do dump.
- Pendências herdadas: ver `BACKLOG_P106_PENDENCIAS.md`.
