# Contratos finais para P10.10

P10.10 pode consumir `getEducationOverview`, `getEducationSection`, `getEducationSeries`, `getEducationComparison` e `getEducationList`. O frontend deve usar estes contratos compactos por padrão, exibir `coverage`, `through`, `refreshedAt` e estados de indisponibilidade, e evitar o perfil legado de 26 MB na primeira renderização.

Não consumir diretamente PostgreSQL ou fontes externas. Não exibir vínculos municipais `UNRESOLVED`, não somar fontes financeiras e não transformar `NULL`/supressão em zero. Dados `NEEDS_LEGAL_VALIDATION` permanecem bloqueados até decisão jurídica documentada.

P10.10 não foi iniciado.
