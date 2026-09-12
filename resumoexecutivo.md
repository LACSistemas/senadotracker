# Cívica — resumo executivo

## 1. O que é o sistema

O Cívica é uma aplicação de transparência legislativa que reúne dados públicos do Senado Federal, da Câmara dos Deputados e do Tribunal Superior Eleitoral em uma experiência única de consulta. O produto permite pesquisar parlamentares, partidos, estados, proposições, votações, despesas, gabinetes, fornecedores, eleições e patrimônio declarado.

O sistema não cria nota geral de desempenho nem transforma ausência de informação em zero. Cada indicador mantém sua unidade, período, universo, tamanho da amostra, estado de disponibilidade e origem oficial. Presença, voto, autoria, relatoria, gasto de cota, verba de gabinete, folha e patrimônio são conceitos distintos.

Em alto nível, o fluxo é:

```text
Fontes oficiais
    ↓
Collector: download, cache e preservação do arquivo bruto
    ↓
Parser: normalização e validação dos contratos
    ↓
Staging e reconciliação do lote
    ↓
Publicação atômica do lote aprovado
    ↓
SQLite local auditável
    ↓
Consultas server-side do Next.js
    ↓
Páginas, filtros, gráficos e links para a fonte oficial
```

## 2. Componentes principais

| Componente | Responsabilidade |
| --- | --- |
| `apps/collector` | CLI de coleta, clientes HTTP, parsers, importadores e reconciliação. |
| `packages/domain` | Tipos e contratos compartilhados de identidade, período, cobertura e fatos legislativos. |
| `packages/db` | Migrações, publicação de lotes e consultas usadas pelo frontend. |
| `apps/web` | Aplicação Next.js App Router, renderizada no servidor e ligada ao banco publicado. |
| `data/raw` | Respostas e arquivos oficiais preservados com URL, horário, tipo, status e SHA-256. |
| `data/senadotracker.sqlite` | Banco operacional local. O schema canônico está nas migrações. |
| `docs/methodology` | Regras semânticas para identidade, gastos, presença, votos e comparações. |
| `docs/reconciliation` | Evidências de validação entre a coleta e as fontes oficiais. |

O frontend não consulta as fontes oficiais durante a abertura de cada página. Ele lê somente dados previamente coletados e publicados. Isso evita resultados diferentes dentro da mesma navegação e mantém rastreabilidade por lote.

## 3. Como a coleta e a auditoria funcionam

Cada execução cria um registro em `ingestion_runs`. A resposta original é salva em `raw_objects` e no diretório de dados, com hash SHA-256. Os parsers convertem o conteúdo para os contratos internos, registrando campos inesperados e divergências em `validation_issues`.

O cadastro parlamentar faz duas leituras do rol oficial. O sistema compara os IDs e campos relevantes antes e depois da coleta dos históricos individuais. Um lote inconsistente é rejeitado; um lote aprovado é publicado por meio de um ponteiro `active_*_publications`. A troca desse ponteiro é atômica: o site vê o lote anterior completo ou o novo lote completo.

As tabelas de fatos mantêm o identificador externo da Casa e chegam à pessoa canônica por `external_identifiers`. Dados do TSE só são ligados a um parlamentar quando o vínculo foi confirmado; sem vínculo seguro, a interface informa a indisponibilidade individual.

Estados de cobertura usados na interface:

| Estado | Significado |
| --- | --- |
| `available` | O lote esperado foi publicado e o indicador pode ser calculado. |
| `partial` | Há informação útil, mas o recorte ou algum complemento está incompleto. |
| `unavailable` | Não existe lote publicado suficiente para aquele indicador. |
| `stale` | Há dado publicado, mas sua atualização ultrapassou o limite esperado. |

## 4. Fontes oficiais e uso no produto

### Senado Federal

| Informação | Endpoint ou conjunto oficial | O que alimenta |
| --- | --- | --- |
| Senadores em exercício | `https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json` | Identidade, nome, UF, partido, foto e perfil oficial. |
| Mandatos | `https://legis.senado.leg.br/dadosabertos/senador/{id}/mandatos.json` | Mandatos, legislaturas, suplências e períodos de exercício. |
| Filiações | `https://legis.senado.leg.br/dadosabertos/senador/{id}/filiacoes.json` | Histórico partidário. |
| Votações nominais anuais | `https://legis.senado.leg.br/dadosabertos/dados/ListaVotacoes{ano}.json` | Deliberações, matéria, resultado e votos individuais. |
| Votações de um senador | `https://legis.senado.leg.br/dadosabertos/senador/{id}/votacoes.json` | Reconciliação e histórico individual de voto. |
| Matéria | `https://legis.senado.leg.br/dadosabertos/materia/{id}.json` | Identificação, ementa, apresentação, situação e serviços relacionados. |
| Complementos da matéria | `https://legis.senado.leg.br/dadosabertos/materia/{rota}/{id}.json` | Autoria, relatoria, emendas, movimentações e situação atual. |
| Votações em comissão | `https://legis.senado.leg.br/dadosabertos/votacaoComissao/parlamentar/{id}.json` | Comissão, proposição e voto individual. |
| Lideranças | `https://legis.senado.leg.br/dadosabertos/senador/{id}/liderancas.json` | Lideranças e cargos publicados. |
| CEAPS | `https://www6g.senado.leg.br/transparencia/sen/{ano}.csv` | Cota parlamentar, categoria, fornecedor, documento e valores. |
| Gestão de pessoas | Portal de Dados Abertos do Senado, grupo `gestao-de-pessoas` | Equipe, lotação e vínculos administrativos. |
| Remuneração | `SF_ConsultaRemuneracaoServidoresParlamentares_{AAAAMM}.csv` | Folha bruta identificada por gabinete e competência. |
| Subsídio | Página de remuneração e subsídio do Senado e base normativa | Valor normativo bruto do subsídio parlamentar. |

