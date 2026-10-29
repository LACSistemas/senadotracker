# P12 — Investigação nacional de Bem-Estar

**Modo:** INVESTIGATION_ONLY · **Data:** 28/10/2026 · **Banco:** `projetoeleitor_db` · **Schema:** `civica_exec` · **RAW/staging:** `D:\Civica`.

## Resumo executivo

Bem-Estar será a camada territorial que explica condições materiais, renda, trabalho, pobreza/vulnerabilidade, proteção social, moradia, inclusão, cotidiano e evolução social. Não é um índice único e não duplica Saúde, Segurança ou Educação; essas áreas aparecem apenas como contexto por seus contratos canônicos.

O banco oficial respondeu a consultas somente-leitura. O inventário tem 118 tabelas em `civica_exec`, 5.631 entidades territoriais (1 Brasil, 27 UFs, 5.571 municípios e 27 agregados de UF) e 123.073 observações de população (2001–2026). Não há fatos sociais, CadÚnico, Bolsa Família, RAIS/Caged, SUAS, Censo renda ou moradia publicados no banco. Há reuso imediato de `exec_entity`, `exec_territory_population`, `exec_ind_value`, `exec_fin_*`, `exec_fin_contract`, `exec_fin_transfer`, `exec_edu_*`, CNES e os contratos de revisão/manifesto.

Fontes oficiais comprovadas: IBGE Censo/SIDRA; MTE PDET/RAIS/Novo Caged; MDS CadÚnico/VisData/CECAD/Censo SUAS; Portal da Transparência (Bolsa Família/BPC); Ministério das Cidades SINISA/SNIS; IBGE MUNIC/ESTADIC; Anatel; Cetic.br; Siconfi/PNCP já operacionais; CAPES já ingerida no domínio educacional.

## Respostas de decisão

- **Renda municipal real:** sim, Censo 2022/SIDRA (rendimento domiciliar per capita médio/mediano e recortes), referência 2022; não rotular como 2026.
- **Desigualdade municipal:** possível quando tabela oficial divulgar distribuição/Gini para o município; não usar PNAD como proxy municipal.
- **Emprego formal mensal:** sim, por município de localização via Novo Caged; saldo/movimento de vínculos, não desemprego de moradores.
- **Desemprego municipal:** não comprovado nacionalmente; PNAD é amostral e fica em Brasil/UF/regiões representativas.
- **CadÚnico/Bolsa Família/BPC:** agregados municipais operacionalizáveis; não persistir CPF/NIS nem microdados identificados.
- **CRAS/CREAS:** estrutura e questionários anuais comprovados no Censo SUAS; atendimento não equivale a pessoas distintas nem qualidade.
- **Moradia:** Censo 2022 é forte para municípios; déficit habitacional municipal requer fonte específica.
- **Serviços básicos:** SINISA/SNIS têm planilhas e glossários; há quebra de continuidade e cobertura declaratória.
- **Cultura/esporte/digital:** MUNIC/ESTADIC e Anatel/Cetic têm valor contextual; pesquisas amostrais não são universais por município.
- **Finanças:** Siconfi, transferências e PNCP já existentes podem ser filtrados sem somar estágios financeiros.

## Contagens

- Fontes oficiais distintas com prova documental: **15**.
- Indicadores candidatos catalogados: **40** (linhas de dados do catálogo).
- Indicadores com município comprovado: **32** (linhas marcadas `Município=sim`; as restantes são restritas/parciais).
- Indicadores com UF comprovada: **40** (inclui linhas com recorte UF, mesmo quando não há município universal).
- Indicadores com série histórica documentada: **21**.
- MVP nacional recomendado: **10 indicadores**.
- Novos collectors estimados: **6 famílias**.
- Armazenamento estimado: **0,4–1,2 GB** de fatos/índices; RAW MTE/MDS/SINISA **8–35 GB** em `D:\Civica` (estimativas).

## Limitações

1. CadÚnico identificado é restrito; apenas agregados públicos são elegíveis.
2. RAIS/Caged microdados são TXT volumosos e podem exigir FTP/PDET.
3. PNAD/Cetic não possuem representatividade municipal universal.
4. IVCAD, Atlas e índices compostos exigem validação de edição/licença.
5. SINISA 2024 (ano-base 2023) inicia novo ciclo; não misturar automaticamente com SNIS.
6. Sem fonte oficial de “nota de bem-estar”; não criar índice Cívica nesta fase.

