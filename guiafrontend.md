# Guia completo do frontend

> Auditoria baseada exclusivamente no código existente em `apps/web` em 16/09/2026. Valores de banco são descritos como dados dinâmicos; exemplos numéricos podem mudar conforme os lotes publicados. Este documento descreve a interface, não o funcionamento interno completo do backend.

## 1. Visão geral

### 1.1 Stack e organização

O frontend é uma aplicação **Next.js 16.3.4** com App Router, **React 19**, TypeScript e **Tailwind CSS 4**. As rotas ficam em `apps/web/app`; componentes compartilhados, em `apps/web/components`; consultas e adaptação dos dados, em `apps/web/lib/data.ts`. Os ícones vêm de `lucide-react`. Não há Recharts, Chart.js ou biblioteca semelhante: `apps/web/components/charts.tsx` desenha barras com HTML e linhas com SVG.

Quase todas as páginas são Server Components. Componentes que dependem de estado ou navegador usam `'use client'`: cabeçalho, filtros eleitorais, seleção de comparação, abas históricas, busca na equipe, timeline expansível e mapa interativo. Rotas alimentadas pelo banco usam `force-dynamic` quando declarado.

### 1.2 Documento global

Arquivo principal: `apps/web/app/layout.tsx`.

Toda página recebe, nesta ordem:

1. link de acessibilidade **“Pular para o conteúdo”**, invisível acima da tela até receber foco;
2. cabeçalho global fixo ao topo;
3. conteúdo da rota;
4. rodapé global.

O `<html>` usa `lang="pt-BR"`. O título padrão da aba é **“Cívica”**; páginas com título próprio usam o molde `título — Cívica`. O conteúdo principal costuma ter `id="conteudo"` e `tabIndex={-1}`, permitindo que o link de salto mova o foco até ele.

### 1.3 Aparência geral

Arquivo: `apps/web/app/globals.css`.

- Fundo da aplicação: bege claro `#f3f1eb` (`--background`).
- Texto principal: verde quase preto `#172c27`.
- Cards: marfim `#faf9f5`.
- Verde institucional: `#115b45`; texto sobre ele: `#f9fcfa`.
- Fundo secundário verde claro: `#dce9e2`.
- Texto secundário: `#60706a`.
- Bordas: `#d6d9d2`.
- Estados: sucesso `#157f58`, alerta `#a65d08`, perigo `#a33a3a`.
- Séries de gráfico: verde `#115b45`, azul-petróleo `#2d7f93`, dourado `#d39a3c` e roxo `#8b6aa8`.
- Texto comum: Arial/Helvetica. Títulos de grande impacto (`display-title`): Georgia/Times, peso 400, letras próximas e entrelinha compacta.

O container `.page-shell` mede `min(1200px, 100% - 48px)`, centralizado. Em telas até 640 px, conserva 14 px em cada lateral (`100% - 28px`). Cards usam normalmente borda de 1 px, fundo `bg-card`, raio entre `rounded-xl` e `rounded-3xl` e sombra discreta. O token de sombra é `0 1px 0 rgba(...)` mais `0 12px 32px rgba(...)`.

Os principais breakpoints observados são `sm` (640 px), `md` (768 px), `lg` (1024 px), `xl` (1280 px). Grids geralmente começam com uma coluna, passam para duas em `sm`/`md` e chegam a três, quatro ou seis em `xl`. Tabelas viram listas de cards abaixo de `md`. Gráficos SVG mantêm largura mínima de 620 px e passam a ter rolagem horizontal quando necessário.

Movimento reduzido é respeitado: com `prefers-reduced-motion`, rolagem suave e transições praticamente desaparecem.

## 2. Estrutura global e componentes fundamentais

### 2.1 Cabeçalho global

Arquivo: `apps/web/components/app-header.tsx`.

Barra `sticky top-0`, `z-40`, com borda inferior, fundo de card a 95% e desfoque. Dentro do container há uma linha de no mínimo 72 px (`min-h-18`), com logo à esquerda e ações à direita.

- Logo Cívica: imagem `/civica-logo.png`, arquivo intrínseco 137 × 48, mostrada com 36 px de altura.
- Navegação desktop, visível a partir de `lg`: **Início**, **Legislativo**, **Estados**, **Assuntos**, **Sobre**. A rota ativa ganha texto verde e borda inferior verde.
- Botão circular de busca: ícone de lupa; abre `/legislativo?busca=`.
- Botão verde **“Explorar →”**: visível a partir de `sm`; abre `/legislativo`.
- Abaixo de `lg`, um `<details>` chamado **“Menu”** abre um painel de 208 px alinhado à direita com os mesmos links. Não existe overlay nem drawer de tela cheia.

### 2.2 Rodapé

Arquivo: `apps/web/components/app-footer.tsx`.

Surge com margem superior de 80 px (`mt-20`), borda superior e fundo de card. Em mobile é uma coluna; a partir de `md`, usa proporção `1.4fr 1fr 1fr`:

1. logo Cívica e frase “Dados públicos do Legislativo com contexto, período, cobertura e origem verificável.”;
2. links **Legislativo**, **Comparar**, **Metodologia**;
3. links externos para Senado Federal e Câmara dos Deputados.

### 2.3 Heroes

Arquivo: `apps/web/components/heroes.tsx`.

