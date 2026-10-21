# Investigação P5: atuação política e administrativa do Poder Executivo

Gerado em 2026-10-11. Dados: `investigacao_executivo_p5_fontes.json`.

## 1. Resumo executivo

Investigação apenas; nada do produto foi alterado. Horizonte 2013–out/2026.

- **Roster eleito é resolvido** por dados abertos do TSE: prefeitos eleitos 5.567 (2012), 5.518 (2016), 5.494 (2020), 5.529 (2024), com vice vinculado em 99,96–100%, título eleitoral em 100% (chave estável entre eleições) e foto em 100% (2024 e 2020).
- **Eleito ≠ empossado não é resolvível só com o TSE.** Não existe fonte nacional de posse, afastamento ou sucessão; o TSE cobre apenas eleições suplementares (111/164/107/34 eleitos em 2012/16/20/24).
- **Cadeia federal de atos é sólida**: lista (Senado) → página (Planalto) → assinatura → referência ao DOU; 84–100% parseável nas amostras. Signatário ≠ titular (interinos assinam).
- **Vetos e MPs têm série anual**: VET 36–73/ano, MPV 29–108/ano (2020 = 108).
- **Autoria do Executivo é institucional** na Câmara (866 proposições em 2013, 835 em 2020): nunca atribuir a pessoa por data (TEMPORAL_ONLY).
- **Municipal é a fronteira**: DOM/SC cobre 289 prefeituras (5,49 mi atos), Querido Diário tem spiders para 441 municípios (7,9%); decreto traz categoria/número/ano, mas a assinatura digital é do consórcio, não do prefeito.
- **Custo institucional**: Vice-Presidência isolável; Presidente como pessoa não (CPGF da Presidência ~96% sigilosa; SIAPE só agregado).
- **Bloqueios**: INLABS (login), LexML (anti-bot), DOEM/Leis Municipais/CR2. Não contornados.
- Gates: BLOCKED=2, NOT_EVALUATED=3, PARTIAL=9, PASS=6, PASS_WITH_CAVEATS=6 (de 26).

## 2. Escopo, método e estados de evidência

Estados de evidência: VERIFIED_API, VERIFIED_DATASET, DOCUMENTED_ONLY, INFERRED, BLOCKED, NOT_EVALUATED, UNAVAILABLE. Viabilidade: READY_FOR_CONTRACT, NEEDS_VALIDATION, DISCOVERY_ONLY, BLOCKED, NOT_FEASIBLE. Todas as medições foram feitas em arquivos públicos (zips TSE baixados; zips de fotos lidos pelo índice via HTTP Range sem baixar imagens). Privacidade: título só como hash; CPF não persistido; SIAPE só agregado. Os rótulos de teste A–N são descritivos desta execução (ver seção 31).

## 3. Reuso da infraestrutura Cívica existente

