
Lembrete: 

Voce é um dev senior muito qualificado e diligente, e ao fazer esse plano vc vai partir dos principios de 

CLEAN CODE 
DRY 
Evitar queries inuteis e extras 
Evitar N+1 
Otimização e deixar tudo mais rapido 
Não atrapalhar o que funciona hoje. 

Nos temos o data dos fornecedores atuais, e build os collectors do fornecedores-institucionais ne? A gente vai fazer uma página desses 2. 
/fornecedores 
Aa
anner / Hero
No topo da página, abaixo da navegação do Legislativo, existe um banner horizontal com a imagem do Congresso Nacional ocupando principalmente a metade direita.
À esquerda:
Fornecedores do Congresso
Subtítulo:
“Veja quem recebe recursos públicos do Senado e da Câmara, quanto recebeu e em que tipo de gasto.”
Logo abaixo existe uma busca rápida:
🔍 Buscar fornecedor, CNPJ ou categoria... [ Buscar ]
Abaixo da busca aparece uma identificação discreta:
Congresso Nacional · Brasília · DF
Na parte direita do banner aparece a frase institucional:
“Mais transparência para um Brasil mais forte.”
________________________________________
Barra de filtros geral
Imediatamente abaixo do banner existe uma única linha horizontal de filtros.
Da esquerda para a direita:
Casa
[ Todos ▾ ]
Categoria
[ Todas as categorias ▾ ]
Ano
[ 2026 ▾ ]
Ordenar por
[ Mais relevante ▾ ]
E, no extremo direito:
[ Aplicar filtros ]
O botão é verde sólido e visualmente mais forte que os selects.
________________________________________
1. Visão geral dos pagamentos a fornecedores
Primeiro grande bloco analítico.
À esquerda há um círculo verde-claro com:
1
Ao lado:
Visão geral dos pagamentos a fornecedores
Subtítulo:
“Principais números dos pagamentos a fornecedores do Senado Federal e da Câmara dos Deputados em 2026.”
Logo abaixo existe uma linha com 5 cards de KPI de mesma altura.
Card 1 — Total pago a fornecedores
Ícone verde de dinheiro.
Valor principal:
R$ 41.105.494
Complemento:
em 2026, pelas duas Casas
________________________________________
Card 2 — Fornecedores pagos
Ícone azul de pessoas/organizações.
Valor:
1.248
Complemento:
empresas e organizações
________________________________________
Card 3 — Maior categoria de gasto
Ícone roxo de gráfico.
Categoria em destaque:
Serviços terceirizados
Valor:
36,8%
Complemento:
do total pago
________________________________________
Card 4 — Fornecedor que mais recebeu
Ícone amarelo de troféu.
Fornecedor:
TechGov Serviços Integrados Ltda.
Valor:
R$ 4.870.000
Esse card funciona como destaque de empresa, então o nome aparece antes ou imediatamente acima do valor.
________________________________________
Card 5 — Top 5 fornecedores
Ícone verde de grupo.
Valor:
27,4%
Complemento:
do total pago em 2026
Esse indicador mostra a concentração dos pagamentos nas cinco maiores empresas.
________________________________________
2 e 3. Distribuição dos pagamentos + Câmara x Senado
A próxima linha é dividida em duas grandes áreas lado a lado, aproximadamente metade da largura para cada uma.
________________________________________
2. Como os pagamentos se distribuem
À esquerda aparece o círculo:
2
Título:
Como os pagamentos se distribuem
Subtítulo:
“Distribuição dos valores pagos a fornecedores, segundo as classificações oficiais de despesa.”
Abaixo existe um gráfico horizontal intitulado:
Valor pago por categoria (2026)
É um ranking de barras horizontais.
Cada linha possui:
categoria | barra proporcional | valor pago | % do total
As categorias exibidas são:
•	Serviços terceirizados — R$ 15.126.520 — 36,8% 
•	Tecnologia da informação — R$ 7.954.321 — 19,4% 
•	Locação de mão de obra — R$ 6.287.440 — 15,3% 
•	Material de consumo — R$ 4.521.773 — 11,0% 
•	Manutenção e contratos — R$ 3.498.302 — 8,5% 
•	Passagens e logística — R$ 2.164.118 — 5,3% 
•	Outros — R$ 1.553.020 — 3,8% 
Cada categoria recebe uma cor diferente.
Visualmente:
● Serviços terceirizados █████████████████ R$ 15,1 mi 36,8%
O objetivo é permitir perceber rapidamente onde o Congresso está gastando com fornecedores.
________________________________________
3. Câmara x Senado ao longo do tempo
Na metade direita aparece o círculo:
3
Título:
Câmara x Senado ao longo do tempo
Subtítulo:
“Pagamentos a fornecedores por mês, separados por Casa, em 2026.”
No canto superior direito existem pequenos seletores de ano:
2023 2024 2025 [2026]
2026 aparece selecionado em verde.
________________________________________
Gráfico mensal
Abaixo existe um gráfico de barras verticais empilhadas, com uma barra para cada mês:
Jan · Fev · Mar · Abr · Mai · Jun · Jul · Ago · Set · Out · Nov · Dez
Cada barra é dividida em duas cores:
•	verde — Câmara dos Deputados 
•	azul — Senado Federal 
O eixo vertical representa o valor pago em reais, em milhões.
Assim é possível enxergar simultaneamente:
•	evolução mensal dos pagamentos; 
•	tamanho total de cada mês; 
•	proporção Câmara x Senado. 
________________________________________
Resumo abaixo do gráfico
Logo abaixo do gráfico existem dois cards pequenos lado a lado.
Total pago pela Câmara (2026)
Ícone institucional verde.
R$ 24.663.297
60,0% do total
________________________________________
Total pago pelo Senado (2026)
Ícone institucional azul.
R$ 16.442.197
40,0% do total
________________________________________
4. Bloco editorial — substitui completamente a tabela
Aqui eu mudaria significativamente o mockup original.
Não colocaria mais:
•	tabela de fornecedores; 
•	filtro por Casa; 
•	filtro por categoria; 
•	filtro de ano; 
•	busca dentro dessa seção; 
•	botão “Baixar CSV”; 
•	paginação ou listagem. 
Tudo isso passa para /fornecedores/explorar.
No lugar entra um bloco editorial grande, mais espaçoso que os blocos de dados anteriores, funcionando como encerramento da narrativa da página e ponte para duas experiências diferentes.
À esquerda pode continuar existindo o círculo:
4
Mas o conteúdo passa a ser:
Existe um mercado por trás dos gabinetes.
Embaixo, um texto em tamanho intermediário:
“Descubra quais empresas concentram pagamentos, quais estão espalhadas pelo Congresso e como fornecedores e parlamentares se conectam.”
O texto deve ter mais espaço em branco ao redor. A ideia é deliberadamente quebrar a sequência de gráficos e KPIs e dar à página um momento mais editorial.
________________________________________
CTAs
Logo abaixo ficam dois botões lado a lado, com hierarquia visual bem diferente.
CTA principal
Botão verde sólido e maior:
Ver o mercado dos gabinetes →
Destino:
/fornecedores-parlamentares
Esse é o CTA que deve chamar atenção primeiro.
Ele leva para a experiência analítica sobre o mercado de fornecedores ligado diretamente à atividade parlamentar: concentração, quantidade de gabinetes atendidos, dependência de poucos clientes, relações fornecedor ↔ parlamentar etc.
________________________________________
CTA secundário
Ao lado, botão branco/outline, bem menos chamativo:
Buscar empresa ou CNPJ
Destino:
/fornecedores/explorar
Esse é utilitário: serve para quem já sabe qual fornecedor está procurando e quer partir diretamente para a base.
Visualmente:
[ Ver o mercado dos gabinetes → ] [ Buscar empresa ou CNPJ ]
O primeiro precisa claramente parecer a ação principal.
________________________________________
Como eu desenharia esse bloco editorial
Eu faria ele diferente dos cards anteriores para deixar claro que começou uma nova etapa da experiência.
Poderia ocupar toda a largura do container e ter algo como:
lado esquerdo, aproximadamente 60%
Título grande:
Existe um mercado por trás dos gabinetes.
Texto:
Descubra quais empresas concentram pagamentos, quais estão espalhadas pelo Congresso e como fornecedores e parlamentares se conectam.
Botões:
[ Ver o mercado dos gabinetes → ]
[ Buscar empresa ou CNPJ ]
lado direito, aproximadamente 40%
Uma pequena composição visual abstrata relacionada à ideia de rede:
Fornecedor A ── 18 gabinetes
Fornecedor B ── 7 gabinetes
Fornecedor C ── 1 gabinete
ou pequenas bolhas/nós conectando empresas ↔ parlamentares, sem virar um gráfico completo.
Isso já planta visualmente a ideia do que o usuário encontrará na página seguinte.
________________________________________
Estrutura final da página
A hierarquia completa ficaria:
Hero — Fornecedores do Congresso
Busca rápida por fornecedor/CNPJ/categoria
↓
Filtros gerais
Casa · Categoria · Ano · Ordenação · Aplicar filtros
↓
1 — Visão geral dos pagamentos
5 KPIs
•	total pago; 
•	fornecedores pagos; 
•	maior categoria; 
•	maior fornecedor; 
•	concentração no Top 5. 
↓
2 + 3 — Área analítica em duas colunas
Esquerda:
Como os pagamentos se distribuem
→ ranking horizontal por categoria.
Direita:
Câmara x Senado ao longo do tempo
→ barras mensais empilhadas
→ total Câmara x total Senado.
↓
4 — Existe um mercado por trás dos gabinetes.
Texto editorial explicando a próxima camada da análise.
[ Ver o mercado dos gabinetes → ] → /fornecedores-parlamentares
[ Buscar empresa ou CNPJ ] → /fornecedores/explorar
Isso deixa a /fornecedores com uma função muito mais clara: ela explica o dinheiro institucional primeiro e, no final, abre duas portas. Uma é exploratória/utilitária; a outra é a experiência mais diferenciada do Cívica, que mostra como funciona o mercado que existe por trás dos gabinetes.