`InstitutionHero` é o banner institucional: retângulo verde com raio de 24 px, imagem opcional cobrindo o fundo, gradiente escuro da esquerda para a direita e conteúdo alinhado na parte inferior. Altura mínima: 360 px. Padding: 28 px no mobile e 48 px em `sm`. Exibe contexto em caixa-alta, título serifado de 36 px no mobile e 72 px em `sm`, descrição, ações e localização com ícone de mapa.

`ProfileHero` é o banner dos parlamentares. Ocupa toda a largura, sem cantos arredondados, com retrato 160 px em proporção 4:5, identidade no centro e fontes/cobertura à direita. Em desktop usa colunas `160px 1fr minmax(220px,320px)`; no mobile empilha os três blocos.

### 2.4 Cards e indicadores

Arquivos: `components/ui/card.tsx` e `components/metrics.tsx`.

`KpiGrid` usa uma coluna, duas a partir de `sm` e quatro a partir de `xl`, com gap de 16 px, salvo sobrescrita da página. Cada `KpiCard` possui padding de 20 px, label pequeno cinza, ícone opcional num quadrado verde-claro de 36 px, valor responsivo entre cerca de 21,6 e 30 px, comparação verde, período e selo de cobertura. Se a cobertura for indisponível, o valor visual vira “—”.

`CoverageBadge` mostra ícone e um dos textos: **Disponível**, **Parcial**, **Indisponível**, **Desatualizado**, **Não se aplica**. A nota completa aparece no atributo `title` e no nome acessível.

### 2.5 Tabelas

Arquivo: `apps/web/components/data-table.tsx`.

No desktop (`md` em diante), a tabela fica em card com borda, rolagem horizontal e largura mínima de 680 px. Cabeçalho tem fundo cinza; células usam 16 px nas laterais e 12 px na vertical. Não há ordenação por clique nos cabeçalhos. A ordenação vem da consulta ou dos filtros da página.

Abaixo de `md`, cada linha vira um card; cada coluna é uma linha de duas colunas, com label à esquerda e valor alinhado à direita. A paginação, quando fornecida, mostra **Anterior**, **Página X de Y**, **Próxima**. Estados comuns: **“Não foi possível carregar a tabela”** e **“Nenhum registro neste recorte”**.

### 2.6 Busca e filtros

Arquivo: `apps/web/components/data-controls.tsx`.

`SearchBar` é uma busca GET com ícone dentro de input arredondado de 48 px de altura e botão. Em mobile input e botão ficam empilhados; em `sm`, lado a lado. Durante submissão, o botão vira **“Carregando…”**.

`FilterBar` é um card em grid: uma coluna no mobile, duas em `sm`, quatro em `lg`. Cada campo possui label em negrito e `<select>` nativo. O botão final diz normalmente **“Aplicar filtros”**.

### 2.7 Gráficos

Arquivo: `apps/web/components/charts.tsx`.

Todos ficam em `figure` com borda, raio de 16 px, fundo de card e padding de 20 px. O título fica no topo esquerdo e o selo de cobertura à direita. Todo gráfico possui **“Ver dados do gráfico”**, que expande uma tabela Categoria/Valor. Sem pontos válidos, o gráfico vira um painel de altura mínima 256 px com título, nota de cobertura e selo.

- `BarChart`: barras horizontais verdes; label e valor são sempre visíveis; `title` oferece o valor completo no hover.
- `HistogramChart`: colunas verticais dentro de área de 256 px; valor abreviado acima e categoria abaixo.
- `StackedBarChart`: barras horizontais segmentadas, legenda colorida, total e números por segmento.
- `LineChart`: SVG 720 × 275, mínimo visual de 620 px; três linhas-guia no eixo Y, labels no eixo X, valor acima de cada ponto e tooltip nativo. Aceita limites explícitos, usados para percentuais de 0 a 100.
- `MultiLineChart`: várias linhas coloridas, legenda e tabela adicional **“Ver comparação mensal”**.
- `GroupedBarChart`: grupos com várias barras finas e valores à direita.
- gráfico bullet: barra percentual e linha vertical de referência, descrita como mediana do universo.

### 2.8 Navegação legislativa e de perfil

`LegislativeSubnav` cria uma faixa horizontal com links do módulo legislativo. Ela pode rolar lateralmente em telas pequenas.

Perfis usam uma navegação lateral/por seções com quatro destinos: **Visão Geral**, **Gastos e Equipe**, **Atuação Parlamentar**, **Carreira Política**. O banner do parlamentar é reaproveitado nas quatro rotas. As regras de `globals.css` ocultam grupos de conteúdo conforme `data-profile-section`; portanto as rotas compartilham o documento de dados, mas publicam apenas o conjunto selecionado.

## 3. Rotas e páginas

## `/`

**Arquivo:** `apps/web/app/page.tsx`.

### Objetivo

Entrada pública da Cívica. Apresenta os Poderes Legislativo e Judiciário, mas somente o Legislativo possui navegação funcional; Judiciário está marcado como futuro.

### Estrutura visual

#### 1. Banner principal

Dentro de `.page-shell`, com 32/40 px de padding vertical. Usa `InstitutionHero` com:

- contexto: **“Congresso Nacional · dados oficiais”**;
- título: **“Entenda quem representa você. Pelos dados.”**;
- explicação sobre parlamentares, gastos, participação, atividade e gabinetes;
- imagem do Congresso e localização **“Brasília · DF”**.

#### 2. Portais dos Poderes

Grid de uma coluna, tornando-se duas colunas iguais em `xl`, gap de 16 px.

