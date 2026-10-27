# Testes e regressões

## Passaram

- 8 testes direcionados passaram (P10.8/P10.9); 0 falharam.
- 3 testes de integração administrativos foram pulados porque `EXEC_TEST_ADMIN_URL` não está definido; não foram convertidos em sucesso artificial.
- replay do materializador e do mapa passou duas vezes sem duplicação.
- contrato municipal real de Vitória retornou 3 linhas de programas e cobertura `PARTIAL`.

## Limitações conhecidas

- `tsc --noEmit -p tsconfig.base.json` permanece bloqueado por erro sintático preexistente em `scripts/p5_rebuild_global_rollup.ts`; nenhum erro novo P10.9 foi observado antes desse arquivo.
- suíte completa não foi usada como gate verde: há testes históricos dependentes de serviços/fixtures externos. O comando e a saída direcionados estão registrados na evidência de execução.
- não houve build/frontend, por escopo explícito P10.9.

O build Next.js (`npm run build`) passou, com TypeScript do workspace web e geração das rotas concluídos. Isso é apenas smoke de regressão; não inicia a implementação de UI P10.10.

## Suíte completa

`npm test` foi executado: 584 testes, 470 pass, 44 fail e 70 skipped em 89,5 s. As falhas estão concentradas em testes de integração que recebem pool/URL administrativo ausente no ambiente atual (por exemplo, leituras P94/P98); portanto o resultado global não é um PASS verde. O P10.9 não converteu essas falhas ambientais em sucesso e mantém o caveat no gate G7.
