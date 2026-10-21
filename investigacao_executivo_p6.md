# Investigação P6: fechamento de mandatos, autoria de atos e cobertura nacional do Executivo

Gerado em 2026-10-11. Dados: `investigacao_executivo_p6_fontes.json`.

## 1. Resumo executivo

Investigação apenas, sem alteração de código, banco ou arquivos anteriores. Período 2013–out/2026.

**O que a P6 comprovou além da P5**
- **Quem exerceu a Presidência** pode ser reconstruído por assinatura de decretos: 840 decretos amostrados (60 por ano, 2013–2026), 840/840 páginas recuperadas, 803 assinaturas extraídas (95.6%). A linha resultante (Dilma até 11/05/2016, Temer em exercício, Bolsonaro, Lula) e **59 atos de substitutos** (Alckmin 24, Mourão 5, Rodrigo Maia 6, Lewandowski 3, Temer como vice 21) mostram que signatário ≠ eleito. É evidência de exercício, não ato de posse.
- **Ciclo do veto fechado em dados estruturados**: 765 vetos 2013–2026; 660 (86%) com norma gerada; desfecho e data de deliberação por campo.
- **Viagem → pagamento comprovado por identificador**: Presidência 2025, 11341/11380 (99.66%) com pagamento; valores coincidem em 97,4%.
- **Ministros vigentes**: SIAPE entrega 39 ocupantes com órgão, data de ingresso e diploma "DECRETO". O SIORG **não** traz ocupante (confirmado no OpenAPI): a ponte é via SIAPE.
- **Decretos municipais**: a categoria estruturada "Decretos" do DOM/SC corrige a P5 (Blumenau 964 contra 3.336 da busca textual). O signatário aparece na página do ato em 1 de 4 municípios e no PDF em 9 de 9 testados.
- **Cobertura municipal real**: união QD + DOM/SC = **731 municípios (13.1% de 5.571)**, com sobreposição de 2. Com 20 adaptadores (sem DOEM bloqueado) o teto no universo conhecido é 618 municípios.
- **Interrupções municipais**: eleições suplementares em UEs com eleito ordinário no ciclo: 110 (2012), 120 (2016), 36 (2020), 11 (2024).

**O que continua aberto**: exercício de governadores e prefeitos (nenhum evento estadual verificado), nomeações/exonerações em massa (INLABS), signatário estadual, histórico mensal do SIAPE (download negado nesta rodada), agendas e 5,4 mil municípios sem fonte comprovada.

Gates: NOT_EVALUATED=3, PARTIAL=12, PASS=3, PASS_WITH_CAVEATS=6 (de 24).

## 2. Correções e aprofundamentos da P5

| Item P5 | Correção/refinamento P6 |
|---|---|
| Decretos municipais: 3.336/3.774/251 (busca textual "decreto") | Categoria estruturada: Blumenau 964, Chapecó 2.563, Lages 1.451, Abdon Batista 167 (2024). A busca textual superestima 1,5×–3,5× |
| Contagem DEC 2013 = 628 (DEC-n 297 + DEC-sn 331) | Esta rodada, `tipo=DEC` devolve só numerados (5249 em 2013–2026; 2013=297). DEC-sn não foi listado por essa consulta: validar fonte separada |
| DOM/SC 289 prefeituras | 289 por nome de entidade "Prefeitura/Município"; 293 de 295 municípios de SC resolvidos por IBGE (faltam Laurentino e Grão-Pará) |
| QD 441 municípios | 440 com IBGE válido (um id de associação não é município) |
| IBGE 5.570 | API devolve 5.571 (inclui DF) |
| Amostra federal 25/ano (84–100%) | Amostra 60/ano em 14 anos: página 100%, assinatura 95.6% |
| SIORG→ministro UNLINKED | Confirmado no OpenAPI (sem ocupante); nova ponte via SIAPE (R6-04) |
| Nomeação: DOU sem paginação confirmada | Paginação por cursor confirmada; precisão de busca baixa |

## 3. Quem efetivamente exerceu a Presidência

| Signatário | Atos na amostra | Primeiro | Último |
|---|---|---|---|
| Dilma | 167 | 2013-01-23 | 2016-05-11 |
| Temer | 152 | 2013-09-04 | 2018-12-27 |
| Lewandowski | 3 | 2014-09-23 | 2014-09-24 |
| Rodrigo Maia | 6 | 2016-09-01 | 2017-01-10 |
| Bolsonaro | 231 | 2019-01-01 | 2022-12-29 |
| Mourão | 5 | 2019-06-27 | 2021-11-17 |
| Lula | 215 | 2023-01-01 | 2026-09-28 |
| Alckmin | 24 | 2023-04-12 | 2026-05-07 |


