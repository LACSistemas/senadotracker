# Tarefas do Cívica

Referência: [plan.md](plan.md). Atualizado em 08/09/2026.

## Estado atual e retomada

- Estado: **blocos A–H concluídos; bloco I é o próximo grupo**.
- Arquivos existentes: documentação, fichas de fonte, fixtures, workspace, CLI, banco local e frontend responsivo.
- Git: inicializado em `main`, sem commits ou remoto. Workspace funcional; SQLite local, auditoria, coletores de cadastro e consultas do lote ativo implementados.
- Fontes: cadastro, mandatos/filiações do Senado e cadastro/histórico da Câmara consultados via HTTPS, com fixtures e proveniência.
- Próxima tarefa: **T108 — configurar CI para verificações existentes**.
- Bloqueios ativos: nenhum. Demais conjuntos ainda não validados.
- Últimas verificações: tipos, 29 testes offline, build e jornada end-to-end no Chrome. Cotas ativas: Senado 35.290 registros e Câmara 224.687 registros em 2025/2026.
- Limites: banco e frontend estão locais, sem deploy. Cotas cobrem somente vínculos seguros com o cadastro atual; não são custo total. Nenhuma métrica legislativa, eleitoral ou de participação foi publicada.

## Como executar e atualizar

Cada linha representa uma entrega pequena. Trabalhar em uma tarefa por vez, respeitando dependências. `—` significa sem dependência. `[ ]` significa pendente; `[x]`, concluída com evidência. Registrar tarefa em andamento neste cabeçalho e bloqueios com motivo, tentativa e condição de retomada.

Ao terminar, marcar a linha, registrar caminhos/checagens na seção de execução e atualizar “Próxima tarefaâ€. Não marcar código inexistente ou verificação não executada. Se uma tarefa crescer para mais de um artefato principal ou uma sessão curta, dividi-la em IDs derivados, como T010a/T010b, antes de implementar. Não criar teste que apenas replique implementação; testar contratos e riscos reais.

As dependências abaixo definem ordem técnica. Uma fonte inviável bloqueia sua funcionalidade, não as demais entregas. Registrar explicitamente itens adiados, sem marcá-los concluídos. Caminhos de tarefas pendentes são destinos previstos; consultar o registro de execução para os artefatos já existentes.

## Planejamento concluído

| Estado | ID | Entrega | Evidência |
| --- | --- | --- | --- |
| [x] | T001 | Ler intenção e inspecionar estado local | `intention.md`; diretório sem código ou `.git` |
| [x] | T002 | Criar arquitetura e critérios de precisão | `plan.md` |
| [x] | T003 | Criar sequência executável e estado de retomada | `tasks.md` |

## A. Fontes e estrutura mínima

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T010 | T003 | Documentar cadastro do Senado em `docs/sources/senado-cadastro.md` | URL de serviço real, formato, chaves, data e amostra de resposta registrados |
| [x] | T011 | T010 | Documentar exercício e histórico partidário do Senado | Campos temporais, suplência e limitações comprovados por amostra |
| [x] | T012 | T003 | Documentar cadastro da Câmara em `docs/sources/camara-cadastro.md` | URL, filtros, paginação, chave e amostra registrados |
| [x] | T013 | T012 | Documentar histórico de exercício e partido da Câmara | Intervalos e estados oficiais mapeados com exemplos |
| [x] | T014 | T011, T013 | Escrever contrato de identidade em `docs/methodology/identity.md` | Pessoa, mandato, exercício e vínculo entre fontes definidos; ambiguidade não gera fusão |
| [x] | T015 | T014 | Registrar stack e versões em `docs/decisions/001-stack.md` | Documentação atual conferida; versões compatíveis e gerenciador escolhidos |
| [x] | T016 | T015 | Inicializar Git e `.gitignore` | Banco, respostas brutas, caches e segredos ignorados; intenção preservada |
| [x] | T017 | T016 | Criar workspace TypeScript e lockfile | Instalação reproduzível e verificação de tipos mínima executadas |
| [x] | T018 | T017 | Criar CLI vazia em `apps/collector` | Comando de ajuda funciona e entrada inválida retorna erro |
| [x] | T019 | T017 | Criar aplicação mínima em `apps/web` | Página local abre e build inicial passa |
| [x] | T020 | T017 | Configurar runner de testes e fixture mínima | Um teste de contrato significativo executa offline |

