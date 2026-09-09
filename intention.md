SOURCES OF TRUTH: 

https://www12.senado.leg.br/dados-abertos/

https://www12.senado.leg.br/dados-abertos/legislativo/parlamentares/senadores-em-exercicio

https://www12.senado.leg.br/dados-abertos/conjuntos?grupo=senadores&portal=Legislativo

https://www12.senado.leg.br/dados-abertos/conjuntos?grupo=senadores&portal=administrativo

https://www25.senado.leg.br/web/transparencia/sen

https://dadosabertos.camara.leg.br/swagger/api.html

https://www.camara.leg.br/transparencia/gastos-parlamentares/

https://www2.camara.leg.br/transparencia/servicos-ao-cidadao/transparencia

https://dadosabertos.tse.jus.br/pt_BR/

https://dadosabertos.tse.jus.br/dataset/?groups=prestacao-de-contas-eleitorais

https://portaldatransparencia.gov.br/api-de-dados

https://portaldatransparencia.gov.br/sancoes/consulta

https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cnpj. 


OBJETIVO DO PROJETO: Fazer um tracker de Senadores e Deputados Federais. 

Um motor que consulta X com periodicidade Y. 
Fontes que eu usaria
Senado Federal — Dados Abertos
senadores em exercício
partido, UF, mandato, gabinete e contatos
votações nominais
autoria e relatoria de matérias
comissões, lideranças e Mesa
CEAPS
benefícios administrativos
histórico partidário e de mandato
 É a fonte principal para todo perfil de senador.
Câmara dos Deputados — Dados Abertos
deputados em exercício
partido, UF e informações cadastrais
histórico de exercício
comissões e cargos
eventos/participação
proposições e votações
despesas vinculadas ao exercício parlamentar
 A API oficial já oferece endpoints específicos para deputado, detalhes, despesas, eventos, discursos, frentes e histórico.
Câmara dos Deputados — Gastos Parlamentares / Transparência
 Para o bloco “Quanto custa este mandato?” dos deputados:


Cota parlamentar / CEAP
Verba de gabinete
Moradia
Remuneração
Viagens
equipe de gabinete
Esta é especialmente importante porque a Câmara já separa oficialmente essas categorias; a verba de gabinete é destinada aos secretários parlamentares.


TSE — Dados Abertos de Candidatos
 Para senadores e deputados:


eleição disputada
cargo
partido/coligação na eleição
votos
dados da candidatura
bens declarados
fotos e outras informações eleitorais
No produto, usar sempre “Bens declarados ao TSE na eleição de YYYY”, nunca “patrimônio atual”.


TSE — Prestação de Contas Eleitorais
 Para:
receitas de campanha
despesas de campanha
fornecedores da campanha
CNPJ de campanha
prestações de contas históricas
 O TSE publica esses arquivos por eleição; a estrutura pode variar de uma eleição para outra.
Para Senadores compilar algo como entificação do senador
Nome
Foto
Partido
Estado/UF
Situação do mandato (ex.: em exercício)
Período do mandato
Indicador de perfil/verificação
Link para perfil oficial no Senado
Custo total do mandato
Custo total acumulado
Custo no ano corrente
Variação percentual em relação ao ano anterior
Comparação com anos anteriores
Evolução histórica/anual dos custos
Gastos diretamente atribuídos ao senador
Total gasto pelo senador
Salário/subsídio
Cota parlamentar (CEAPS)
Passagens e diárias
Outros gastos (moradia, auxílio etc.)
Comparação dos gastos com o ano anterior
Gastos do gabinete
Total gasto pelo gabinete
Folha da equipe
Escritórios (Brasília e estado)
Outros custos
Número de funcionários
Comparação com o ano anterior
Presença no Senado
Percentual de presença em sessões deliberativas
Número absoluto de presenças
Ausências justificadas
Ausências não justificadas
Média de presença do Senado para comparação
Evolução anual da presença
Participação em votações
Percentual de participação
Número total de votações
Número de votações das quais participou
Comparação com a média do Senado
Evolução histórica da participação
Propostas legislativas apresentadas
Quantidade total de propostas
Propostas em tramitação
Propostas aprovadas no Senado
Propostas que viraram lei
Propostas encerradas
Possibilidade de acessar individualmente todas as propostas
Relatorias
Número total de relatorias
Relatorias concluídas
Em tramitação
Em outras situações
Acesso à relação completa de relatorias
Leis originadas de propostas do senador
Quantidade de propostas que efetivamente viraram lei
Acesso às leis aprovadas/originadas das propostas
Comissões e cargos
Comissões das quais participa
Cargo/função em cada comissão, como:
membro
vice-presidente
presidente
Cargos institucionais, como liderança partidária
Participação na Mesa Diretora
Acesso ao histórico completo de cargos e comissões
Estrutura do gabinete
Quantidade de pessoas na equipe
Número de escritórios
Localização dos escritórios
Custo anual do gabinete
Possibilidade de acessar informações mais detalhadas do gabinete
Histórico de votações individuais
 Para cada votação:
Data
Identificador da proposição (ex.: PL, PEC etc.)
Número/ano
Descrição/ementa resumida
Voto do senador (SIM, NÃO, não participou etc.)
Resultado da votação (aprovado, rejeitado etc.)
Link para todas as votações
Histórico eleitoral
Última eleição disputada
Ano da eleição
Situação (eleito, por exemplo)
Número de votos recebidos
Estado pelo qual concorreu
Histórico eleitoral completo
Gastos de campanha
Valor gasto/declarado na campanha eleitoral
Ano da eleição
Fonte eleitoral/TSE
Patrimônio declarado
Valor total dos bens declarados
Ano de referência
Declarações patrimoniais eleitorais
Possibilidade de consultar histórico
Séries históricas / evolução temporal
 A interface explicitamente permite acompanhar ao longo dos anos:
Custo total
Gastos do senador
Gastos do gabinete
Presença
Participação em votações
Propostas
Comparação percentual entre períodos
Comparações
Senador × média do Senado
Senador × outros senadores
Comparação por partido
Comparação por estado
Rankings
Uns toggles de partidos/estados. 

Algo analogo para Deputados também. 

Seja um dev inteligente, e façamos um plano para isso. Crie um plan.md para ver o overview e overrall structure do projeto, e divida-o em MINUSCULAS E EXECUTAVEIS tasks.md, onde vc consegue ver o estado atual da codebase e implementação, assim como saber o proximo passo. Já que será executado por voce.

O Frontend deve ser lindo, high-level e profissional, feito com shadcn/ui e do mais high-level possível. 

Mas o backend, o coletor deve ver as informações necessárias. Construir isso lindamente, que a informação displayed sempre esteja correta e nunca errada, ver as que precisam de uma certa periodicidade, e aí tb estudar o melhor jeito de isso ir pro ar em um vercel da vida. Server de graça, qualquer coisa podemos fazer o backend de coleta ir pra um supabase e algo assim e aí o front leria dali, sei la, isso pode ser pro final tb. Pode começar em SQLite tb, ou se não precisar tudo em .JSON 