Regras de leitura: (1) a primeira data é a primeira data da amostra, não a posse; (2) atos de Temer antes de 12/05/2016 (21) são em exercício como vice; (3) a transição Dilma→Temer na amostra: último ato de Dilma em 2016-05-11, primeiro de Temer como presidente em 2016-05-30; (4) Rodrigo Maia assina em 2016-09-01 e 2017-01-10 como substituto. Prova independente (segunda fonte oficial, p.ex. Congresso/Planalto) **não** foi obtida: estado VERIFIED_DATASET com ressalva. Para bordas exatas: varrer os 5249 decretos e cruzar com atos de afastamento.

## 4. Quem efetivamente exerceu os governos estaduais

Não comprovado. Eleitos 2014/2018/2022 vêm do TSE (P5). Nenhum evento de posse, afastamento ou sucessão de governador foi verificado em ES, SP, MG, RJ ou PE. Evidência disponível: SP publica metadados de 254.060 normas com classe Executivo/Legislativo (sem signatário); BA publica decretos individuais com data do ato e do DOE, sem nome. Gate P6_STATE_OFFICE_HOLDING = NOT_EVALUATED. Caminho: parsear texto/PDF de decretos por UF e cruzar com atos da Assembleia sobre afastamentos.

## 5. Quem efetivamente exerceu as prefeituras

| Ciclo | UEs com suplementar eleita | Com eleito ordinário no ciclo (mandato interrompido) |
|---|---|---|
| 2012 | 111 | 110 |
| 2016 | 163 | 120 |
| 2020 | 106 | 36 |
| 2024 | 34 | 11 |


Evidência de exercício efetivo municipal: decretos com assinatura (Abdon Batista: prefeito identificado em 6/6 PDFs; Chapecó 3/3). Vitória, Alto Rio Novo, São Paulo e outros cinco municípios **não** foram fechados nesta rodada: só eleição (P5) e, para SC, atos. Candidaturas dos eleitos 2012/2016 trazem situação jurídica: 349 e 244 "deferido com recurso", 42 "substituto pendente" (2012), 4 "cassado com recurso" (2016): marcadores de risco, não prova de perda do mandato.

## 6. Posse, afastamento e sucessão

| Evento | Fonte testada | Estado |
|---|---|---|
| Candidatura, eleição, diplomação (parcial) | TSE | VERIFIED_DATASET |
| Posse | nenhuma nacional | NOT_EVALUATED |
| Exercício efetivo federal | assinatura de decretos | VERIFIED_DATASET |
| Substituição temporária federal | assinatura de substitutos | VERIFIED_DATASET |
| Licença/afastamento | não coletado | NOT_EVALUATED |
| Cassação/novo pleito municipal | TSE suplementar | VERIFIED_DATASET |
| Renúncia/falecimento | não coletado | NOT_EVALUATED |
| Encerramento ordinário | regra do calendário | INFERRED |

## 7. Extração de signatários federais

| Ano | Amostra | Assinatura extraída |
|---|---|---|
| 2013 | 60 | 57 |
| 2014 | 60 | 58 |
| 2015 | 60 | 54 |
| 2016 | 60 | 50 |
| 2017 | 60 | 52 |
| 2018 | 60 | 57 |
| 2019 | 60 | 58 |
| 2020 | 60 | 59 |
| 2021 | 60 | 59 |
| 2022 | 60 | 60 |
| 2023 | 60 | 60 |
| 2024 | 60 | 59 |
| 2025 | 60 | 60 |
| 2026 | 60 | 60 |


Totais: 840 amostrados, 803 extraídos (95.6%); assinaturas múltiplas: 0; flag de retificação/republicação: 1; sem assinatura recuperável: 37 (regex do bloco; revisar padrões de fim de página). 100% das páginas citam o DOU. Universo: 5249 DEC-n listados 2013–2026; decretos legislativos fora do escopo; decretos sem número não medidos.

## 8. Extração de signatários estaduais

SP (Alesp XML): Promulg E/L e IdTipo, sem signatário. BA (LegislaBahia): "O GOVERNADOR DO ESTADO DA BAHIA" no texto, sem nome; data do ato e de publicação no DOE em campos. Classe de atribuição máxima hoje: INSTITUTIONAL_EXECUTIVE_ACT / PUBLISHED_DURING_TERM. UFs restantes não testadas para 2020 e 2025.

## 9. Extração de signatários municipais

| Município | Decretos 2024 (categoria) | Assinante na página do ato | PDF original |
|---|---|---|---|
| Blumenau | 964 | 0/10 (só consórcio) | não testado |
| Chapecó | 2563 | 0/10 | 3/3: assinatura eletrônica SEI "Prefeito(a)" |
| Lages | 1451 | 0/10 | não testado |
| Abdon Batista | 167 | 10/10 (ICP-Brasil, CPF mascarado) | 6/6 "Nome, Prefeito Municipal" |