## B. Auditoria, banco e coleta de cadastro

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T021 | T014, T017 | Definir contratos de identidade em `packages/domain` | IDs por fonte, intervalos e estados de disponibilidade tipados |
| [x] | T022 | T021 | Criar migração SQLite de identidade | Banco vazio aceita migração; chaves duplicadas são rejeitadas |
| [x] | T023 | T022 | Criar migração de auditoria e lotes | Origem, execução, objeto bruto, validação e lote vinculáveis |
| [x] | T024 | T018, T023 | Implementar armazenamento bruto local | Resposta com URL, parâmetros, instante e hash pode ser recuperada sem sobrescrita |
| [x] | T025 | T018, T020 | Implementar cliente HTTP de coleta | Timeout, retry limitado e erro 429/5xx verificados com respostas controladas |
| [x] | T026 | T023, T025 | Implementar registro de execução e trava por job | Execução concorrente é recusada; falhas ficam registradas e trava expira de forma controlada |
| [x] | T027 | T010, T021, T024, T025 | Implementar parser de cadastro do Senado | Fixture real anonimizada quando necessário produz registros; campo inesperado gera diagnóstico |
| [x] | T028 | T027, T026 | Implementar importação do cadastro do Senado em staging | Dados carregados com IDs e origem; segunda execução não duplica registros |
| [x] | T029 | T011, T028 | Importar intervalos de exercício e partido do Senado | Mudança de partido e suplência preservadas em fixtures |
| [x] | T030 | T012, T021, T024, T025 | Implementar parser e paginação de cadastro da Câmara | Todas as páginas de uma amostra são lidas sem repetição |
| [x] | T031 | T030, T026 | Implementar importação do cadastro da Câmara em staging | Reexecução idempotente; resposta vazia inesperada sinalizada |
| [x] | T032 | T013, T031 | Importar intervalos de exercício e partido da Câmara | Histórico não é substituído pelo estado atual |
| [x] | T033 | T029, T032 | Implementar validação de lotes de cadastro | Chaves, UF, intervalos e completude verificados; rejeições explicadas |
| [x] | T034 | T033 | Implementar publicação transacional | Falha no meio mantém último lote válido; lote incompleto não vira cadastro público |
| [x] | T035 | T034 | Reconciliar cadastro real das duas Casas | Relatório compara identidades e contagens com fontes na mesma data; divergências resolvidas ou bloqueadas |
| [x] | T036 | T034 | Criar consultas públicas de cadastro | Somente lote publicado é retornado; filtros e paginação funcionam |

## C. Primeira experiência visual

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T037 | T019 | Configurar Tailwind, shadcn/ui e tokens visuais | Tipografia, cores, espaçamento e foco definidos em uma página de desenvolvimento |
| [x] | T038 | T037 | Criar layout e navegação responsivos | Menu utilizável por teclado e em viewport mobile |
| [x] | T039 | T036, T038 | Criar listagem real de parlamentares | Nome, foto disponível, Casa, partido, UF e link do perfil vêm do banco |
| [x] | T040 | T039 | Implementar busca e filtros na URL | Reabrir URL preserva Casa, UF, partido, busca e página |
| [x] | T041 | T039 | Criar perfil básico | Identidade, exercício, período e perfil oficial visíveis; ID inexistente tratado |
| [x] | T042 | T041 | Criar componente de origem e disponibilidade | Fonte, referência, coleta e estados parcial/desatualizado/indisponível distinguíveis |
| [x] | T043 | T042 | Criar página de metodologia inicial | Regras de identidade e limitações reais publicadas sem conteúdo fictício |
| [x] | T044 | T035, T040, T043 | Verificar jornada da entrega A | Busca → perfil → fonte testada; build, teclado e mobile verificados |

