# Contrato do perfil integrado municipal

Entrada: código IBGE de sete dígitos. Leitura: `getEducationMunicipalityProfile(queryable, ibge7, { year, includeSeries })`.

Famílias: escolas e oferta; matrículas e turmas; infraestrutura; docentes; aprendizagem e fluxo; Siconfi e SIOPE separados; programas por estágio; contratos com `POSSIBLE` separado. Obras são `NOT_APPLICABLE` no município porque Obrasgov só prova UF.

O resumo não devolve listas completas; elas continuam paginadas nas fases de origem. Séries longas são opt-in. `NULL` e estados de cobertura nunca viram zero. Fontes financeiras não são somadas. Município de contrato é o ente do órgão contratante, não o local da execução.