A assinatura do consórcio publicador não é do prefeito (regra de autoria). Classe: SIGNED_BY_PERSON só quando nome e cargo estão no documento; caso contrário PUBLISHED_DURING_TERM.

## 10. Matriz de diários oficiais municipais

| Plataforma | Municípios (IBGE) | Estado |
|---|---|---|
| DOM/SC | 293 | VERIFIED_DATASET |
| Instar | 111 | VERIFIED_DATASET |
| DOEM | 56 | BLOCKED |
| DOSP | 42 | VERIFIED_DATASET |
| ADiários v1 | 34 | VERIFIED_DATASET |
| MunicípioOnline | 26 | VERIFIED_DATASET |
| Atende v2 | 22 | VERIFIED_DATASET |
| DIOF | 21 | VERIFIED_DATASET |
| BarcoDigital | 12 | VERIFIED_DATASET |
| Siganet | 10 | VERIFIED_DATASET |
| DiarioOficialBR | 10 | VERIFIED_DATASET |
| Modernização | 6 | VERIFIED_DATASET |
| Dionet | 5 | VERIFIED_DATASET |
| ADiários v2 | 5 | VERIFIED_DATASET |
| Aplus | 4 | VERIFIED_DATASET |
| Dioenet | 4 | VERIFIED_DATASET |
| PTIO | 4 | VERIFIED_DATASET |
| AdministraçãoPública | 3 | VERIFIED_DATASET |


Não medidos por plataforma: primeiro ano, última publicação, periodicidade, API e direitos (exceto DOM/SC: 2008–2026, atos históricos 5,49 mi, busca por entidade/categoria/período, direitos não verificados). O número de spiders é indicador de conectores.

## 11. União de cobertura entre plataformas

União 731 municípios (13.1%): QD 440, DOM/SC 293, sobreposição 2. Plataformas quase disjuntas (exclusivos ≈ total em cada uma).

| Adaptadores | Sem DOEM | Com DOEM (bloqueado) |
|---|---|---|
| 1 | 293 | 293 |
| 3 | 446 | 460 |
| 5 | 506 | 536 |
| 10 | 581 | 625 |
| 20 | 618 | 670 |


Ordem gulosa sem DOEM: DOM/SC→293, BaseInstarSpider→404, BaseDospSpider→446, BaseAdiariosV1Spider→480, BaseMunicipioOnlineSpider→506, BaseAtendeV2Spider→528.

Por UF (cobertos/total, %): DF 1/1 (100%); SC 293/295 (99%); SE 29/75 (39%); RJ 33/92 (36%); AP 3/16 (19%); TO 26/139 (19%); SP 116/645 (18%); BA 72/417 (17%); MA 28/217 (13%); MS 10/79 (13%); RR 1/15 (7%); CE 13/184 (7%) ... AC e PI sem município. **Teto**: mesmo com 20 adaptadores o universo conhecido cobre ~11%; os outros ~89% exigem descoberta fora do QD (associações estaduais, consórcios).

## 12. Matriz de atos das 27 UFs

| UF | Portal candidato | Alcançável | Prova de ato 2020/2025 |
|---|---|---|---|
| AC | LEGIS :: Portal da Legislação do Estado do Acre | sim | NOT_EVALUATED |
| AL | Assembleia Legislativa de Alagoas | não (404) | NOT_EVALUATED |
| AM | ALEAM / Assembleia Legislativa do Estado do Amazonas | sim | NOT_EVALUATED |
| AP | Portal da Assembleia Legislativa do Estado do Amapá | sim | NOT_EVALUATED |
| BA | Início / Portal de Legislação do Estado da Bahia / Casa Civil | sim | SP: metadados; BA: decreto 2026 |
| CE | Principal | sim | NOT_EVALUATED |
| DF |  .:: SINJ-DF - Sistema Integrado de Normas Jurídicas do DF ::.  | sim | NOT_EVALUATED |
| ES | Diário Oficial / Home | sim | NOT_EVALUATED |
| GO | - | sim | NOT_EVALUATED |
| MA | - | não (000) | NOT_EVALUATED |
| MG | Dados Abertos - ALMG  | não (500) | NOT_EVALUATED |
| MS | - | sim | NOT_EVALUATED |
| MT |  Busca Legislação  | sim | NOT_EVALUATED |
| PA | 404 - File or directory not found. | não (404) | NOT_EVALUATED |
| PB | Legislação Cidadã - Assembleia Legislativa da Paraíba | sim | NOT_EVALUATED |
| PE |  Alepe Legis - Portal da Legislação Estadual de Pernambuco  | sim | NOT_EVALUATED |
| PI | SAPL - Assembleia Legislativa do Estado do Piauí | sim | NOT_EVALUATED |
| PR | Sistema Legislação | sim | NOT_EVALUATED |
| RJ | The resource cannot be found. | não (404) | NOT_EVALUATED |
| RN | - | não (000) | NOT_EVALUATED |
| RO | - | não (000) | NOT_EVALUATED |
| RR | Assembleia Legislativa do Estado de Roraima / ALE-RR | sim | NOT_EVALUATED |
| RS | Sistema Legis - Assembleia Gaúcha | sim | NOT_EVALUATED |
| SC | Legislação / Pesquisa da Legislação Estadual | sim | NOT_EVALUATED |
| SE | Principal - Assembleia Legislativa de Sergipe | sim | NOT_EVALUATED |
| SP | Alesp - Legislação Estadual | sim | SP: metadados; BA: decreto 2026 |
| TO | Assembleia Legislativa do Estado do Tocantins | sim | NOT_EVALUATED |