A participação em votação nominal do Senado usa somente deliberações plenárias que possuem registros individuais válidos. Códigos como ausência, missão, licença, `P-NRV`, `NCom`, `AP` e voto do presidente não são tratados como voto de mérito. A presença física dos senadores continua separada da participação em votações; o Diário do Senado é a referência oficial para futura extração estruturada de comparecimento.

### Câmara dos Deputados

| Informação | Endpoint ou conjunto oficial | O que alimenta |
| --- | --- | --- |
| Deputados em exercício | `https://dadosabertos.camara.leg.br/api/v2/deputados` | Identidade, partido, UF, foto e perfil oficial. |
| Histórico individual | `https://dadosabertos.camara.leg.br/api/v2/deputados/{id}/historico` | Mandatos, legislaturas, exercício e filiações. |
| Proposições | `https://dadosabertos.camara.leg.br/api/v2/proposicoes` e arquivos anuais | Catálogo de matérias e busca. |
| Detalhe da proposição | `https://dadosabertos.camara.leg.br/api/v2/proposicoes/{id}` | Ementa, situação, apresentação e identificação oficial. |
| Autores | `https://dadosabertos.camara.leg.br/api/v2/proposicoes/{id}/autores` | Autoria publicada. |
| Temas | `https://dadosabertos.camara.leg.br/api/v2/proposicoes/{id}/temas` | Temas oficiais. |
| Tramitações | `https://dadosabertos.camara.leg.br/api/v2/proposicoes/{id}/tramitacoes` | Andamento e órgãos envolvidos. |
| Votações | `https://dadosabertos.camara.leg.br/api/v2/votacoes` e `votacoes-{ano}.json` | Deliberações e resultados. |
| Votos | `https://dadosabertos.camara.leg.br/api/v2/votacoes/{id}/votos` e `votacoesVotos-{ano}.json` | Votos nominais individuais. |
| Orientações | `https://dadosabertos.camara.leg.br/api/v2/votacoes/{id}/orientacoes` | Orientações de partidos, blocos e Governo. |
| Órgãos e membros | `/api/v2/orgaos`, `/orgaos/{id}/membros` e arquivo `orgaosDeputados-L{legislatura}.json` | Comissões, cargos e participação em órgãos. |
| Presença oficial | `https://www.camara.leg.br/deputados/{id}/presenca-plenario/{ano}` | Presença anual por dia, justificativas e série mensal desde 2018. |
| Eventos | `eventos-{ano}.json` e `eventosPresencaDeputados-{ano}.json` | Fallback rotulado quando o relatório individual não está disponível. |
| CEAP | `https://www.camara.leg.br/cotas/Ano-{ano}.json.zip` | Despesas, categorias, fornecedores, documentos e estornos. |
| Funcionários | `https://dadosabertos.camara.leg.br/arquivos/funcionarios/csv/funcionarios.csv` | Equipe e lotação dos gabinetes. |
| Verba de gabinete | `https://www.camara.leg.br/deputados/{id}/verba-gabinete?ano={ano}` | Limite e gasto mensal da verba. |
| Subsídio | Decreto legislativo que fixa o subsídio parlamentar | Valor normativo bruto exibido no perfil. |

Na Câmara, a métrica principal é **presença em dias de Plenário**. Ela não usa cru o número de eventos ou sessões. O relatório individual oficial prevalece; arquivos de eventos funcionam somente como fallback identificado. Participação em votação continua sendo outro indicador.

### Tribunal Superior Eleitoral

| Informação | Fonte oficial | O que alimenta |
| --- | --- | --- |
| Candidaturas | `consulta_cand_{ano}.zip` | Cargo, partido, situação, votos e identificadores eleitorais. |
| Complemento de candidatura | Arquivo complementar do lote eleitoral | Campos necessários para completar a candidatura conforme o pleito. |
| Bens declarados | Conjunto `bens-de-candidatos-{ano}` | Bens por candidatura, total declarado e variação entre pleitos. |
| Resultados | `https://resultados.tse.jus.br/` | Resultado e votação oficial quando integrados ao lote. |
| Prestação de contas | Conjuntos anuais de receitas e despesas eleitorais | Financiadores, fornecedores e transações de campanha. |

Os arquivos do TSE são importados localmente porque o CDN pode bloquear downloads automatizados em alguns ambientes. O importador lê os CSVs oficiais em Windows-1252, registra a origem e exige vínculo seguro com a pessoa. Bens declarados em eleição não são apresentados como patrimônio atual.

## 5. O que cada página exibe

### `/`

Home pública. Apresenta a proposta do produto, indicadores gerais, estado das fontes e acessos para Legislativo, comparação, representação por UF e metodologia.

### `/legislativo`