O card **Poder Legislativo** tem topo com duas colunas de 115 px + restante; em `sm`, 155 px + restante. A ilustração do Congresso fica à esquerda; título, texto e botão **“Explorar Legislativo →”** à direita. Na base, quatro atalhos em duas colunas, passando a quatro em `sm`: **Senadores**, **Deputados Federais**, **Partidos**, **Quem me representa?**. Cada atalho tem altura mínima de 96 px, ícone, título, contagem dinâmica e elevação de 2 px no hover.

O card **Poder Judiciário** repete a composição com balança e martelo, selo **“Em breve”** e ação visualmente desabilitada **“Explorar Judiciário →”**. Os quatro blocos — **Tribunais**, **Magistrados**, **Justiça em números**, **Processos** — têm borda tracejada e não são links.

#### 3. “O que você encontra em cada área?”

Faixa com bordas superior/inferior e fundo de card. Duas colunas a partir de `md`, com divisor vertical. Cada lado tem ícone de 40 px e quatro itens com check. O lado judicial termina com **“Área planejada. Ainda não há dados judiciais publicados neste produto.”**

#### 4. Fontes oficiais

Faixa branca de altura mínima 64 px, horizontalmente rolável. Exibe logos de Senado, Câmara, TSE, CNJ, DataJud e STJ. Um ponto verde indica fonte conectada; fontes futuras ficam em escala de cinza e 45% de opacidade.

## `/legislativo`

**Arquivo:** `apps/web/app/legislativo/page.tsx`.

### Objetivo

Hub do Legislativo, combinando busca, atalhos, panorama das Casas, descoberta temática e listagem filtrada de representantes.

### Blocos

#### 1. Hero próprio

Banner de altura mínima 310 px, imagem do Congresso e gradiente. Em `md`, divide-se em `1.15fr/.85fr`: à esquerda título **“Entenda quem te representa. Pelos dados.”**, explicação, busca e exemplos clicáveis; à direita frase em itálico e placa **“Congresso Nacional / Brasília · DF”**. O lado direito some no mobile.

#### 2. “Comece por aqui”

Quatro cards: **Senadores**, **Deputados Federais**, **Partidos**, **Estados**. Uma coluna no mobile, duas em `sm`, quatro em `xl`. Cada card explica o destino e usa cor própria.

#### 3. “Congresso em números”

Dois painéis horizontais, um do Senado e outro da Câmara. Cada linha identifica a Casa e oferece link para a listagem. Os indicadores incluem número de parlamentares, custo médio mensal da Casa e **tempo médio de tramitação**, usando `processingTime.meanDays`; o Senado usa participação nominal onde presença oficial não é equivalente. Valores, anos, amostra e disponibilidade são dinâmicos.

#### 4. “O que você pode descobrir?”

Grade de links com ícone, título e descrição: **Quanto custa um mandato?**, **Ele participa?**, **O que ele fez?**, **Quem trabalha no gabinete?**, **Proposições**, **Rankings**, **Fornecedores**, **Patrimônio**, **Comparações**.

#### 5. Filtros e representantes

Filtros GET por Casa, UF, partido e busca. A tabela possui colunas **Representante**, **Cargo**, **Estado**, **Partido**, **Custo total (ano)**, **Presença**, ação **Ver perfil**. O custo mostra cota + gabinete + subsídio apenas quando todas as parcelas necessárias existem; cobertura incompleta aparece como travessão. A paginação mostra cinco itens por página.

Estado indisponível: **“Entrada legislativa indisponível”**.

## `/legislativo/senadores` e `/legislativo/deputados`

**Arquivos de rota:** `.../senadores/page.tsx`, `.../deputados/page.tsx`. **Implementação compartilhada:** `components/parliamentary-house-page.tsx`.

### Objetivo e diferenças

Listam os integrantes da Casa e publicam indicadores operacionais. A estrutura é idêntica; textos, fonte, cargo, número esperado e métricas são parametrizados por `source`.

### Blocos

1. `LegislativeSubnav` e hero institucional com busca por nome, partido ou estado.
2. `FilterBar`: **Estado**, **Partido**, **Situação** (em exercício), **Ordenar por** (Nome, Maior cota identificada, Menor cota identificada).
3. **“Eficiência operacional do Senado Federal/Câmara dos Deputados”**: KPIs de representantes, **Backlog publicado**, métrica específica da Câmara quando aplicável, **Tempo médio de tramitação**, **Participação média nominal** e **Custo mensal da Casa**. O tempo usa média da apresentação ao desfecho e mostra `n`.
4. **“Destrinchando os gastos”**: custo mensal destacado e composição em subsídios, CEAPS/CEAP e gabinetes, com proporções visuais e pessoas médias/medianas quando publicadas.
5. Fluxo legislativo: marcos publicados e suas quantidades, apresentados como sequência descritiva; as notas deixam claro quando universos não constituem uma coorte.
6. **“Explore senadores/deputados”**: tabela com **Parlamentar**, **Cota (ano)**, participação/presença aplicável, **Gabinete**, **Propostas**, **Perfil**. Exibe dez por página e mantém ausentes após valores comparáveis ao ordenar por cota.
7. Barra para adicionar pessoas à comparação.
8. Quatro explicadores: **Gastos**, **Votações**, **Propostas**, **Gabinete**.

Grids de KPI passam de duas colunas em `sm` a até seis em `xl`. A tabela segue a transformação móvel padrão.

## Perfis: `/legislativo/senadores/[id]` e `/legislativo/deputados/[id]`

