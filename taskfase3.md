# Fase 3 ââ‚¬â€ eleições e gabinetes completos

Referências: [intention3.md](intention3.md), [intention2.md](intention2.md), [taskfase2.md](taskfase2.md), [plan.md](plan.md) e [tasks.md](tasks.md).

## Estado atual e regra de execução

- Estado: **blocos A e B concluídos; F3-016 é a próxima tarefa**.
- Objetivo: publicar no frontend os dados eleitorais locais de 2018/2022 e ampliar a cobertura de gabinetes do Senado e da Câmara, preservando a arquitetura visual e metodológica da Fase 2.
- O SQLite atual já possui contratos e publicação eleitoral, custos expandidos, perfil parlamentar unificado e estados `available`, `partial`, `unavailable` e `stale`. Esta fase deve evoluir essas estruturas em vez de criar um segundo caminho de dados.
- Os CSVs do TSE informados em `intention3.md` são entradas locais externas ao repositório. Nunca copiá-los para Git; registrar somente hash, tamanho, cabeçalho, origem oficial, instante de importação e diagnóstico.
- Os arquivos disponíveis cobrem candidaturas, informações complementares e bens. Receitas e despesas de campanha continuam indisponíveis até a inclusão de arquivos oficiais próprios.
- Vínculo eleitoral exige evidência composta. Nome isolado nunca confirma uma pessoa; conflito ou duplicidade permanece `pending` ou `ambiguous`.
- Funcionários da Câmara e do Senado são snapshots. Data de nomeação/admissão não transforma o arquivo atual em histórico de permanência.
- Nome, cargo, função e lotação podem ser exibidos por serem dados funcionais oficiais. Evitar documento pessoal, contato, endereço, salário líquido ou qualquer campo sem função pública para a tela.
- Verba de gabinete, remuneração, benefícios, encargos, CEAP/CEAPS e subsídio parlamentar são rubricas diferentes. Não somar parcelas sobrepostas nem chamar resultado parcial de custo total.
- Toda tabela, KPI e gráfico deve mostrar Casa, competência/período, universo, cobertura, fonte e lote. Ausência não vira zero.
- URLs HTML por parlamentar são fontes frágeis: antes de coletar em escala, identificar contrato, limites, resposta vazia e alternativa oficial estruturada.
- Cada tarefa só é marcada após implementação e evidência. Uma fonte inviável bloqueia apenas o módulo dependente.

## Entradas previstas

| Conjunto | Ano/competência | Entrada inicial | Uso permitido |
| --- | --- | --- | --- |
| Candidaturas TSE | 2022 | `consulta_cand_2022_BRASIL.csv` | candidatura, cargo, partido, UF, resultado e situação oficial |
| Complemento TSE | 2022 | `consulta_cand_complementar_2022_BRASIL.csv` | atributos complementares documentados após auditoria |
| Bens TSE | 2022 | `bem_candidato_2022_BRASIL.csv` | bens declarados e versões/ordem disponíveis |
| Candidaturas TSE | 2018 | `consulta_cand_2018_BRASIL.csv` | candidatura, cargo, partido, UF, resultado e situação oficial |
| Bens TSE | 2018 | `bem_candidato_2018_BRASIL.csv` | bens declarados e versões/ordem disponíveis |
| Funcionários da Câmara | snapshot diário | `https://dadosabertos.camara.leg.br/arquivos/funcionarios/csv/funcionarios.csv` | equipe ativa, lotação, cargo, função e nomeação |
| Verba de gabinete da Câmara | mês/ano | `https://www.camara.leg.br/deputados/{ID}/verba-gabinete?ano={ANO}` | limite publicado e valor gasto por mês, após validar o contrato da fonte |
| Pessoal do Senado | snapshot/ano | `https://www6g.senado.leg.br/transparencia/sen/{ID}/pessoal/?ano={ANO}&local=gabinete` e dados abertos administrativos | equipe por vínculo, lotação, cargo e função |
| Remuneração do Senado | competência | CSV oficial de servidores ativos/remuneração | remuneração funcional agregada com cobertura e rubricas separadas |

Os caminhos absolutos completos dos cinco arquivos TSE permanecem registrados em [intention3.md](intention3.md). A CLI deverá recebê-los por `--file`; nenhum caminho de máquina será hardcoded.