Entrada principal do módulo legislativo. Organiza os caminhos para senadores, deputados, partidos, proposições, rankings, fornecedores, patrimônio e comparação.

### `/legislativo/senadores`

Lista os senadores do lote ativo. Permite busca, filtro por UF e partido, paginação e ordenação por nome, cota ou gabinete. Exibe panorama da Casa, mediana de despesas, participação em votações, produção legislativa e gabinete. A presença física só aparece quando houver lote próprio compatível.

### `/legislativo/deputados`

Lista os deputados do lote ativo com os mesmos filtros e controles. Exibe presença oficial em dias de Plenário, participação em votações, gastos, produção e métricas de gabinete.

### `/legislativo/senadores/{id}` e `/legislativo/deputados/{id}`

Aliases públicos dos perfis unificados. Encaminham o identificador e a Casa para a página canônica de parlamentar.

### `/parlamentares/{source}/{id}`

Perfil parlamentar completo, onde `source` é `senado` ou `camara`. Exibe:

- identidade, foto, partido, UF e perfil oficial;
- mandato com período civil e legislatura como contexto;
- histórico partidário com logos e datas;
- cota parlamentar, subsídio normativo e custo/folha de gabinete sem somá-los como custo total;
- presença e participação nominal em universos separados;
- evolução anual e, para a Câmara, mensal da presença;
- autoria, relatorias e propostas vinculadas a leis;
- comissões, cargos e lideranças disponíveis;
- composição e informações financeiras do gabinete;
- votos recentes com semântica por cor e links para a matéria interna e a fonte;
- candidaturas, votos eleitorais, campanha e bens quando vinculados ao TSE;
- cobertura, período, lote e origem dos dados.

### `/parlamentares/{source}/{id}/gastos`

Detalhamento da cota parlamentar. Mostra total do período, categorias, distribuição do gasto, evolução mensal, comparação com partido e UF, fornecedores, maior fornecedor, concentração, percentil, posição no universo e destaques derivados diretamente dos dados.

### `/legislativo/proposicoes`

Busca e lista proposições da Câmara e do Senado. Aceita filtros por texto, Casa, tipo, ano, autor e tema. A consulta usa tabelas normalizadas e índices locais; não consulta as APIs oficiais durante a requisição.

Parâmetros de URL:

| Parâmetro | Uso |
| --- | --- |
| `busca` | Texto livre, número, tipo ou trecho da ementa. |
| `casa` | `camara` ou `senado`. |
| `tipo` | Tipo da proposição, como `PL`, `PLP` ou `PEC`. |
| `ano` | Ano da matéria. |
| `autor` | Autor publicado. |
| `tema` | Tema oficial. |
| `pagina` | Página do resultado. |

### `/legislativo/proposicoes/{source}/{id}`

Detalhe de uma proposição. Exibe identificação, ementa, situação, data, autoria, temas, tramitação, votações relacionadas e distribuição dos votos por parlamentar e por partido. Matérias equivalentes entre as Casas podem ser relacionadas por tipo, número e ano sem presumir que os IDs internos sejam iguais.

### `/legislativo/partidos`

Panorama dos partidos com representação, filtros e indicadores comparáveis. Usa logos locais dos partidos e leva ao detalhe de cada sigla.

### `/legislativo/partidos/{party}`

Página de uma sigla. Exibe senadores, deputados, custo mediano, presença e participação medianas, produção legislativa, composição por UF, parlamentares e cobertura de cada indicador.

### `/quem-me-representa`

Exploração por estado com mapa SVG oficial do Brasil, seleção de UF e listagem dos representantes na Câmara e no Senado. Mostra partido, Casa, foto e acesso ao perfil.

### `/comparar`

Comparação por pessoas, partidos ou estados. A seleção usa busca e chips removíveis. Cada dimensão conserva unidade e cobertura próprias; não existe nota agregada nem radar. Os painéis incluem gastos, composição das despesas, presença, participação, produção, gabinete, eleições, patrimônio, concordância de voto e fidelidade à orientação partidária quando os dados permitem. Comparações financeiras entre Casas incompatíveis são bloqueadas ou explicadas.

Parâmetros principais:

| Parâmetro | Uso |
| --- | --- |
| `modo` | Pessoas, partidos ou estados, conforme os controles da página. |
| `casa` | Restringe a Casa nos modos aplicáveis. |
| `pessoas` | IDs selecionados, serializados na URL. |

### `/legislativo/rankings`

Rankings navegáveis por dimensão: maiores e menores gastos de cota, faltas/presença, propostas e relatorias. Permite filtro por UF e partido e sempre informa `n`, período e cobertura. Posições são descritivas do recorte, sem nota de desempenho.

### `/legislativo/fornecedores`

Radar de fornecedores cruzados. Agrupa despesas por documento de fornecedor e mostra valor recebido, quantidade de parlamentares e vínculos observados. Serve para identificar concentração e relações que merecem investigação; não classifica automaticamente irregularidade.

### `/legislativo/fornecedores/{documento}`

Detalhe de um fornecedor com CNPJ válido. Mostra nome mais recorrente e variações publicadas, total líquido, lançamentos, ticket médio, alcance, concentração nos maiores pagadores, categorias, evolução mensal e distribuição por UF, partido e Casa. A tabela nominal liga cada agregado ao perfil parlamentar. Não infere CNAE, sócios, endereço ou situação cadastral.