Cada UF tem estado explícito: alcançabilidade (VERIFIED), prova de ato (NOT_EVALUATED exceto SP e BA). Colunas Veto, Projeto do Executivo, Nomeação e API/arquivo: NOT_EVALUATED, exceto SP (arquivo XML, VERIFIED_DATASET) e BA (listagem paginada, VERIFIED). Home de CE e SP exibiram sinais de WAF/captcha: não contornados.

## 13. Nomeações e exonerações federais

DOU: paginação por cursor confirmada (página 2 sem sobreposição). A busca é fuzzy e domina por portarias de conselhos e tribunais; frases entre aspas retornam 0; não há filtro por espécie "Decreto". Alternativa estrutural: SIAPE Cadastro tem 39 ministros vigentes com ingresso e diploma. INLABS exige cadastro (BLOCKED). Cadeia nomeação→exercício→exoneração: 0 de 5 fechadas; ministros têm apenas ponto de início por snapshot.

## 14. Nomeações e exonerações estaduais

Não avaliadas (NOT_EVALUATED). BA publica decretos individuais, mas nomeação não foi medida.

## 15. Nomeações e exonerações municipais

| Município (2024) | Portarias | Leis | Decretos |
|---|---|---|---|
| Blumenau | 4153 | 202 | 964 |
| Chapecó | 682 | 284 | 2563 |
| Abdon Batista | 584 | 54 | 167 |
| Lages | 1111 | 52 | 1451 |


Abdon Batista, portarias com "nomear" 58 e "exonerar" 128 (busca textual). A categoria "Atos de Pessoal" não existe nos resultados (0). Taxonomia cargo comissionado/função/efetivo não separável por categoria: exige texto.

## 16. Estrutura histórica do Executivo federal

SIORG: hierarquia e versões (P5). Cargos: endpoints `cargo-funcao`, `alocados-estrutura` e `total-alocados-tipo` entregam quantitativos, não ocupantes. Ponte: SIAPE `COD_ORG_EXERCICIO`/`COD_UORG_EXERCICIO` ↔ SIORG (equivalência a validar). Comparação de versões e unidades extintas: não repetida nesta rodada.

## 17. Estrutura estadual e municipal

Não avaliada para UFs. Municipal: proxy por unidade orçamentária dos TCEs (P4); portais do ES e PE dos TCEs não responderam nesta rodada (RS e SP responderam). Não confundir unidade orçamentária com órgão.

## 18. Projetos de iniciativa do Executivo

Federal: autoria institucional (P5). Cadeia projeto→veto→lei só por parsing do texto da ementa do veto (PL de origem), exato em parte. Estadual e municipal: não fechado. Nunca converter em autoria pessoal.

## 19. Sanções, vetos e apreciações

| Ano | Vetos | Com norma gerada | Desfecho (campo siglaTipoDeliberacao) |
|---|---|---|---|
| 2013 | 57 | 40 | sem=21, MANTIDA_MATE=36 |
| 2014 | 36 | 26 | MANTIDA_MATE=35, PREJUDICADO=1 |
| 2015 | 64 | 47 | MANTIDA_MATE=57, MANTIDO_PARCIALMENTE=4, REJEITADO_PLENARIO=2, PREJUDICADO=1 |
| 2016 | 52 | 49 | MANTIDA_MATE=47, PREJUDICADO=1, MANTIDO_PARCIALMENTE=3, REJEITADO_PLENARIO=1 |
| 2017 | 50 | 44 | MANTIDA_MATE=41, REJEITADO_PLENARIO=7, MANTIDO_PARCIALMENTE=1, PREJUDICADO=1 |
| 2018 | 42 | 42 | MANTIDA_MATE=32, MANTIDO_PARCIALMENTE=5, REJEITADO_PLENARIO=4, PREJUDICADO=1 |
| 2019 | 62 | 49 | MANTIDA_MATE=41, MANTIDO_PARCIALMENTE=8, REJEITADO_PLENARIO=13 |
| 2020 | 59 | 53 | REJEITADO_PLENARIO=9, MANTIDA_MATE=39, MANTIDO_PARCIALMENTE=11 |
| 2021 | 73 | 68 | REJEITADO_PLENARIO=27, MANTIDO_PARCIALMENTE=12, MANTIDA_MATE=32, PREJUDICADO=2 |
| 2022 | 65 | 59 | REJEITADO_PLENARIO=22, MANTIDA_MATE=29, MANTIDO_PARCIALMENTE=12, PREJUDICADO=1, sem=1 |
| 2023 | 49 | 47 | MANTIDO_PARCIALMENTE=18, MANTIDA_MATE=14, PREJUDICADO=2, sem=4, REJEITADO_PLENARIO=11 |
| 2024 | 50 | 46 | MANTIDO_PARCIALMENTE=4, MANTIDA_MATE=25, REJEITADO_PLENARIO=6, sem=15 |
| 2025 | 51 | 44 | sem=38, REJEITADO_PLENARIO=3, PREJUDICADO=3, MANTIDO_PARCIALMENTE=3, MANTIDA_MATE=4 |
| 2026 | 55 | 46 | sem=54, REJEITADO_PLENARIO=1 |


