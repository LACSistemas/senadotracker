# Testes e regressÃµes

- `npm.cmd run typecheck --workspace=@senadotracker/db`: PASS.
- Smoke real em projetoeleitor_db: overview VitÃ³ria/ES, UF ES, Brasil, indicador municipal, comparaÃ§Ã£o, obras, detalhe com 142 contratos, detalhe com 775 empenhos/pagamento, projeto multimunicipal, facilities e logÃ­stica: PASS.
- IdempotÃªncia de migrations: v36â€“v39 aplicadas uma vez; reexecuÃ§Ã£o nÃ£o cria nova revisÃ£o de dados.
- Performance: 10 execuÃ§Ãµes por cenÃ¡rio; overview municipal p95 mÃ¡ximo observado 169,34 ms; detalhe de obra p95 mÃ¡ximo 13,29 ms; listagem Brasil p95 148,27 ms.
- Privacidade: allowlist de colunas em detalhes; nenhum acesso externo.

`P13_REGRESSION=PASS_WITH_CAVEATS` e `OTHER_DOMAINS_REGRESSION=PASS_WITH_CAVEATS`: a validaÃ§Ã£o foi direcionada aos serviÃ§os e banco oficiais; nÃ£o houve frontend ou nova coleta.