### `/legislativo/patrimonio`

Explora bens declarados e variação entre eleições vinculadas. Permite ranking de crescimento quando há dois pleitos comparáveis e mantém visível o ano e o aviso de que declaração eleitoral não equivale ao patrimônio atual.

### `/metodologia`

Explica fontes, conceitos, cobertura, períodos, vínculos de identidade, limitações e diferenças entre indicadores. É o ponto público de interpretação e auditabilidade.

### `/design-system`

Página interna de referência visual para cores, tipografia, botões, cards, badges, gráficos e estados de cobertura.

## 5.1. Inventário visual detalhado das páginas

Esta seção funciona como um manual da interface existente. “Card” significa uma unidade visual com valor principal e selo de cobertura. Ao abrir o selo, o usuário encontra período, fonte, tamanho da amostra e observações metodológicas.

### Home: ordem dos blocos e ações

1. **Hero “Entenda quem representa você. Pelos dados.”** Explica o propósito do produto e oferece o botão **Explorar o Legislativo**.
2. **Comece por aqui.** Cinco cards de navegação levam a Senadores, Deputados federais, Partidos, Quem me representa e Comparar.
3. **O que você encontra.** Seis itens explicam cadastro e mandatos, gastos, presença, atividade, eleições e gabinetes. São descrições de módulos, não números agregados.
4. **Aviso metodológico.** Informa que nenhum indicador vira nota e leva à metodologia.
5. **Três perguntas principais.** Os cards “Quanto custa?”, “Como participa?” e “O que faz?” explicam a organização conceitual do produto.
6. **Faixa de fontes oficiais.** Para Senado e Câmara, mostra disponibilidade, atualização, lote e anos completos de despesa quando conhecidos.

### Entrada legislativa: cards, tabela e comparação

O topo contém busca nominal. Logo abaixo há cards de acesso para Senadores, Deputados, Partidos, Proposições, Rankings, Fornecedores, Patrimônio e Quem me representa.

O bloco **Congresso em números** é separado por Casa. Cada Casa apresenta:

| Card | Conteúdo |
| --- | --- |
| Parlamentares | Quantidade de perfis no cadastro ativo. |
| UFs representadas | Número de UFs encontradas nesse cadastro. |
| Cota mediana | Mediana dos totais líquidos individuais no ano indicado. |
| Presença mediana | Nesta página geral permanece indisponível até existir agregação conciliada própria para o recorte. |

Quatro cards explicativos descrevem custos, participação, produção e gabinete. A tabela **Parlamentares do Congresso** possui as colunas parlamentar, Casa, partido/UF, cota no período e participação. Os filtros são Casa, estado e partido; a busca fica preservada ao paginar. O bloco final permite selecionar pessoas da listagem e abrir a comparação.

### Listagem de uma Casa: Senado ou Câmara

As duas páginas usam a mesma estrutura, com textos e métricas adequados à Casa:

1. **Hero institucional e busca.** Busca nome, partido ou estado.
2. **Filtros.** UF, partido, situação “em exercício” e ordenação por nome, maior/menor cota ou maior/menor métrica de gabinete.
3. **Panorama da Casa.** Cards de parlamentares, UFs, cota mediana, presença mediana e participação mediana.
4. **Distribuição da cota.** Cards de mediana, intervalo P25–P75 e faixa observada, acompanhados por histograma.
5. **Participação e produção.** Cards de presença e votações nominais, seguidos por propostas apresentadas, relatorias e propostas ligadas a leis.
6. **Gabinetes.** Mostra vínculos medianos e a mediana financeira disponível. Para a Câmara, a dimensão financeira é verba utilizada; para o Senado, folha identificada.
7. **Tabela de parlamentares.** Foto, logo e sigla do partido, UF, cota, presença, votação e gabinete. O nome abre o perfil.
8. **Comparação.** O seletor adiciona pessoas ao painel comparativo.
9. **Cards de leitura.** Explicam o significado de gastos, votações, propostas e gabinete.

Valores indisponíveis aparecem depois dos observáveis na ordenação financeira e nunca são convertidos em zero.

### Perfil parlamentar: anatomia completa

O perfil é a principal tela de síntese do sistema.

#### Cabeçalho

- foto oficial, nome, cargo, partido com logo e UF;
- início do mandato atual e legislatura;
- botão **Perfil oficial**;
- botão **Comparar**, que já abre o parlamentar selecionado;
- card de fontes com URL, data de publicação, lote e trecho do SHA-256;
- menu fixo para Visão geral, Gastos, Presença e votações, Atuação legislativa, Comissões e cargos, Gabinete, Votações recentes, Eleições e patrimônio e Histórico.

#### Visão geral

O bloco **Mandatos como parlamentar** converte a legislatura em intervalo civil legível, como `2019–2022` e `2023–2026`. Cada card mostra situação atual, cargo, UF, datas completas e número da legislatura. O bloco **Histórico partidário** usa logo, sigla, início, fim e “até o presente” para filiação aberta; períodos consecutivos repetidos podem ser consolidados visualmente.

#### Quanto custa este mandato?