Total 765; desfechos: MANTIDA_MATE=432, SEM_DELIBERACAO=133, REJEITADO_PLENARIO=106, MANTIDO_PARCIALMENTE=81, PREJUDICADO=13. Vetos de 2025–2026 ainda tramitam. Dispositivos vetados e votações por dispositivo não foram medidos. Diferenciar mensagem, dispositivo e votação no modelo.

## 20. Custos institucionais e gabinetes

Menor unidade isolável comprovada: Gabinete da Vice-Presidência (366 viagens como órgão solicitante) e a Presidência como órgão superior. Pessoa: NOT_ATTRIBUTABLE. Estaduais (ES/SP/MG/RJ/PE) e municipais não retestados. Matriz de dupla contagem: não montada nesta rodada; regra: somar apenas folhas disjuntas da hierarquia (Presidência ⊃ vinculadas ⊃ Vice).

## 21. Servidores e cargos comissionados

Sem nova medição além da P5 (140.288 vínculos com função não são todos de livre nomeação). Ministros: 39 por cargo MINISTRO DE ESTADO (SITUACAO_VINCULO NATUREZA ESPECIAL). Histórico mensal não verificado.

## 22. Viagens, cartões e agendas

Presidência 2025: 11380 viagens; 11341 com pagamento; valores coincidentes 11049, divergentes 292; não realizadas 263. Tipos de pagamento: diárias, passagem, seguro. CPGF: sigilo ~96% na Presidência preservado. Agenda: NOT_EVALUATED.

## 23. Relacionamentos comprovados

| ID | A | B | Classe | Base | Estado |
|---|---|---|---|---|---|
| R6-01 | viagem | pagamento | EXACT | Identificador do processo de viagem | VERIFIED_DATASET |
| R6-02 | veto | lei/norma gerada | EXACT | normaGerada no processo VET | VERIFIED_API |
| R6-03 | veto | deliberação do Congresso | EXACT | siglaTipoDeliberacao e dataDeliberacao | VERIFIED_API |
| R6-04 | ministro (cargo) | ocupante e órgão | HIGH_CONFIDENCE | SIAPE: cargo MINISTRO DE ESTADO, COD_ORG_EXERCICIO, DATA_INGRESSO_CARGOFUNCAO, diploma DECRETO | VERIFIED_DATASET |
| R6-05 | decreto federal | signatário | EXACT | bloco de assinatura Planalto | VERIFIED_DATASET |
| R6-06 | mandato municipal ordinário | interrupção por eleição suplementar | EXACT | TSE: suplementar eleita na mesma SG_UE do ciclo | VERIFIED_DATASET |
| R6-07 | ato municipal | tipo Decretos | EXACT | categoria estruturada DOM/SC | VERIFIED_API |
| R6-08 | decreto municipal | prefeito signatário | HIGH_CONFIDENCE | PDF: nome + "Prefeito Municipal" ou assinatura ICP/SEI | VERIFIED_DATASET |
| R6-09 | norma estadual | classe institucional Executivo/Legislativo | INSTITUTIONAL_ONLY | SP Promulg E/L; BA "O GOVERNADOR" | VERIFIED_DATASET |
| R6-10 | unidade SIORG | ministro | UNLINKED | SIORG sem ocupante | VERIFIED_API |
| R6-11 | proposição do Executivo | presidente | TEMPORAL_ONLY | autoria institucional | INFERRED |
| R6-12 | município | plataforma de diário | EXACT | IBGE no spider QD / entidade DOM/SC | VERIFIED_DATASET |
| R6-13 | nomeação/exoneração federal | ministro | UNLINKED | DOU busca fuzzy; INLABS bloqueado | BLOCKED |
| R6-14 | substituição presidencial | decreto do substituto | HIGH_CONFIDENCE | signatário diferente do titular na data | VERIFIED_DATASET |