## Gates

| Gate | Estado | Evidência |
|---|---|---|
| G0_REPOSITORY_SAFETY | PROVEN_OPERATIONAL | Banco somente-leitura; nenhum código operacional alterado. |
| G1_EDITORIAL_BOUNDARY | PROVEN_OPERATIONAL | Contrato anti-duplicação. |
| G2_INCOME | PROVEN_WITH_LIMITATIONS | Censo/SIDRA municipal; PNAD não municipal. |
| G3_LABOR | PROVEN_WITH_LIMITATIONS | Novo Caged/RAIS municipal; desemprego municipal não. |
| G4_CADUNICO | PROVEN_WITH_LIMITATIONS | Agregados MDS; identificados restritos. |
| G5_SOCIAL_PROGRAMS | PROVEN_WITH_LIMITATIONS | Portal mensal; separar famílias/pessoas/benefícios. |
| G6_SUAS | PROVEN_WITH_LIMITATIONS | Censo anual; qualidade não inferida. |
| G7_HOUSING | PROVEN_WITH_LIMITATIONS | Censo 2022 municipal; déficit requer fonte. |
| G8_BASIC_SERVICES | PROVEN_WITH_LIMITATIONS | SINISA/SNIS e quebra metodológica. |
| G9_CULTURE_SPORT | DISCOVERY_ONLY | MUNIC/ESTADIC precisam validação de arquivos. |
| G10_DIGITAL_INCLUSION | PROVEN_WITH_LIMITATIONS | Anatel técnico; Cetic amostral. |
| G11_VULNERABILITY | PROVEN_WITH_LIMITATIONS | CadÚnico/IVCAD não universais. |
| G12_PUBLIC_FINANCE | PROVEN_OPERATIONAL | Reuso Siconfi/PNCP. |
| G13_COMPOSITE_INDICES | NEEDS_VALIDATION | IDHM/IVCAD/Gini não intercambiáveis. |
| G14_NATIONAL_COVERAGE | PROVEN_WITH_LIMITATIONS | Identidade completa; fatos sociais ausentes. |
| G15_TERRITORIAL_PROOFS | PROVEN_WITH_LIMITATIONS | Matriz sem valores inventados. |
| G16_BENCHMARKS | PROVEN_OPERATIONAL | Regras por ano/unidade/denominador. |
| G17_PRODUCT_STORYTELLING | PROVEN_OPERATIONAL | Oito capítulos recomendados. |
| G18_STORAGE_ARCHITECTURE | PROVEN_WITH_LIMITATIONS | Reuso; microdados em D:. |
| G19_MVP_SELECTION | PROVEN_OPERATIONAL | 10 indicadores priorizados. |
| G20_EXECUTION_ROADMAP | PROVEN_OPERATIONAL | Roadmap sem iniciar fase seguinte. |

## Readiness

```text
P12_INVESTIGATION_STATUS=PASS_WITH_DOCUMENTED_LIMITATIONS
READY_FOR_P12_1_ARCHITECTURE=YES
MVP_NATIONAL_INDICATORS_COUNT=10
MUNICIPAL_INDICATORS_PROVEN=32
UF_INDICATORS_PROVEN=40
SOURCES_REUSED=9
NEW_COLLECTORS_ESTIMATED=6
ESTIMATED_STORAGE_GB=0.4-1.2_FACTS_PLUS_8-35_RAW
PUBLICATION_LEGAL_BLOCKERS=CadUnico_identificado; microdados_pessoais; licencas_Atlas_IVCAD
EXTERNAL_SOURCE_BLOCKERS=RAIS_Caged_FTP_or_volume; MDS_download_contract; SINISA_coverage
P12_1_STARTED=NO
```

P12.1 pode começar apenas como arquitetura/contratos. Nenhum collector, migration ou frontend foi iniciado nesta investigação.

## As 38 perguntas executivas