| Card | Cálculo e comportamento |
| --- | --- |
| Cota parlamentar identificada | Total líquido do ano até o último mês disponível. Compara com os mesmos meses do ano anterior. O card inteiro abre o detalhamento de gastos. |
| Subsídio parlamentar mensal | Valor normativo bruto vigente, base legal e link oficial. Não representa o líquido recebido. |
| Folha bruta do gabinete | Parcela bruta identificada na competência publicada. Pode ficar indisponível quando não há vínculo seguro. |

A página declara que esses valores não são somados como “custo total do mandato”.

#### Ele participa?

| Card ou gráfico | Conteúdo |
| --- | --- |
| Presença em dias de Plenário | Percentual e fração `presentes/total`. Para deputados, usa o relatório oficial por dia da Câmara. |
| Participação em votações nominais | Percentual e fração de votações com voto válido sobre o universo nominal elegível. |
| Evolução da presença | Toggle entre visão mês a mês e ano a ano quando há série mensal. Eixo percentual limitado a 0–100%. |

Ausência de voto não é apresentada como falta em sessão.

#### O que ele fez?

Três cards mostram **Propostas de autoria**, **Relatorias** e **Propostas ligadas a leis**. Abaixo, até oito cards de proposição mostram identificação, ementa, situação, data e link oficial. Os três totais permanecem separados.

#### Onde atua?

O card **Comissões e cargos** lista função, órgão, início, fim e link para o registro oficial. A ausência da relação no lote não gera uma ocupação inferida.

#### Equipe e recursos do gabinete

Os cards iniciais mostram **Pessoas no snapshot** e até duas categorias de vínculo mais relevantes. O card **Composição do gabinete** possui busca instantânea por nome, vínculo, cargo ou função e tabela com origem oficial.

O card financeiro muda por Casa:

- **Câmara:** ano, limite publicado, gasto publicado e percentual de utilização; gráficos de limite mensal e gasto mensal da verba;
- **Senado:** competência, total de parcelas identificadas e linhas de folha normal; gráfico por rubrica, como proventos, auxílios, diárias e vantagens indenizatórias.

#### Como votou?

A tabela de votos recentes mostra data, proposição, voto literal, resultado literal e fonte. Quando a proposição está vinculada, o título abre seu detalhe interno. Votos usam cores sem alterar o código oficial: verde para sim, vermelho para não e cores próprias para abstenção ou códigos procedimentais.

#### Eleições e patrimônio

Os filtros locais são ano, cargo e resultado oficial. Os três cards principais mostram:

- **Última candidatura:** cargo, ano e resultado;
- **Votos recebidos:** votação e situação publicada;
- **Bens declarados no pleito:** soma e quantidade de bens.

Quando há pleitos comparáveis, cards mostram a variação nominal declarada e o gráfico mostra o total de bens por eleição. Cada candidatura possui data, votos, receitas e despesas de campanha. A tabela de bens detalha tipo, descrição, valor e total. Havendo receitas importadas, a tabela **Quem financiou a campanha** mostra financiador, documento publicado, tipo e valor. A falta de campanha não elimina candidatura nem bens já publicados.

#### Cobertura e histórico

Cards anuais de despesas informam ano completo ou parcial, meses, quantidade de registros e atualização. O bloco histórico permite alternar entre cota, presença e participação em votação. Lacunas continuam vazias.

### Detalhamento de gastos

O usuário chega aqui clicando na cota do perfil. Um seletor troca o ano.

| Card | O que responde |
| --- | --- |
| Total líquido identificado | Quanto foi registrado no período após estornos conhecidos. |
| Maior fornecedor | Qual fornecedor concentrou mais valor e qual sua participação percentual. |
| Posição na Casa | Ranking no mesmo ano e corte mensal, universo e percentil. |
| Diferença para a mediana | Distância relativa da mediana da mesma Casa e período. |

O bloco **Principais destaques** cria frases determinísticas sobre concentração, maior fornecedor, mês atípico e posição. O gráfico de barras mostra distribuição por categoria. O card **Benchmark do período** traz média, mediana e `n` para partido, estado e Casa, além da frase com posição e distância da mediana. O gráfico de linhas compara gasto mensal individual, média do partido e média da UF.

A tabela de fornecedores mostra nome normalizado, documento, total líquido, participação e quantidade de lançamentos. O documento abre o radar de pagamentos cruzados já filtrado.

### Proposições: busca e resultado

O formulário possui texto/tipo/número, Casa, tipo, ano, autoria e tema oficial. A página mostra total encontrado, selo de cobertura e ordenação utilizada. A tabela contém:

- identificação clicável da proposição, tipo, número, ano e Casa;
- descrição ou ementa;
- até três autores, com logo partidário quando aplicável;
- tema oficial;
- data de apresentação.

O quadro **Cobertura dos lotes** mostra, por Casa, quantidade de proposições, escopos, deliberações e votos disponíveis. Uma busca vazia ou sem correspondência produz estado vazio e sugere ajustar filtros; campo não publicado não é tratado como texto vazio.

### Detalhe de uma proposição

O hero mostra Casa, tipo, identificação, ementa, número/ano e link oficial. A primeira linha tem três cards:

| Card | Conteúdo |
| --- | --- |
| Apresentação | Data oficial da matéria. |
| Situação oficial | Situação publicada no lote; sua falta altera somente este card para indisponível. |
| Votações relacionadas | Quantidade vinculada por ID oficial ou equivalência de tipo, número e ano entre Casas. |

