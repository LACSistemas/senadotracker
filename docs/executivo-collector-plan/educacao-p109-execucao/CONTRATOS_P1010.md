# Handoff contratual para P10.10

P10.10 poderá consumir os read models existentes sem acesso direto à fonte:

1. usar `getEducationSchoolProfile`, `getEducationMunicipalityProfile`, `getEducationStateProfile` e `getEducationNationalProfile`;
2. renderizar `coverage`, `publication`, `through` e `privacy` como metadados editoriais;
3. tratar `PARTIAL`, `NOT_COLLECTED`, `SOURCE_UNAVAILABLE`, `SUPPRESSED` e `NEEDS_LEGAL_VALIDATION` como estados distintos;
4. não somar SICONFI/SIOPE nem estágios financeiros diferentes;
5. não exibir os 30 códigos municipais não resolvidos como município canônico;
6. não chamar portais externos pelo browser;
7. paginar ou carregar sob demanda payloads acima de 1 MB, especialmente UF/Brasil.

P10.10 não foi iniciado nesta execução.