**Arquivos:** páginas finas nas pastas dinâmicas; implementação em `components/parliamentarian-profile-page.tsx`.

### Elementos dinâmicos

Foto, nome, Casa/cargo, partido e logo, UF, período do mandato, URL oficial, fonte, lote, hash, custos, presença, votos, produção, cargos, gabinete e eleições mudam com `[id]`. ID inexistente conduz a `notFound()`.

### Visão geral

1. `ProfileHero`: retrato, cargo, nome, partido/UF, mandato, botões **Perfil oficial** e **Comparar**, além de “Fontes oficiais conectadas”, data, lote, SHA-256 e link de metodologia.
2. Navegação persistente das quatro áreas.
3. Três cards-resumo clicáveis: custo total do ano, participação nominal e propostas de autoria. Cada um conduz à subpágina correspondente.
4. Resumos adicionais publicados no componente, sem o histórico detalhado de mandato; esse histórico fica apenas em Carreira Política.

## `/legislativo/{senadores|deputados}/[id]/gastos-equipe`

### Objetivo

Concentra custo e gabinete mantendo o mesmo hero do parlamentar.

### Blocos

1. **“Quanto custa este mandato?”**: card principal de custo total e cards separados para **Cota parlamentar identificada**, **Subsídio parlamentar mensal** e **Folha bruta/verba do gabinete**. A cota é um link explícito para a análise detalhada de gastos.
2. **“Equipe e recursos do gabinete”** (`cabinet-breakdown.tsx`): três KPIs, tabela pesquisável e painel financeiro.
3. Busca local **“Buscar por nome, vínculo, cargo ou função”**, com contador ao vivo.
4. Tabela de equipe: **Nome**, **Vínculo**, **Cargo/código**, **Função**, **Fonte**. O link **“Oficial ↗”** abre a origem.
5. Câmara: resumo de ano, limite e gasto, mais linhas de limite/gasto mensal. Senado: folha identificada por competência e gráfico de rubricas.

Em desktop, composição e resumo financeiro usam proporção `1.15fr/.85fr`; no mobile empilham.

## `/legislativo/{senadores|deputados}/[id]/atuacao-parlamentar`

### Objetivo e blocos

Mantém o hero e apresenta:

1. **“Ele participa?”**: presença em dias de Plenário e participação nominal como universos separados; KPIs e evolução histórica. O gráfico de presença oferece alternância mês/ano quando há séries adequadas, respeita eixo de 0% a 100% e oferece dados tabulares.
2. **“O que ele fez?”**: cards distintos de **Propostas de autoria**, **Relatorias**, **Propostas ligadas a leis**; não são somados.
3. **“Onde atua?”**: comissões e cargos com função, período e origem.
4. **“Como votou?”**: tabela paginada de votos recentes, com proposição navegável, voto literal em badge colorido, resultado e fonte oficial. Exibe dez registros por página quando a paginação é fornecida.

Estados sem dados usam explicações de cobertura, sem converter ausência em zero.

## `/legislativo/{senadores|deputados}/[id]/carreira-politica`

### Objetivo e blocos

1. **Mandatos como parlamentar**: cards por mandato, ordenados do mais recente, com intervalo de anos, selo **Mandato atual**, cargo/UF, datas e legislatura.
2. **Histórico partidário**: timeline vertical com mini logo, sigla, início e fim; filiação sem fim aparece como **“o presente”**. Registros consecutivos do mesmo partido separados por até três dias são unidos visualmente.
3. **Eleições e patrimônio**: filtros client-side de **Ano**, **Cargo**, **Resultado oficial**; cards **Última candidatura**, **Votos recebidos**, **Bens declarados no pleito**; variação entre eleições; linha do total de bens; cards por candidatura.
4. Em cada candidatura: data, votos, receitas, despesas, tabela de bens (**Tipo**, **Descrição**, **Valor declarado**) e, quando disponível, financiadores (**Financiador**, **CPF/CNPJ publicado**, **Tipo**, **Valor**).

Mensagens possíveis: **“Nenhuma candidatura vinculada”**, **“Nenhuma candidatura neste recorte”**, **“Contas de campanha indisponíveis.”**

## `/parlamentares/[source]/[id]`

Arquivo: `apps/web/app/parlamentares/[source]/[id]/page.tsx`.

Rota de compatibilidade para o perfil unificado. Valida `source` como `senado` ou `camara` e renderiza a mesma interface base dos perfis legislativos. Conteúdo dinâmico segue `[source]` e `[id]`.

## `/parlamentares/[source]/[id]/gastos`

Arquivo: `apps/web/app/parlamentares/[source]/[id]/gastos/page.tsx`.

### Objetivo

Dashboard investigativo da cota de um parlamentar, filtrado por `?ano=`.

### Conteúdo

- retorno ao perfil e cabeçalho com nome, Casa e ano;
- KPIs de total líquido, posição/percentil, maior fornecedor e concentração;
- bloco **“Principais destaques”**, gerado dos dados;
- distribuição por categoria, evolução mensal e comparação mensal com média do partido e da UF;
- benchmark com ranking entre pares e distância da mediana;
- tabela de lançamentos/fornecedores e links para o radar/detalhe do CNPJ quando válido;
- notas de cobertura e período em todos os blocos.

Os gráficos usam os componentes padronizados, exibem valores visíveis, tooltip nativo e tabela expansível. Se o conjunto não estiver publicado, há `EmptyState`, sem gráfico vazio artificial.

## `/legislativo/proposicoes`

