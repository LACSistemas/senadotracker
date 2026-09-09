Vamos adequar os dados e o nosso frontend existente, a um mockup existente. Aqui estão os dados do mockup, vc vai criar a taskfase2.md onde seria as tasks de  adaptabilidade disso sem perder nosso estilo de UI/UX para a integração de algo que serviria a esse mockup. 

Somente tire qualquer coisa do Judiciário por ora, por enquanto vai ser tudo e telas e paginas somente do legislativo. 
Mas vou incluir o conteúdo do mockups na integra

Home / Entrada
Rota sugerida: /
É a tela que aparece no início e novamente quando o walkthrough troca do Judiciário para o Legislativo. O objetivo é dividir o produto em dois caminhos principais.
Header
Uma única linha:
[Logo] Início | Legislativo | Judiciário | Estados | Assuntos | Sobre | 🔍 | [Explorar a plataforma →]
Início aparece ativo com underline azul.
Hero
Banner horizontal ocupando quase toda a largura.
Background: imagem do Congresso Nacional.
À esquerda:
Entenda o setor
 público pelos dados.
Texto:
Organizamos, em um só lugar, informações oficiais sobre representantes, tribunais, magistrados, gastos, atividade e instituições públicas do Brasil.
Abaixo, uma pequena linha decorativa azul e a frase:
MAIS TRANSPARÊNCIA. UMA SOCIEDADE MAIS INFORMADA.
À direita do hero:
INFORMAÇÃO FORTALECE A DEMOCRACIA
No canto inferior direito da foto:
Brasília · DF
 Nosso país. Dados para todos.
Escolha de poder
Duas caixas grandes, 50/50.
Card Poder Legislativo
Tem imagem/ilustração do Congresso à esquerda.
Título:
PODER LEGISLATIVO
Poder Legislativo
Descrição sobre senadores, deputados, partidos, estados, gastos, votações e atividade legislativa.
Botão:
Explorar Legislativo →
Abaixo há 4 mini-cards:
Senadores — 81 senadores
Deputados Federais — 513 deputados
Partidos — Todos os partidos
Quem me representa? — Por estado e cidade
Card Poder Judiciário
Mesmo layout.
Botão:
Explorar Judiciário →
4 mini-cards:
Tribunais
Magistrados
Justiça em números
Processos
O que você encontra em cada área?
Duas colunas.
Legislativo: lista de quatro checkmarks sobre parlamentares, partidos, gastos/cotas e votações/projetos.
Judiciário: lista de quatro checkmarks sobre tribunais, magistrados, custos e processos.
Fontes
Faixa horizontal com logos de:
Senado Federal | Câmara dos Deputados | TSE | CNJ | DataJud | STJ
Não há gráficos nesta página.

2. Landing do Judiciário
Rota sugerida: /judiciario
A apresentação define esta tela como a entrada para tribunais, magistrados, processos e os principais números da Justiça.
Hero
Foto do STF com estátua da Justiça.
Título:
Entenda como funciona
 a Justiça. Pelos dados.
Texto explicativo curto.
Logo abaixo existe uma barra de busca grande, com placeholder semelhante a:
Buscar tribunal, magistrado, processo ou assunto...
e botão:
Buscar
Abaixo aparecem exemplos clicáveis:
STF • STJ • Justiça Federal • Nome de magistrado • Processo nº
Comece por aqui
Uma linha com 4 cards navegacionais grandes:
Tribunais
ícone de tribunal
estrutura e funcionamento
Magistrados
ícone de pessoa
juízes, desembargadores e ministros
Processos
ícone de documento
tramitação, estoque e tipos
Justiça em números
ícone de barras
principais indicadores
Judiciário em números
Uma linha com 5 KPI cards:
Custo total da Justiça
Magistrados
Servidores
Processos pendentes
Tempo mediano de tramitação
Cada card contém:
ícone + nome do KPI + valor grande + período + variação vs. período anterior
Exemplo visual:
↑ +4,2% em verde.
O que você pode descobrir?
Mais 4 cards explicativos/CTA:
Quanto custa a Justiça?
Quantos processos estão acumulados?
Quanto tempo leva?
Quem são os magistrados?
Explore os tribunais
Linha com 6 cards institucionais:
STF | STJ | Justiça Federal | Justiça Estadual | Justiça do Trabalho | Justiça Eleitoral
Cada um tem logo/ícone, nome, descrição e Ver dados →.