## 24. Modelo canônico de identidade e temporalidade

Entidades: PERSON, CANDIDACY, ELECTION_RESULT, ELECTORAL_MANDATE, OFFICE, OFFICE_HOLDING_PERIOD, OFFICE_HOLDING_EVENT, GOVERNMENT_BODY, GOVERNMENT_UNIT, ORGANIZATIONAL_VERSION, POSITION, APPOINTMENT, DISMISSAL, NORMATIVE_ACT, ACT_SIGNATORY, EXECUTIVE_INITIATIVE, LEGISLATIVE_PROPOSITION, SANCTION, VETO, OFFICIAL_PUBLICATION, INSTITUTIONAL_EXPENDITURE, TRAVEL_RECORD, CARD_TRANSACTION. Mapeamento ao Postgres existente (apenas leitura de `migrations.ts`): people, mandates, exercise_periods, candidacies, elections cobrem as primeiras entidades; atos, assinatura, vetos, viagens e custos exigiriam tabelas novas. **Não validado em código nesta rodada.** Chaves: IK6-PERSON=hash(título), IK6-MANDATE=eleição+SG_UE+cargo+turno, IK6-HOLDING=pessoa+cargo+ente+início+fonte, IK6-ACT-FED=tipo+número+ano, IK6-ACT-DOMSC=código do ato DOM/SC, IK6-VIAGEM=Identificador do processo de viagem, IK6-VET=VET numero/ano + id processo Senado, IK6-MUN=IBGE 7 dígitos. Contrato temporal: data_inicio, data_fim, data_publicacao, data_efeito, fonte, confianca, motivo_encerramento, evidencia. Classes de atribuição: SIGNED_BY_PERSON, ISSUED_BY_AUTHORITY, DELEGATED_SIGNATURE, INSTITUTIONAL_EXECUTIVE_ACT, PUBLISHED_DURING_TERM, NOT_ATTRIBUTABLE, CONFLICT.

## 25. Cobertura histórica

| Fonte | Período verificado | Observação |
|---|---|---|
| TSE prefeitos | 2012–2024 | 4 ciclos |
| Decretos federais | 2013–2026 | amostra 60/ano; 5249 listados |
| Vetos | 2013–2026 | universo completo |
| Viagens | 2025 | um ano |
| SIAPE | 2026-07 | histórico negado |
| DOM/SC | 2008–2026 | por entidade |
| SP normas | 1836–2026 | metadados |

## 26. Cobertura territorial

Municipal documentos: 731/5571 (13.1%). SC 293/295. Estadual: 20/27 portais alcançáveis, 2 com prova de ato. Federal: completo para decretos numerados e vetos.

## 27. Estratégia de collectors

| ID | Nome | Reuso | Viab. | Cenário |
|---|---|---|---|---|
| CF6-A | Roster e mandatos TSE (executivos) | apps/collector/src/elections.ts; migrations mandates/exercise_periods | READY_FOR_CONTRACT | A |
| CF6-B1 | Atos federais Senado+Planalto (assinatura) | novo | READY_FOR_CONTRACT | B |
| CF6-B2 | Vetos Senado (ciclo de vida) | novo | READY_FOR_CONTRACT | B |
| CF6-B3 | Ministros SIAPE por snapshot mensal | national-finance-registry (P3) | NEEDS_VALIDATION | B |
| CF6-B4 | Viagens e pagamentos | national-finance-registry | READY_FOR_CONTRACT | B |
| CF6-C | Normas estaduais (Alesp XML; BA; demais por portal) | state/providers | NEEDS_VALIDATION | C |
| CF6-D1 | DOM/SC por categoria | state/providers (padrão) | READY_FOR_CONTRACT | D |
| CF6-D2 | Instar/DOSP/ADiários (plataformas) | - | NEEDS_VALIDATION | D |
| CF6-E | DOU por cursor (nomeações) | - | NEEDS_VALIDATION | B |

## 28. Volume e custos operacionais

| Cenário | Cobertura | Volume | Lacunas |
|---|---|---|---|
| OS6-A Identidade e roster | prefeitos 2012-2024 (5.5 mil por ciclo); governadores/presidente 2014-2022 | MB | exercício |
| OS6-B Atuação federal | 5249 decretos 2013-2026; 765 vetos; viagens 2025 | ~14 mil páginas Planalto por varredura completa; 1 req/decreto | nomeações (INLABS), agendas |
| OS6-C Atuação estadual | SP completo (metadados); BA decretos individuais; 20/27 portais alcançáveis | variável | assinatura, nomeações |
| OS6-D Atuação municipal | 731 municípios (13.1%) com conector documentado | DOM/SC 5,49 mi atos | 5.4 mil municípios sem fonte comprovada |
| OS6-E Cobertura ampliada | adaptadores incrementais | - | teto 618-670 com 20 adaptadores no universo conhecido |