Os cards de **Autoria publicada** e **Temas oficiais** exibem autores, tipo de autoria, partido/UF e temas. A tramitação aparece como linha do tempo com data, descrição, situação e fonte.

Cada votação relacionada cria um grande card com órgão, data, descrição, resultado, total de votos e selo de cobertura. Dentro dele há:

1. cards com total e percentual de cada voto literal;
2. cards por partido, com logo, `n`, barra colorida e distribuição percentual;
3. orientações partidárias publicadas, sempre separadas dos votos individuais;
4. tabela nominal com parlamentar, partido/UF, voto e horário;
5. link para a votação na fonte oficial.

### Partidos: panorama geral

Os filtros são Casa, ano e sigla. Cinco cards resumem **Partidos representados**, **Senadores**, **Deputados federais**, **Mediana das cotas partidárias** e **Participação partidária mediana**.

A tabela principal traz sigla/logo, representação por Casa, cota mediana com `n`, presença mediana com `n` e participação mediana com `n`. O bloco de votação permite escolher uma deliberação nominal e mostra a distribuição de votos registrados por partido em barras empilhadas. A tabela de produção mantém propostas, relatorias, status oficial aprovado e vínculos com leis em colunas distintas. **Assuntos em destaque** usa somente temas oficiais e mostra propostas e votações vinculadas.

### Detalhe de um partido

O hero mostra sigla e logo. Os cinco KPIs são:

1. **Senadores** do partido;
2. **Deputados federais** do partido;
3. **Cota mediana por mandato** no ano;
4. **Presença mediana** entre membros com observação;
5. **Participação mediana em votações**.

A seção de parlamentares alterna Senado e Câmara, permite busca por nome ou UF e exibe nome, UF, cargo, cota, presença, participação e link para o perfil. O bloco **Como o partido votou?** permite escolher uma votação, mostra eventual orientação oficial, abre a lista de quem votou como e apresenta a barra de distribuição.

O bloco de atividade contém mini KPIs de propostas, relatorias, status aprovado e leis ligadas. O gráfico **Proposições por tema** usa os assuntos oficiais mais frequentes. O card **Quanto custam os mandatos?** mostra mediana, intervalo P25–P75 e `n`. O card **Explore mais** liga para parlamentares da sigla, votações, proposições e comparação com outros partidos.

### Quem me representa?

Sem UF selecionada, a página mostra um mapa SVG clicável do Brasil e um seletor. Ao escolher uma UF, o panorama estadual apresenta:

| Card | Conteúdo |
| --- | --- |
| Representantes | Total de senadores e deputados no cadastro ativo. |
| Cota mediana | Mediana entre representantes da UF com cota vinculada. |
| Presença mediana | Mediana entre representantes com presença observável. |
| Participação mediana | Mediana da participação nas votações elegíveis. |
| Vínculos medianos | Mediana dos gabinetes associados com segurança. |

Dois cards adicionais mantêm separados os gabinetes do Senado e da Câmara. As tabelas de senadores e deputados mostram perfil, partido, Casa e métricas disponíveis. A busca por assunto usa apenas temas oficiais ligados à bancada. Um seletor permite comparar com outra UF; a tabela resultante apresenta representação, cota, presença, participação, folha do Senado e verba da Câmara em colunas distintas.

### Comparação multidimensional

Há três modos persistidos na URL:

- **Parlamentares:** duas a quatro pessoas da mesma Casa;
- **Partidos:** dois a dez partidos;
- **Estados:** duas a dez UFs.

A seleção usa busca, botões e chips removíveis. Na comparação de pessoas, o cabeçalho fixo mantém foto, logo, nome, partido e UF como legenda dos gráficos.

Os painéis de parlamentares são:

| Painel | Visualização e regra |
| --- | --- |
| Cota total | Barras, em reais, no mesmo ano. |
| Composição por categoria | Barras empilhadas sem somar dimensões incompatíveis. |
| Gasto mensal | Linhas por pessoa ao longo dos meses. |
| Presença | Bullet chart com mediana do universo como referência. |
| Participação nominal | Bullet chart separado, também com referência. |
| Produção | Barras agrupadas para propostas, relatorias e leis ligadas. |
| Gabinete | Um card por pessoa com financeiro, vínculos e período; o conceito depende da Casa. |
| Eleições e patrimônio | Votos, ano/cargo, receitas, despesas, bens e variação declarada. |
| Concordância de voto | Percentual de votos iguais apenas nas deliberações em que ambos têm voto comparável; permite auditar exemplos. |
| Fidelidade partidária | Percentual de votos alinhados à orientação oficial comparável, com alinhados, denominador e excluídos. |

Partidos são comparados por representação, cota mediana, presença, participação e produção. Estados são comparados por representação, cota mediana, presença e participação. Nenhum modo calcula nota geral.

### Rankings

Cinco cards funcionam como abas: **Maiores gastos de cota**, **Menores gastos de cota**, **Mais faltas**, **Mais propostas** e **Mais relatorias**. Os filtros são Casa, UF, partido e ano. A tabela mostra posição, parlamentar, logo/sigla, UF e valor da dimensão. O universo, `n`, período e cobertura aparecem antes da tabela. Indisponíveis são excluídos e empates usam ordem alfabética depois do valor.