3. Lista / comparação de Tribunais
Rota sugerida: /judiciario/tribunais
Aqui a função principal é comparar custo, magistrados, backlog e tempo antes de abrir um tribunal.
Breadcrumb
Início > Judiciário > Tribunais
Hero
Título grande:
Tribunais
Texto explicativo à esquerda e imagem do STF à direita.
Filtros
Logo abaixo do hero existe uma linha com 3 controles + botão:
Ramo da Justiça — dropdown
Localidade — dropdown
Buscar tribunal — campo texto
Buscar — botão azul
KPIs
5 cards:
Tribunais acompanhados
Magistrados
Custo mediano por tribunal
Processos pendentes
Tempo mediano
Cards de exploração
4 cards:
Quanto custa cada tribunal?
Quantos processos estão em estoque?
Quanto tempo os casos levam?
Quantas pessoas trabalham na estrutura?
Visualizações
Duas visualizações lado a lado.
Gráfico 1 — barras
Distribuição dos custos dos tribunais
Bar chart vertical.
Categorias:
STF | STJ | TRFs | TJs | TRTs | TREs | Outros
Ao lado do gráfico há um callout grande mostrando o custo mediano.
Gráfico 2 — barras agrupadas
Estoque de processos x processos baixados
Cada tribunal possui duas barras:
azul = processos pendentes;
verde = processos baixados.
Tabela
Título:
Explore os tribunais
Colunas:
Tribunal | Ramo da Justiça | Magistrados | Custo anual | Processos pendentes | Tempo mediano | Ações
Cada linha termina em:
Ver tribunal →

4. Tribunal em detalhe — STJ
Rota sugerida: /judiciario/tribunais/:id
O mockup usa STJ como exemplo. A página começa pelos KPIs do tribunal e depois apresenta seus magistrados.
Hero institucional
Breadcrumb:
Judiciário > Tribunais > STJ
Título enorme:
Superior Tribunal de Justiça (STJ)
Texto descritivo sobre a função do tribunal.
Background com imagem do STJ.
No canto direito existe um card flutuante de fontes:
Fontes oficiais conectadas
CNJ — atualizado em data X
DataJud — atualizado em data X
STJ — atualizado em data X
Link:
Ver todas as fontes e metodologia →
KPIs
5 cards em uma linha:
Magistrados
Custo anual do tribunal
Processos em estoque
Processos baixados
Tempo mediano de tramitação
Quem faz parte do STJ?
Tabela com foto dos magistrados.
Colunas:
Nome | Cargo | Total pago no ano | Processos em estoque | Tempo mediano | Ver perfil
Botão por linha:
Ver perfil →
Quanto custa o STJ?
Card grande à esquerda contendo um donut / pie chart.
Centro do donut:
R$ X bilhão
Legenda lateral dividindo o custo em aproximadamente quatro categorias:
remuneração dos magistrados;
servidores e apoio;
tecnologia e infraestrutura;
outras despesas.
Cada categoria possui % + valor.
Como estão os processos?
À direita há 5 mini KPI cards:
Novos processos
Processos em estoque
Processos baixados
Taxa de congestionamento
Tempo mediano
Todos com:
valor + seta/tendência + comparação com ano anterior.
Entenda os dados
3 cards explicativos:
Custo do tribunal
Processos
Tempo de tramitação