| Peça existente | Uso em P5 |
|---|---|
| packages/db/src/migrations.ts: people, mandates, exercise_periods, party_memberships, elections, candidacies | modelo já separa mandato/exercício/candidatura; basta novos cargos |
| apps/collector/src/elections.ts | parser CSV TSE; relevant() hoje limita a senador/deputado federal; estender para cargos 1–4, 11–12 |
| packages/db/src/portrait-mirror.ts | espelho de retratos; reaproveitar para fotos TSE de executivos |
| apps/collector/src/state/providers/* | padrão de provider por UF para normas estaduais/diários |
| core/registry/national-finance-registry.ts (P3/P4) | registro de fontes financeiras já usado para custos institucionais |
| packages/domain/src/temporal.ts | intervalos de exercício |

## 4. Pessoas e cargos

| ID | Papel | Esperado | Fonte | Estado |
|---|---|---|---|---|
| PE-PRES | Presidente/Vice | 2 | S-TSE-CAND, S-PLANALTO | VERIFIED_DATASET |
| PE-GOV | Governador/Vice (27 UFs) | 54 | S-TSE-CAND | VERIFIED_DATASET |
| PE-MAYOR | Prefeito/Vice (5.570) | 11140 | S-TSE-CAND | VERIFIED_DATASET |
| PE-MIN | Ministros | 38 | S-PLANALTO, S-SIORG, S-DOU | NEEDS_VALIDATION |
| PE-SEC | Secretários estaduais/municipais | None | - | DISCOVERY_ONLY |
| PE-COMM | Cargos comissionados | 140288 | S-PT-SIAPE | VERIFIED_DATASET |


Secretários estaduais/municipais: DISCOVERY_ONLY (sem fonte nacional).

## 5. Mandato x exercício x candidatura

Três entidades distintas: **candidatura** (TSE), **mandato** (resultado ordinário), **exercício** (posse/afastamento, fonte por esfera). Regra de prefeito eleito: eleição ORDINÁRIA, maior NR_TURNO com DS_SIT_TOT_TURNO começando por ELEITO. Suplementar é evento próprio e nunca sobrescreve o ordinário. UEs sem eleito (1/50/74/40 em 2012/16/20/24) são eleição anulada, indeferimento ou não realizada: ficam como lacuna explícita, não como zero.

## 6. Presidente, vice, governadores (TSE 2014–2022)

Eleitos 2014/2018/2022: 29/28/28 linhas (2014 inclui 2 suplementares de governo). CPF presente em 28/28; título 100%; vice vinculado 100%. Segundo turno: 15/15/13. Posse e sucessão: sem fonte no TSE (NEEDS_VALIDATION via Planalto/diários).

## 7. Prefeitos e vices (5.570)

| Ano | Eleitos | Com vice | Título | CPF | 2º turno | Suplementares eleitas |
|---|---|---|---|---|---|---|
| 2012 | 5567 | 5567 | 5567 | 4330 | 50 | 111 |
| 2016 | 5518 | 5518 | 5518 | 5517 | 57 | 164 |
| 2020 | 5494 | 5492 | 5494 | 5494 | 58 | 107 |
| 2024 | 5529 | 5529 | 5529 | mascarado | 51 | 34 |


Continuidade: título eleitoral em hash liga a mesma pessoa entre 2012–2024 (8 títulos mascarados em 2012, 1 em 2016, 0 depois). Reeleição e troca de município detectáveis.

## 8. Eleito x empossado x eleitos de 2026

Regra de produto: o resultado de 2026 não mostra "prefeito/governador atual" antes da posse (1º/jan/2027). Em exercício hoje (out/2026) permanecem os eleitos de 2022 (governadores/presidente) e 2024 (prefeitos), salvo sucessão. Sucessão por vice, cassação e afastamento exigem diário oficial: NEEDS_VALIDATION; teste 2026 NOT_EVALUATED.

## 9. Fotos oficiais e proveniência

| Recorte | Prefeitos com foto |
|---|---|
| 2024 prefeitos | 5529/5529 |
| 2020 prefeitos | 5494/5494 |
| 2016 (ES,SP,PE,MG) | 1723/1724 |
| 2012 (ES,SP,PE,MG) | 1760/1760 |


Proveniência: retrato de candidatura TSE, identificado por SQ_CANDIDATO; não é foto oficial de gestão. Tamanho dos zips: de 47 MB (AP) a 2,16 GB (MG) em 2024; leitura só do índice.

## 10. Atos normativos federais

| Ano | DEC-n listados | Amostra | Página+assinatura | Ref. DOU |
|---|---|---|---|---|
| 2013 | 297 | 25 | 21 | 25 |
| 2016 | 318 | 25 | 22 | 25 |
| 2020 | 398 | 25 | 25 | 25 |
| 2025 | 463 | 25 | 25 | 25 |


Contagens Senado por ano (DEC/LEI/LCP/MPV/DLG): 2013 628/172/2/35/425; 2016 457/171/4/56/153; 2019 537/185/7/48/65; 2022 399/228/9/58/172; 2025 463/239/13/46/310; 2026 323/204/13/63/444. DEC inclui DEC-n (numerados) e DEC-sn (sem número): em 2013, 297 + 331. DLG é ato do Legislativo e não conta como ato do Executivo. Variação de caixa nas pastas do Planalto (`_Ato`/`_ato`) exige tentativa dupla.

## 11. Signatário x titular do cargo

O bloco de assinatura traz o signatário real: em 2016 aparecem Dilma Rousseff, Michel Temer e Rodrigo Maia; em 2025 Lula e Alckmin (interino). O adaptador deve guardar "signatário" e resolver "titular no exercício" separadamente por intervalo; nunca assumir o presidente eleito.

## 12. Atos estaduais

| UF | Fonte | Situação |
|---|---|---|
| SP | Alesp normas XML | dataset completo (VERIFIED_DATASET) |
| PE | ALEPE listas | 156 (2014), 145 (2020), 217 (2025): parcial |
| MG | ALMG HTML | documentado; não medido |
| ES e demais | - | NOT_EVALUATED |


A matriz das 27 UFs está documentada apenas para SP/PE/MG; 24 UFs permanecem sem medição (ver gate NORMATIVE_ACTS_STATE=PARTIAL).

## 13. Atos municipais e plataformas de diário

| Plataforma (spiders QD) | N |
|---|---|
| Instar | 111 |
| Gazette (genérico) | 65 |
| DOEM | 56 |
| DOSP | 42 |
| ADiários v1 | 34 |
| MunicípioOnline | 26 |
| Atende v2 | 22 |
| DIOF | 21 |
| BarcoDigital | 12 |
| Siganet | 10 |
| DiarioOficialBR | 10 |
| Modernização | 6 |


449 spiders / 441 municípios únicos = 7,9% dos 5.570. DOM/SC: 289 prefeituras de 294 municípios com entidades (5.488.834 atos de prefeituras; 289 com publicação em 2026; 153 com primeira publicação até 2014; maioria desde 2008–2017). Concentração em poucas plataformas torna viável um adaptador por plataforma (Instar+Gazette+DOEM+DOSP = 274 de 449, 61%). DOEM bloqueado (BunkerWeb).

## 14. Teste D: decretos de cinco municípios (DOM/SC)

| Município | Entidade | Decretos publicados 2024 (busca) | Páginas |
|---|---|---|---|
| Blumenau | 41 | 3.336 | 334 |
| Chapecó | 71 | 3.774 | 378 |
| Abdon Batista | 4 | 251 | 26 |
| Florianópolis | - | não consta como prefeitura no DOM/SC | - |
| Joinville | - | idem | - |


Observação importante: a contagem vem da busca por termo "decreto" no período, ou seja, inclui publicações que citam decreto; o ato individual traz Categoria = Decretos, Número, Ano e Data (ex.: Decreto 15.887/2024, Blumenau, publicado 30/12/2024). A assinatura digital é do Consórcio de Inovação na Gestão Pública (CIGA), não do prefeito; o prefeito só aparece no PDF/texto. Resultado: cobertura boa, **autoria pessoal = TEMPORAL_ONLY** até parsear o texto. Estado: VERIFIED_API, PARTIAL.

## 15. Projetos de lei de iniciativa do Executivo

Federal: a Câmara marca o Poder Executivo como instituição autora (2013: TVR 552, MSC 166, PLN 42, MPV 35, PL 31, MCN 12, AV 12, OFN 9, AVN 5, PLP 2 = 866; só 70 normas e zero URN LexML). Contar iniciativa por tipo (PL/PLP/PLN/MPV), não por "proposição". Estadual e municipal: sem ligação projeto→norma comprovada (Teste E PARTIAL). Ligação com o grafo de proposições da Cívica: por tipo+número+ano federal.

## 16. Sanções, vetos e medidas provisórias

| Ano | VET | MPV |
|---|---|---|
| 2013 | 57 | 35 |
| 2014 | 36 | 29 |
| 2015 | 64 | 43 |
| 2016 | 52 | 56 |
| 2017 | 50 | 51 |
| 2018 | 42 | 53 |
| 2019 | 62 | 48 |
| 2020 | 59 | 108 |
| 2021 | 73 | 70 |
| 2022 | 65 | 58 |
| 2023 | 49 | 52 |
| 2024 | 50 | 81 |
| 2025 | 51 | 46 |
| 2026 | 55 | 63 |


Unidade de contagem explícita: VET = mensagem de veto (pode ser total ou parcial); MPV = medida editada; sanção = lei publicada. Cadeia veto→apreciação: PROBABLE, não fechada por ID.

## 17. Nomeações e exonerações

Os decretos listados pelo Senado não incluem nomeações/exonerações (0 nos DEC examinados): elas são atos da seção 2 do DOU. DOU público tem busca com JSON embutido, mas frases acentuadas entre aspas retornam 0 e a paginação não foi confirmada; INLABS exige login (BLOCKED). Estado: BLOCKED para massa, NEEDS_VALIDATION via DOU.

## 18. Estrutura de governo (SIORG e equivalentes)

SIORG REST (OpenAPI): estrutura hierárquica, versões (`versaoConsulta`) e IDs persistentes: base para mudanças estruturais por intervalo de tempo (VERIFIED_API). Estadual e municipal não têm equivalente nacional (DISCOVERY_ONLY); no municipal, a unidade orçamentária dos TCEs (ex.: ES "Gabinete do Prefeito") é o melhor proxy.

## 19. Custo institucional do gabinete e níveis de atribuição

| Nível | Significado | Achado |
|---|---|---|
| INSTITUTIONAL_COST | custo do órgão (Presidência, Vice) | UG/órgão da Presidência isoláveis em despesas-execução |
| CABINET_COST | gabinete do titular | ES: UO Gabinete do Prefeito (Alto Rio Novo, Vitória) |
| DIRECT_OFFICE_EXPENSE | despesa direta da unidade | Vice-Presidência isolável |
| PERSON_SPECIFIC_EXPENSE | gasto atribuível à pessoa | raro; CPGF/diárias |
| NOT_ATTRIBUTABLE | sem ligação defensável | Presidente como pessoa |


Regra: instituição ≠ pessoa. Nunca somar custo do órgão como gasto pessoal.

## 20. Cartões corporativos (CPGF) e suprimento de fundos

Ago/2026: 15.237 linhas, R$ 11,72 mi; Presidência 1.064 linhas, R$ 1,66 mi; ~96% das linhas da Presidência são sigilosas. Resultado: nível máximo INSTITUTIONAL_COST; nunca PERSON_SPECIFIC. Estado VERIFIED_DATASET, PASS_WITH_CAVEATS.

## 21. Remuneração, subsídios e cargos comissionados

Atos de fixação de subsídio existem como normas (federal e municipal) e fixam teto, não pagamento. SIAPE jul/2026: 778.337 vínculos, 627.380 pessoas, 140.288 com função, 32 órgãos superiores; Presidência: 2.005 vínculos, 1.736 pessoas. Só agregado, sem CPF; remuneração de governadores/prefeitos por entidade: não medida.

## 22. Viagens e agendas

Viagens 2025: 814.395; Presidência 11.380; 92 com sigilo. Previsto e realizado são campos separados. Agendas oficiais: apenas HTML, sem API (DISCOVERY_ONLY). Teste N (viagem↔despesa/agenda): PROBABLE por documento, não provado.

## 23. Planos de governo, PPA, LDO e LOA

Planos de governo do TSE são PDFs sem estrutura (DOCUMENTED_ONLY). PPA/LDO/LOA já foram investigados em P3/P4 como orçamento. Ligação promessa↔PPA/LOA: THEMATIC_ONLY. Sem pontuação automática de cumprimento.

## 24. Reconstrução do histórico de mandatos

Possível para eleitos (2012–2024) por hash de título. Para exercício real: acrescentar eventos de posse, licença e sucessão por esfera; intervalos temporais por `packages/domain/src/temporal.ts`.

## 25. Chaves de identidade

| ID | Entidade | Chave | Regra/estado |
|---|---|---|---|
| IK-1 | pessoa política | hash(título eleitoral) | CPF nunca persistido em claro; 2024 mascarado / VERIFIED_DATASET |
| IK-2 | mandato | eleição+SG_UE+cargo+NR_TURNO | suplementar é evento próprio / VERIFIED_DATASET |
| IK-3 | ato federal | tipo+número+ano (+URN LexML quando houver) |  / VERIFIED_DATASET |
| IK-4 | ato municipal | plataforma+código do ato (ex.: DOM/SC /atos/{id}) | IBGE+tipo+número+ano / VERIFIED_API |
| IK-5 | unidade federal | SIORG id |  / VERIFIED_API |
| IK-6 | município | IBGE 7 dígitos ↔ SG_UE do TSE (tabela de-para) |  / NEEDS_VALIDATION |

## 26. As 25 relações

| ID | A | B | Classe | Base |
|---|---|---|---|---|
| R01 | prefeito eleito | vice eleito | EXACT | SG_UE+NR_TURNO+NR_CANDIDATO |
| R02 | candidato TSE | foto TSE | EXACT | SQ_CANDIDATO no nome do arquivo |
| R03 | prefeito 2020 | prefeito 2024 (reeleição) | EXACT | hash título |
| R04 | eleito | empossado | UNLINKED | sem fonte nacional de posse |
| R05 | decreto federal | signatário | EXACT | bloco de assinatura da página Planalto |
| R06 | signatário | titular do cargo | HIGH_CONFIDENCE | assina o presidente em exercício; interino aparece (Alckmin, Rodrigo Maia) |
| R07 | decreto | DOU | EXACT | referência ao DOU na página (100% da amostra) |
| R08 | MPV | lei de conversão | HIGH_CONFIDENCE | processo Senado |
| R09 | veto | apreciação em sessão | PROBABLE | não fechado por ID |
| R10 | proposição Executivo | instituição Poder Executivo | INSTITUTIONAL_ONLY | Câmara: autor institucional |
| R11 | proposição Executivo | presidente da época | TEMPORAL_ONLY | só por data; nunca responsabilidade pessoal |
| R12 | norma | projeto de lei de origem (estadual) | PROBABLE | texto da norma cita o projeto |
| R13 | ato municipal | prefeito | TEMPORAL_ONLY | assinatura digital é do consórcio; prefeito só no PDF |
| R14 | unidade SIORG | ministro | UNLINKED | SIORG não traz titular de forma confiável |
| R15 | vínculo SIAPE | Presidência | EXACT | órgão de exercício |
| R16 | vínculo SIAPE | pessoa nomeada | UNLINKED | sem CPF; agregado apenas |
| R17 | CPGF Presidência | pessoa | CONFLICT | ~96% sigilosas; portador ≠ beneficiário político |
| R18 | despesa gabinete | prefeito | INSTITUTIONAL_ONLY | UO Gabinete do Prefeito (nível INSTITUTIONAL_COST/CABINET_COST) |
| R19 | viagem | agenda | THEMATIC_ONLY | agenda não coletada |
| R20 | viagem | despesa | PROBABLE | PCDP/documento; não provado |
| R21 | plano de governo (TSE) | PPA/LOA | THEMATIC_ONLY | sem pontuação automática promessa x resultado |
| R22 | ato de subsídio | remuneração paga | PROBABLE | norma fixa teto; folha municipal varia |
| R23 | município TSE (SG_UE) | IBGE | HIGH_CONFIDENCE | de-para a validar |
| R24 | plataforma de diário | município | EXACT | spider id = IBGE em QD |
| R25 | eleição suplementar | mandato anterior | CONFLICT | não sobrescrever; evento próprio |


TEMPORAL_ONLY nunca vira responsabilidade pessoal.

## 27. Matrizes de cobertura

| Fonte | Esfera | Período | Completude medida |
|---|---|---|---|
| TSE prefeitos | municipal | 2012–2024 | 5.567/5.518/5.494/5.529 eleitos |
| TSE gov/pres | estadual/federal | 2014–2022 | 29/28/28 |
| Atos federais | federal | 2013–2026 | lista 100%; página 84–100% |
| VET/MPV | federal | 2013–2026 | série anual completa |
| Normas estaduais | 27 UFs | - | SP completo; PE parcial |
| Diários municipais | 5.570 | 2008–2026 | QD 441; DOM/SC 289 |
| SIAPE | federal | jul/2026 | snapshot |
| CPGF | federal | ago/2026 | mensal |
| Viagens | federal | 2025 | anual |

## 28. Famílias de collectors F0–F9

| ID | Nome | Reuso | Viabilidade |
|---|---|---|---|
| F0 | Roster de mandatos TSE (prefeito/governador/presidente + vices) | apps/collector/src/elections.ts (estender relevant(); hoje só senador/dep. federal); tabelas mandates/candidacies | READY_FOR_CONTRACT |
| F1 | Fotos de candidatura | packages/db/src/portrait-mirror.ts | READY_FOR_CONTRACT |
| F2 | Atos federais (Senado legislacao + Planalto) | novo; Senado já usado em P3 | READY_FOR_CONTRACT |
| F3 | VET/MPV (Senado processo) | novo, mesmo cliente do Senado | READY_FOR_CONTRACT |
| F4 | Diários municipais por plataforma (DOM/SC primeiro) | apps/collector/src/state/providers/* como padrão de provider | NEEDS_VALIDATION |
| F5 | Normas estaduais (Alesp XML, listas) | state providers | NEEDS_VALIDATION |
| F6 | SIORG | novo | READY_FOR_CONTRACT |
| F7 | Custo institucional (PT despesas, CPGF, viagens, SIAPE agregado) | core/registry/national-finance-registry.ts (P3/P4) | READY_FOR_CONTRACT |
| F8 | Nomeações/exonerações (DOU) | - | BLOCKED |
| F9 | Planos/PPA/LDO/LOA e agendas | - | DISCOVERY_ONLY |

## 29. Cenários de coleta

| ID | Cenário | Custo | Entrega |
|---|---|---|---|
| SC-1 | Mínimo: F0+F1+F6 | baixo (zips TSE ~MB; fotos ~GB só se espelhar) | roster e fotos de 5.570 prefeitos, governadores, presidente; estrutura federal |
| SC-2 | Atos: SC-1 + F2+F3 | médio (páginas Planalto ~1.800 decretos/ano em amostra de 25 mostra 84-100% parseáveis) | cadeia federal decreto/MPV/veto com signatário |
| SC-3 | Municipal: SC-2 + F4 DOM/SC | alto (5,49 mi atos só em SC) | decretos de 289 prefeituras; depende de filtro por categoria Decretos |
| SC-4 | Completo: SC-3 + F5+F7+F8 | muito alto; F8 bloqueada | nomeações dependem de licença INLABS |

## 30. Oportunidades de produto e criativas

| ID | Experiência | Depende de | Estado |
|---|---|---|---|
| PO-1 | Quem governa agora x quem foi eleito | F0, OHE | NEEDS_VALIDATION |
| PO-2 | Linha do tempo de um prefeito (mandatos, vices, reeleição) | F0, F1 | VERIFIED_DATASET |
| PO-3 | Atos assinados por cada presidente (signatário vs titular) | F2 | VERIFIED_API |
| PO-4 | Vetos e MPs por ano com unidade de contagem explícita | F3 | VERIFIED_API |
| PO-5 | Custo institucional do gabinete (nível rotulado, nunca pessoal) | F7 | VERIFIED_DATASET |
| PO-6 | Mapa de cobertura de diários oficiais | F4 | VERIFIED_API |


Criativas: mapa de cobertura de diários; linha do tempo do mandato; comparador "assinou x titular"; selo de unidade de contagem em cada número de ato.

## 31. Inventário de testes A–N

| Teste | Descrição | Resultado | Evidência |
|---|---|---|---|
| T-A | Prefeito/vice por TSE: identidade, continuidade e foto (5 municípios + painel nacional) | PASS | vencedores 2012:5567 2016:5518 2020:5494 2024:5529; vice vinculado 99,96-100%; título presente 100%; foto 2024 5529/5529, 2020 5494/5494 (amostra de 4 UFs 2016-2012 ~100%) |
| T-B | Presidente/governador: eleito x empossado | PASS_WITH_CAVEATS | TSE dá eleitos 2014/2018/2022 (29/28/28 linhas; 2014 inclui suplementar); posse, afastamento e sucessão NÃO existem no TSE |
| T-C | Cadeia federal decreto: lista -> página -> assinatura -> DOU | PASS | página+assinatura 84% (2013), 88% (2016), 100% (2020), 100% (2025) em amostras de 25; referência ao DOU 100%; signatário no bloco da página |
| T-D | Decretos municipais de 5 municípios (DOM/SC) | PARTIAL | Blumenau 3.336 publicações de decreto na busca 2024, Chapecó 3.774, Abdon Batista 251; ato traz categoria, número, ano, data; assinatura digital é do consórcio CIGA, prefeito só no PDF; Florianópolis e Joinville ausentes do DOM/SC |
| T-E | Projeto de lei do Executivo -> norma (estadual/municipal) | PARTIAL | federal: Câmara marca Executivo como instituição (PL 31/18/38; MPV; PLN 42); estadual/municipal sem prova de ligação |
| T-F | Veto/MPV: contagem e cadeia | PARTIAL | VET 2013-2026: 36-73/ano; MPV 29-108/ano; cadeia veto->apreciação não fechada por ID |
| T-G | Nomeação/exoneração como par de atos | PARTIAL | Senado legislacao não contém decretos de nomeação/exoneração (0 nos decretos DEC listados); DOU busca sem paginação confirmada; INLABS bloqueado |
| T-H | SIORG: hierarquia e histórico de versões | PASS | OpenAPI com versaoConsulta e árvore; IDs persistentes de unidade |
| T-I | Custo institucional da Presidência/gabinete | PASS_WITH_CAVEATS | Vice-Presidência isolável; Presidente pessoa não; ES: UO Gabinete do Prefeito (Alto Rio Novo/Vitória) |
| T-J | CPGF / suprimento de fundos | PASS_WITH_CAVEATS | Presidência 1.064 de 15.237 linhas (R$ 1,66 mi de R$ 11,72 mi); ~96% das linhas da Presidência sigilosas |
| T-K | Folha/cargos comissionados (SIAPE) | PASS_WITH_CAVEATS | 778.337 vínculos, 627.380 pessoas, 140.288 com função, 32 órgãos superiores; Presidência 2.005 vínculos/1.736 pessoas; só agregado |
| T-L | Viagens | PASS | 2025: 814.395 viagens; Presidência 11.380; sigilo 92; previsto x realizado separados |
| T-M | Adaptador de plataforma de diário municipal | PARTIAL | QD: Instar 111, Gazette 65, DOEM 56, DOSP 42, ADiários v1 34, MunicípioOnline 26 (de 449 spiders); DOEM/Leis Municipais/CR2 bloqueados; DOM/SC medido |
| T-N | Viagem <-> despesa/agenda | PARTIAL | viagem tem PCDP/beneficiário; ligação a despesa por documento não provada; agenda não coletada |

## 32. Bloqueios

| ID | Bloqueio | Impacto | Ação |
|---|---|---|---|
| B-1 | INLABS exige login | nomeações/exonerações em massa | obter credencial ou usar DOU público paginado |
| B-2 | LexML anti-bot | URN/lexml de atos | não contornar; usar fontes primárias |
| B-3 | DOEM BunkerWeb, Leis Municipais 403, CR2 Bubble.io | parte dos municípios | descartar ou pedir acordo |
| B-4 | Querido Diário API inalcançável nesta execução | contagem de cobertura via spiders apenas | reavaliar |
| B-5 | Não há fonte nacional de posse/afastamento | eleito ≠ empossado não resolvível por TSE | diários oficiais por esfera |
| B-6 | CPGF da Presidência ~96% sigilosa | nenhum gasto pessoal do presidente | manter nível INSTITUTIONAL_COST |

## 33. Custo e esforço de cobertura

TSE: poucos MB por ano (zips); fotos: ~GB só se espelhar (MG 2,16 GB); DOM/SC: milhões de atos, exigir filtro por categoria e janela; SIAPE/CPGF/viagens: arquivos mensais de dezenas de MB a GB, agregar na origem.

## 34. Privacidade e limites legais

Sem CPF em claro; título só em hash; folha SIAPE agregada; sigilos da CPGF respeitados e rotulados; sem comparar pessoa com instituição. Nada de LexML/INLABS contornado.

## 35. Riscos

1) Assumir titular = eleito. 2) Contar DEC-sn como decreto numerado. 3) Contar DLG como ato do Executivo. 4) Atribuir ato municipal ao prefeito pela assinatura digital. 5) Somar custo do órgão como pessoal.

## 36. Gates

| Gate | Estado | Motivo |
|---|---|---|
| P5_EXECUTIVE_ROSTER | PASS_WITH_CAVEATS | prefeitos/governadores/presidente eleitos medidos; empossados não |
| P5_MANDATE_VS_OFFICE | PARTIAL | eleito≠empossado só modelado; sem fonte de posse |
| P5_ELECTED_NOT_YET_IN_OFFICE | NOT_EVALUATED | resultado de 2026 não coletado; regra definida |
| P5_SUCCESSION_EVENTS | PARTIAL | suplementares TSE medidas (111/164/107/34); sucessão por vice sem fonte |
| P5_OFFICIAL_PHOTOS | PASS_WITH_CAVEATS | foto TSE 100% prefeitos 2020/2024; foto oficial de gestão não |
| P5_NORMATIVE_ACTS_FEDERAL | PASS | cadeia lista->página->assinatura->DOU 84-100% |
| P5_NORMATIVE_ACTS_STATE | PARTIAL | SP completo, PE parcial; 25 UFs não medidas |
| P5_NORMATIVE_ACTS_MUNICIPAL | PARTIAL | DOM/SC mede 289 prefeituras; resto por plataformas |
| P5_LEXML_COVERAGE | BLOCKED | anti-bot |
| P5_EXECUTIVE_INITIATIVE | PARTIAL | federal institucional; estadual/municipal sem ligação |
| P5_VETOS_MPS_COUNTING | PASS | séries anuais com unidade de contagem |
| P5_APPOINTMENTS | BLOCKED | INLABS login; DOU parcial |
| P5_STRUCTURE_FEDERAL | PASS | SIORG |
| P5_STRUCTURE_SUBNATIONAL | NOT_EVALUATED | sem equivalente |
| P5_INSTITUTIONAL_COST | PASS_WITH_CAVEATS | Vice isolável, Presidente não |
| P5_CORPORATE_CARDS | PASS_WITH_CAVEATS | sigilo ~96% na Presidência |
| P5_REMUNERATION | PARTIAL | atos de subsídio achados; folha por entidade não |
| P5_COMMISSIONED_POSTS | PASS_WITH_CAVEATS | SIAPE agregado |
| P5_PAYROLL_PRIVACY | PASS | sem CPF em claro |
| P5_TRAVEL | PASS | 814.395 viagens 2025 |
| P5_AGENDAS | NOT_EVALUATED | não coletadas |
| P5_GOVERNMENT_PLANS | PARTIAL | PDFs TSE; sem pontuação |
| P5_IDENTITY_KEYS | PASS_WITH_CAVEATS | título hash; IBGE↔SG_UE a validar |
| P5_RELATIONSHIPS | PARTIAL | 25 relações classificadas; 6 só INFERRED/UNLINKED |
| P5_COLLECTOR_FAMILIES | PASS | F0–F9 com reuso |
| P5_PRODUCT_READINESS | PARTIAL | roster+atos federais prontos; municipal e posse não |

## 37. Respostas A–Q

|  | Pergunta | Resposta |
|---|---|---|
| A | Quem foi eleito e como identificar entre eleições? | TSE; hash do título; vice por SG_UE+NR_TURNO+NR_CANDIDATO. |
| B | Quem está no cargo? | Não resolvível pelo TSE; precisa de diários oficiais por esfera. |
| C | Fotos? | TSE 100% prefeitos 2020/2024, com proveniência de candidatura. |
| D | Atos federais? | Cadeia completa, 84–100% parseável. |
| E | Atos estaduais? | SP completo; PE parcial; demais não medidos. |
| F | Atos municipais? | DOM/SC 289 prefeituras; QD 441 municípios; prefeito não é signatário estruturado. |
| G | Iniciativa do Executivo? | Federal institucional; local não ligado. |
| H | Vetos/MPs? | Séries anuais com unidade explícita. |
| I | Nomeações? | BLOCKED em massa (INLABS). |
| J | Estrutura? | SIORG federal; subnacional sem fonte. |
| K | Custo institucional? | Vice isolável; Presidente pessoa não. |
| L | Cartões? | Presidência ~96% sigilosa. |
| M | Remuneração/cargos? | Atos de subsídio + SIAPE agregado. |
| N | Viagens/agendas? | Viagens sim; agendas não. |
| O | Planos? | PDFs; THEMATIC_ONLY. |
| P | Reuso Cívica? | elections.ts, portrait-mirror, state providers, national-finance-registry. |
| Q | Pronto para produto? | Roster e atos federais sim; municipal e posse não. |

## 38. Próximos experimentos

1) Parsear texto do decreto municipal para extrair signatário. 2) Medir DOU paginado para nomeações. 3) Medir normas de ES/MG/RJ/BA. 4) Tabela IBGE↔SG_UE. 5) Coletar resultado 2026 em modo staging. 6) Medir plataformas Instar/DOSP com um município cada.

## 39. Recomendação de sequência

F0+F1+F6 → F2+F3 → F4 (DOM/SC) → F5 → F7 → F8 se houver credencial INLABS.

## 40. Lacunas desta execução

Testes E, F (cadeia completa), G, N e Florianópolis/Joinville não fechados; fotos 2016/2012 medidas em 4 UFs; INLABS/LexML/DOEM/QD API não acessados; letras A–N reconstruídas como rótulos descritivos.

## 41. Inventário de evidências

- p5/cand_*.zip
- p5/tse_an.json
- p5/tse_an2.json
- p5/photos.json
- p5/testA.json
- p5/fed_test.json
- p5/senado_counts.json
- p5/senado_vet_mpv.json
- p5/senado_dec_nom.json
- p5/camara_exec.json
- p5/siorg_openapi.yaml
- p5/qd_spiders.json
- p5/domsc.json
- p5/domsc2.json
- p5/testD.json
- p5/alepe_counts.json
- p5/siape_agg.json
- p5/cpgf_agg.json
- p5/viagens_agg.json