Arquivo: `apps/web/app/legislativo/proposicoes/page.tsx`; loading: `loading.tsx`.

### Blocos

1. Hero **“Proposições”**.
2. Formulário em uma coluna, duas em `md` e quatro em `xl`. Campos: **Texto, tipo ou número** (ocupa duas colunas em `xl`), **Casa**, **Tipo**, **Ano**, **Autoria**, **Tema oficial**, botão **Buscar**. Placeholders incluem “Ex.: reforma tributária, PL 1087”, “Nome oficial” e “Quando publicado”.
3. Resultado: contagem e texto de ordenação.
4. Tabela de 20 itens por página: **Proposição**, **O que é**, **Autoria**, **Tema oficial**, **Apresentação**. O título da proposição abre o detalhe. Até três autores aparecem com logo partidária.
5. Card tracejado **“Cobertura dos lotes”**, com volumes por Casa.

Loading: esqueleto pulsante com hero de 208 px, filtro de 160 px e seis linhas de 64 px. Vazio: **“Nenhuma proposição encontrada”**. Indisponível: **“Proposições indisponíveis”**.

## `/legislativo/proposicoes/[source]/[id]`

Arquivo: `apps/web/app/legislativo/proposicoes/[source]/[id]/page.tsx`.

### Blocos

1. Link **“Voltar às proposições”** e hero com Casa/tipo, identificação, ementa, número/ano e botão **“Fonte oficial ↗”**.
2. **“O que é esta proposição?”**: cards **Apresentação**, **Situação oficial**, **Votações relacionadas**.
3. Se for acessória, card verde-claro **“Proposição acessória”**, vínculo com a matéria principal e link **“Abrir matéria principal →”**.
4. **“Autoria e temas”**: duas colunas em `lg`; autores com logo e natureza; temas em badges, inclusive temas herdados explicitamente da matéria principal.
5. **“Tramitação nas Casas”**: timeline vertical. Mostra os 20 marcos mais recentes inicialmente; cada data é um `<details>` clicável com Casa, marco, quantidade de registros, texto integral e fonte. Botão alterna **“Ver histórico completo (N datas)”** e **“Mostrar somente os 20 marcos mais recentes”**.
6. **“Como foi votada?”**: um card por deliberação, com Casa, data, órgão, descrição, resultado e total. Pequenos cards contam cada voto; cards de partido exibem barra segmentada, `n`, badges e percentuais. Link **“Ver lista nominal”** salta à tabela.
7. Tabela nominal: **Parlamentar**, **Partido/UF**, **Voto registrado**, **Registro**. Link para perfil e fonte oficial.
8. **“Documentos, relações e resultado”**, quando existem: cards de documentos, emendas, prazos, órgãos, relações legislativas e norma resultante.

Estados vazios distinguem **“Tramitação não publicada”** e **“Nenhuma votação nominal vinculada”**. Datas inválidas são apresentadas como **“Data não informada”**.

## `/legislativo/partidos`

Arquivo: `apps/web/app/legislativo/partidos/page.tsx`.

Página de panorama por sigla. Após o hero **“Partidos no Congresso”**, um formulário usa a grade `1fr 1fr 2fr auto` em `md`: **Casa** (Congresso/Senado/Câmara), **Ano**, **Buscar partido** com placeholder **“Sigla oficial”** e **Aplicar filtros**.

O bloco **“Panorama partidário · [ano]”** tem cinco KPIs em `xl`: **Partidos representados**, **Senadores**, **Deputados federais**, **Mediana das cotas partidárias** e **Participação partidária mediana**. Em seguida:

1. **“Partidos representados”**: tabela **Partido**, **Senadores**, **Deputados**, **Cota mediana**, **Presença mediana**, **Participação mediana**. Métricas exibem `n`; a identidade da sigla abre seu detalhe.
2. **“Como os partidos votaram?”**: seletor **Votação nominal**, botão **Exibir votação**, card com proposição/descrição/fonte e barra empilhada **“Votos registrados por partido”**. Cada segmento preserva o voto literal; falta de registro não é ausência inferida.
3. **“O que os partidos fizeram?”**: tabela **Partido**, **Propostas apresentadas**, **Relatorias**, **Status oficial aprovado**, **Ligadas a leis**.
4. **“Assuntos em destaque”**: até 12 cards em duas colunas a partir de `md`, cada um com tema, número de proposições e votações. Sem temas, aparece **“Assuntos oficiais indisponíveis”**.
5. Faixa de fontes oficiais do Senado e Câmara.

## `/legislativo/partidos/[party]`

Arquivo: `apps/web/app/legislativo/partidos/[party]/page.tsx`.

### Blocos

1. Hero com logo/sigla e contexto do Congresso.
2. KPIs: **Senadores**, **Deputados federais**, **Custo mediano por mandato**, **Presença mediana**, **Participação mediana**, sempre com período/cobertura.
3. **“Parlamentares do [partido]”**: pílulas para alternar **Senadores (N)** e **Deputados federais (N)**; busca **“Buscar parlamentar do [partido] por nome ou UF”**; tabela paginada com **Nome**, **UF**, **Cargo**, **Cota em [ano]**, **Presença**, **Participação**, **Ver perfil**.
4. Em grid de duas colunas em `xl`, **“Como o [partido] votou?”** possui seletor de votação e barra empilhada; o painel vizinho resume produção legislativa em contagens separadas.
5. Gráficos de cota, presença, participação e produção conforme cobertura, mantendo `n` e período.