## A. Auditoria das fontes e contratos

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-001 | ââ‚¬â€ | Inventariar o esquema dos cinco CSVs TSE locais | Encoding, separador, cabeçalhos, contagens, anos, cargos, chaves, versões e hashes registrados sem alterar os arquivos |
| [x] | F3-002 | F3-001 | Documentar os conjuntos TSE 2018/2022 | Fonte oficial, significado dos campos usados, diferenças entre anos e campos ignorados registrados em `docs/sources/tse-local-2018-2022.md` |
| [x] | F3-003 | ââ‚¬â€ | Auditar o CSV diário de funcionários da Câmara | Status, encoding, cabeçalho, tamanho, chave, lotação, cargos e caráter de snapshot comprovados por resposta arquivada |
| [x] | F3-004 | ââ‚¬â€ | Auditar a fonte mensal de verba de gabinete da Câmara | Contrato real, meses, moeda, limite, gasto, respostas ausentes, rate limit e alternativa estruturada documentados; exemplo não vira regra global |
| [x] | F3-005 | ââ‚¬â€ | Auditar pessoal e remuneração do Senado | Fontes oficiais, IDs, categorias de vínculo, competência, rubricas e relação com gabinete documentadas |
| [x] | F3-006 | F3-001, F3-003, F3-004, F3-005 | Criar matriz tela Ã— campo Ã— fonte Ã— período | Cada dado pretendido possui origem, granularidade, cobertura, chave de vínculo e fallback explícitos |
| [x] | F3-007 | F3-006 | Definir política de exposição de pessoal | Campos funcionais publicáveis e campos excluídos registrados; frontend não expõe documento, contato ou dado pessoal sem finalidade pública |
| [x] | F3-008 | F3-006 | Definir vocabulário financeiro de gabinete | Limite, gasto, remuneração bruta, benefício, indenização, encargo, cota e subsídio permanecem conceitos separados |

## B. Modelo de dados, lotes e auditoria

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-009 | F3-002 | Revisar contratos eleitorais existentes | `Candidacy`, `ElectoralAsset` e cobertura suportam os campos auditados e preservam valor em centavos, versão e origem |
| [x] | F3-010 | F3-003, F3-005, F3-007 | Definir contratos de pessoa funcional e lotação | Casa, identificador funcional, nome, vínculo, cargo, função, unidade, admissão/nomeação e snapshot tipados com nulabilidade explícita |
| [x] | F3-011 | F3-004, F3-008 | Definir contrato `CabinetMonthlyBudget` | Deputado, ano, mês, limite, gasto e percentual derivado separados; quantidade da equipe vem do snapshot identificado |
| [x] | F3-012 | F3-010, F3-011 | Criar migrações para snapshots, lotações e verba mensal | Chaves impedem duplicidade; lote, origem e competência são obrigatórios; banco existente migra sem perda |
| [x] | F3-013 | F3-012 | Criar publicação ativa por fonte e recorte | Nova publicação troca ponteiro de forma atômica; lote anterior e bruto permanecem auditáveis |
| [x] | F3-014 | F3-013 | Definir validade e estado `stale` dos snapshots | Interface distingue snapshot vigente, desatualizado, parcial e ausente usando limite documentado por fonte |
| [x] | F3-015 | F3-009, F3-012 | Criar invariantes de integridade cruzada | Bem órfão, funcionário sem lote, mês inválido, centavo impreciso e vínculo ambíguo são rejeitados ou isolados |

## C. Importação eleitoral do TSE

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-016 | F3-001, F3-009 | Implementar leitor CSV TSE com encoding detectado | Arquivos grandes são processados sem carregar tudo desnecessariamente; cabeçalho divergente falha com diagnóstico |
| [x] | F3-017 | F3-002, F3-016 | Adaptar parser de candidaturas para 2018 e 2022 | Chave `SQ_CANDIDATO`, eleição, turno, cargo, UF, nomes, partido, número, votos e resultado literal preservados quando presentes |
| [x] | F3-018 | F3-002, F3-016 | Adaptar parser de bens para 2018 e 2022 | Ordem/chave, tipo, descrição, valor em centavos e versão preservados; bem sem candidatura é diagnosticado |
| [x] | F3-019 | F3-002, F3-016 | Importar complemento de candidatura de 2022 | Somente campos documentados entram; ausência do equivalente de 2018 gera cobertura parcial, não inferência |
| [x] | F3-020 | F3-017 | Evoluir o vínculo candidatura–pessoa | Nome completo/urna normalizado, UF, cargo/Casa, partido no período e identificadores disponíveis compõem evidência; conflitos ficam revisáveis |
| [x] | F3-021 | F3-020 | Criar relatório de vínculos eleitorais | Confirmados, pendentes, ambíguos e não encontrados têm contagem e evidências; nenhuma confirmação depende só de nome |
| [x] | F3-022 | F3-015, F3-017, F3-018, F3-019, F3-021 | Publicar lotes TSE de 2018 e 2022 | Candidaturas e bens reconciliam com os CSVs; publicação é transacional, idempotente e mantém bruto/hash |
| [x] | F3-023 | F3-022 | Criar comandos CLI para importação TSE local | Ano, arquivos e escopo são argumentos; `--dry-run` valida sem publicar e caminhos locais não aparecem no código |
| [x] | F3-024 | F3-022 | Manter contas de campanha com cobertura correta | Receitas/despesas permanecem `unavailable` sem arquivos próprios; candidatura e bens continuam publicáveis |