## D. Gastos de cota

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T045 | T010 | Documentar contrato de CEAPS | Chaves, valores, documentos, estornos e cobertura identificados em amostras |
| [x] | T046 | T012 | Documentar contrato de CEAP | Competência, reembolso, deduções e identificadores conferidos no dicionário oficial |
| [x] | T047 | T045, T046 | Escrever metodologia de cotas | Composição, sobreposição, correções e ausência de dados definidas |
| [x] | T048 | T047, T023 | Criar schema financeiro e conversão monetária | Centavos exatos, moeda, revisão e origem persistidos; decimais e estornos testados |
| [x] | T049 | T048, T025 | Implementar adaptador CEAPS | Amostra oficial normalizada com documento e competência |
| [x] | T050 | T049, T034 | Implementar job CEAPS por período | Reimportar período não duplica nem perde retificações |
| [x] | T051 | T048, T025 | Implementar adaptador CEAP | Amostra oficial normalizada preservando valor bruto e deduções quando aplicáveis |
| [x] | T052 | T051, T034 | Implementar job CEAP por período | Paginação/arquivo completo, repetição e correção verificados |
| [x] | T053 | T050, T052 | Reconciliar gastos por Casa e período | Relatório concilia totais equivalentes e explica exclusões; divergência bloqueia publicação |
| [x] | T054 | T053 | Implementar agregação mensal de cotas | Soma coincide com registros publicados; cobertura e metodologia acompanham resultado |
| [x] | T055 | T054, T042 | Criar aba de gastos e documentos | Total delimitado, série, tabela e origem acessíveis; nenhuma cota rotulada custo total |
| [x] | T056 | T055 | Implementar variação entre períodos equivalentes | Ano parcial, base zero e mudança de cobertura tratados |

## E. Atuação legislativa

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T057 | T010 | Documentar votos e deliberações do Senado | Identidade da votação, estados e resultado mapeados por amostras |
| [x] | T058 | T012 | Documentar votos e deliberações da Câmara | Identidade da votação, estados e resultado mapeados por amostras |
| [x] | T059 | T057, T058, T023 | Criar schema de deliberações e votos | Uma proposição comporta várias deliberações; voto mantém estado original |
| [x] | T060 | T059 | Implementar importação de votos do Senado | Fixture e lote real delimitado reconciliados, com deduplicação |
| [x] | T061 | T059 | Implementar importação de votos da Câmara | Fixture e lote real delimitado reconciliados, com deduplicação |
| [x] | T062 | T060, T061, T042 | Criar histórico de votos | Data, matéria, objeto da deliberação, voto, resultado e fonte visíveis |
| [x] | T063 | T010 | Documentar proposições, relatorias, cargos e leis do Senado | Ficha por conjunto com chaves, estados, datas e limitações |
| [x] | T064 | T012 | Documentar proposições, relatorias, cargos e leis da Câmara | Ficha por conjunto com chaves, estados, datas e limitações |
| [x] | T065 | T063, T064 | Definir contrato legislativo e migração de proposições | Autoria múltipla, estados e vínculo com lei representados sem perda |
| [x] | T066 | T065 | Importar proposições e autores do Senado | Amostra rastreável com atualização de situação e coautoria preservadas |
| [x] | T067 | T065 | Importar proposições e autores da Câmara | Amostra rastreável com atualização de situação e coautoria preservadas |
| [x] | T068 | T066, T067 | Criar lista de proposições no perfil | Filtros por situação/tipo e links oficiais; sem confundir aprovação e lei |
| [x] | T069 | T065 | Criar schema de relatorias, comissões e cargos | Funções e intervalos preservados; exercício atual consultável |
| [x] | T070 | T069, T063 | Importar relatorias do Senado | Designação e situação reconciliadas com amostra oficial |
| [x] | T071 | T069, T064 | Importar relatorias da Câmara | Designação e situação reconciliadas com amostra oficial |
| [x] | T072 | T069, T063 | Importar comissões e cargos do Senado | Histórico e funções atuais distinguíveis |
| [x] | T073 | T069, T064 | Importar comissões e cargos da Câmara | Histórico e funções atuais distinguíveis |
| [x] | T074 | T070, T071, T072, T073 | Exibir relatorias e cargos | Listas paginadas com período, situação e fonte |
| [x] | T075 | T066 | Importar vínculos oficiais de proposição com lei do Senado | Vínculo comprovado; transformação não é inferida por palavra-chave |
| [x] | T076 | T067 | Importar vínculos oficiais de proposição com lei da Câmara | Vínculo comprovado e coautoria mantida |
| [x] | T077 | T075, T076, T068 | Exibir leis originadas das proposições | Contagem deduplicada e acesso à evidência de cada vínculo |

