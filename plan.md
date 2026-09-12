# Plano do Cívica

Documento criado em 08/09/2026 a partir de `intention.md`. Execução e estado das entregas: [tasks.md](tasks.md).

## 1. Objetivo e estado atual

Construir um tracker de senadores e deputados federais com perfis, exercício parlamentar, gastos, votações, produção legislativa, cargos e histórico eleitoral. Permitir pesquisa, filtros, séries históricas e comparações com critérios públicos e rastreáveis.

Na inspeção inicial, o diretório continha somente `intention.md`, sem aplicação ou repositório Git. Após os blocos A, B e C, concluídos em 08/09/2026, existem Git em `main`, workspace npm/TypeScript, frontend Next.js responsivo, coletor, SQLite auditável, 25 testes offline, 3 testes end-to-end e cadastro real reconciliado das duas Casas. A listagem, os filtros, os perfis, a rastreabilidade e a metodologia inicial estão ligados ao lote publicado. Ainda não existem métricas ou deploy. O estado executável e as verificações estão em `tasks.md`; as seções futuras deste plano continuam sendo propostas.

## 2. Requisitos de confiabilidade

- Cada fato publicado deve apontar para sua fonte oficial e execução de coleta. Cada indicador deve registrar período, cobertura e versão da metodologia.
- Separar data do evento, competência financeira, data de atualização informada pela fonte e instante de coleta. Coletar hoje não significa que a fonte esteja atualizada até hoje.
- Preservar respostas originais, hashes, parâmetros de consulta e versões dos adaptadores para permitir auditoria e reprocessamento.
- Distinguir zero confirmado, ausência de dados, coleta incompleta, dado desatualizado e indicador não aplicável. Não converter campos ausentes em zero.
- Publicar apenas lotes validados. Falhas preservam a última versão válida, com aviso de defasagem; não devem apagar registros silenciosamente.
- Não juntar pessoas por nome. Usar identificadores oficiais por fonte, vínculos explícitos e tratamento de correspondências ambíguas.
- Preservar mudanças de partido, mandato, licença, suplência, exercício e cargos com intervalos temporais. Não atribuir o partido atual retroativamente.
- Não apresentar custo parcial como custo total do mandato. Não confundir limite autorizado, valor solicitado, valor reembolsado e pagamento efetivo.
- Não deduzir ausência a partir da falta de voto. Não tratar aprovação em uma Casa como transformação em lei.
- Quantidade de proposições, gastos e presença não constituem, isoladamente, medida de qualidade política. Não criar nota geral de desempenho.
- O indicador de verificação do perfil significa identificação e dados conferidos, nunca endosso institucional ou político.

A meta operacional é detectar, impedir e corrigir erros com evidências. Ausência absoluta de erros não pode ser garantida, inclusive porque fontes oficiais podem sofrer retificações.

## 3. Entregas progressivas

| Entrega | Conteúdo | Condição de publicação |
| --- | --- | --- |
| A — Base confiável | Cadastro de ambas as Casas, identificadores, partido/UF, exercício, perfil oficial, busca e filtros | Cadastro reconciliado com fontes e informações temporais rastreáveis |
| B — Gastos de cota | CEAPS e CEAP, documentos, categorias e séries por período | Sem duplicações; valores conciliados; cobertura explícita |
| C — Atuação legislativa | Votos individuais, proposições, autoria, relatorias, cargos e comissões | Estados oficiais preservados e vínculos comprovados |
| D — Indicadores de participação | Presença e participação em votações com metodologia por Casa | Universo elegível, exceções e denominadores comprovados |
| E — Dados eleitorais | Candidaturas, resultados, bens, receitas e despesas de campanha | Vínculos de identidade revisados e adaptadores por eleição |
| F — Custos ampliados e comparação | Subsídio, gabinete, moradia, viagens, séries e rankings delimitados | Atribuição e não sobreposição demonstradas para cada categoria |
| G — Operação pública | Hospedagem, execução agendada, monitoramento, recuperação e metodologia pública | Coleta independente do frontend, restauração testada e orçamento verificado |

Desenvolver o frontend desde a entrega A. Hospedagem é uma decisão posterior, mas o armazenamento e os jobs já devem permitir a separação entre coleta e leitura. Histórico inicial: exercício atual; para gastos, ano corrente e anterior quando disponíveis; para eleições, última eleição com dados e vínculo validados. Toda expansão histórica terá cobertura declarada, sem prometer períodos ainda não importados.