## D. Equipes e verba de gabinete da Câmara

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-025 | F3-003, F3-010 | Implementar coleta e parser de funcionários da Câmara | CSV bruto arquivado; campos funcionais normalizados sem inventar histórico |
| [x] | F3-026 | F3-025 | Resolver lotação para deputado | ID oficial ou regra documentada vincula gabinete; unidade genérica, liderança e comissão não são atribuídas a deputado |
| [x] | F3-027 | F3-026 | Gerar relatório de lotações da Câmara | Vinculados, não vinculados, ambíguos e unidades ignoradas têm contagens e exemplos revisáveis |
| [x] | F3-028 | F3-013, F3-027 | Publicar snapshot de equipe da Câmara | Quantidade e lista por deputado reconciliam com linhas elegíveis; snapshot e atualização aparecem na cobertura |
| [x] | F3-029 | F3-004, F3-011 | Implementar coletor de verba por deputado/ano | Meses são lidos com valores monetários exatos; HTML alterado, captcha, vazio e indisponibilidade não viram gasto zero |
| [x] | F3-030 | F3-029 | Aplicar limites de concorrência, cache e retomada | Coleta respeita a fonte, reutiliza bruto válido e pode retomar sem duplicar parlamentares/meses |
| [x] | F3-031 | F3-015, F3-030 | Reconciliar verba mensal da Câmara | Soma de meses, limites e gastos batem com a fonte; percentual é calculado apenas com denominador válido |
| [x] | F3-032 | F3-013, F3-031 | Publicar verba mensal da Câmara | Lote por ano é atômico; meses ausentes ficam nulos e notas registram 13º, férias e auxílio fora da verba quando confirmado pela fonte |
| [x] | F3-033 | F3-028, F3-032 | Criar CLI de atualização de gabinete da Câmara | Comandos separados para snapshot de pessoal e série de verba suportam `--dry-run`, recorte e resumo de reconciliação |

## E. Equipes e remuneração de gabinete do Senado

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-034 | F3-005, F3-010 | Implementar parser da base ativa de pessoal do Senado | Efetivos, comissionados, terceirizados e estagiários preservam categoria literal, cargo, função, lotação e snapshot |
| [x] | F3-035 | F3-034 | Resolver lotação para senador | Gabinete, liderança, comissão e unidade administrativa permanecem distintos; associação usa identificador ou regra auditada |
| [x] | F3-036 | F3-035 | Reconciliar páginas individuais e base consolidada | Amostra por senador confere nomes e categorias; divergências recebem nota e não são silenciosamente mescladas |
| [x] | F3-037 | F3-013, F3-036 | Publicar snapshot detalhado de equipe do Senado | Categorias e total reconciliam; cobertura mostra data e diferenças entre fontes |
| [x] | F3-038 | F3-005, F3-008 | Evoluir parser de remuneração do Senado | Rubricas são mantidas separadas, registros duplicados e folhas extraordinárias são identificados, competência é obrigatória |
| [x] | F3-039 | F3-038 | Vincular remuneração à pessoa funcional e ao gabinete | Vínculo usa identificador estável quando disponível; nome isolado produz pendência, nunca confirmação automática |
| [x] | F3-040 | F3-015, F3-039 | Reconciliar folha por gabinete | Total agregado explica rubricas incluídas, excluídas, duplicidades e quantidade de registros; amostra confere com CSV oficial |
| [x] | F3-041 | F3-013, F3-040 | Publicar folha detalhada do Senado | Competência ativa é substituída atomicamente; nome/cargo/função podem ser consultados sem expor campos excluídos |
| [x] | F3-042 | F3-037, F3-041 | Unificar CLI de gabinete do Senado | Snapshot de equipe e remuneração aceitam fontes distintas, `--dry-run` e relatório de correspondência |

