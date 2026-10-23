# Comparabilidade dos efetivos e da estrutura institucional (P9.3)

Regra geral: **cada fonte × corporação × medida é um indicador separado** (`IND-EFE-<FONTE>-…`). O Cívica nunca soma, funde ou "concilia" fontes diferentes em um número só. Este documento explica o que pode ser comparado, com que cuidado, e o que não pode.

## 1. FBSP (2025) × ESTADIC (2018 e 2022)

| | FBSP Raio-X 2026 | ESTADIC (edições 2019 e 2023) |
|---|---|---|
| Quem informa | portais da transparência federal/estaduais, DPF, DPRF, DEPEN, RAIS | o órgão gestor da segurança de cada UF, em questionário |
| Conceito | **efetivo da ativa** (servidores em atividade na posição informada) | **efetivo existente** declarado pela UF |
| Data-base | PM, CBM, PC, perícia, polícia penal, PRF: março/2025; PF: abril/2025; polícia penal federal: junho/2023 | 31/12/2018 (edição 2019) e 31/12/2022 (edição 2023) |
| Corporações por UF | PM, CBM, PC, perícia, polícia penal, guardas municipais | só PM e PC (e contagem de unidades: operacionais da PM; delegacias distritais/especializadas da PC) |
| Ausência | "..." (indisponível), "-" (fenômeno inexistente), célula vazia (SP/CBM) | "Recusa" (RO 2023), "Não informou", "(*) Não soube informar" |

Exemplos reais (ES, SP, RJ; PM): FBSP 9.231 / 82.250 / 42.543; ESTADIC 2022 7.938 / 79.943 / 43.761; ESTADIC 2018 8.710 / 83.044 / 44.020. As diferenças **não são variação anual**: são três fontes, três datas e duas definições. Por isso:

- os valores são mostrados **lado a lado**, com fonte, data-base e definição (`getSecurityStaffingState().divergences`, sempre `comparable: false`);
- **não existe série contínua 2018 → 2025**: a ESTADIC dá dois pontos (31/12/2018 e 31/12/2022) com a mesma pergunta e os mesmos códigos de variável (conferidos no dicionário oficial de cada edição); nada foi preenchido para 2019–2021 nem 2023–2024; o FBSP 2025 é um terceiro ponto de **outra** fonte;
- nenhuma taxa por habitante é calculada para a ESTADIC e a MUNIC: **não há estimativa populacional oficial carregada para 2018 e 2022** (o Cívica tem SIDRA 6579 sem 2022 e 2023; o Censo 2022 não é uma estimativa de 31/12).

Rondônia respondeu em 2019 e **recusou** em 2023: a linha 2023 existe com valor nulo e estado `refused`. Nunca zero. Pará e Tocantins informaram em 2023 só o total do efetivo (sem o recorte por sexo): as colunas de homens/mulheres ficam `not_informed`.

## 2. FBSP × SIAPE (PF e PRF)

| | FBSP (2025) | SIAPE (ago/2026) |
|---|---|---|
| PF | 12.536 (abril/2025) | 17.253 registros de vínculo |
| PRF | 12.328 (março/2025) | 14.000 registros de vínculo |

- O SIAPE conta **linhas do cadastro por órgão de exercício**, não pessoas nem policiais. Em PF e PRF a situação do vínculo, o cargo, a UF e **o próprio identificador do servidor** vêm "Sigiloso" (o número de identificadores distintos é 1): não há como separar ativos de aposentados, policiais de administrativos, nem contar pessoas. Uma pessoa pode ter um registro de cargo e outro de função.
- Os registros de tipo "Cargo" (PF 14.579; PRF 12.951) são o recorte mais próximo de "uma linha por servidor", mas ainda incluem carreiras de apoio e podem incluir inativos.
- A diferença para o FBSP (PF +38 %, PRF +14 %) é consequência dos conceitos, **não crescimento de policiais**. O Cívica publica as duas medidas separadas (indicadores 5006/5007 e 5301–5304) e nunca troca uma pela outra.
- A série SIAPE tem 9 competências (jan/2020 a jan/2026 em saltos anuais, mais jul/2026 e ago/2026). **Meses não coletados não existem na série e não foram interpolados.** O comportamento de PF e PRF não é monótono (PRF: 12.019 em jan/2020, 14.356 em jan/2023, 13.719 em jan/2025, 14.000 em ago/2026).
- Distribuição por UF ou município: **impossível** (campo sigiloso). Nenhuma inferência a partir do local de delegacias, postos ou operações.

## 3. Quadro previsto × efetivo existente

Só o FBSP traz previsto, e só para PM (Tabela 3), PC (Tabela 4) e polícia penal estadual (Tabela 5). Publicados: previsto, **ocupação** (existente ÷ previsto × 100) e **diferença** (previsto − existente, negativa quando o existente supera o previsto: CE-PM 100,4 %).