### Radar de fornecedores

A busca aceita nome ou CNPJ e os filtros são Casa e ano. Os KPIs mostram **Fornecedores com documento**, **Maior alcance no recorte** e **Período**. A tabela ordena por número de parlamentares distintos e depois por valor, mostrando fornecedor, documento formatado, parlamentares, Casas, lançamentos e total líquido. Homônimos sem documento não são cruzados e concentração não é rotulada como irregularidade.

O nome de cada fornecedor abre `/legislativo/fornecedores/{documento}`. A página individual possui seis KPIs: total líquido, parlamentares pagadores, ticket médio, concentração no maior pagador, concentração nos cinco maiores e quantidade de Casas. O bloco de identidade mostra o CNPJ, o nome mais recorrente e todas as grafias distintas encontradas nos lançamentos. Gráficos apresentam categoria, partido, Casa e evolução mensal. Um mapa coroplético do Brasil mostra a distribuição financeira por UF. A tabela final ranqueia parlamentares por valor, participação e lançamentos, com acesso direto a cada perfil. Apenas CNPJs com dígitos verificadores válidos recebem página; CPF permanece fora.

### Patrimônio declarado

O hero deixa explícito o par de eleições comparado. Os cards mostram **Parlamentares comparáveis** e **Maior variação percentual**. A tabela de ranking traz posição, parlamentar, partido/UF, total no pleito inicial, total no pleito final, variação percentual e variação nominal. Só entram pessoas com candidaturas seguramente vinculadas e valores nos dois pleitos. Os números não são corrigidos pela inflação.

### Metodologia

Quatro cards explicam origem preservada, publicação validada, períodos comparáveis e incerteza visível. Os textos seguintes detalham eleições e patrimônio, gabinete e remuneração, proposições e votos e os quatro estados de disponibilidade. A tabela final lista conjunto oficial, formato, periodicidade, acesso observado e arquivo interno de auditoria.

### Design system

É uma referência interna dos componentes visuais. Serve para conferir tipografia, cores, espaçamento, cards, botões, badges, tabelas e estados; não apresenta dados legislativos como página editorial.

## 6. Interfaces e endpoints do sistema

### Rotas HTTP públicas

As rotas listadas na seção anterior são as interfaces HTTP do produto. As páginas dinâmicas são renderizadas no servidor pelo Next.js. Atualmente não existem arquivos `route.ts` nem uma API REST/GraphQL pública própria.

### Camada interna de consulta

O arquivo `apps/web/lib/data.ts` abre o banco e chama funções de `packages/db`. Entre as consultas internas estão:

- cadastro e perfil publicado;
- panoramas da Câmara e do Senado;
- listagens e facetas;
- proposições e detalhe de votação;
- partidos e detalhe da sigla;
- estados e representantes;
- comparação de pessoas, partidos e estados;
- rankings;
- fornecedores cruzados;
- patrimônio e campanha;
- inteligência de despesas;
- presença anual/mensal e participação nominal;
- gabinete, equipe, verba e folha.

Essas funções não são endpoints de rede. São chamadas TypeScript executadas no servidor durante a renderização.

### Endpoints externos

Os endpoints externos são os serviços oficiais relacionados na seção 4. O coletor restringe os hosts aceitos, preserva a resposta bruta e evita misturar coleta remota com renderização da interface.

## 7. Modelo de dados resumido

| Domínio | Tabelas principais |
| --- | --- |
| Auditoria | `schema_migrations`, `ingestion_runs`, `job_locks`, `raw_objects`, `validation_issues`. |
| Identidade | `people`, `external_identifiers`, `profiles`, `mandates`, `exercises`, `party_memberships`, `status_events`. |
| Despesas | `expense_batches`, `active_expense_publications`, `expenses`. |
| Votos | `legislative_batches`, `active_legislative_publications`, `deliberations`, `legislative_votes`. |
| Presença | `presence_batches`, `active_presence_publications`, `legislative_sessions`, `attendance`, `chamber_official_presence`. |
| Atividade | `activity_batches`, `proposals`, `proposal_authors`, `legislative_appointments`, `proposal_laws`. |
| Complementos | `legislative_complement_batches`, `legislative_complements`. |
| TSE | `election_batches`, `election_candidates`, `candidate_assets`, `campaign_transactions`, `person_candidate_links`. |
| Gabinetes | `staff_batches`, `functional_staff_assignments`, `cabinet_budget_batches`, `cabinet_monthly_budgets`. |
| Custos ampliados | `expanded_cost_batches`, `active_expanded_cost_publications`, `expanded_costs`. |

O detalhamento integral de colunas, chaves, índices e fontes está em [`schema.md`](schema.md).

## 8. Indicadores e regras de apresentação

### Gastos

O valor exibido para cota é a soma líquida observada no lote, considerando deduções e estornos conforme a fonte. Categorias, fornecedor, documento, mês e ano permanecem disponíveis para detalhamento. Cota, verba de gabinete, folha e subsídio não são somados como se formassem um custo total completo.

### Presença

Para deputados, a presença é calculada por dias de Plenário segundo o relatório oficial individual. Presença justificada e não justificada permanecem distinguíveis. Para senadores, participação em votação não substitui comparecimento.

### Participação em votações