## F. Consultas para o frontend

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-043 | F3-022 | Criar consulta eleitoral por pessoa | Retorna eleições em ordem temporal, candidatura, resultado, votos e bens com cobertura independente de contas de campanha |
| [x] | F3-044 | F3-043 | Criar comparação patrimonial temporal segura | Total declarado por eleição usa apenas vínculos confirmados e valores disponíveis; variação não é chamada de enriquecimento |
| [x] | F3-045 | F3-028, F3-037 | Criar consulta de composição do gabinete | Total e categorias usam um único snapshot por Casa; lista nominal conserva cargo, função, vínculo e fonte |
| [x] | F3-046 | F3-032 | Criar consulta mensal de verba da Câmara | Limite, gasto e percentual por mês preservam nulos e cobertura; total anual usa somente meses publicados |
| [x] | F3-047 | F3-041 | Criar consulta de folha do Senado | Total por competência e decomposição por rubrica/pessoa evitam dupla contagem e deixam exclusões explícitas |
| [x] | F3-048 | F3-045, F3-046, F3-047 | Criar panorama de gabinete por Casa | Medianas usam competência e universo iguais; Câmara e Senado não são comparados quando conceitos divergem |
| [x] | F3-049 | F3-043, F3-045 | Integrar consultas ao adaptador `apps/web/lib/data.ts` | Falha de banco/fonte produz estado indisponível; páginas não acessam SQLite diretamente |

## G. Adaptação visual do perfil parlamentar

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-050 | F3-043, F3-044, F3-049 | Popular “Eleições e patrimônioââ‚¬ | Cards mostram eleição, cargo, situação, votos e total de bens; tabela detalha bens e contas ausentes ficam explicitamente indisponíveis |
| [x] | F3-051 | F3-050 | Criar evolução patrimonial entre pleitos | Gráfico/tabela usa valores declarados por eleição, informa moeda/período e não atribui causalidade ou ganho patrimonial |
| [x] | F3-052 | F3-045, F3-049 | Popular composição atual do gabinete | Total, categorias e lista nominal aparecem com data do snapshot, busca simples e alternativa móvel acessível |
| [x] | F3-053 | F3-046, F3-049 | Criar série de verba de gabinete da Câmara | Limite e gasto mensal aparecem como séries separadas; percentual só existe com ambos os valores |
| [x] | F3-054 | F3-047, F3-049 | Detalhar folha de gabinete do Senado | Competência, equipe elegível, rubricas incluídas e total identificado aparecem sem chamar parcela de custo completo |
| [x] | F3-055 | F3-052, F3-053, F3-054 | Criar `CabinetBreakdown` compartilhado | Composição, gasto/verba e fonte usam a mesma hierarquia visual; diferenças por Casa entram por configuração |
| [x] | F3-056 | F3-050, F3-055 | Atualizar navegação e estados das seções do perfil | Âncoras, headings, cobertura parcial, vazio e erro preservam o padrão da Fase 2 |

## H. Listagens, estados e comparação

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-057 | F3-048 | Popular indicadores de gabinete nas listagens por Casa | Quantidade e métrica financeira mostram competência e amostra; nulos continuam depois dos valores observados |
| [x] | F3-058 | F3-048 | Atualizar panorama estadual | Gabinete estadual agrega apenas métricas conceitualmente iguais e usa o mesmo snapshot/competência |
| [x] | F3-059 | F3-048 | Evoluir dimensão “Gabinete” em `/comparar` | Pessoas da mesma Casa e período podem comparar composição e a métrica financeira própria; nenhuma nota geral |
| [x] | F3-060 | F3-043 | Expor filtros eleitorais somente onde comparáveis | Ano, cargo e resultado usam valores oficiais; ausência de cobertura de campanha não remove candidatura/bens |