## 29. Oportunidades adicionais

1) Linha da Presidência por assinatura, com marca de substituto (nova, comprovada). 2) Mapa de interrupções municipais por suplementar. 3) Viagem↔pagamento por processo. 4) Desfecho de vetos por ano. 5) Ministros vigentes com órgão e data via SIAPE. 6) Taxa de substituição por ano (atos assinados por substitutos). Interpretação de desempenho: fora de escopo.

## 30. Matriz de prontidão para produto

| ID | Experiência | Viabilidade | Evidência |
|---|---|---|---|
| PO6-01 | Histórico de prefeitos eleitos | READY_FOR_CONTRACT | VERIFIED_DATASET |
| PO6-02 | Histórico de prefeitos em exercício | DISCOVERY_ONLY | INFERRED |
| PO6-03 | Linha do tempo da Presidência por signatário | NEEDS_VALIDATION | VERIFIED_DATASET |
| PO6-04 | Fotos de candidaturas | READY_FOR_CONTRACT | VERIFIED_DATASET |
| PO6-05 | Decretos assinados (federal) | READY_FOR_CONTRACT | VERIFIED_DATASET |
| PO6-06 | Decretos municipais SC | NEEDS_VALIDATION | VERIFIED_API |
| PO6-07 | Leis sancionadas | NEEDS_VALIDATION | VERIFIED_API |
| PO6-08 | Vetos e desfecho | READY_FOR_CONTRACT | VERIFIED_API |
| PO6-09 | Medidas provisórias | READY_FOR_CONTRACT | VERIFIED_API |
| PO6-10 | Ministros por período | NEEDS_VALIDATION | VERIFIED_DATASET |
| PO6-11 | Organograma histórico | NEEDS_VALIDATION | VERIFIED_API |
| PO6-12 | Nomeações/exonerações | BLOCKED | BLOCKED |
| PO6-13 | Cargos comissionados (agregado) | NEEDS_VALIDATION | VERIFIED_DATASET |
| PO6-14 | Custo institucional do gabinete | NEEDS_VALIDATION | VERIFIED_DATASET |
| PO6-15 | Viagens oficiais e pagamento | READY_FOR_CONTRACT | VERIFIED_DATASET |
| PO6-16 | Agendas oficiais | DISCOVERY_ONLY | NOT_EVALUATED |

## 31. Bloqueios

| ID | Bloqueio | Impacto | Ação |
|---|---|---|---|
| B6-1 | INLABS: cadastro | nomeações em massa | cadastro legítimo pelo responsável |
| B6-2 | Busca pública do DOU é fuzzy e sem filtro de espécie | precisão insuficiente para nomeações | usar INLABS ou extração por edição |
| B6-3 | Portal da Transparência negou downloads nesta rodada (AccessDenied) | histórico mensal SIAPE 2013-2025 não verificado | repetir mais tarde, sem contornar |
| B6-4 | ALMG dados abertos 500 | MG | reavaliar endpoint |
| B6-5 | Sem fonte nacional de posse/afastamento | exercício estadual e municipal | diários por esfera |
| B6-6 | 5.4 mil municípios sem fonte comprovada | cobertura nacional | descoberta de provedores fora do QD |
| B6-7 | LexML, DOEM, Leis Municipais, CR2 | parte dos municípios | manter bloqueio |

## 32. Experimentos seguintes

1) Varrer os 5.249 decretos (assinatura + fim de página) e detectar bordas exatas. 2) Obter credencial INLABS legítima e medir Seção 2. 3) Tentar novamente histórico SIAPE 2013–2025 e montar linha de ministros. 4) Parsear PDF de decretos de BA/SP/MG/RJ/PE/ES para signatário e testar afastamentos. 5) Descobrir provedores municipais fora do QD (associações estaduais). 6) Testar Instar e DOSP com um município cada, categoria de decretos. 7) Mapear SIAPE↔SIORG por código de órgão.

## 33. Gates