- previsto é **cargo previsto em lei**, não necessidade de policiamento nem meta;
- a ocupação mede preenchimento de cargos, **não cobertura do policiamento do território**; não classifica UF como mais ou menos segura;
- a ocupação é recalculada pelo Cívica e conferida contra a coluna "relação" impressa (diferença máxima 0,05 p.p., em todas as linhas com percentual impresso); Alagoas (polícia penal) traz "..." no PDF mas os dois números permitem o cálculo;
- Ceará (polícia penal): o previsto é "..." na fonte: linha com valor nulo e estado `unavailable`; sem ocupação nem diferença;
- **RJ (PM)**: a nota da Tabela 3 diz que os números da PM do RJ são de março/2022 (a instituição não respondeu à LAI para 2023), enquanto a nota (1) da Tabela 2 diz "março/2025" para todas as colunas. A fonte não esclarece se a linha do RJ da Tabela 2 também é de 2022. As quatro linhas do RJ-PM (efetivo, previsto, ocupação, diferença) levam o sinalizador `refDateUncertain` e a taxa por habitante do RJ também.
- perícia, bombeiros e guardas **não** têm quadro previsto na fonte: não há indicador de previsto para eles.

## 4. Vínculos × profissionais; efetivo da ativa × lotado × operacional

Nenhum indicador publicado é "efetivo lotado" ou "efetivo operacional". Vínculo administrativo (SIAPE), efetivo da ativa (FBSP), efetivo existente declarado (ESTADIC) e efetivo declarado da guarda (MUNIC) são quatro medidas distintas, sem conversão entre elas.

## 5. PM estadual × guarda municipal

- PM, PC, bombeiros, perícia e polícia penal são **estaduais** e existem **por UF**. O Cívica não distribui nenhum deles por município, população, delegacia ou território (`getSecurityStructureMunicipality` devolve o total da UF apenas em `stateContext`, rotulado "Contexto estadual (FBSP, 2025)" com o aviso "não é o efetivo lotado neste município").
- Guarda municipal é **municipal**. Três leituras diferentes coexistem e **não são somadas nem confundidas**:
  1. **MUNIC (planilha oficial)**: 1.322 municípios e 101.854 guardas em 2023 (efetivo em 31/12/2022); 1.188 e 99.510 em 2019. É o único dado por município.
  2. **FBSP final** (RAIS 2024 + MUNIC 2023 + Senasp 2024, com checagem do próprio FBSP): 1.384 municípios e 107.457 guardas, **só por UF**; a lista municipal do FBSP (Tabela 27) traz nomes sem código IBGE, mistura fontes (RAIS/MUNIC) e não foi importada.
  3. **FBSP leu a MUNIC 2023** como 1.306 municípios e 101.653 guardas; a planilha oficial tem 1.322 e 101.854. O Cívica publica o arquivo como está e registra a diferença.
- Por isso não há "total de guardas" que some MUNIC e FBSP: seria contar duas vezes universos relacionados.

## 6. Ano de referência × ano de publicação

Cada linha traz `period_start`/`period_end` = **data-base** da medida, não o ano da pesquisa ou do relatório:

| Fonte | Publicação | Data-base das linhas |
|---|---|---|
| FBSP Raio-X | 2026 (2ª edição) | 2025-03 (maioria), 2025-04 (PF), 2023-06 (polícia penal federal), 2025/ano (polícia legislativa e guardas, incerta) |
| ESTADIC | 2019 e 2023 | 2018-12-31 e 2022-12-31 |
| MUNIC | 2019 e 2023 | existência: ano da pesquisa; efetivo: 2022-12-31 (2023) e ano da pesquisa 2019 com `refDateUncertain` (o dicionário 2019 não informa a data) |
| SIAPE | mensal | o mês do arquivo |

## 7. O que se pode e o que não se pode comparar entre UFs

**Pode (com a nota da corporação):**
- efetivo da ativa de uma mesma corporação entre UFs, mesma fonte e data-base (FBSP, março/2025), em valor absoluto ou por 100 mil habitantes (denominador: população SIDRA 2025). Conferência independente: as 80 taxas por 1.000 habitantes (PM, CBM, PC × UFs) ficam a até 0,1 da Tabela 6 do FBSP;
- ocupação do quadro previsto de PM, PC e polícia penal;
- contagens de guardas municipais e de municípios com delegacia, por UF, em cada edição da MUNIC, sempre com o número de municípios que não responderam.

**Não pode:**
- somar corporações ("policiais por 100 mil" agregado): cada taxa é de uma corporação; nenhum indicador no banco tem esse significado;
- ranquear UFs por número de policiais como se medisse segurança, eficiência ou capacidade de resposta; não existe "índice de eficiência policial";
- relacionar efetivo à criminalidade sem metodologia própria;
- comparar PM de São Paulo com as outras UFs sem a nota: o valor inclui bombeiros (nota 7) e o CBM de SP não tem valor (a soma das 26 outras UFs = total nacional do CBM);
- usar a existência de delegacia como número de unidades, de investigadores ou de área atendida (a MUNIC é binária);
- inferir que uma estrutura declarada em 2019/2023 existe em 2026.