## I. Proposições e detalhamento de votações

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-061 | F3-049 | Auditar cobertura publicável de proposições | Câmara e Senado têm campos, anos, escopos e lotes inventariados; ausência de tema, autoria ou tramitação não vira dado vazio implícito |
| [x] | F3-062 | F3-061 | Criar busca unificada de proposições | Tipo, número, ano, texto, Casa, autoria e tema oficial são pesquisáveis no SQLite, com paginação e ordenação determinística |
| [x] | F3-063 | F3-061 | Criar consulta detalhada de proposição | Retorna identificação oficial, ementa/descrição, autoria, apresentação, situação, temas, tramitação disponível, votações relacionadas e fontes sem misturar conceitos |
| [x] | F3-064 | F3-061 | Criar consulta nominal de votação por proposição | Cada deliberação conserva órgão, data, resultado e universo; votos individuais mantêm valor literal, parlamentar, partido e UF observados |
| [x] | F3-065 | F3-064 | Criar agregação partidária auditável da votação | Contagens e percentuais por partido usam somente votos registrados; orientação partidária permanece separada e ausência de voto não vira ausência em sessão |
| [x] | F3-066 | F3-062 | Criar `/legislativo/proposicoes` | Busca e filtros permitem encontrar proposição por tipo, número, ano, texto, Casa, autoria e tema quando cobertos |
| [x] | F3-067 | F3-063, F3-064, F3-065 | Criar `/legislativo/proposicoes/[source]/[id]` | Página explica o que é a proposição, datas, autoria, situação, tramitação e votações, sempre com fonte e cobertura |
| [x] | F3-068 | F3-067 | Criar breakdown visual de votos | Resumo de resultado, distribuição geral, barras por partido e tabela nominal responsiva permitem ver quem e qual partido votou em cada opção |
| [x] | F3-069 | F3-056, F3-066, F3-067 | Simplificar linguagem visual e integrar navegação | Remover círculos/números “1, 2, 3...” dos títulos do perfil e páginas; usar headings diretos como “Quanto custa este mandato?”; adicionar Proposições à navegação legislativa |

## J. Metodologia, privacidade e conteúdo

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-070 | F3-007, F3-008, F3-021 | Atualizar metodologia eleitoral e de gabinete | Vínculo, snapshots, rubricas, exclusões, versões e limites de interpretação explicados em linguagem pública |
| [x] | F3-071 | F3-061, F3-064, F3-065 | Documentar metodologia de proposições e votações | Identidade da matéria, deliberação, voto individual, orientação, universo e agregação partidária são explicados separadamente |
| [x] | F3-072 | F3-070, F3-071 | Atualizar fichas de fontes e faixas oficiais | URL, periodicidade, formato, hash/lote e data de acesso exibidos; números normativos só entram após validação oficial |
| [x] | F3-073 | F3-050, F3-055, F3-068, F3-070 | Revisar linguagem editorial | “Declarado”, “identificado”, “snapshot” e “parcial” usados corretamente; títulos são diretos e não há alegação de patrimônio atual ou custo total |
| [x] | F3-074 | F3-052, F3-070 | Auditar exposição de nomes de funcionários | Somente campos aprovados aparecem; pesquisa, cache e HTML não vazam campos excluídos do CSV |

## K. Detalhamento e inteligência de gastos de cota

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-075 | F3-010, F3-011 | Definir contrato do detalhamento individual de cota | Período, total líquido identificado, categorias, meses, fornecedores, Casa, partido e UF usam o mesmo lote e conservam nulos, estornos e cobertura |
| [x] | F3-076 | F3-075 | Criar consulta de distribuição por categoria | Soma e participação de cada tipo de despesa reconciliam com o total do período; categorias ausentes não viram zero e itens pouco frequentes podem ser agrupados sem perder rastreabilidade |
| [x] | F3-077 | F3-075 | Criar série mensal e medidas de variação | Gasto mensal, média do parlamentar e comparação temporal usam meses equivalentes; meses sem cobertura ficam nulos e variação não mistura períodos incompletos |
| [x] | F3-078 | F3-075 | Criar benchmarks de partido, estado e Casa | Médias e medianas usam parlamentares comparáveis no mesmo período e Casa; posição, universo, percentil e diferença percentual expõem denominador e tamanho da amostra |
| [x] | F3-079 | F3-075 | Calcular concentração por fornecedor | Maior fornecedor, valor e participação usam fornecedor normalizado e despesas líquidas; documentos e nomes ausentes permanecem identificados como cobertura parcial |
| [x] | F3-080 | F3-076, F3-077, F3-078, F3-079 | Gerar “Principais destaques” a partir de regras auditáveis | Frases sobre concentração, fornecedor, pico mensal, posição e percentil são derivadas deterministicamente, mostram período/base e não usam texto gerado sem evidência |
| [x] | F3-081 | F3-076, F3-077, F3-078, F3-079 | Criar navegação e tela de detalhamento da cota | Clique no card “Cota parlamentar identificada” abre o recorte do parlamentar e preserva período; distribuição por categoria, evolução mensal, benchmarks e maior fornecedor aparecem com fontes e cobertura |
| [x] | F3-082 | F3-080, F3-081 | Construir visualizações e bloco de benchmark | Gráfico adequado às categorias, série mensal com referências do partido/estado, destaques e texto “R$ X, posição N de M e diferença para a mediana” são responsivos, acessíveis e reconciliados |