/fornecedores/explorar 
Vai ser bem simples, vai ser parecido com o /fornecedores de hoje. 
Vai ter ali uma barra de Buscar nome ou CNPJ. 
Um filtro de Tipo (Institucional ou Parlamentar), Casa, Ano. 
E a tabela que temos hoje de fornecedores cruzados, so que adicionando a coluna de Institucional ou Parlamentar (Ou ambos), e podemos sort everything nisso. 
/fornecedores-parlamentares
Aqui não entram os institucionais, é pra ser bem sexy
1. A abertura precisa vender a história, não mostrar KPIs
Eu não colocaria dois cards.
Faria um hero editorial:
O mercado por trás dos gabinetes
R$ XXXX milhões foram pagos a XXXX fornecedores em 2026.
Mas esse dinheiro não se distribui igualmente.
Os 20 maiores concentram xx% dos pagamentos. Xx empresas receberam de cinco ou mais parlamentares. xx começaram a aparecer nos gastos do Congresso apenas neste ano.
[ Explorar o mercado ↓ ]
Embaixo, talvez uma pequena observação:
Pagamentos relacionados à atividade parlamentar de deputados federais e senadores.
Visualmente, quase vazio. Número grande. Texto. Sem quatro quadradinhos com ícones.
2. A peça central: “Como é esse mercado?”
Esse scatter é excelente, mas eu faria dele o protagonista da página, não simplesmente “um gráfico”.
O mercado de fornecedores parlamentares
Cada ponto é uma empresa. Quanto mais alto, mais recebeu. Quanto mais à direita, mais parlamentares atendeu.
Scatter
X → parlamentares distintos que pagaram
Y → valor total recebido
Tamanho → quantidade de pagamentos
E acrescentaria uma dimensão muito importante:
Cor → tipo de despesa, opcional.
Não deixaria a cor obrigatória porque 15 categorias transformam em carnaval. Default neutro; ao selecionar “Publicidade”, por exemplo, destaca publicidade.
O pulo do gato: nomear regiões do gráfico
Não quatro quadrantes matemáticos rígidos, mas pequenas anotações editoriais:
                    VALOR RECEBIDO
                         ↑

     Grandes contratos  │     Grande alcance
     concentrados       │
                        │           ●
                ●       │                ●
                        │       ●