5. Perfil de Magistrado
Rota sugerida: /judiciario/magistrados/:id
O deck define este nível como a visão individual de remuneração, processos, decisões, órgãos de atuação, apoio e histórico.
Esta é uma das telas mais densas.
Hero de perfil
Foto grande do magistrado à esquerda.
Ao lado:
Ministro Carlos Andrade
Superior Tribunal de Justiça (STJ)
Badge:
Ministro
Breve descrição da carreira.
Botões:
Ver no site do CNJ ↗
Comparar
Background do STJ.
À direita aparece novamente o card:
Fontes oficiais conectadas
Tabs
Barra horizontal:
Visão geral | Remuneração | Processos | Estrutura de apoio | Histórico
Seção 1 — Quanto foi pago?
Marcada visualmente por um círculo azul 1.
3 cards grandes:
Total pago no ano
Valor grande + crescimento percentual.
Remuneração base
Valor total + breakdown:
subsídio mensal;
13º salário;
férias.
Verbas, benefícios e indenizações
Valor total + breakdown:
auxílio-moradia;
auxílio-saúde;
indenizações e outras verbas.
Seção 2 — Como está sua carga de trabalho?
4 KPI cards:
Processos em estoque
Novos processos
Processos julgados/baixados
Tempo mediano de julgamento
Todos apresentam comparação anual.
Seção 3 — O que decidiu?
À esquerda, 3 cards KPI:
Decisões
Acórdãos
Sessões
À direita:
Tabela “Últimos julgamentos”
Colunas visuais:
Data | Processo | Matéria | Resultado | Ver detalhes
Resultados usam badges:
verde;
vermelho.
Seção 4 — Onde atua?
Dois cards.
Órgãos e colegiados
Lista de órgãos com função:
Terceira Turma — Membro
etc.
Estrutura de apoio
Lista de:
servidores no gabinete;
assessores;
estagiários;
cargos em comissão.
Seção 5 — Como isso mudou ao longo do tempo?
Card grande com tabs internas:
Pagamentos | Processos julgados | Tempo de julgamento
Line chart temporal, aproximadamente 2019–2026.
À direita do gráfico há KPI-resumo com valor atual e crescimento acumulado.

6. Landing do Legislativo / Congresso
Rota sugerida: /legislativo
A arquitetura volta a ser a mesma do Judiciário, mas aplicada a representação, custo, participação e produção legislativa.
Hero
Foto do Congresso.
Título:
Entenda quem te representa.
 Pelos dados.
Texto introdutório.
Busca:
Buscar senador, deputado, partido ou estado...
botão Buscar.
Comece por aqui
4 cards:
Senadores
Deputados Federais
Partidos
Quem me representa?
Congresso em números
Duas linhas institucionais.
Senado Federal
Card de identificação + 4 KPIs:
81 senadores
27 estados
gasto mediano do mandato
presença mediana
Câmara dos Deputados
Mesma estrutura:
513 deputados
27 UFs
gasto mediano
presença mediana
O que você pode descobrir?
4 cards:
Quanto custa um mandato?
Ele participa?
O que ele fez?
Quem trabalha no gabinete?
Explore os dados
Tabela misturando senadores e deputados.
Existe seletor:
Todos | Senado | Câmara
Colunas:
Nome | Casa | Cargo | Estado | Partido | Custo do mandato | Presença | Ver perfil
Compare parlamentares
Barra horizontal com seletores de parlamentares + botão:
Comparar

7. Senadores
Rota sugerida: /legislativo/senadores
A tela combina panorama do Senado, custos, participação, atividade, gabinete e lista dos parlamentares.
Subnav
Logo abaixo do header:
Senadores | Deputados Federais | Partidos | Estados
Hero
Título:
Senadores
Descrição.
Busca de senador por:
nome, partido ou estado.
Filtros
4 dropdowns:
Estado
Partido
Situação
Ordenar por
Senado hoje
5 KPI cards:
81 senadores
27 estados representados
gasto mediano
presença mediana
participação mediana em votações
Linha analítica
Quatro grandes blocos.
Quanto custam os mandatos?
Contém:
mediana;
P25–P75;
faixa observada;
histograma/bar chart de distribuição de gastos.
Eles participam?
Dois KPI cards:
presença;
participação em votações.
O que fazem?
3 KPIs:
propostas apresentadas;
relatorias;
propostas que viraram lei.
Gabinetes
3 KPIs:
servidores;
custo mediano;
escritórios.
Explore os senadores
Tabela.
Colunas:
Nome | Partido/UF | Custo do mandato | Presença | Votações | Gabinete | Ver perfil
Compare senadores
Faixa com dois campos de seleção e botão:
Comparar
Entenda os dados
4 cards explicativos:
Gastos | Votações | Propostas | Gabinete

