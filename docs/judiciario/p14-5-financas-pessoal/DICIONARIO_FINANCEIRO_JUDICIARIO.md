# Dicionário financeiro

Valores monetários são armazenados em centavos (bigint) e somente convertidos para BRL na camada de serving. Folha não contém nome, matrícula, CPF ou qualquer identificador individual.

- **PAYROLL:** total_creditos_cents, total_debitos_cents, rendimento_liquido_cents, diarias_cents e rubricas oficiais por mês.
- **EXPENSE_REPORTED:** total do Anexo I conforme Resolução 102.
- **AUTHORIZED_BUDGET / COMMITTED / LIQUIDATED / PAID:** fases distintas do Anexo II; não são substituíveis entre si.
- **PAYMENT_CHRONOLOGY_NET_TOTAL:** soma do valor líquido publicado no PDF de pagamentos, com número de linhas preservado.
