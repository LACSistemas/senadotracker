# Contrato do perfil integrado de escola

Entrada: código INEP inteiro. Leitura: `getEducationSchoolProfile(queryable, inep)`.

Entrega identidade e histórico por edição; oferta, matrículas e turmas; infraestrutura declarada; indicadores docentes oficiais; Ideb, rendimento, distorção e INSE quando publicados; e PDDE somente quando `school_inep` prova o vínculo.

Ausências deliberadas: Saeb escolar independente é `NOT_PUBLISHED_BY_SOURCE`; PNAE/PNATE na escola, contratos e obras são `NOT_APPLICABLE`, pois as fontes coletadas não provam essa atribuição; valores suprimidos nunca são reconstruídos.

O retorno contém `coverage[]` e `privacy`. É contrato interno. Nome e dados escolares permanecem `NEEDS_LEGAL_VALIDATION` para publicação, sobretudo em grupos pequenos.