| Gate | Estado | Motivo |
|---|---|---|
| P6_FEDERAL_OFFICE_HOLDING | PASS_WITH_CAVEATS | linha 2013-2026 derivada de assinaturas; sem ato de afastamento/posse |
| P6_STATE_OFFICE_HOLDING | NOT_EVALUATED | nenhum evento de exercício estadual verificado em ES/SP/MG/RJ/PE |
| P6_MUNICIPAL_OFFICE_HOLDING | PARTIAL | interrupções por suplementar (TSE) comprovadas; posse e sucessão interina sem fonte |
| P6_SUCCESSION_EVENTS | PARTIAL | federal por assinatura; municipal por suplementar; estadual ausente |
| P6_SIGNATORY_EXTRACTION_FEDERAL | PASS | 803/840 (95.6%) em amostra de 14 anos |
| P6_SIGNATORY_EXTRACTION_STATE | PARTIAL | BA e SP sem nome do signatário nos dados estruturados; só classe institucional |
| P6_SIGNATORY_EXTRACTION_MUNICIPAL | PARTIAL | PDF 9/9; página 10/40; amostra de 4 municípios de SC |
| P6_MUNICIPAL_GAZETTE_PROVIDERS | PASS_WITH_CAVEATS | 18 plataformas medidas em municípios cobertos |
| P6_MUNICIPAL_COVERAGE_UNION | PASS | união 731 (13.1%) deduplicada por IBGE |
| P6_STATE_NORMATIVE_COVERAGE | PARTIAL | 20 portais alcançáveis; SP e BA com prova de ato; demais sem teste de 2020/2025 |
| P6_FEDERAL_APPOINTMENTS | PARTIAL | SIAPE dá 39 ministros vigentes; DOU paginável mas impreciso; INLABS bloqueado |
| P6_STATE_APPOINTMENTS | NOT_EVALUATED | não testado |
| P6_MUNICIPAL_APPOINTMENTS | PARTIAL | portarias existem no DOM/SC; tipo só por texto |
| P6_GOVERNMENT_STRUCTURE_LINKAGE | PARTIAL | SIORG sem ocupante; ponte via SIAPE a validar |
| P6_EXECUTIVE_LEGISLATIVE_LINKAGE | PARTIAL | veto->lei comprovado; projeto->veto por parsing; estadual/municipal não |
| P6_VETO_LIFECYCLE | PASS_WITH_CAVEATS | 765 vetos, desfecho e norma; dispositivos/votações não medidos |
| P6_INSTITUTIONAL_COST | PARTIAL | unidade mínima = Vice-Presidência; estaduais não testados |
| P6_GOVERNMENT_WORKFORCE | PARTIAL | P5 mantida; sem nova prova de histórico |
| P6_TRAVEL_EXPENSE_LINKAGE | PASS | 99.66% das viagens da Presidência com pagamento; valores iguais em 97,4% |
| P6_OFFICIAL_AGENDA_LINKAGE | NOT_EVALUATED | agendas não coletadas |
| P6_CANONICAL_IDENTITY | PASS_WITH_CAVEATS | chaves definidas; IK6-HOLDING ainda não materializada |
| P6_TEMPORAL_CONTRACT | PASS_WITH_CAVEATS | contrato definido; reuso de exercise_periods não validado em código |
| P6_COLLECTOR_FEASIBILITY | PASS_WITH_CAVEATS | 9 famílias; 4 prontas para contrato |
| P6_PRODUCT_READINESS | PARTIAL | 6 de 16 experiências prontas ou próximas |

## 34. Inventário de evidências

- p5/cand_*.zip
- p6/fed2.json (840 decretos)
- p6/vet_all.json
- p6/viag2.json
- p6/union.json
- p6/greedy.json
- p6/tse6.json
- p6/testD2.json
- p6/sig_dom.json
- p6/nom.json
- p6/state_probe.json
- p6/alesp_tipos.json
- p6/dou*.py (paginação)
- p6/pdf/ (9 decretos SC)
- p5/siape202607.zip
- p5/pt_viagens_2025.zip
- p5/alesp_normas.zip
- p6/ibge.json

### Respostas A–O

|  | Resposta |
|---|---|
| A | Presidência desde 2013: sim por signatário (amostra de 60 atos/ano), com substitutos; ainda sem ato de posse/afastamento. |
| B | Governadores em exercício: 0 estados fechados. |
| C | Prefeitos: interrupções por suplementar conhecidas (110/120/36/11); exercício real fechado só em SC por assinatura (Abdon Batista, Chapecó). |
| D | Atos federais com signatário: 95.6% da amostra; universo 5249. |
| E | Estadual: classe institucional (SP, BA); municipal: PDF 9/9, página 10/40, só SC. |
| F | 731 municípios (13.1%). |
| G | Fontes estruturadas de legislação: SP (XML) e BA (listagem); 20 portais alcançáveis; nomeações: nenhuma. |
| H | Não; só início de ministros vigentes via SIAPE. |
| I | Parcialmente: SIORG não tem ocupante; SIAPE tem órgão, sem validação do código. |
| J | Sim para veto→lei e desfecho; projeto→veto por parsing. |
| K | Gabinete da Vice-Presidência / Presidência (órgão). |
| L | Sim: Presidência 2025, 99,66% via identificador do processo de viagem. |
| M | Prontas: roster TSE, fotos, vetos, viagens/pagamento, decretos federais. |
| N | Plataformas compartilhadas por adaptador, começando por DOM/SC e Instar; descoberta de provedores fora do QD. |
| O | Comprovou: linha presidencial por signatário, substitutos, ciclo do veto, viagem→pagamento, categoria DOM/SC, união 13,1%, ponte SIAPE para ministros. |
