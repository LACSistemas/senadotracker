Vamos adequar os dados ao frontend, pra finalmente popular as coisas de eleições e gabinetes que não existem hj, vc vai criar a taskfase3.md onde seria as tasks de  adaptabilidade disso sem perder nosso estilo de UI/UX para a integração de algo que serviria a esse mockup. 


Aqui os dados do TSE da eleição de 2022 

"C:\Users\lucas\Downloads\consulta_cand_2022 (1)\consulta_cand_2022_BRASIL.csv"

"C:\Users\lucas\Downloads\bem_candidato_2022\bem_candidato_2022_BRASIL.csv"

"C:\Users\lucas\Downloads\consulta_cand_complementar_2022\consulta_cand_complementar_2022_BRASIL.csv"

Aqui de 2018 

"C:\Users\lucas\Downloads\consulta_cand_2018\consulta_cand_2018_BRASIL.csv"
"C:\Users\lucas\Downloads\bem_candidato_2018\bem_candidato_2018_BRASIL.csv"

Para gabinete, eu faria assim:
Deputados federais — Câmara
Você tem duas fontes principais.
1. Quem trabalha em cada gabinete
Arquivo oficial atualizado diariamente:
https://dadosabertos.camara.leg.br/arquivos/funcionarios/csv/funcionarios.csv
Ele contém todos os funcionários ativos da Câmara, incluindo secretários parlamentares, com nome, número de ponto, lotação, cargo, função e data de nomeação. A própria Câmara avisa que é um snapshot do dia anterior, não histórico.
Para testar no PowerShell:
curl.exe -L -o funcionarios_camara.csv "https://dadosabertos.camara.leg.br/arquivos/funcionarios/csv/funcionarios.csv"
A partir da lotacao, seu agente consegue agrupar:
Deputado X
├── 19 secretários parlamentares
├── nomes
├── cargos
├── funções
└── datas de nomeação
2. Quanto aquele gabinete gasta
A Câmara tem uma página individual por deputado:
https://www.camara.leg.br/deputados/{ID_DEPUTADO}/verba-gabinete?ano=2026
Exemplo real:
https://www.camara.leg.br/deputados/209787/verba-gabinete?ano=2026
Ela retorna algo como:
Janeiro    disponível R$ 133.170,54   gasto R$ 116.095,44
Fevereiro  disponível R$ 145.991,64   gasto R$ 119.744,15
Março      disponível R$ 165.806,07   gasto R$ 127.754,85
...
Isso é exatamente o que você estava sentindo falta na CEAP.
Atualmente o limite normal é R$ 165.806,07/mês, para até 25 secretários parlamentares. A Câmara deixa explícito que 13º, férias e auxílio-alimentação ficam fora dessa verba.
Então eu colocaria na sua BD:
gabinete_deputado_mes

deputado_id
ano
mes
limite_verba
valor_gasto
percentual_utilizado
quantidade_funcionarios

Senadores — Senado
Aqui é até mais explícito.
Existe uma base oficial diária de servidores efetivos e comissionados ativos, contendo:
nome
unidade onde trabalha
vínculo
data de admissão
cargo
especialidade
função
afastamento
...
O Senado confirma que a periodicidade é diária.
Além disso, cada senador tem uma página específica:
https://www6g.senado.leg.br/transparencia/sen/{ID}/pessoal/?ano=2026&local=gabinete
Ela já vem separada em:
Efetivos
Comissionados
Terceirizados
Estagiários
e lista nome + função/cargo.
Por exemplo, a página do Renan Calheiros atualmente mostra 21 comissionados e lista individualmente assessor legislativo, assessor parlamentar, secretário legislativo etc.
E a remuneração dos servidores também é pública em CSV. O portal do Senado disponibiliza explicitamente “Servidores Ativos — Versão Web / CSV” para remuneração e subsídio.


Aí vamos ter um breakdown completo do seu gabinete