8. Perfil individual de Senador
Rota sugerida: /legislativo/senadores/:id
O perfil foi pensado para responder sequencialmente: custo, participação, produção, atuação, votação, eleição e histórico.
Hero
Foto do parlamentar.
Nome + selo de verificação.
PSD • São Paulo (SP)
Badge:
Senador da República
Mandato e início no Senado.
Botões:
Ver no site do Senado ↗
Comparar
Ao fundo, Congresso.
À direita:
Fontes oficiais conectadas
Tabs
Há 8 tabs:
Visão geral
Gastos
Presença e votações
Atuação legislativa
Comissões e cargos
Gabinete
Eleições e patrimônio
Histórico
1 — Quanto custa este mandato?
3 cards:
Custo total do mandato
Valor + comparação anual.
Gastos do senador
Valor total + breakdown:
salário/subsídio;
cota parlamentar;
passagens e diárias;
outros.
Gastos do gabinete
Valor +:
folha da equipe;
escritórios;
outros custos;
número de funcionários.
2 — Ele participa?
Duas métricas grandes:
Presença em sessões
Percentual + progress bar + mediana de referência + contagens.
Participação em votações
Mesmo padrão.
À direita:
bar chart vertical “Evolução anual da presença”, com anos em sequência.
3 — O que ele fez?
3 cards:
Propostas apresentadas
Relatorias
X propostas viraram lei
Os dois primeiros usam stacked bars horizontais para mostrar status.
4 — Onde atua?
Dois cards:
Comissões e cargos
Gabinete
5 — Como votou?
Tabela das votações recentes.
Colunas:
Data | Proposição | Tema | Votou | Resultado
SIM, NÃO e Não participou usam badges coloridos.
6 — Ele foi eleito com quantos votos?
3 mini-cards:
última eleição + votos;
gastos de campanha;
bens declarados.
7 — Como isso mudou ao longo do tempo?
Grande line chart.
Tabs internas:
Custo total | Gastos do senador | Gastos do gabinete | Presença | Votações | Propostas
Resumo numérico à direita.

9. Deputados Federais
Rota sugerida: /legislativo/deputados
A estrutura replica deliberadamente Senadores, mas usa as métricas próprias da Câmara.
Hero
Título:
Deputados Federais
Busca por nome, partido ou estado.
Filtros
4 dropdowns:
Estado
Partido
Situação
Ordenar por
botão:
Aplicar filtros
Câmara hoje
5 KPIs:
513 deputados
27 UFs
gasto mediano
presença mediana
participação mediana em votações
Quatro blocos analíticos
Quanto custam os mandatos?
Resumo + histograma de custos.
Eles participam?
2 KPIs.
O que fazem?
3 KPIs:
proposições apresentadas;
relatorias designadas;
proposições aprovadas que viraram lei.
Gabinetes
3 KPIs.
Explore os deputados federais
Tabela mostrando 10 registros no mockup.
Colunas:
Nome | Partido/UF | Custo do mandato | Presença | Votações | Gabinete | Ver perfil
Compare deputados
Aqui aparecem 3 campos de seleção de deputado + botão:
Comparar
Entenda os dados
4 cards:
Gastos | Votações | Propostas | Gabinete

10. Partidos no Congresso
Rota sugerida: /legislativo/partidos
A tela compara representação, custo, presença/participação e depois mostra comportamento em votações e produção legislativa.
Hero
Título:
Partidos no Congresso
Descrição e background do Congresso.
Navegação/filtros
Linha com:
Todos os partidos
Senado
Câmara dos Deputados
Comparar partidos
À direita:
campo Buscar partido.
KPIs
5 cards:
partidos com representação
senadores
deputados federais
custo mediano por mandato
participação mediana em votações
Tabela de partidos
Colunas:
Sigla
Nome do partido
Senadores
Deputados
Custo mediano por mandato
Presença mediana em sessões
Participação mediana em votações
Ver partido
Parte inferior: 3 painéis numerados
1. Como os partidos votaram?
Dropdown para selecionar uma proposição.
Em seguida existe um stacked horizontal bar chart por partido.
Legenda:
verde = Sim
vermelho = Não
cinza/azulado = Abstenção
cinza claro = Não participaram
Cada barra soma 100%.
2. O que os partidos fizeram?
Tabela compacta:
Partido | Proposições apresentadas | Relatorias | Proposições aprovadas | Proposições que viraram lei
3. Assuntos em destaque
Lista vertical de temas.
Exemplos:
Economia
Saúde
Educação
Segurança pública
Meio ambiente
Cada linha possui:
ícone + tema + nº de proposições + nº de votações + chevron