## L. Página de detalhes de partido

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-083 | F3-048, F3-057, F3-065, F3-078 | Criar página navegável de detalhes de um partido político | Clicar em um partido abre `/legislativo/partidos/[sigla]` com identidade e logo oficiais, descrição e representação separada por Casa. O topo mostra cinco KPIs reconciliados para o mesmo recorte: senadores, deputados federais, custo mediano por mandato com ano, presença mediana em sessões e participação mediana em votações; cada valor expõe período, universo, `n`, fonte e cobertura, sem misturar presença com voto nem somar rubricas incompatíveis. A página contém tabs de senadores/deputados, busca por nome ou UF, tabela paginada com cargo, custo, presença, participação e link para o perfil. Uma votação selecionável apresenta distribuição horizontal de votos literais, orientação separada e acesso à lista nominal; ausência de voto não vira falta ou “não participou” sem evidência própria. A atividade legislativa distingue proposições, relatorias, aprovadas e proposições convertidas em lei; assuntos recentes usam apenas temas oficiais e informam o período. O bloco de custos mostra mediana e faixa interquartil entre parlamentares comparáveis. Links levam à lista completa, votações, proposições do partido e comparação com outro partido. Estados vazios, cobertura parcial e fonte indisponível são explícitos; layout, tabelas e gráficos funcionam por teclado, em 390 px, desktop e zoom de 200%. |

## M. Comparação multidimensional

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-084 | F3-044, F3-048, F3-065, F3-078, F3-083 | Definir contratos e regras dos três modos de comparação | `/comparar` aceita modos `parlamentares`, `partidos` e `estados`, cada um com URL reproduzível, limites próprios de seleção e entidades válidas. Parlamentares preservam Casa; partidos permitem até 10 siglas; estados reutilizam ou encaminham para a comparação estadual. Cada dimensão conserva unidade, período, universo, `n`, fonte e cobertura. Nenhum contrato calcula nota, ranking geral ou índice composto; radar/spider chart fica explicitamente proibido. |
| [x] | F3-085 | F3-084 | Criar seleção persistente e cabeçalho das entidades | Entidades selecionadas aparecem como chips fixos com foto ou logo, partido, UF, cor consistente, remoção acessível e ação “Adicionar”; busca não duplica entidades, respeita o limite do modo e serializa seleção, modo, Casa, ano e recorte na URL. Cores permanecem iguais em todos os painéis e não são usadas como única forma de identificação. |
| [x] | F3-086 | F3-075, F3-076, F3-077, F3-078, F3-084 | Criar comparação detalhada de gastos | Small multiples mostram total de cota em barras agrupadas, composição por categoria em barras empilhadas e evolução mensal em linhas. Todas as séries usam o mesmo lote e corte mensal; categorias, estornos, meses nulos, rank e percentil permanecem auditáveis. Tooltip, valores visíveis, tabela alternativa e cobertura funcionam em desktop, 390 px e teclado. |
| [x] | F3-087 | F3-048, F3-059, F3-084 | Criar painéis de presença, participação, produção e gabinete | Presença e participação aparecem em bullet charts separados, em percentual, com mediana e faixa do universo como referências. Propostas, relatorias e vínculos com leis aparecem lado a lado e nunca somados. Gabinete separa quantidade de vínculos da métrica financeira e rotula competência. Comparação entre Casas bloqueia ou omite o financeiro de gabinete, pois folha do Senado e verba da Câmara não são conceitos equivalentes. |
| [x] | F3-088 | F3-043, F3-044, F3-084 | Criar painel eleitoral e patrimonial comparável | Para pleitos equivalentes, exibir votos recebidos, receitas/despesas de campanha disponíveis, bens declarados e variação entre eleições. Ano, cargo, moeda, cobertura TSE e vínculo confirmado acompanham cada valor. Pleitos, cargos ou eleições incompatíveis não são colocados na mesma escala; bens declarados são apresentados como declaração eleitoral, sem sugerir patrimônio atual ou enriquecimento. |
| [x] | F3-089 | F3-064, F3-065, F3-084 | Calcular concordância de voto entre parlamentares | Para cada par da mesma Casa, calcular votos iguais somente nas votações nominais em que ambos possuem voto individual registrado e comparável. Retornar numerador, denominador, percentual, período, lote e lista auditável das concordâncias e divergências. Voto ausente, votação secreta, obstrução ou valor não comparável não vira discordância. O painel usa leitura head-to-head factual, sem classificar proximidade política ou desempenho. |
| [x] | F3-090 | F3-065, F3-089 | Calcular fidelidade à orientação partidária | Comparar o voto individual apenas com orientação oficial do partido válida na mesma deliberação, mantendo orientação e voto como fatos separados. Expor votos alinhados, universo elegível, percentual, ausências de orientação e mudanças de filiação no período. Orientação ausente, liberada ou ambígua é excluída do denominador; o resultado não recebe rótulo moral, nota ou ranking geral. |
| [x] | F3-091 | F3-085, F3-086, F3-087, F3-088, F3-089, F3-090 | Construir a nova página `/comparar` com small multiples | Seletor de modo e cabeçalho permanecem visíveis; painéis independentes de gastos, presença, participação, produção, gabinete, eleições/patrimônio, concordância e fidelidade mostram escalas e coberturas próprias. Estados vazios explicam a incompatibilidade ou ausência sem fabricar zero. Links permitem abrir perfis, partidos, estados, votações e gastos detalhados. Carregamento evita N+1, limita séries e mantém orçamento de desempenho; compartilhamento da URL reproduz exatamente a comparação. |

