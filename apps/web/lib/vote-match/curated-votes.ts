/**
 * Curadoria editorial de votações nominais notáveis, por Casa — "Qual parlamentar vota como você?"
 * (widget em /legislativo). NÃO é o universo completo de votações nominais, nem uma amostra aleatória:
 * é uma seleção manual de votos substantivos (não procedimentais), com assunto verificado na fonte
 * oficial de cada Casa (API de dados abertos do Senado/Câmara, ou matéria oficial via busca) antes de
 * escrever `pauta` — nunca por memória do que a proposição "deve" tratar. Quando o mesmo projeto teve
 * 1º e 2º turno, só o turno decisivo entra aqui, para não contar o mesmo voto duas vezes no motor de
 * concordância; quando o mesmo projeto aparece nas duas Casas (ex. a reforma tributária), cada Casa
 * usa sua PRÓPRIA votação, nunca a mesma deliberação citada duas vezes.
 *
 * `pauta` é UMA frase só, em linguagem simples, que descreve o EFEITO CONCRETO E DIRECIONAL da medida —
 * nunca "muda as regras de X" ou "regulamenta Y" sem dizer em que direção, porque aí Sim/Não perde o
 * sentido (achado real do feedback do usuário sobre a 1ª versão do licenciamento ambiental: a frase
 * dizia que a lei "muda as regras", mas não dizia SE afrouxa ou aperta o licenciamento, então Sim/Não
 * não tinham significado claro).
 *
 * `deliberationId` é o `external_id` real em `civica_votes_presence_poc.deliberations` (e a chave de
 * join com `votes`). O loader (`voteMatchDataset` em `apps/web/lib/data-postgres.ts`) busca aqui só o
 * texto editorial; data, resultado, nº de votos registrados e a URL oficial vêm sempre ao vivo do banco,
 * nunca duplicados aqui — evita os dois ficarem dessincronizados se a fonte for reprocessada.
 */
export interface CuratedVote {
  deliberationId: string;
  proposalLabel: string;
  /** O efeito concreto e direcional da medida, numa frase só — Sim = a favor do que esta frase descreve. */
  pauta: string;
}