Após presença e participação, executar o complemento F2 descrito em `tasks.md`: reconciliar as rotas sobrepostas de Plenário, matérias, comissões, cargos e lideranças do Senado e as rotas de votações, proposições e órgãos da Câmara. O complemento amplia cobertura e evidência; ausência de voto continua sem valor probatório de ausência.

## 4. Fontes e investigação necessária

Consulta documental inicial em 08/09/2026: catálogo de senadores em exercício, página de API/arquivos da Câmara, portal do TSE e página de gastos da Câmara. Isso não equivale a testar endpoints, autenticação, esquemas ou completude. As demais fontes vieram de `intention.md` e permanecem por validar.

Atualização dos blocos A e B: cadastro, mandatos/filiações do Senado e cadastro/histórico da Câmara foram consultados por HTTPS, persistidos e reconciliados com respostas rastreáveis. Contratos e limites em `docs/sources/`; resultado em `docs/reconciliation/`. A tabela abaixo continua indicando investigações necessárias para outros domínios. TSE e gastos ainda não foram integrados.

| Domínio | Referência oficial | Próxima validação |
| --- | --- | --- |
| Senado: cadastro e atuação | [Catálogo de senadores](https://www12.senado.leg.br/dados-abertos/legislativo/parlamentares/senadores-em-exercicio) | Resolver serviços, formatos, identificadores, histórico e limites |
| Senado: gastos administrativos | [Transparência](https://www25.senado.leg.br/web/transparencia/sen) e [catálogo administrativo](https://www12.senado.leg.br/dados-abertos/conjuntos?grupo=senadores&portal=administrativo) | CEAPS, documentos, folha, benefícios e possibilidade de atribuição individual |
| Câmara: cadastro e atuação | [API e arquivos](https://dadosabertos.camara.leg.br/swagger/api.html) | Endpoints, paginação, histórico e semântica dos campos |
| Câmara: custos | [Gastos parlamentares](https://www.camara.leg.br/transparencia/gastos-parlamentares/) | Separação entre cota, gabinete e demais despesas; valores e competências |
| Eleições e contas | [Portal TSE](https://dadosabertos.tse.jus.br/pt_BR/) e [contas eleitorais](https://dadosabertos.tse.jus.br/dataset/?groups=prestacao-de-contas-eleitorais) | Arquivos por eleição, dicionários, retificações e chaves de candidatura |
| Enriquecimento futuro | [Portal da Transparência](https://portaldatransparencia.gov.br/api-de-dados), [sanções](https://portaldatransparencia.gov.br/sancoes/consulta) e [Receita/CNPJ](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cnpj) | Viabilidade, termos, credenciais, volume e vínculo temporal de fornecedores |

Enriquecimento por sanções/CNPJ fica fora das primeiras entregas. Um vínculo comercial não demonstra irregularidade do parlamentar. Só considerar publicação após definir o significado exato, datas e evidências do vínculo.

Cada integração terá uma ficha em `docs/sources/` com URL exata, responsável institucional, campos, formato, codificação, paginação, chave, cobertura temporal, autenticação, condições de uso, frequência observada, exemplos e limitações. Fonte sem acesso ou sem semântica comprovada bloqueia somente a funcionalidade dependente; a limitação deve ficar registrada.

## 5. Arquitetura proposta

Fluxo: fonte oficial → resposta bruta imutável → adaptação → staging → validação e reconciliação → publicação transacional → consultas do frontend.

Usar TypeScript para compartilhar contratos entre frontend e coletor. Frontend em Next.js, React, Tailwind CSS e componentes shadcn/ui locais. As versões estão fixadas por lockfile e registradas nos [ADRs 001](docs/decisions/001-stack.md) e [003](docs/decisions/003-frontend.md): Next 16.3.4, React 19.2.8, TypeScript 5.9.3 e Tailwind 4.3.3, com npm workspaces.

Coletor executado por CLI em processo independente das requisições web. Preferir API/arquivos oficiais; adotar extração de páginas somente quando necessária, documentada e testada. Jobs devem suportar timeout, retry limitado com backoff, limites por fonte, paginação, checkpoints, bloqueio contra execução concorrente e repetição sem duplicação.

SQLite será o banco local inicial por oferecer transações, restrições e consultas relacionais. JSON servirá como formato de resposta bruta, fixture ou exportação, não como banco principal. Encapsular consultas e migrações para preparar a passagem a PostgreSQL; portabilidade será testada, não presumida. Valores monetários serão armazenados em centavos inteiros com moeda, sem ponto flutuante nos cálculos.

Estrutura prevista, a criar conforme a necessidade:

```text
apps/web/                 # páginas, componentes, consultas no servidor
apps/collector/           # CLI, jobs e adaptadores por fonte
packages/domain/          # contratos, estados e regras de indicadores
packages/db/              # migrações, repositórios e publicação de lotes
docs/sources/             # contratos e evidências por fonte
docs/methodology/         # fórmulas, cobertura, exceções e rotulagem
docs/decisions/           # decisões técnicas e alternativas
tests/fixtures/           # amostras mínimas sem dados pessoais desnecessários
tests/integration/        # importação, reconciliação e publicação
tests/e2e/                # jornadas essenciais do frontend
data/                     # banco e arquivos locais fora do versionamento
```

Não iniciar com microserviços, fila distribuída, autenticação de usuários ou API pública. A interface consulta apenas dados publicados, nunca APIs institucionais diretamente no navegador. Chaves administrativas e de coleta ficam no servidor.

## 6. Modelo de dados por etapas

| Grupo | Entidades e relações |
| --- | --- |
| Auditoria | `sources`, `ingestion_runs`, `raw_objects`, `validation_issues`, `publication_batches`; registros apontam para origem, hash, execução e lote |
| Identidade | `people`, `external_identifiers`, `mandates`, `exercise_periods`, `party_memberships`; chaves externas únicas por fonte e intervalos temporais |
| Financeiro | `expenses`, `expense_documents`, `expense_revisions`, `categories`; identidade de origem, competência, datas, moeda, valor e tipo contábil |
| Legislativo | `proposals`, `proposal_authors`, `rapporteurships`, `deliberations`, `votes`, `sessions`, `attendance`, `offices`, `office_memberships`, `law_links` |
| Eleitoral | `elections`, `candidacies`, `electoral_results`, `declared_assets`, `campaign_transactions`, `identity_links`; identificadores respeitam o escopo de cada eleição |
| Leitura | Agregações por pessoa/Casa/período com cobertura, versão de metodologia, data de cálculo e lote publicado |

Uma pessoa pode ter mandatos diferentes e múltiplos períodos de exercício. Mandato, candidatura e pessoa são entidades distintas. Voto referencia uma deliberação específica, que pode não corresponder à aprovação final da proposição. Manter autoria e coautoria sem atribuir exclusividade indevida.

Adotar estados de disponibilidade explícitos: `available`, `partial`, `unavailable`, `stale` e `not_applicable`. Preservar valores literais oficiais ao lado das normalizações. Conflitos entre fontes geram pendência, não substituição silenciosa. Dados pessoais sem finalidade no produto não serão expostos; minimizar também o conteúdo retido em fixtures e logs.

## 7. Metodologia dos indicadores

Antes de publicar um indicador, criar sua ficha com fonte, fórmula, unidade, universo, filtros, exceções, arredondamento, período e limitações.

| Indicador | Regra de apresentação e validação |
| --- | --- |
| Cotas | Somar valores compatíveis segundo o dicionário da fonte, incorporando estornos e retificações; conciliar com totais oficiais equivalentes |
| Custos ampliados | Identificar sobreposição entre cota, viagens, moradia e outras rubricas; distinguir orçamento disponível de gasto realizado |
| Total do mandato | Somente usar este rótulo com cobertura e composição justificadas; caso contrário, usar “Despesas identificadas nas categorias disponíveis” |
| Variação anual | Comparar períodos equivalentes e mesma cobertura; base zero torna a variação percentual indefinida; explicar mudanças de exercício |
| Presença | Presenças / sessões elegíveis no intervalo de exercício; justificativas, licenças e sessões incluídas seguem metodologia documentada por Casa |
| Participação em votos | Participações / deliberações nominais elegíveis; definir tratamento de abstenção, obstrução, presidência e demais estados conforme fonte |
| Produção legislativa | Contar tipos e situações com definição explícita; separar autoria, coautoria, relatoria, aprovação na Casa e vínculo comprovado com lei |
| Bens | Usar “Bens declarados ao TSE na eleição de YYYY”; não estimar patrimônio atual |
| Campanha | Separar receitas, despesas e situação da prestação de contas, com eleição e versão da declaração |
| Rankings | Exibir métrica, período, amostra, cobertura e desempate; excluir ou destacar casos sem comparabilidade |

Médias e rankings serão separados por Casa inicialmente. Média de percentuais e razão entre totais não são intercambiáveis: escolher e documentar uma. Comparações por partido precisam declarar se usam o partido no evento ou em uma data de referência. Séries monetárias começam em valores nominais; não apresentar interpretação de poder de compra sem metodologia adicional de correção.

## 8. Periodicidade proposta

As frequências abaixo são hipóteses operacionais, não garantias dos órgãos. Ajustar após medir tamanho, limites, atraso e frequência de retificação de cada conjunto.

| Dados | Coleta inicial proposta | Revisão histórica |
| --- | --- | --- |
| Cadastro, exercício e partidos | Diária | Reconciliação semanal do histórico disponível |
| Votações, proposições, relatorias e cargos | Diária | Revisitar últimos 30 dias diariamente e histórico mensalmente |
| Presença | Diária, quando houver fonte utilizável | Revisar mês corrente e anterior semanalmente |
| CEAP/CEAPS | Diária no período recente | Últimos 90 dias diariamente; ano corrente e anterior mensalmente |
| Folha, subsídio e benefícios | Semanal para detectar novas competências | Reimportar competências retificadas e revisar ano mensalmente |
| TSE | Diária na eleição ativa quando viável; semanal fora dela | Comparar hashes; revisão mensal de arquivos históricos utilizados |

Primeiro executar manualmente. Depois agendar as mesmas operações da CLI. Ausência de cursor confiável exige reimportação controlada do arquivo/período. Diferenciar última tentativa de última coleta bem-sucedida. Definir limiar de defasagem por fonte após observar a cadência real. Uma resposta vazia inesperada deve impedir substituição do conjunto completo.

## 9. Experiência visual

Criar identidade editorial sóbria, tipografia legível, espaçamento consistente e componentes shadcn/ui adaptados. Evitar cores partidárias como indicação de mérito. Priorizar mobile, navegação por teclado, contraste, foco visível e tabelas alternativas aos gráficos.

Rotas previstas: listagem de parlamentares; perfil individual com resumo, gastos, atuação, eleições e fontes; comparação; metodologia; status dos dados. Filtros por Casa, UF, partido e período terão estado na URL. Paginar tabelas grandes e oferecer acesso ao detalhe oficial.

Cards e gráficos devem mostrar período e cobertura, com explicação acessível da metodologia. Criar estados de carregamento, erro, vazio, parcial e desatualizado. Sem dados reais validados, mostrar indisponibilidade; dados de demonstração ficam restritos ao desenvolvimento, explicitamente identificados.

## 10. Testes e critérios de passagem

- Contratos de adaptadores com amostras oficiais: campos opcionais, codificação, paginação, alterações de esquema e estados desconhecidos.
- Integração: duplicação, repetição de importação, retificação, falha intermediária, retomada, rollback e preservação do último lote válido.
- Domínio: centavos, estornos, denominador zero, exercício parcial, mudanças partidárias e distinção entre ausência e não participação.
- Reconciliação: registros, valores e períodos comparados com evidência oficial equivalente; divergências explicadas ou bloqueadas.
- Frontend: busca → perfil → origem de um dado; filtros, teclado, mobile e estados de disponibilidade.
- CI sem dependência obrigatória de APIs externas; verificações reais separadas e registradas com data.

Cada entrega só será marcada concluída com artefatos existentes, verificações executadas e limitações registradas em `tasks.md`. Despesas e identidades ambíguas não serão publicadas enquanto a divergência permanecer sem resolução.

## 11. Hospedagem e operação

Desenvolvimento local: frontend, SQLite e CLI. Para publicação, avaliar frontend na Vercel, PostgreSQL/Supabase e armazenamento de respostas brutas em serviço de objetos, com coletor em executor agendado independente. Essa combinação é candidata, não escolha validada nem promessa de gratuidade.

Antes de contratar ou publicar, conferir documentação e condições vigentes: limites de execução, armazenamento, tráfego, cron, pausas, backups, uso permitido e custo excedente. Medir uma carga representativa, incluindo importações históricas do TSE. Não usar SQLite gravável no sistema de arquivos efêmero do frontend hospedado.

Migração para PostgreSQL requer comparar contagens, centavos, chaves e resultados de consultas. Configurar escrita restrita ao coletor, leitura limitada ao frontend, logs sem segredos, backups e restauração testada. Monitorar falha por fonte, registros rejeitados, atraso de atualização, duração e consumo. Documentar rollback de um lote e recuperação de coleta interrompida.

## 12. Ordem de execução

Começar pelo inventário verificável das fontes de cadastro e exercício, antes de criar dependências do produto. Construir a primeira jornada completa com dados reais: coleta → validação → banco → listagem → perfil → fonte. Repetir esse padrão em cada domínio, preservando as diferenças entre Casas.

Os blocos A–F e o complemento F2 estão concluídos. O próximo passo executável é T086 em `tasks.md`, que inicia o bloco eleitoral G; deploy permanece no bloco I.