Valores são calculados do partido solicitado em `[party]`; sigla inexistente resulta em 404 ou estado indisponível conforme retorno da consulta.

## `/quem-me-representa`

Arquivo: `apps/web/app/quem-me-representa/page.tsx`; mapa: `components/brazil-state-map.tsx`.

### Objetivo e interação

Permite selecionar uma UF por filtro ou diretamente em um SVG fiel do Brasil. Cada estado é um link acessível com nome e sigla. Quando o mapa representa valores, a tonalidade verde varia pela intensidade e o `aria-label` inclui o valor.

Sem UF, o hero contém o seletor **“Selecione seu estado”** e botão **“Ver representantes”**. Abaixo, o título **“Escolha seu estado no mapa”**, uma explicação de que cidade não é inferida e o mapa SVG.

Após a seleção:

1. hero com nome/UF e o mesmo seletor;
2. **“[Estado] no Congresso”**, seletor **“Comparar com outro estado”** e botão **Comparar**;
3. cinco KPIs: **Representantes**, **Cota mediana**, **Presença mediana**, **Participação mediana**, **Vínculos medianos**;
4. dois cards lado a lado em `lg`: **Gabinetes do Senado** e **Gabinetes da Câmara**, cada um com vínculos medianos, métrica financeira mediana, `n` e competência/período;
5. explicador **“Como são escolhidos?”**;
6. tabela **“Senadores de [Estado]”** e tabela paginada de 15 itens **“Deputados federais de [Estado]”**. Colunas: **Representante**, **Cota**, **Presença**, **Votações**, **Gabinete**;
7. **“Explore por assunto”**, busca com placeholder **“Ex.: saúde, educação, segurança…”** e cards de tema;
8. se houver UF comparada, tabela **“Como os estados se comparam?”** com **UF**, **Representantes**, **Cota mediana**, **Presença mediana**, **Participação mediana**, **Senado · folha**, **Câmara · verba**;
9. faixa de fontes oficiais.

As tabelas ligam cada pessoa ao perfil. O fragmento `#deputados` preserva o foco da paginação de deputados.

## `/comparar`

Arquivo: `apps/web/app/comparar/page.tsx`; seletor: `comparison-multi-select.tsx`.

### Objetivo

Comparar parlamentares, partidos ou estados sem produzir nota geral.

### Interações e blocos

1. seletor de modo com URL própria;
2. seletor amigável de múltiplas entidades, com busca/adicionar/remover em vez de `Ctrl/Cmd`; selecionados aparecem como chips;
3. limite dependente do modo e cores consistentes;
4. painéis independentes de **Gastos**, **Presença e participação**, **Produção**, **Gabinete**, **Eleições e patrimônio**;
5. para pessoas, concordância de voto e fidelidade à orientação quando os dados permitem.

Os gráficos usam small multiples, barras agrupadas/empilhadas, linhas e bullet charts. Cada painel mantém unidade, período, universo e cobertura próprios. Comparações incompatíveis entre Casas ocultam ou explicam o painel de gabinete. Estados vazios orientam a escolher entidades ou informam falta de interseção.

## `/legislativo/rankings`

Arquivo: `apps/web/app/legislativo/rankings/page.tsx`.

Ranking navegável por dimensão: gastos de cota, faltas, propostas e relatorias. Filtros incluem dimensão, Casa, UF, partido e ano quando disponíveis. O topo explicita `n` e cobertura. A tabela apresenta posição, parlamentar, partido/UF, valor da dimensão e acesso ao perfil. O significado da coluna varia com a dimensão, sem fundir indicadores distintos em uma nota.

## `/legislativo/fornecedores`

Arquivo: `apps/web/app/legislativo/fornecedores/page.tsx`.

Hero **“Radar de fornecedores”**; busca **“Nome ou CNPJ”**; filtros **Casa** e **Ano**. Três KPIs: **Fornecedores com documento**, **Maior alcance no recorte**, **Período**. Tabela **Fornecedores cruzados** com colunas **Fornecedor**, **Parlamentares**, **Casas**, **Lançamentos**, **Total identificado**. O nome abre o detalhe por CNPJ. Abaixo, nota que valores são líquidos de estornos e homônimos sem documento não são cruzados.

## `/legislativo/fornecedores/[documento]`

Arquivo: `apps/web/app/legislativo/fornecedores/[documento]/page.tsx`.

### Blocos

1. retorno ao radar; hero com nome observado, CNPJ formatado, Casa e link externo para consultar CNPJ;
2. seis KPIs: **Total líquido recebido**, **Parlamentares pagadores**, **Ticket médio por lançamento**, **Concentração no maior pagador**, **Concentração nos 5 maiores**, **Casas com pagamentos**;
3. **“Identificação publicada”**: nome mais recorrente e variações de grafia;
4. duas colunas em `xl`: pagamentos por categoria e mapa **“Onde recebe mais?”**;
5. pagamentos por partido, chips com logos, e pagamentos por Casa;
6. linha **“Evolução mensal dos pagamentos em [ano] (R$)”**;
7. tabela **“Quem pagou este fornecedor?”**: **Posição**, **Parlamentar**, **Valor líquido**, **Participação**, **Lançamentos**;
8. card **“Como ler esta página”**, esclarecendo limites cadastrais, exclusão de CPF e natureza indiciária da concentração.

A página só é publicada para CNPJ válido; documento inválido resulta em 404.

## `/legislativo/patrimonio`