## N. Desempenho de proposições e leitura visual dos votos

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F3-100 | F3-061, F3-062, F3-066, F3-069 | Instrumentar o caminho completo de `/legislativo/proposicoes` | Separar e registrar, em desenvolvimento, duração de abertura do banco, normalização dos filtros, contagem, busca, agregações complementares, serialização e renderização. Reproduzir consulta sem filtros e recortes Senado/Câmara por tipo, ano, autor e tema; guardar `EXPLAIN QUERY PLAN`, volume examinado/retornado, mediana e p95 de ao menos 10 execuções quentes e frias. O diagnóstico identifica a causa dos tempos de 6–20 s antes de escolher SQLite, PostgreSQL, índice ou cache como solução. |
| [x] | F3-101 | F3-100 | Eliminar varreduras e N+1 da listagem de proposições | A consulta aplica filtros, ordenação determinística, contagem e paginação no banco; autoria, temas e demais resumos visíveis são carregados em consultas agregadas por lote/página, sem uma consulta por proposição. Criar ou ajustar índices somente a partir do plano medido, incluindo chaves de lote ativo, Casa, tipo, ano e relações usadas pela busca. Nenhuma otimização remove proveniência, cobertura ou distinção entre Casas. |
| [x] | F3-102 | F3-100, F3-101 | Reduzir trabalho repetido entre requisições de proposições | Reutilizar conexão de leitura, statements e resultados estáveis do mesmo lote quando seguro; a chave inclui lote ativo e todos os filtros. Troca de publicação invalida o resultado antigo. A rota entrega rapidamente o shell/estado de carregamento quando houver trabalho residual e trata cancelamento de navegação sem `The destination stream closed early`. |
| [x] | F3-103 | F3-100, F3-101, F3-102 | Fixar um orçamento de desempenho para proposições | No banco publicado de referência, medir a rota sem filtro e os recortes mais caros; execução quente do código de aplicação fica abaixo de 500 ms na mediana e 1 s no p95 local, salvo limite documentado do ambiente. Adicionar teste de regressão da forma da consulta e script reproduzível que mostre duração, quantidade retornada, total, lote e plano. |
| [x] | F3-104 | F3-063, F3-064, F3-066 | Publicar um vocabulário oficial dos valores de voto e resultado | Mapear valores literais do Senado e da Câmara, incluindo `Sim`, `Não`, `P-NRV`, `AP`, `NCom`, `LP`, `A`, `R` e presidência, para rótulo legível, explicação e classe visual somente quando a documentação ou o payload oficial sustentar o significado. O valor bruto continua disponível para auditoria; código desconhecido recebe estilo neutro e nunca é inferido como aprovação, rejeição, presença ou ausência. |
| [x] | F3-105 | F3-064, F3-067, F3-104 | Melhorar a tabela “Como votou?” no perfil parlamentar | Voto e resultado usam badges com texto e contraste acessível: favorável/`Sim` em verde, contrário/`Não` em vermelho e demais estados em cores semanticamente distintas após validação do vocabulário. A proposição vira link para o detalhe interno correspondente; o resolvedor usa identificador oficial ou vínculo legislativo seguro, inclusive quando deliberação e proposição estão em Casas diferentes, e recorre à fonte oficial quando não houver vínculo único. Linhas repetidas preservam deliberações distintas e expõem contexto suficiente para explicar a diferença. |
| [x] | F3-106 | F3-065, F3-078, F3-104 | Redesenhar a distribuição partidária de votos | Substituir a apresentação cinza e repetitiva por uma grade responsiva de cards compactos, um por partido, com logo/sigla, total `n` e segmentos/badges coloridos por voto. Cada card mostra contagens e proporções, ordena de forma estável e permite abrir o partido e a lista nominal da deliberação. Cor nunca é a única pista: rótulo e valor ficam sempre visíveis; estados desconhecidos permanecem neutros. A leitura funciona em 390 px, desktop, teclado e zoom de 200%, com tabela alternativa auditável. |
| [x] | F3-107 | F3-103, F3-104, F3-105, F3-106 | Testar desempenho, navegação e semântica visual dos votos | Cobrir filtros e paginação sem N+1, invalidação por lote, cancelamento de stream, links internos de proposição, fallback oficial, deliberações repetidas, todos os códigos conhecidos e valores desconhecidos. Testes verificam texto e contraste além da cor, totais por partido, `n`, responsividade e reconciliação com `legislative_votes` e `deliberations`. |