────────────────────────┼────────────────────────→
                        │                 ALCANCE
           ●            │   ●
                        │
     Relações pontuais  │     Muitos gabinetes,
                        │     valores menores
Isso ensina a interpretar.
Hover de verdade
Ao passar na bolinha:
Agência ABC Ltda.
R$ 1,42 mi recebidos
17 parlamentares
92 pagamentos
8 estados
61% vindos do maior cliente
Primeiro registro: fev/2025
+184% vs. 2025
Ver fornecedor →
A pessoa consegue ficar 10 minutos brincando só com esse gráfico.
3. Eu eliminaria “Alcance × Dependência” como seção separada
Porque você já criou a linguagem do mercado no scatter.
Transformaria em modo alternativo do mesmo gráfico.
Botões:
[ Tamanho do mercado ] [ Alcance × dependência ]
No segundo:
X → nº de parlamentares
Y → participação do maior cliente no total recebido
Aí surgem comportamentos bem diferentes:
Alto alcance + baixa dependência
Empresa distribuída por muitos gabinetes.
Baixo alcance + alta dependência
Empresa fortemente ligada a poucos clientes parlamentares.
Alto alcance + alta dependência
Caso curioso: atende vários gabinetes, mas um domina financeiramente.
Baixo alcance + baixa dependência
Operação pequena e pulverizada.
Ou seja, uma única visualização já proporciona duas formas de investigar o mercado.
Isso evita repetição.
4. Depois entra a parte mais viciante: “O que vale olhar?”
Eu mudaria “Relações que chamam atenção” para algo ainda mais editorial.
O que está acontecendo nesse mercado?
Mudanças, concentrações e relações que se destacam nos dados.
Nada de grid com seis cards idênticos.
Faria um feed vertical, quase Bloomberg/NYT.
________________________________________
NOVO NO CONGRESSO
Uma empresa que apareceu em março já recebeu R$ 782 mil
A Empresa X não possuía pagamentos observados anteriormente. Em sete meses, recebeu de 14 parlamentares de três estados.
Examinar relação →
________________________________________
ALTA CONCENTRAÇÃO
87% do que a Empresa Y recebeu veio de um único gabinete
Foram R$ 910 mil observados no período, dos quais R$ 792 mil vieram do parlamentar X.
Ver pagamentos →
________________________________________
EXPANSÃO
De 4 para 29 gabinetes em um ano
A Empresa Z multiplicou por sete seu número de clientes parlamentares entre 2025 e 2026.
R$ 92 mil → R$ 640 mil
Entender o crescimento →
________________________________________
MUITO COMPARTILHADO
43 parlamentares contrataram o mesmo fornecedor
São parlamentares de 11 estados e 7 partidos, com pagamentos distribuídos ao longo de 18 meses.
Ver quem são →
Isso começa a parecer uma página viva, não um BI.
E cada item leva para alguma exploração real.
________________________________________
5. “Quem fornece para quem?” — mas cuidado com o gráfico de rede
A ideia é ótima. Uma rede com 1.248 empresas × centenas de parlamentares, porém, vira macarrão.
Eu não abriria com toda a rede.
Faria:
Quem fornece para quem?
Explore as conexões entre empresas e gabinetes.
E começaria com uma busca:
[ Buscar fornecedor ou parlamentar... ]
Ou alguns casos selecionados:
Mais compartilhados · Maiores em valor · Em crescimento · Novos
Clicou em uma empresa:
                    EMPRESA ABC
                     R$ 1,84 mi

               92 pagamentos
                      │
       ┌──────────────┼─────────────┐
       │              │             │
  Parlamentar A  Parlamentar B  Parlamentar C
    R$ 410 mil     R$ 320 mil     R$ 190 mil
       │
   + 14 outros