Arquivo: `apps/web/app/legislativo/patrimonio/page.tsx`.

Hero de variação patrimonial declarada entre dois pleitos. Dois KPIs: **Parlamentares comparáveis** e **Maior variação percentual**. Tabela: **Posição**, **Parlamentar**, ano inicial, ano final, **Variação nominal**. Paginação de 25. A nota **“Como ler”** explica que são declarações eleitorais nominais, sem correção pela inflação.

## `/metodologia`

Arquivo: `apps/web/app/metodologia/page.tsx`.

Página editorial longa, em seções e cards, que explica fontes, cobertura, ausência, períodos, conceitos de gasto, presença, participação, eleições, privacidade e limitações. Usa o mesmo container, tipografia de títulos, bordas e fundos. Links externos conduzem às fontes oficiais. Não possui filtros nem dados manipuláveis.

## `/design-system`

Arquivo: `apps/web/app/design-system/page.tsx`.

Vitrine interna dos tokens e componentes: cores, tipografia, botões, badges, inputs, cards, KPIs, estados e outros padrões. Serve como referência visual, mas é uma rota pública no App Router. Os exemplos não representam necessariamente dados reais.

## Página 404

Arquivo: `apps/web/app/not-found.tsx`.

Estado simples dentro de `.page-shell`, com título de página não encontrada, explicação e link para retornar à entrada legislativa. Continua envolvido pelo header e footer globais.

## 4. Componentes reutilizados

### `PartyLogo`

Arquivo: `components/party-logo.tsx`. Resolve a imagem da sigla; quando não há arquivo válido, apresenta fallback textual. Usado em perfis, partidos, proposições, patrimônio, fornecedores e eleições.

### `OfficialPortrait` e `InstitutionalImage`

Arquivo: `components/app-image.tsx`. Controlam fallback e enquadramento de retratos e fundos oficiais. Retratos são normalmente `object-cover`; imagens institucionais cobrem toda a área.

### `EmptyState`

Arquivo: `components/empty-state.tsx`. Card tracejado/centralizado com título e descrição. Distingue indisponibilidade, ausência no recorte e erro de consulta por meio do texto fornecido pela página.

### `SectionHeader` e `SectionTabs`

Arquivo: `components/section-navigation.tsx`. `SectionHeader` cria âncora com compensação para cabeçalho fixo. `SectionTabs` é sticky, rolável horizontalmente e acompanha a seção visível via `IntersectionObserver`.

### `MandateOverview`

Arquivo: `components/mandate-overview.tsx`. Duas colunas em `lg`: mandatos em cards e filiações em timeline. É usado na área de carreira.

### `ElectoralProfileSection`

Arquivo: `components/electoral-profile.tsx`. Componente client-side responsável por filtros eleitorais, KPIs, variação patrimonial, gráfico, candidaturas, bens e financiadores.

### `CabinetBreakdown`

Arquivo: `components/cabinet-breakdown.tsx`. Componente client-side de equipe, busca local, tabela e painel financeiro específico por Casa.

### `PropositionTimeline`

Arquivo: `components/proposition-timeline.tsx`. Agrupa eventos por data, escolhe uma situação como marco principal, limita a 20 datas e expande cada data com `<details>`.

### `VoteBadge`

Arquivo: `components/vote-badge.tsx`. Normaliza apresentação visual de Sim, Não, abstenção e códigos literais, usando cores sem alterar o conteúdo oficial.

### Componentes UI básicos

`Button`, `Badge`, `Card`, `Input` e `NativeSelect` ficam em `components/ui`. São componentes pequenos inspirados no padrão shadcn, mas mantidos localmente. Botões têm variantes e tamanhos por `class-variance-authority`; inputs/selects recebem borda, fundo, foco visível e estados desabilitados.

## 5. Estados condicionais e acessibilidade

- Cobertura ausente nunca deve ser visualmente convertida em zero; usa travessão, “N/D”, “Indisponível” ou `EmptyState`.
- Listagens sem linhas viram cards explicativos.
- A rota de proposições possui loading próprio; as demais dependem do comportamento padrão do Next.js e não têm `loading.tsx` local identificado.
- Não foram encontrados modais. Expansões usam `<details>` e botões inline.
- Links e controles importantes têm foco visível de 2 px com offset de 4 px.
- Ícones decorativos frequentemente usam `aria-hidden`; buscas têm label visual ou `sr-only`.
- Gráficos possuem `role="img"`, descrição acessível, valores textuais e tabelas alternativas.
- Mapas têm links e `aria-label` por UF.
- A interface não depende apenas de cor para cobertura: ícone e texto acompanham o estado.

## 6. Design system observado

### Cores

| Papel | Valor |
|---|---|
| Fundo | `#f3f1eb` |
| Texto | `#172c27` |
| Card | `#faf9f5` |
| Primária | `#115b45` |
| Secundária | `#dce9e2` |
| Texto secundário | `#60706a` |
| Borda | `#d6d9d2` |
| Sucesso | `#157f58` |
| Alerta | `#a65d08` |
| Perigo | `#a33a3a` |

### Tipografia

Arial/Helvetica para interface; Georgia/Times para heroes. Eyebrows usam cerca de 11,5 px, peso 800, caixa-alta e espaçamento de 0,17 em. Títulos de seção são geralmente 24–30 px; títulos de hero, 36–72 px; corpo, 14–18 px; notas, 12 px.

### Espaçamento e forma

