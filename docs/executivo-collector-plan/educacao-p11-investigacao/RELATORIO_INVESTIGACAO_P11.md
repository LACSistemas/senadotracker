# P11 — Investigação nacional de ENEM e ensino superior

**Estado:** INVESTIGAÇÃO CONCLUÍDA COM LIMITAÇÕES DOCUMENTADAS  
**Modo:** somente leitura; nenhum collector, migration, backfill, frontend ou configuração alterado.  
**Data:** 2026-10-27  
**Banco:** \`projetoeleitor_db\` (comprovado por \`SELECT current_database()\`)  
**RAW/staging:** \`D:\Civica\raw\p11\` e \`D:\Civica\staging\p11\`

## Resumo executivo

Há base oficial suficiente para uma camada nacional de ensino superior institucional, cursos, ofertas, matrículas, ingressantes, concluintes, modalidade, bolsas e qualidade. O Censo Superior do INEP é a espinha dorsal: a inspeção já existente no P10 mediu 30 ZIPs de 1995–2024, 2024 com 84 colunas de IES e 223 de cursos, 2.580 IES únicas em 2023 e 671.610 linhas de ofertas. A Sinopse Superior por município fornece reconciliação histórica desde 1995.

O ENEM é publicamente disponibilizado de 2011–2025 na página oficial, com microdados, provas, gabaritos, notas e questionários. Porém o próprio INEP informa reestruturação de microdados para LGPD, e decisões oficiais excluem variáveis que poderiam reidentificar participantes, em especial código de escola. Portanto:

- **ENEM por município de residência:** tecnicamente possível somente se a edição atual mantiver município de residência e notas; isso é \`NEEDS_VALIDATION\` para 2023–2025 até abrir os arquivos atuais.
- **ENEM por escola pública localizada em Vitória:** não é uma capacidade segura hoje. O antigo ENEM por Escola terminou em 2015 e o INEP não recomenda construir ranking escolar com microdados do exame.
- **Ensino superior municipal:** \`PROVEN_WITH_LIMITATIONS\`, usando Censo/Sinopse e separando sede da IES, local de oferta e polo EaD.
- **Qualidade:** IGC é institucional e triádico; CPC/Conceito Enade/IDD são ligados a curso e ciclos. Não há base para um ranking composto nacional sem contrato editorial adicional.
- **Financiamento:** ProUni e FIES têm dados abertos oficiais, porém com cobertura temporal e semântica distintas; Tesouro/Portal da Transparência viabilizam execução federal, não um orçamento total comparável de todas as IES privadas ou estaduais.
- **CAPES:** Sucupira e o portal de dados abertos permitem programas stricto sensu, conceitos, áreas e bolsas; lato sensu não é competência da CAPES.

## Repositório e reuso

Não existe \`CLAUDE.md\` na raiz; há apenas \`apps/web/CLAUDE.md\`, que referencia \`AGENTS.md\`. O inventário do P10 foi lido. O reuso recomendado é:

1. identidade territorial em \`civica_exec.exec_entity\` (UF/município);
2. publicação, snapshots, cobertura e rollback do motor \`civica_exec\` já usado pelo P10;
3. contratos e storage previstos em \`educacao-p10/contrato_educacao_superior.md\`;
4. não reutilizar identidade de escola básica como identidade de IES/curso;
5. não colocar RAW no PostgreSQL: manter arquivos e hashes em \`D:\Civica\`.

## Respostas às 24 perguntas objetivas

### ENEM

1. **Públicos de Vitória no ENEM:** possível como agregação por município de residência, faixa de participação e notas, se \`CO_MUNICIPIO_RESIDENCIA\` e notas estiverem na edição. Não afirmar estimativa como fato antes da validação.
2. **Públicos que estudaram em escola localizada em Vitória:** não comprovado. Exige município da escola e classificação de dependência na edição atual; código de escola não deve ser usado para reidentificação.
3. **Residência versus escola:** são populações diferentes. Residência responde “onde mora”; escola responde “onde estudava”; local de prova responde “onde fez o exame”. Cada uma deve ter dimensão própria.
4. **Série histórica:** página oficial lista 2011–2025 e microdados históricos anteriores; comparabilidade de campos deve ser versionada, especialmente antes/depois das mudanças de privacidade.
5. **Variáveis nucleares esperadas:** notas CN/CH/LC/MT/redação, presença, situação de conclusão, tipo de escola, município/UF de residência ou escola quando publicado. A presença efetiva no arquivo 2025 é \`NEEDS_VALIDATION\`.
6. **Provas e gabaritos:** publicados junto dos microdados; servem para documentação e análise de itens, não para identificar estudantes.
7. **ENEM por Escola:** fonte histórica somente até 2015; não deve ser apresentada como série atual.
8. **Privacidade:** nenhuma chave de inscrição, CPF, escola ou combinação de atributos que permita reidentificação deve chegar à camada de produto.

### IES, cursos e qualidade

9. **Instituições e cursos:** Censo Superior 1995–2024, com arquivos de IES e cadastro de cursos; identidade institucional é \`CO_IES\`; oferta usa composição \`CO_IES + CO_CURSO + CO_MUNICIPIO + TP_MODALIDADE_ENSINO\` e dimensão adicional a esclarecer para duplicatas.
10. **Município correto:** curso usa \`CO_MUNICIPIO\` (local de oferta); IES usa \`CO_MUNICIPIO_IES\` (sede). Nunca substituir um pelo outro.
11. **Presencial/EaD:** \`TP_MODALIDADE_ENSINO\` está no arquivo de cursos. EaD pode ter polos e não deve ser contabilizado como presença física da sede.
12. **Matrículas, ingressantes e concluintes:** \`QT_MAT\`, \`QT_ING\`, \`QT_CONC\` são contagens agregadas por oferta; matrícula não é pessoa única nacional.
13. **Evolução temporal:** Censo/Sinopse permite série anual; quebras de layout e revisões devem ser preservadas na cobertura.
14. **IGC:** indicador institucional, calculado por triênio de CPC e componentes de pós-graduação; o ano publicado representa uma janela, não desempenho anual puro.
15. **CPC/Enade/IDD:** CPC e Conceito Enade são associados a curso; IDD mede diferença entre desempenho observado e esperado. Ciclos e notas técnicas devem acompanhar cada valor.
16. **Ranking:** publicar comparação descritiva com denominador, ciclo e cobertura; não produzir ranking composto ou “melhor universidade” sem regra editorial explícita.

### Financiamento e programas

17. **Universidades federais:** Portal da Transparência, SIAFI/Tesouro e lista oficial de órgãos fornecem identificadores e execução federal; a ligação exige mapa órgão–IES–campus.
18. **Estados e municípios:** Siconfi/SIOPE e portais locais cobrem orçamento público, mas não formam um orçamento universitário nacional uniforme.
19. **Privadas:** não há orçamento público total comparável; podem ser mostradas bolsas, vagas, qualidade e contratos públicos quando disponíveis.
20. **Contratos e fornecedores:** PNCP é reutilizável, mas cobertura é contrato publicado e CNPJ; não representa toda a despesa de uma IES.
21. **ProUni:** dados abertos MEC 2017–2026 detalham bolsas por ano, UF, município, IES, curso, modalidade, turno e tipo de bolsa; perfil deve ser agregado e anonimizado.
22. **FIES:** dados abertos MEC cobrem processos seletivos e ofertas sobretudo 2019–2022, com dicionário; separar vagas, inscrições, pré-seleção e contratação.
23. **CAPES:** Sucupira/dados abertos cobrem programas stricto sensu, conceito, área, modalidade e bolsas; fomento e produção têm séries e granulações próprias.
24. **Roadmap:** P11.1 valida ENEM atual; P11.2 materializa IES/cursos; P11.3 qualidade; P11.4 ProUni/FIES; P11.5 CAPES; P11.6 finanças; P11.7 read layer e produto. Nenhuma etapa foi iniciada.

## G1–G10 (nomes do mandato)

| Gate | Resultado | Justificativa |
|---|---|---|
| G1_ENEM_FEASIBILITY | **PROVEN_WITH_LIMITATIONS** | página e série oficiais provadas; campos atuais e arquivo completo ainda não revalidados |
| G2_IES_IDENTITY | **PROVEN_WITH_LIMITATIONS** | Censo 1995–2024, cabeçalhos e identidade 2023 já auditados no P10; e-MEC bulk não provado |
| G3_COURSES_ACCESS | **PROVEN_WITH_LIMITATIONS** | vagas, matrículas, ingressantes e concluintes existem no Censo; evasão depende de indicadores oficiais |
| G4_OFFICIAL_QUALITY | **PROVEN_WITH_LIMITATIONS** | IGC/CPC/Enade/IDD documentados; arquivos de indicadores ainda não ingeridos |
| G5_FINANCE | **DISCOVERY_ONLY** | fontes e identificadores existem; cobertura nacional comparável não provada |
| G6_ACCESS_PROGRAMS | **PROVEN_WITH_LIMITATIONS** | ProUni/FIES oficiais; FIES tem janela e semântica restritas |
| G7_GRADUATE_RESEARCH | **PROVEN_WITH_LIMITATIONS** | Sucupira e CKAN CAPES públicos; extração em massa não testada |
| G8_COVERAGE | **PROVEN_WITH_LIMITATIONS** | matriz por fonte/indicador entregue; ENEM atual ainda sem contagem real |
| G9_TERRITORIAL_PROOFS | **PROVEN_WITH_LIMITATIONS** | municípios/UF comprovados no Censo; e-MEC e polos EaD requerem prova adicional |
| G10_STORAGE_ARCHITECTURE | **PROVEN_WITH_LIMITATIONS** | Censo Superior medido em 750 MB ZIP; ENEM/novas famílias são estimativas |

## Produto futuro (sem implementação)

Para município/UF, a experiência pode responder: instituições por sede e por local de oferta; cursos, modalidade, vagas, matrículas, ingressantes e concluintes; bolsas ProUni; oferta/inscrição FIES; programas stricto sensu; qualidade por IES/curso/ciclo; e ENEM municipal apenas quando a população e o denominador estiverem comprovados. O produto deve mostrar “não publicado”, “cobertura parcial” e “não comparável” em vez de zero.

Não são promessas desta investigação: ranking composto nacional, ranking atual de escolas via ENEM, orçamento total de privadas, estudantes individuais ou cruzamento de microdados anonimizados.

## Testes territoriais previstos

Vitória, Serra, Vila Velha, Campos dos Goytacazes, Rio de Janeiro, João Pessoa, Campina Grande, São Paulo, Belo Horizonte, Recife, uma UF de menor população, um município pequeno sem IES presencial e um município com polo EaD sem sede devem ser usados na P11.1–P11.3. Nenhum número desses casos foi inventado nesta fase; os artefatos marcam os testes como pendentes.

## Decisão

P11 está fechado como investigação. \`READY_FOR_P11_1 = NO\`: a próxima fase deve validar arquivos ENEM 2023–2025 em D:, congelar o dicionário por edição e medir cobertura municipal antes de qualquer schema ou collector. Nenhuma alteração de produção foi feita.