## O. Testes, reconciliação e entrega

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [ ] | F3-092 | F3-017, F3-018, F3-019 | Criar fixtures mínimas reais dos layouts TSE | 2018/2022, acentos, campos vazios, retificação, bens e complemento cobertos sem versionar dados desnecessários |
| [ ] | F3-093 | F3-025, F3-029, F3-034, F3-038 | Criar testes de contrato das fontes de gabinete | Mudança de cabeçalho, moeda, encoding, snapshot vazio e lotação ambígua falham de forma controlada |
| [ ] | F3-094 | F3-022, F3-028, F3-032, F3-037, F3-041 | Testar publicação e reexecução | Troca atômica, idempotência, rollback e preservação do lote anterior comprovados para cada conjunto |
| [ ] | F3-095 | F3-044, F3-048, F3-063, F3-064, F3-065, F3-089, F3-090 | Executar reconciliação final com SQLite | Contagens e somas do banco batem com arquivos/fontes e consultas do frontend; proposições, votos, concordância e fidelidade partidária reconciliam com os lotes ativos |
| [ ] | F3-096 | F3-057, F3-058, F3-059, F3-068, F3-069, F3-091, F3-107 | Criar E2E da arquitetura da Fase 3 | Eleições, gabinetes, busca/detalhe de proposição, votos nominais/partidários, os três modos de comparação, nulos, 404, indisponibilidade e fontes cobertos |
| [ ] | F3-097 | F3-073, F3-074, F3-096 | Auditar acessibilidade e responsividade | Teclado, headings diretos, tabelas, gráficos, 390 px, desktop e zoom 200% passam sem perder contexto de cobertura |
| [ ] | F3-098 | F3-091, F3-095, F3-097, F3-103 | Medir desempenho com os novos volumes | Perfil, proposições, comparação e listagens mantêm orçamento de LCP/CLS/transferência; consultas agregadas evitam N+1 e tabelas longas têm paginação ou limite explícito |
| [ ] | F3-099 | F3-095, F3-096, F3-097, F3-098 | Preparar revisão visual e relatório final | Capturas desktop/mobile, lotes publicados, métricas, limitações e comandos de reprodução documentados |

## Ordem de execução

1. F3-001 a F3-008 ââ‚¬â€ auditoria e semântica das fontes.
2. F3-009 a F3-015 ââ‚¬â€ contratos, migrações e publicação.
3. F3-016 a F3-024 ââ‚¬â€ TSE 2018/2022.
4. F3-025 a F3-033 ââ‚¬â€ gabinete da Câmara.
5. F3-034 a F3-042 ââ‚¬â€ gabinete do Senado.
6. F3-043 a F3-049 ââ‚¬â€ consultas e adaptadores.
7. F3-050 a F3-060 — perfil, listagens, estados e comparação.
8. F3-061 a F3-069 — proposições, votações e simplificação visual.
9. F3-070 a F3-074 — metodologia, privacidade e conteúdo.
10. F3-075 a F3-082 — detalhamento e inteligência de gastos de cota.
11. F3-083 — página detalhada e navegável de partido.
12. F3-084 a F3-091 — comparação multidimensional por small multiples.
13. F3-100 a F3-107 — desempenho de proposições e leitura visual dos votos.
14. F3-092 a F3-099 — testes, reconciliação e entrega.

Ao retomar: iniciar **F3-025**, auditando as fontes de equipe e verba de gabinete da Câmara.