11. Quem me representa?
Rota sugerida: /quem-me-representa
Aqui a entrada é o estado do cidadão, trazendo o Congresso para um panorama local.
Essa tela tem uma pequena diferença de header em relação às demais.
Header
Além do logo, aparecem:
Início | Senadores | Deputados Federais | Votações | Projetos de Lei | Estados | Sobre
À direita há uma busca grande diretamente no header:
Buscar parlamentar, projeto ou assunto...
Hero
Título:
Quem me representa?
Subtítulo:
Veja os senadores e deputados federais do seu estado.
Campo grande de localização/estado:
📍 São Paulo (SP)
Botão:
Ver meus representantes
Imagem do Congresso à direita.
Panorama do estado
Título:
São Paulo no Congresso: panorama em números
No canto direito:
Comparar com outro estado [Selecione um estado ▼]
KPIs
5 cards:
representantes
custo mediano do mandato
presença mediana
participação mediana
funcionários medianos por gabinete
Seus representantes por São Paulo
Duas colunas grandes.
Coluna esquerda — Senadores de São Paulo
Mostra os 3 senadores.
Cada registro possui:
foto;
nome;
partido/UF;
mandato;
badge Em exercício;
gasto;
presença;
votações;
funcionários;
chevron para abrir perfil.
Coluna direita — Deputados Federais de São Paulo
Indica que existem 70 deputados e exibe alguns inicialmente.
Cada linha possui praticamente os mesmos KPIs dos senadores.
Existe link:
Ver todos os 70 deputados de São Paulo →
Banner explicativo
No topo das listas:
Como são escolhidos?
Texto explicando 3 senadores e 70 deputados.
Parte inferior
3 cards horizontais.
Explore por assunto
Campo:
Ex.: saúde, educação, segurança...
botão Buscar.
Principais temas em que votaram
Pills clicáveis:
Saúde
Segurança pública
Reforma tributária
Educação
Meio ambiente
Como São Paulo se compara?
Dropdown de estado + botão Comparar.

Estrutura que eu passaria para o agente
O ponto mais importante é dizer para ele não criar 11 designs independentes.
Existem componentes claramente reutilizáveis:
<AppHeader />

<InstitutionHero />
<ProfileHero />

<SearchBar />
<FilterBar />

<KpiCard />
<KpiGrid />

<NavigationCard />
<ExplainerCard />

<DataTable />

<HistogramChart />
<BarChart />
<StackedBarChart />
<DonutChart />
<LineChart />

<OfficialSourcesCard />
<OfficialSourcesStrip />

<ComparisonBar />

<SectionHeader number={} />
<AppFooter />
E eu daria esta regra para implementação:
IMPORTANTE:

O PPTX é referência visual, e não fonte de dados.

Não hardcode os números presentes no mockup.
Todos os valores, listas, tabelas, séries históricas e filtros
devem ser obtidos do SQLite já existente.

Preservar a arquitetura visual do mockup:

1. Hero/contexto
2. filtros ou navegação
3. KPIs de panorama
4. blocos analíticos
5. gráficos
6. tabelas detalhadas
7. drill-down para instituição ou pessoa
8. fontes oficiais / metodologia

Priorizar componentes reutilizáveis entre:

- Judiciário / Legislativo
- Tribunais / Senadores / Deputados
- Magistrado / Parlamentar

As páginas Senadores e Deputados Federais devem compartilhar
a mesma estrutura-base, trocando apenas métricas, labels,
queries e campos específicos de cada casa legislativa.

As páginas de perfil de Magistrado e Parlamentar devem seguir
o mesmo princípio de seções numeradas, cards KPI, tabelas
operacionais e série histórica.
Essa especificação corresponde às 11 telas únicas do mockup; a apresentação possui 12 passos porque a Home é exibida novamente no passo 6 para iniciar o fluxo Legislativo.