E cada nó é clicável.
O importante é chamar isso de rede de relações financeiras observadas, e não sugerir que uma conexão financeira implique relação política ou irregularidade.
________________________________________
6. A concentração merece uma seção própria
Essa eu manteria porque responde uma pergunta estrutural diferente.
O dinheiro está nas mãos de poucos?
E gigantesco:
De cada R$ 100 pagos,
R$ 38 foram para apenas 20 fornecedores.
Visual:
Maior fornecedor       R$ 9
Top 5                   R$ 27
Top 20                  R$ 38
Demais 1.228            R$ 62
Mas eu permitiria clicar:
Todos · Publicidade · Consultoria · Passagens · Aluguel · ...
E:
Congresso · Câmara · Senado
Isso pode revelar histórias muito mais interessantes.
Exemplo hipotético:
Publicidade é significativamente mais concentrada: os cinco maiores fornecedores recebem 52% dos pagamentos da categoria.
Enquanto outra:
Em passagens, os cinco maiores respondem por 18%.
Isso ensina como cada mercado funciona, não apenas quanto gastaram.
________________________________________
7. Colocaria uma análise que ainda não está na sua proposta: “quão nacional é esse mercado?”
Essa eu acho muito sexy.
Até onde chegam esses fornecedores?
Você não precisa nem necessariamente mostrar um mapa logo de cara.
Exemplo:
74% dos fornecedores atendem parlamentares de apenas um estado.
63 empresas aparecem em cinco ou mais estados.
11 fornecedores receberam pagamentos de parlamentares de todas as regiões do país.
E aí:
Empresa ABC
29 parlamentares · 12 estados · 6 partidos · Câmara + Senado
Isso é uma dimensão muito mais interessante que “categoria mais gasta”.
Pode até virar um atributo:
Alcance político-institucional observado
Não no sentido ideológico.
É literalmente:
•	número de parlamentares; 
•	número de estados; 
•	número de partidos; 
•	Câmara/Senado. 
________________________________________
8. Outra métrica muito forte: recorrência
Existe uma pergunta excelente:
Esses fornecedores aparecem uma vez ou viram parte recorrente da operação dos gabinetes?
Quem permanece?
Por exemplo:
682 fornecedores
receberam apenas em um único ano.
214 fornecedores
aparecem há três anos ou mais.
38 fornecedores
receberam pagamentos em todos os anos da série.
E para uma empresa:
Ativa no Congresso há 6 anos
Recebeu pagamentos em 58 dos últimos 72 meses.
Isso cria uma dimensão de longevidade que simplesmente olhar valor não revela.
________________________________________
9. E eu criaria “velocidade”
Essa é bem Cívica.
Para fornecedores novos:
Quanto tempo leva para ganhar escala?
Exemplo:
Empresa aberta em janeiro/2025
Primeiro pagamento: maio/2025
R$ 100 mil acumulados: agosto/2025
R$ 500 mil: fevereiro/2026
10º parlamentar cliente: abril/2026
Visualmente:
ABERTURA        1º PAGAMENTO       R$100k       10º GABINETE       R$500k
   ●----------------●----------------●---------------●----------------●
 Jan/25           Mai/25           Ago/25          Abr/26           Jun/26
Não precisa dizer que é anormal.
Você simplesmente mostra a trajetória.
E deixa o usuário interpretar.