Escala recorrente de 8, 12, 16, 20, 24, 28, 32, 40, 48 e 56 px. Cards comuns têm 16–24 px de padding. Raios recorrentes: 8 px em controles pequenos, 12 px em botões/blocos, 16 px em cards e 24–28 px em heroes.

### Botões e links

Botão principal verde com texto claro, altura confortável e cantos arredondados. Secundários usam borda/fundo claro. Links contextuais costumam ser verdes e sublinhados. Hover dos atalhos pode alterar borda/fundo e deslocar levemente o card.

### Badges

Pílulas compactas para siglas, estados, votos e contexto. Cobertura é um badge sem cápsula pesada: ícone pequeno + texto cinza.

### Tabelas

Desktop em tabela tradicional; mobile em cards rotulados. Números podem ser alinhados à direita e usar `tabular-nums`. Paginação é externa à tabela.

### Gráficos

Gráficos têm moldura uniforme, dados textuais visíveis, hover por `title`, tabela expansível e selo de cobertura. Linhas usam SVG; barras usam elementos HTML. Não há animação significativa.

### Ícones

Lucide com traço padrão, normalmente 13–20 px; heroes podem usar 29–72 px. Ícones ficam à esquerda de títulos/ações ou em quadrados de 36–40 px.

### Responsividade

Mobile-first. Navegação desktop surge em `lg`; cards geralmente passam a duas colunas em `sm`/`md`; painéis complexos passam a duas colunas em `lg`/`xl`; tabelas mudam integralmente de representação em `md`; SVGs largos ganham rolagem.

## 7. Inventário final de rotas

| Rota | Página | Tipo | Descrição |
|---|---|---|---|
| `/` | Home | Estática com dados | Entrada por Poder e fontes oficiais |
| `/legislativo` | Hub legislativo | Dinâmica | Busca, panorama, atalhos e representantes |
| `/legislativo/senadores` | Senadores | Lista dinâmica | Indicadores do Senado e lista de senadores |
| `/legislativo/deputados` | Deputados | Lista dinâmica | Indicadores da Câmara e lista de deputados |
| `/legislativo/senadores/[id]` | Perfil de senador | Dinâmica | Visão geral individual |
| `/legislativo/deputados/[id]` | Perfil de deputado | Dinâmica | Visão geral individual |
| `/legislativo/senadores/[id]/gastos-equipe` | Gastos/equipe do senador | Dinâmica | Custos e gabinete |
| `/legislativo/deputados/[id]/gastos-equipe` | Gastos/equipe do deputado | Dinâmica | Custos e gabinete |
| `/legislativo/senadores/[id]/atuacao-parlamentar` | Atuação do senador | Dinâmica | Participação, produção, cargos e votos |
| `/legislativo/deputados/[id]/atuacao-parlamentar` | Atuação do deputado | Dinâmica | Presença, produção, cargos e votos |
| `/legislativo/senadores/[id]/carreira-politica` | Carreira do senador | Dinâmica | Mandatos, filiações, eleições e bens |
| `/legislativo/deputados/[id]/carreira-politica` | Carreira do deputado | Dinâmica | Mandatos, filiações, eleições e bens |
| `/parlamentares/[source]/[id]` | Perfil compatível | Dinâmica | Alias de perfil unificado por fonte |
| `/parlamentares/[source]/[id]/gastos` | Inteligência de gastos | Dinâmica | Detalhamento da cota e benchmarks |
| `/legislativo/proposicoes` | Proposições | Lista dinâmica | Pesquisa e filtros de matérias |
| `/legislativo/proposicoes/[source]/[id]` | Proposição | Dinâmica | Identidade, tramitação, votação e documentos |
| `/legislativo/partidos` | Partidos | Lista dinâmica | Panorama por sigla |
| `/legislativo/partidos/[party]` | Partido | Dinâmica | Detalhamento da sigla |
| `/quem-me-representa` | Estados | Dinâmica | Mapa e representantes por UF |
| `/comparar` | Comparações | Dinâmica | Comparação multidimensional |
| `/legislativo/rankings` | Rankings | Dinâmica | Rankings por dimensão, UF e partido |
| `/legislativo/fornecedores` | Radar de fornecedores | Dinâmica | CNPJs cruzados entre parlamentares |
| `/legislativo/fornecedores/[documento]` | Fornecedor | Dinâmica | Distribuição, concentração e pagadores |
| `/legislativo/patrimonio` | Patrimônio | Dinâmica | Ranking entre declarações eleitorais |
| `/metodologia` | Metodologia | Estática/editorial | Conceitos, fontes e limites |
| `/design-system` | Design system | Estática | Vitrine de componentes e tokens |
| rota não encontrada | 404 | Estado global | Orienta retorno à área legislativa |

## 8. Checklist da auditoria

- [x] Rotas do diretório `app` inventariadas, incluindo segmentos dinâmicos.
- [x] Layout, header, footer e CSS global analisados.
- [x] Componentes filhos centrais seguidos a partir das páginas.
- [x] Cards, tabelas, gráficos, filtros, buscas, paginação e estados vazios descritos.
- [x] Loading explícito identificado.
- [x] Responsividade traduzida dos breakpoints Tailwind.
- [x] Interações de clique, expansão, filtros, seleção e navegação registradas.
- [x] Design system documentado somente com tokens presentes no código.
- [x] Conteúdo dinâmico diferenciado de texto fixo.
- [x] Nenhuma dimensão em pixels foi atribuída onde o código usa apenas tamanho automático ou relativo.