export const CURATED_VOTES: Record<'senado' | 'camara', CuratedVote[]> = {
  senado: [
    { deliberationId: '7050', proposalLabel: 'PL 896/2023', pauta: 'Tornar crime, pela mesma lei do racismo, atos de ódio contra mulheres motivados por misoginia.' },
    { deliberationId: '7097', proposalLabel: 'PEC 14/2021', pauta: 'Dar aposentadoria diferenciada e regularizar o vínculo dos agentes comunitários de saúde e de combate a endemias.' },
    { deliberationId: '7048', proposalLabel: 'PEC 22/2025', pauta: 'Obrigar a instalação de pontos de parada e descanso para caminhoneiros em intervalos regulares nas rodovias, e flexibilizar a obrigatoriedade de descanso do motorista quando não houver local adequado disponível.' },
    { deliberationId: '7094', proposalLabel: 'PLP 128/2022', pauta: 'Usar o Fundo Penitenciário Nacional para capacitar os policiais penais e servidores do sistema prisional.' },
    { deliberationId: '7098', proposalLabel: 'PLP 18/2021', pauta: 'Permitir que o atendimento pré-hospitalar dos bombeiros receba verba de emendas parlamentares de saúde.' },
    { deliberationId: '7101', proposalLabel: 'PLP 124/2022', pauta: 'Criar regras nacionais para resolver de forma mais consensual disputas entre contribuintes e o Fisco.' },
    { deliberationId: '6935', proposalLabel: 'PL 2159/2021', pauta: 'Criar uma licença ambiental "por adesão e compromisso": o empreendedor se autodeclara dentro de regras pré-definidas e passa a poder operar sem análise prévia caso a caso do órgão ambiental, para empreendimentos de pequeno/médio porte e baixo/médio potencial poluidor (mineração fica de fora).' },
    { deliberationId: '6938', proposalLabel: 'PEC 37/2022', pauta: 'Incluir guardas municipais e agentes de trânsito como órgãos oficiais de segurança pública.' },
    { deliberationId: '7033', proposalLabel: 'PEC 48/2023', pauta: 'Fixar na Constituição que só são demarcadas como terras indígenas as que já eram ocupadas por povos indígenas em 1988 (o "marco temporal").' },
    { deliberationId: '7036', proposalLabel: 'PEC 169/2019', pauta: 'Permitir que um professor acumule seu cargo com qualquer outro cargo público remunerado.' },
    { deliberationId: '6920', proposalLabel: 'PEC 18/2024', pauta: 'Declarar o Pantanal patrimônio nacional, como já são a Amazônia e a Mata Atlântica.' },
    { deliberationId: '6926', proposalLabel: 'PEC 2/2016', pauta: 'Tornar o saneamento básico um direito social garantido pela Constituição, como saúde e educação.' },
    { deliberationId: '6929', proposalLabel: 'PEC 81/2015', pauta: 'Dar aos estados e ao DF o poder de legislar, junto com a União, sobre proteção ao idoso.' },
    { deliberationId: '6782', proposalLabel: 'PEC 8/2021', pauta: 'Impedir que um só ministro do STF (ou de outro tribunal superior) decida sozinho pedidos de vista, declarações de inconstitucionalidade e medidas cautelares — essas decisões passariam a exigir o colegiado.' },
    { deliberationId: '6777', proposalLabel: 'PEC 45/2019', pauta: 'Criar os novos impostos sobre consumo (IBS e CBS) para substituir, aos poucos, o ICMS, o ISS, o PIS e a Cofins — a reforma tributária do consumo.' },
    { deliberationId: '6714', proposalLabel: 'PLP 93/2023', pauta: 'Criar o novo "arcabouço fiscal", regras que limitam o crescimento das despesas públicas conforme a arrecadação, substituindo o antigo teto de gastos.' },
    { deliberationId: '6916', proposalLabel: 'PEC 54/2024', pauta: 'Reduzir despesas obrigatórias do governo, diminuindo gradualmente quem tem direito ao abono do PIS/Pasep e reforçando o limite para salários públicos acima do teto constitucional (supersalários).' },
    { deliberationId: '6833', proposalLabel: 'PLP 150/2021', pauta: 'Criar mecanismos de proteção à população LGBT+ presa, dentro do sistema penitenciário.' },
    { deliberationId: '6836', proposalLabel: 'PL 914/2024', pauta: 'Criar incentivos fiscais para fabricantes de veículos menos poluentes (Programa Mover) e taxar as compras internacionais de baixo valor, como as de até US$ 50 (a "taxação das blusinhas").' },
    { deliberationId: '6279', proposalLabel: 'PL 317/2021', pauta: 'Obrigar a administração pública federal a oferecer seus serviços também em formato digital, com uma base nacional de serviços públicos e plataformas de governo digital.' },
    { deliberationId: '6312', proposalLabel: 'PL 4209/2019', pauta: 'Dar prioridade na fila de registro da Anvisa para medicamentos fabricados com insumo farmacêutico ativo de origem nacional.' },
    { deliberationId: '6314', proposalLabel: 'PL 4725/2020', pauta: 'Permitir reduzir a pena de prisão por frequência em qualquer curso educacional (não só ensino formal) que ajude na ressocialização do condenado.' },
    { deliberationId: '6327', proposalLabel: 'PL 1674/2021', pauta: 'Criar um Passaporte Nacional de Imunização (com dados de vacinação, testagem e recuperação de doença) que pode ser usado para suspender ou abrandar restrições sanitárias de emergência de saúde pública.' },
    { deliberationId: '6340', proposalLabel: 'PL 741/2021', pauta: 'Criar o programa "Sinal Vermelho contra a Violência Doméstica" (pedido de ajuda discreto em farmácias e outros locais), aumentar a pena da lesão corporal simples cometida contra a mulher por razão de sexo, e criar o crime de violência psicológica contra a mulher.' },
    { deliberationId: '6410', proposalLabel: 'PL 2505/2021', pauta: 'Exigir prova de dolo (intenção deliberada) para punir um agente público por improbidade administrativa, acabando com a punição por mera culpa (erro ou negligência).' },
    { deliberationId: '6418', proposalLabel: 'PL 4194/2019', pauta: 'Permitir que a Justiça conceda medidas protetivas urgentes a vítimas de violência doméstica sem precisar ouvir antes o Ministério Público, e autorizar prisão preventiva de quem descumprir essas medidas.' },
    { deliberationId: '6425', proposalLabel: 'PL 123/2019', pauta: 'Usar parte do dinheiro do Fundo Nacional de Segurança Pública também para financiar ações de combate à violência contra a mulher.' },
    { deliberationId: '6437', proposalLabel: 'PL 4373/2020', pauta: 'Equiparar a injúria racial ao crime de racismo, aumentando a pena para esse tipo de ofensa por raça, cor, etnia ou procedência nacional.' },
    { deliberationId: '6514', proposalLabel: 'PL 520/2021', pauta: 'Garantir atendimento prioritário a pessoas com diabetes nos serviços de saúde públicos e privados.' },
    { deliberationId: '6518', proposalLabel: 'PLC 115/2017', pauta: 'Impedir que hospitais filantrópicos e Santas Casas de Misericórdia tenham seus bens tomados (penhorados) para pagar qualquer tipo de dívida.' },
    { deliberationId: '6557', proposalLabel: 'PL 3846/2021', pauta: 'Obrigar os laboratórios a oferecer também a bula do medicamento em versão digital, acessível por QR Code na embalagem (a bula de papel continua existindo).' },
    { deliberationId: '6612', proposalLabel: 'PLP 18/2022', pauta: 'Classificar combustíveis, energia elétrica, telecomunicações e transporte coletivo como bens essenciais para fins de ICMS, limitando a alíquota que os estados podem cobrar sobre eles (reduzindo o preço ao consumidor).' },
    { deliberationId: '6670', proposalLabel: 'PL 2438/2022', pauta: 'Aumentar em 18% o salário dos Ministros do STF, o que também reajusta, por efeito cascata, o teto salarial do funcionalismo público em geral.' },
    { deliberationId: '6783', proposalLabel: 'PLP 243/2023', pauta: 'Permitir que os gastos do programa Pé-de-Meia (bolsa para o aluno do ensino médio não abandonar a escola) ficassem fora do limite de gastos do arcabouço fiscal em 2023.' },
    { deliberationId: '6816', proposalLabel: 'MPV 1185/2023', pauta: 'Dificultar que empresas usem incentivos fiscais de ICMS dados pelos estados para reduzir o Imposto de Renda federal que pagam, substituindo esse benefício por um crédito fiscal restrito a projetos de investimento.' },
    { deliberationId: '6818', proposalLabel: 'PL 2253/2022', pauta: 'Acabar com a "saidinha" (saída temporária de presos em datas comemorativas), exigir exame criminológico para progressão de regime, e exigir monitoramento eletrônico do preso.' },
    { deliberationId: '6939', proposalLabel: 'PLP 234/2020', pauta: 'Elevar para R$ 120 mil o valor máximo de contratação pública reservada só para micro e pequenas empresas, e exigir que grandes empresas subcontratem micro/pequenas empresas em obras e serviços públicos.' },
    { deliberationId: '6951', proposalLabel: 'PLP 177/2023', pauta: 'Aumentar o número de deputados federais de 513 para 531 a partir de 2027, dando novas cadeiras aos estados que mais cresceram sem tirar vaga de nenhum estado.' },
  ],
  camara: [
    { deliberationId: '2233802-438', proposalLabel: 'PEC 221/2019', pauta: 'Reduzir a jornada de trabalho padrão do Brasil de 44h para 36h semanais, em 10 anos.' },
    { deliberationId: '2500080-330', proposalLabel: 'PEC 18/2025', pauta: 'Tornar a segurança pública uma competência legislativa CONCORRENTE entre União, estados e municípios — mantendo o poder de estados e municípios de legislar sobre o tema, em vez de concentrá-lo só na União, como queria a proposta original do Executivo.' },
    { deliberationId: '2162116-178', proposalLabel: 'PEC 383/2017', pauta: 'Garantir na Constituição um financiamento mínimo obrigatório para a assistência social (SUAS).' },
    { deliberationId: '2191208-67', proposalLabel: 'PL 488/2019', pauta: 'Tornar obrigatórias penas restritivas de direitos para quem é condenado por pedofilia.' },
    { deliberationId: '2606313-36', proposalLabel: 'PLP 41/2026', pauta: 'Criar um sistema nacional, com recursos próprios, para combater a violência contra mulheres e o feminicídio.' },
    { deliberationId: '2557414-32', proposalLabel: 'MPV 1313/2025', pauta: 'Permitir que famílias do Auxílio Gás escolham entre receber o valor em dinheiro ou o botijão de gás gratuito entregue pelo revendedor, sem acumular os dois benefícios.' },
    { deliberationId: '2351506-122', proposalLabel: 'PEC 5/2023', pauta: 'Ampliar e detalhar na Constituição a imunidade de impostos para templos e entidades religiosas e sem fins lucrativos.' },
    { deliberationId: '2382675-97', proposalLabel: 'PL 4133/2023', pauta: 'Elevar de 10% para 20% a margem de preferência para produtos nacionais em compras públicas, dentro de uma nova política industrial com metas obrigatórias de descarbonização.' },
    { deliberationId: '2618177-71', proposalLabel: 'PLP 114/2026', pauta: 'O governo abrir mão de receita fiscal para amortecer, no Brasil, o impacto de uma crise de energia internacional.' },
    { deliberationId: '2580259-24', proposalLabel: 'PLP 230/2025', pauta: 'Proibir o governo de contingenciar (travar) o dinheiro do fundo que leva telecomunicações a áreas carentes.' },
    { deliberationId: '2608575-64', proposalLabel: 'PLP 55/2026', pauta: 'Isentar de impostos municipais (ISS) os serviços ligados à organização da Copa do Mundo Feminina de 2027 no Brasil.' },
    { deliberationId: '2562173-30', proposalLabel: 'MPV 1317/2025', pauta: 'Fortalecer a Autoridade Nacional de Proteção de Dados (ANPD), com carreira própria de fiscalização.' },
    { deliberationId: '2324721-94', proposalLabel: 'PL 1366/2022', pauta: 'Excluir a silvicultura (plantio de árvores para corte, como eucalipto) da lista de atividades consideradas potencialmente poluidoras, dispensando-a de parte do licenciamento ambiental.' },
    { deliberationId: '2454495-166', proposalLabel: 'PEC 66/2023', pauta: 'Criar um limite para o pagamento de precatórios (dívidas judiciais) pelos municípios, e abrir um novo parcelamento especial para as dívidas previdenciárias municipais.' },
    { deliberationId: '2204088-88', proposalLabel: 'PL 3010/2019', pauta: 'Criar um programa nacional de proteção aos direitos de quem tem fibromialgia, fadiga crônica ou síndrome complexa de dor regional.' },
    { deliberationId: '2430143-72', proposalLabel: 'PLP 68/2024', pauta: 'Regulamentar a reforma tributária, criando o novo IBS (Imposto sobre Bens e Serviços), a CBS (Contribuição Social sobre Bens e Serviços) e o Imposto Seletivo, que vão substituir impostos como ICMS, ISS, PIS e Cofins.' },
    { deliberationId: '2270800-160', proposalLabel: 'PEC 3/2021', pauta: 'A "PEC da Blindagem": exigir autorização do Congresso para abrir processo criminal contra deputados e senadores, restringir prisões e buscas a decisão do STF, e incluir presidentes de partido no foro privilegiado mesmo fora do mandato.' },
    { deliberationId: '2192459-786', proposalLabel: 'PEC 6/2019', pauta: 'Estabelecer idade mínima para se aposentar (62 anos para mulheres, 65 para homens, com regras de transição), acabando com a aposentadoria só por tempo de contribuição sem idade mínima — a reforma da Previdência de 2019.' },
    { deliberationId: '1198512-272', proposalLabel: 'PEC 15/2015', pauta: 'Tornar permanente o Fundeb (fundo que financia a educação básica pública, que antes tinha prazo de validade) e aumentar a parte que a União contribui para ele.' },
    { deliberationId: '2293449-241', proposalLabel: 'PEC 23/2021', pauta: 'A "PEC dos Precatórios": limitar o valor que a União paga por ano em precatórios (dívidas que perdeu na Justiça), parcelando o que exceder esse limite, e mudar a fórmula de correção do teto de gastos públicos para abrir mais espaço de gastos.' },
    { deliberationId: '2326450-98', proposalLabel: 'PEC 11/2022', pauta: 'Criar um piso salarial nacional obrigatório para enfermeiros, técnicos e auxiliares de enfermagem, e parteiras.' },
    { deliberationId: '2288318-78', proposalLabel: 'PEC 16/2021', pauta: 'Permitir que um brasileiro adquira outra nacionalidade sem perder automaticamente a nacionalidade brasileira (a perda só ocorre se a própria pessoa pedir).' },
    { deliberationId: '2238434-80', proposalLabel: 'PL 528/2020', pauta: 'Criar programas de incentivo a combustíveis renováveis (etanol de aviação, diesel verde, biometano) e à captura e estocagem de carbono — o "Combustível do Futuro".' },
    { deliberationId: '2352476-168', proposalLabel: 'PEC 9/2023', pauta: 'Obrigar os partidos políticos a aplicar recursos financeiros de campanha especificamente em candidaturas de pessoas pretas e pardas.' },
    { deliberationId: '2515648-44', proposalLabel: 'PDL 214/2025', pauta: 'Derrubar o decreto do governo federal que tinha aumentado o IOF (Imposto sobre Operações Financeiras).' },
    { deliberationId: '2279186-86', proposalLabel: 'PL 458/2021', pauta: 'Permitir que pessoas físicas atualizem o valor declarado de bens (imóveis, veículos) e regularizem bens lícitos não declarados à Receita Federal, pagando um imposto de 4% sobre a diferença de valor.' },
    { deliberationId: '2466104-95', proposalLabel: 'PLP 175/2024', pauta: 'Criar regras obrigatórias de transparência e rastreabilidade para as emendas parlamentares (verba que cada deputado e senador destina a obras e programas), permitindo bloqueá-las na mesma proporção que o resto do orçamento.' },
    { deliberationId: '2576234-34', proposalLabel: 'PLP 204/2025', pauta: 'Permitir que o governo gaste bilhões em projetos estratégicos de defesa nacional (como submarinos e caças) sem contar no teto de gastos nem na meta fiscal.' },
    { deliberationId: '2422905-75', proposalLabel: 'PEC 72/2023', pauta: 'Isentar do IPVA os veículos de passageiros com 20 anos ou mais de fabricação.' },
    { deliberationId: '2122682-94', proposalLabel: 'PEC 39/2022', pauta: 'Tornar os Tribunais de Contas órgãos permanentes e essenciais ao controle externo da administração pública, protegendo-os na própria Constituição.' },
    { deliberationId: '2483447-25', proposalLabel: 'PL 358/2025', pauta: 'Transferir temporariamente a sede do governo federal para Belém (PA) durante a COP30, a conferência do clima da ONU, entre 11 e 21 de novembro de 2025.' },
    { deliberationId: '2318217-77', proposalLabel: 'PLP 235/2019', pauta: 'Criar o Sistema Nacional de Educação, com regras comuns de cooperação entre as redes de ensino federal, estadual e municipal.' },
    { deliberationId: '2439876-43', proposalLabel: 'PRC 32/2024', pauta: 'Dar à Mesa Diretora da Câmara o poder de suspender cautelarmente, por até 6 meses, o mandato de um deputado que responde a processo disciplinar interno.' },
  ],
};