O numerador contém votos individuais válidos do parlamentar. O denominador contém deliberações nominais elegíveis com registros individuais no mesmo universo. Eventos futuros e votações sem universo nominal válido não entram no cálculo.

### Produção legislativa

Propostas de autoria, relatorias e propostas ligadas a normas são mostradas separadamente. O produto não soma essas relações em uma pontuação.

### Comparações e rankings

Cada painel mantém unidade, período, Casa e tamanho da amostra. Média, mediana, percentil e posição referem-se somente ao universo publicado e comparável. Folha do Senado e verba da Câmara não são tratadas como a mesma grandeza.

### Destaques automáticos

Textos como concentração por categoria, participação do maior fornecedor ou distância da mediana são produzidos por regras determinísticas sobre dados publicados. Não são conclusões sobre legalidade, qualidade ou mérito político.

## 9. Comandos operacionais

### Instalação e execução

```powershell
npm ci
npm run dev
```

Abrir `http://127.0.0.1:3000`. No PowerShell, usar `npm.cmd` quando a política local bloquear `npm.ps1`.

### Cadastro

```powershell
npm run collector -- collect --source all
npm run collector -- collect --source senado
npm run collector -- collect --source camara
```

### Despesas, votos, atividade, presença e complementos

```powershell
npm run collector -- collect-expenses --source all --year 2026
npm run collector -- collect-votes --source all --year 2026
npm run collector -- collect-activity --source all
npm run collector -- collect-presence --source all --year 2026
npm run collector -- collect-complement --source all
```

Para montar séries históricas, repetir os comandos anuais para cada ano necessário.

### Presença oficial da Câmara

```powershell
npm run collect:official-presence
```

Esse coletor percorre os deputados publicados e os anos de 2018 a 2026, lê o relatório individual oficial e grava os totais anuais e dias detalhados em `chamber_official_presence`.

### Gabinetes

```powershell
npm run collector -- collect-camara-staff
npm run collector -- collect-camara-budget --year 2026
npm run collector -- collect-senate-staff --year 2026
npm run collector -- import-cabinet --source senado --competence 2026-08 --file ARQUIVO.csv
```

As opções `--ids`, `--file`, `--dry-run` e `--report` permitem restringir, importar arquivo já baixado, validar sem publicar e salvar relatório de reconciliação.

### TSE

```powershell
npm run collector -- import-elections --year 2022 --candidates CONSULTA_CAND.csv --assets BEM_CANDIDATO.csv --complement CONSULTA_CAND_COMPLEMENTAR.csv --dry-run --report relatorio-tse.json
```

Depois de revisar o relatório, executar novamente sem `--dry-run` para publicar. Os nomes concretos dos CSVs dependem do conteúdo extraído do ZIP oficial.

### Estado e validação

```powershell
npm run collector -- status
npm run typecheck
npm test
npm run build
npm run check
npm run test:e2e
```

`npm run check` executa checagem de tipos, testes e build. O teste E2E inicia a aplicação compilada e percorre a jornada visual quando o Chrome está disponível.

## 10. Segurança, privacidade e limites

- O sistema usa somente fontes públicas oficiais e mantém links para conferência.
- Documentos de fornecedores podem ser usados no radar investigativo porque fazem parte das prestações públicas, sem transformar coincidência em acusação.
- Dados funcionais de servidores são exibidos no contexto de lotação e custo público; detalhes pessoais sem função de transparência não devem ser promovidos na interface.
- Identidade entre Casas e TSE depende de identificadores ou vínculo confirmado, nunca apenas de nome semelhante.
- Ausência de registro não é convertida em ausência parlamentar, gasto zero, patrimônio zero ou inexistência de atividade.
- Dados futuros são removidos dos denominadores correntes por um corte temporal centralizado.
- O banco SQLite é adequado ao modelo local e de leitura atual; volume, concorrência e implantação podem justificar PostgreSQL, mas a semântica de lotes e auditoria deve ser preservada em qualquer migração.

## 11. Estado atual e limitações conhecidas

O sistema já possui cadastro bicameral, despesas, votações nominais, atividade legislativa, presença oficial da Câmara, gabinetes, proposições, partidos, estados, comparações, rankings, fornecedores e importação eleitoral. A cobertura concreta depende dos lotes ativos no banco em cada ambiente.

As principais limitações são:

- o CDN do TSE pode negar a coleta automática, exigindo download manual e importação local dos arquivos oficiais;
- presença estruturada do Senado ainda depende da extração dos registros de comparecimento publicados no Diário;
- alguns complementos do Senado e da Câmara têm cobertura parcial por matéria, órgão ou período;
- relatórios individuais de presença da Câmara eventualmente indisponíveis usam fallback rotulado;
- não há API pública própria, autenticação, painel administrativo ou atualização agendada incluídos na aplicação atual.

## 12. Referências internas

- [`intention.md`](intention.md): doutrina inicial do produto.
- [`intention2.md`](intention2.md): direção visual e experiência das páginas.
- [`intention3.md`](intention3.md): expansão de dados, análises e fase atual.
- [`schema.md`](schema.md): schema completo e catálogo de fontes.
- [`docs/methodology`](docs/methodology): definições técnicas dos indicadores.
- [`docs/reconciliation`](docs/reconciliation): verificações contra as fontes oficiais.
- [`taskfase3.md`](taskfase3.md): tarefas e entregas da fase 3.