## F. Presença e participação

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T078 | T057, T029 | Investigar presença e universo elegível do Senado | Sessões, justificativas, licenças e exceções documentadas; lacunas explícitas |
| [x] | T079 | T058, T032 | Investigar presença e universo elegível da Câmara | Sessões, justificativas, licenças e exceções documentadas; lacunas explícitas |
| [x] | T080 | T078, T079 | Escrever metodologia de participação por Casa | Numeradores, denominadores, estados e média escolhida definidos |
| [x] | T081 | T080, T023 | Criar schema de sessões e presença | Sessão, exercício, estado original e fonte relacionados |
| [x] | T082 | T081 | Publicar estado de presença do Senado | Fonte estruturada insuficiente registrada como indisponível; falta de voto não gera ausência |
| [x] | T083 | T081 | Importar presença da Câmara | Presença explícita preservada; falta de voto não gera ausência |
| [x] | T084 | T082, T083, T060, T061 | Calcular indicadores validados | Exercício parcial, estados especiais e denominador zero cobertos por testes |
| [x] | T085 | T084, T042 | Exibir presença e participação separadamente | Contagens, percentual, período e denominador acessíveis; sem dados completos, percentual indisponível |

## F2. Complemento de coleta legislativa

Executar depois do grupo F. Este bloco amplia e reconcilia fontes que se sobrepõem ao grupo E; ele não autoriza preencher lacunas de presença a partir da ausência de voto.

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T085a | T077, T085 | Inventariar a cobertura legislativa adicional e eliminar sobreposição | Matriz rota/conjunto/entidade/período identifica fonte canônica, redundâncias e lacunas sem contar o mesmo evento duas vezes |
| [x] | T085b | T085a | Reconciliar votações nominais do Plenário do Senado | [Lista anual oficial](https://www12.senado.leg.br/dados-abertos/legislativo/plenario/votacoes-nominais) e [rota por senador](https://www12.senado.leg.br/dados-abertos/legislativo/plenario/votacoes-nominais/info/webservice-de-votacoes-de-um-senador) concordam em votação, matéria, data, resultado, voto e totais; divergências ficam registradas |
| [x] | T085c | T085a, T065 | Ampliar matérias do Senado | [Projetos e Matérias](https://www12.senado.leg.br/dados-abertos/conjuntos?grupo=projetos-e-materias&portal=legislativo) fornece autoria, relatoria, tramitação, emendas, situação e vetos com chaves e estados literais preservados |
| [x] | T085d | T085a, T059 | Importar votações nominais em comissões do Senado | [Fonte oficial](https://www12.senado.leg.br/dados-abertos/legislativo/comissoes/votacoes-nominais) vincula votação, comissão, proposição, parlamentar e voto; Plenário e comissão permanecem universos distintos |
| [x] | T085e | T085a, T069 | Reconciliar cargos, lideranças e comissões dos senadores | [Cadastro consolidado](https://www12.senado.leg.br/dados-abertos/legislativo/parlamentares/senadores-em-exercicio) confirma função, órgão, mandato, filiação e intervalos sem substituir histórico por estado atual |
| [x] | T085f | T085a, T061 | Importar detalhe e orientações das votações da Câmara | `/votacoes`, `/votacoes/{id}`, `/votacoes/{id}/votos` e `/votacoes/{id}/orientacoes` preservam deliberação, voto e orientação como fatos diferentes |
| [x] | T085g | T085a, T067 | Ampliar proposições da Câmara | `/proposicoes`, detalhe, autores, temas e tramitações são reconciliados; autoria múltipla, tema e mudança de situação não se sobrescrevem |
| [x] | T085h | T085a, T073 | Reconciliar órgãos e membros da Câmara | `/orgaos` e `/orgaos/{id}/membros` preservam órgão, cargo, titularidade e contexto temporal; composição atual não é anunciada como histórico completo |
| [x] | T085i | T085b, T085c, T085d, T085e, T085f, T085g, T085h | Criar migrações e jobs complementares | Reexecução por fonte/período é idempotente, objetos brutos têm hash e falha mantém o último lote válido |
| [x] | T085j | T085i | Reconciliar e publicar o complemento legislativo | Relatório por Casa compara contagens entre rotas equivalentes, explica exclusões e bloqueia divergências materiais |
| [x] | T085k | T085j, T042 | Exibir atuação complementar no perfil | Plenário, comissões, cargos, orientações, matérias e tramitações mostram período, escopo e fonte sem criar nota geral de desempenho |

## G. Eleições

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T086 | T014 | Documentar candidaturas e resultados de uma eleição | Arquivos, dicionários, codificação, chaves e atualização conferidos |
| [x] | T087 | T086 | Documentar bens e contas da mesma eleição | Receitas/despesas, retificações e unidades confirmadas |
| [x] | T088 | T087, T023 | Criar schema eleitoral | Candidatura separada de pessoa, eleição e mandato; versões rastreáveis |
| [x] | T089 | T088 | Importar candidaturas e resultados | Download e processamento delimitados e retomáveis; resultado oficial preservado |
| [x] | T090 | T089, T014 | Implementar vínculo de identidade eleitoral | Correspondência ambígua fica pendente; nome sozinho não confirma vínculo |
| [x] | T091 | T090 | Importar bens declarados | Soma por candidatura conferida com declaração original |
| [x] | T092 | T090 | Importar receitas de campanha | Categorias e revisões mantidas; totais conciliados |
| [x] | T093 | T090 | Importar despesas de campanha | Fornecedores e revisões mantidos; totais conciliados |
| [x] | T094 | T091, T092, T093, T042 | Criar aba eleitoral | Ano, resultado, votos, bens e contas com rótulos e origens corretos |
| [x] | T095 | T094 | Validar uma segunda eleição histórica | Diferenças de esquema testadas antes de ampliar cobertura |

> Estado de cobertura eleitoral (08/09/2026): modelo, parsers, vínculo conservador, publicação e interface concluídos. Os lotes 2022 e 2018 estão publicados como `unavailable`, pois os hosts oficiais do TSE bloquearam ou recusaram conexão neste ambiente; nenhum zero ou ausência individual foi inferido. A ampliação material depende de uma coleta oficial acessível.

## H. Custos ampliados e comparações

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | T096 | T047 | Mapear folha, subsídio e benefícios do Senado | Matriz fonte/categoria/cobertura/atribuição/sobreposição registrada |
| [x] | T097 | T047 | Mapear folha, subsídio e benefícios da Câmara | Matriz fonte/categoria/cobertura/atribuição/sobreposição registrada |
| [x] | T098 | T096, T097 | Definir composição de custos ampliados | Rubricas somáveis justificadas; orçamento separado de gasto e limitações explícitas |
| [x] | T099 | T098 | Desdobrar importação de custos do Senado por rubrica | Filhas T099a–T099e registradas e tratadas por disponibilidade |
| [x] | T099a | T099 | Subsídio do Senado | Contrato mensal e estado indisponível definidos |
| [x] | T099b | T099 | Diárias e devoluções do Senado | Fluxos líquidos separados e origem exigida |
| [x] | T099c | T099 | Moradia e imóvel funcional do Senado | Pagamento separado de ocupação sem valor |
| [x] | T099d | T099 | Viagens e benefícios do Senado | Grupo de sobreposição obrigatório |
| [x] | T099e | T099 | Folha vinculada a gabinete do Senado | Lotação e competência obrigatórias |
| [x] | T100 | T098 | Desdobrar importação de custos da Câmara por rubrica | Filhas T100a–T100d registradas e tratadas por disponibilidade |
| [x] | T100a | T100 | Subsídio da Câmara | Contrato mensal e estado indisponível definidos |
| [x] | T100b | T100 | Verba e folha do gabinete da Câmara | Limite separado de gasto e encargos coletivos |
| [x] | T100c | T100 | Moradia e imóvel funcional da Câmara | Pagamento separado de ocupação sem valor |
| [x] | T100d | T100 | Viagens da Câmara | Sobreposição com CEAP deve ser reconciliada |
| [x] | T101 | T099, T100 e todas as filhas | Criar visualização de custos ampliados | Composição auditável; custos incompletos nunca apresentados como total integral |
| [x] | T102 | T098 | Definir estrutura de gabinete publicável | Pessoa, vínculo, lotação e escritório separados no schema |
| [x] | T103 | T102 | Desdobrar coleta de estrutura de gabinete por Casa | Filhas T103a–T103c registradas |
| [x] | T103a | T103 | Snapshot de funcionários da Câmara | Fotografia diária não cria histórico retroativo |
| [x] | T103b | T103 | Escritórios de apoio do Senado | Local e observação exigem origem explícita |
| [x] | T103c | T103 | Equipe do Senado por lotação | Vínculo ambíguo não entra na contagem |
| [x] | T103d | T103c, T099a, T099e | Popular equipe e custo de gabinete do Senado | Baixar servidores ativos/comissionados e remuneração mensal; vincular matrícula → lotação → unidade de gabinete → senador; preservar afastamento e competência; conciliar contagem e folha; rejeitar lotações compartilhadas ou não parlamentares |
| [x] | T104 | T103 e todas as filhas, T101 | Exibir estrutura de gabinete | Estado indisponível publicado sem contagens inventadas |
| [x] | T105 | T056, T085, T077 | Escrever metodologia de comparações | Casa, período, cobertura, exercício, partido e desempate definidos |
| [x] | T106 | T105 | Implementar consultas de comparação | Casos sem cobertura são excluídos; média vazia é nula |
| [x] | T107 | T106 | Criar tela de comparação e rankings por métrica | Seleção por Casa/UF/partido/ano, sem nota geral de mérito |

> Cobertura em 08/09/2026: CEAPS/CEAP e a folha de agosto de 2026 de 79 gabinetes do Senado estão conciliadas. A folha separa proventos brutos, auxílios, diárias, indenizações e linhas normais; não inclui encargos patronais. Quatro lotações parlamentares ficaram sem vínculo seguro. Demais rubricas continuam indisponíveis.

## I. Operação e publicação

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [ ] | T108 | T044 | Configurar CI para verificações existentes | Tipos, testes offline e build executam em checkout limpo |
| [ ] | T109 | T050, T052, T026 | Implementar checkpoint e retomada de jobs financeiros | Interrupção e retomada não duplicam nem omitem registros |
| [ ] | T110 | T109 | Configurar janelas de reprocessamento por fonte | Frequência parametrizada; retificação antiga pode ser reprocessada manualmente |
| [ ] | T111 | T110 | Criar status de atualização por fonte | Última tentativa, sucesso, cobertura e atraso distinguíveis |
| [ ] | T112 | T053, T089 | Medir armazenamento e duração representativos | Registrar volume bruto, banco, tempo e custo estimado por domínio |
| [ ] | T113 | T112 | Comparar hospedagem e limites atuais | Decisão documentada com links oficiais, data e orçamento; sem presumir gratuidade |
| [ ] | T114 | T113 | Preparar migrações PostgreSQL | Schema e restrições sobem em ambiente de teste |
| [ ] | T115 | T114 | Validar migração SQLite → PostgreSQL | Contagens, valores em centavos e consultas equivalentes conciliados |
| [ ] | T116 | T115 | Configurar credenciais e acesso mínimo | Frontend não escreve; coletor escreve; segredos ausentes de bundle/logs |
| [ ] | T117 | T116 | Configurar executor agendado independente | Job executa sem requisição web; concorrência e falha observáveis |
| [ ] | T118 | T117 | Configurar armazenamento bruto e backup | Objetos referenciados recuperáveis; retenção e custo documentados |
| [ ] | T119 | T118 | Testar restauração e rollback | Recuperar banco e lote anterior em ambiente isolado com evidência |
| [ ] | T120 | T111, T117 | Configurar alertas operacionais | Simular falha e defasagem; alerta contém fonte e ação de recuperação |
| [ ] | T121 | T044, T108, T116 | Preparar preview de frontend | Build hospedável, conexão de leitura e estados de erro verificados |
| [ ] | T122 | T121 | Revisar acessibilidade e desempenho | Jornada principal em teclado/mobile e tabelas/gráficos verificados; problemas materiais corrigidos |
| [ ] | T123 | T119, T120, T122 | Executar checklist da versão pública | Apenas módulos validados habilitados; metodologia, cobertura e recuperação documentadas |
| [ ] | T124 | T123 | Publicar versão habilitada dentro da autorização vigente | URL acessível e smoke test; qualquer contratação ou autorização pendente registrada antes da ação |
| [ ] | T125 | T124 | Documentar operação em `docs/operations.md` | Coletar, reprocessar, corrigir, restaurar e investigar divergência têm comandos reproduzíveis |

## Backlog condicionado

Sanções e CNPJ: investigar apenas após as entregas principais. Criar tarefas específicas de fonte, identidade, temporalidade e apresentação antes de implementar. Não inferir culpa por associação. Expansão histórica, exportação pública e API pública exigem tarefas próprias; não fazem parte da primeira versão.

## Registro de execução

| Data | Tarefas | Resultado | Verificação / limite |
| --- | --- | --- | --- |
| 08/09/2026 | T001–T003 | Intenção lida; plano e backlog criados | Sem implementação. Consulta documental inicial não valida payloads nem cálculos |
| 08/09/2026 | T010–T011 | `docs/sources/senado-cadastro.md`, `senado-historico.md` e fixtures do Senado | GETs reais 200; lista com 81 registros observados, recorte de três pessoas, mandatos e filiações; exercício de suplente e intervalos encerrados comprovados |
| 08/09/2026 | T012–T013 | `docs/sources/camara-cadastro.md`, `camara-historico.md` e fixtures da Câmara | GETs reais 200; duas páginas ligadas por next; histórico com licença, retorno, mudança partidária, fim e nulo |
| 08/09/2026 | T014–T015 | `docs/methodology/identity.md` e `docs/decisions/001-stack.md` | Namespaces, identidade ambígua e temporalidade definidos; versões consultadas no registro npm e compatibilidade verificada localmente |
| 08/09/2026 | T016 | `.gitignore`, `.gitattributes`, `.editorconfig` e Git em main | Brutos, banco, envs, cache e build excluídos. Git reinicializado na conta do usuário após diferença de proprietário do sandbox; cópia vazia anterior preservada em `data/research/git-initial-sandbox` |
| 08/09/2026 | T017 | `package.json`, `package-lock.json`, configs TypeScript e pacotes em `apps/` | `npm ci --offline --no-audit --no-fund` passou; `npm run typecheck` passou, incluindo geração de tipos Next. Instalação inicial reportou zero vulnerabilidades |
| 08/09/2026 | T018 | `apps/collector/src/cli.ts` e `index.ts` | Ajuda por comando npm passou; testes do processo real validaram status 0 e erro 2 sem coleta |
| 08/09/2026 | T019 | `apps/web/app`, configuração Next e README de execução | Build Next 16.3.4 passou; servidor de produção retornou 200 e 404; screenshot desktop `data/web-desktop.png` inspecionada. Página informa dados ainda não publicados |
| 08/09/2026 | T020 | `tests/contracts/sources.test.ts`, `tests/unit/cli.test.ts` e 7 fixtures com proveniência | 8 testes offline passaram; hashes, paginação, estados temporais e CLI verificados. Testes não substituem futura reconciliação integral |
| 08/09/2026 | T021–T023 | `packages/domain`, `packages/db`, migrações versionadas de identidade/auditoria/publicação | Tipos estritos, datas civis, namespaces, foreign keys, chaves únicas e reabertura de banco testados; `node:sqlite` experimental registrado em ADR 002 |
| 08/09/2026 | T024–T026 | Armazenamento por SHA-256, cliente HTTP, execuções e leases | Integridade, imutabilidade, timeout, limite de tamanho, retry 429/5xx, 404, HTML 200, UTF-8 inválido, concorrência e lease expirada testados |
| 08/09/2026 | T027–T032 | Parsers e jobs Senado/Câmara | Fixtures preservam suplência, filiação, exercício, nulos e paginação; coleta integral real importou 81 + 513 perfis e 4.895 eventos históricos |
| 08/09/2026 | T033–T034 | Validação e publicação transacional | 25 testes passaram; lote vazio/alterado rejeitado, staging idempotente, retificação conserva pessoa e falha simulada mantém lote anterior |
| 08/09/2026 | T035–T036 | `docs/reconciliation/cadastro-2026-09-08.md` e consultas em `packages/db` | Listas inicial/final: Senado 81/81, Câmara 513/513, zero alterações. Busca sem acento, filtros, paginação, detalhe e somente lote ativo testados |
| 08/09/2026 | T037–T043 | Tailwind/shadcn local, layout, listagem, perfil, origem, `/metodologia` e `/design-system` | 594 perfis reais ligados ao lote publicado; Casa, UF, partido, busca e página na URL; origem inclui URL, coleta, lote e hash; 404 e indisponibilidade tratados |
| 08/09/2026 | T044 | `tests/e2e/cadastro.spec.ts` e `playwright.config.ts` | 3 testes no Chrome passaram: busca → perfil → fonte, filtros persistidos, 404, metodologia, skip-link por teclado e viewport de 390 px sem overflow; tipos e build passaram |
| 08/09/2026 | T045–T047 | `docs/sources/senado-ceaps.md`, `camara-ceap.md` e `docs/methodology/expenses.md` | Catálogos, tutorial, arquivos anuais, campos monetários, restituições, documentos, cobertura e limites registrados |
| 08/09/2026 | T048–T054 | Migração 003, domínio financeiro, parsers e `collect-expenses` | Centavos inteiros; lotes por Casa/ano; reimportação transacional testada. Publicados Senado 22.188/13.102 e Câmara 149.120/75.567 registros para 2025/2026 |
| 08/09/2026 | T055–T056 | Seção de cotas no perfil e reconciliação financeira | Total delimitado, categorias, documentos, origem e comparação jan–ago equivalente; base zero indefinida. 29 testes offline e build passaram |
| 08/09/2026 | T057–T058 | `docs/sources/senado-votacoes.md`, `camara-votacoes.md` e fixtures rastreáveis | OpenAPI e respostas reais conferidos; Senado 423 votos na rota amostrada; Câmara com votação nominal de 396 votos; matéria, deliberação, resultado e voto separados |
| 08/09/2026 | T059–T077 | Migrações 004–005, coletores `collect-votes`/`collect-activity`, documentação metodológica e seções legislativas no perfil | Publicados: votos Senado 59/1.470 e Câmara 7.360/49.142; atividade Senado amostral 453/383/169 e Câmara 44.356/55.549/17.516. Vínculos com leis: zero, pois os recortes não os comprovam explicitamente |
| 08/09/2026 | T078–T085 | Fontes e metodologia de presença, migração 006, `collect-presence`, indicadores separados e interface | Câmara: 1.564 eventos, 72 sessões elegíveis e 56.603 presenças vinculadas. Senado: presença indisponível; participação nominal publicada sem inferir falta |

| 08/09/2026 | T085a–T085k | Matriz de cobertura, migração 007, `collect-complement`, reconciliação e interface | Senado: 59/59 votações plenárias sem divergência e 3.067 complementos; Câmara: 64 complementos. Amostras declaradas, sem duplicar fatos canônicos |
Ao retomar: ler este estado, inspecionar as mudanças locais e iniciar T108 no bloco I.




