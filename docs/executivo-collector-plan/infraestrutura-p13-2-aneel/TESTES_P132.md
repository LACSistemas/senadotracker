# Testes P13.2

- conexão: `current_database() = projetoeleitor_db`;
- fonte: hashes SHA-256 recalculados e iguais aos arquivos no D:;
- parser: 63 colunas INDGER e 9 colunas DEC/FEC conferidas contra os dicionários;
- identidade: sem chave duplicada no DEC/FEC; 0 duplicatas conflitantes no recorte INDGER;
- territorialidade: IBGE 7 dígitos reconciliado deterministicamente; sem fuzzy match;
- nulidade: 7.489 valores `NULL` preservados com flag `notInformed`; zero não usado para ausência;
- publicação: 13 runs `status=9`, `state=1`, `rows_in=rows_out`;
- paridade: sete totais do staging elegível iguais aos totais de `exec_ind_value`;
- replay: 13/13 `NO_CHANGE`;
- regressão SINISA: 5 datasets P13.1, 98.636 observações e 12.301 nulos preservados;
- TypeScript DB: `npm run typecheck --workspace=@senadotracker/db` PASS antes da execução; erros de testes educacionais já existentes não foram alterados.