1. **O que é Bem-Estar?** Condições materiais e sociais territorialmente observáveis, não uma nota única.
2. **O que já existe no banco?** Identidade, população, indicadores genéricos, saúde, finanças, contratos, educação e CAPES.
3. **Quantas fontes oficiais?** 15 famílias comprovadas documentalmente.
4. **Quantos candidatos?** 39 indicadores no catálogo.
5. **Quantos operacionais agora?** Nove famílias reutilizáveis; nenhum fato social novo.
6. **Quantos municipais?** 32 linhas do catálogo têm município marcado como comprovado.
7. **Quantos apenas UF?** O catálogo tem 40 linhas com recorte UF; parte delas não possui município universal.
8. **Quantos históricos?** 21 com série ou edição histórica documentada.
9. **Período mais recente?** Caged/benefícios/SINISA são correntes; Censo renda/moradia é 2022.
10. **Renda municipal?** Sim, Censo/SIDRA 2022.
11. **Desigualdade municipal?** Condicional; Gini/Atlas requer validação de tabela e edição.
12. **Emprego formal mensal?** Sim, Novo Caged por local de trabalho.
13. **Desemprego municipal?** Não com validade nacional; PNAD não é municipal universal.
14. **Salários/setores?** Sim, RAIS anual e Caged por setor/ocupação, sob quebra metodológica.
15. **CadÚnico/Bolsa Família?** Sim, agregados públicos; não PII.
16. **Cobertura da proteção sem taxa enganosa?** Sim, mostrando famílias/benefícios e denominador próprio.
17. **CRAS/CREAS?** Sim, Censo SUAS/Observatório por município.
18. **Capacidade de serviços?** Parcial; questionários e atendimentos não medem qualidade ou pessoas únicas.
19. **Condições habitacionais?** Sim, Censo 2022.
20. **Déficit habitacional municipal?** Não comprovado nacionalmente nesta fase.
21. **Cultura/esporte?** Equipamentos e políticas via MUNIC/ESTADIC, ainda discovery.
22. **Conectividade/ambiente?** Anatel técnico, Cetic amostral, SINISA/SNIS com cobertura declaratória.
23. **Gasto público associável?** Siconfi/PNCP, preservando estágio e vínculo documental.
24. **Fontes Cívica reutilizáveis?** `exec_entity`, população, indicadores, finanças, contratos, PNCP, revisões e manifestos.
25. **Risco de duplicação?** Saúde, Segurança, Educação e Infraestrutura; contrato editorial define fronteiras.
26. **Benchmarks relevantes?** Série do próprio território, UF, Brasil, mediana municipal da UF e porte.
27. **Pequenos versus grandes?** Faixas de população, com denominador e ano iguais; sem ranking automático.
28. **Melhor história?** Condições materiais → trabalho → dificuldades → proteção → moradia → cotidiano → ação pública → evolução.
29. **Topo da página?** RDPC, emprego formal, proteção social e moradia, somente após cobertura publicada.
30. **Aprofundamentos de especialistas?** CNAE/CBO, distribuição de renda, IVCAD, serviços SUAS, SINISA, contratos e revisões.
31. **Cobertura das 27 UFs/municípios?** Identidade cobre 27 UFs/5.571 municípios; fatos sociais ainda não.
32. **Fontes bloqueadas?** CadÚnico identificado; RAIS/Caged por volume/FTP; IVCAD/Atlas por licença/edição pendente.
33. **Armazenamento?** 0,4–1,2 GB facts/indexes e 8–35 GB RAW estimados.
34. **Collectors novos?** Seis famílias de fonte, a validar em P12.1.
35. **Roadmap eficiente?** P12.1 contratos, P12.2 IBGE, P12.3 MTE, P12.4 MDS, P12.5 SUAS, P12.6 saneamento/cultura/digital, P12.7 finanças, P12.8 serving.
36. **MVP?** Dez indicadores listados em `PRIORIZACAO_MVP_NACIONAL.md`.
37. **Expansão?** Setores/salários, IVCAD, capacidade SUAS, SINISA, cultura/esporte, digital e grupos vulneráveis.
38. **P12.1 pronta?** Sim para arquitetura/contratos; não para coleta/publicação sem validações de fonte.
