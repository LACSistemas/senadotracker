# Contrato de infraestrutura e docentes · G5

Estado: **PASS_WITH_CAVEATS** · Fase consumidora: P10.3 (depende de P10.1) · Provas: `censo_escolar_variaveis_x_ano.csv` (1.180 variáveis × 19 anos), `censo_infra_semantica_nulos_2021_2025.json`, `inep_indicadores_arquivos.csv`/`inep_indicadores_tamanhos.json`, notas da Sinopse 2025 (tabela 2.1).

## 1. Infraestrutura (Tabela de Escola)
### O que as variáveis significam
- Famílias: abastecimento (água, energia, esgoto), dependências físicas ("existentes e **utilizadas** na escola": biblioteca, laboratórios, quadra, cozinha, refeitório, banheiros…), acessibilidade, equipamentos (`QT_EQUIP_*`, `QT_DESKTOP_ALUNO`, `QT_COMP_PORTATIL_ALUNO`), internet (`IN_INTERNET`, `IN_BANDA_LARGA`, `IN_INTERNET_ALUNOS`), salas (`QT_SALAS_*`), profissionais não docentes (`QT_PROF_*`, 2019+).
- **São respostas autodeclaradas de existência/uso**, não medição de condição, quantidade útil, manutenção ou qualidade do serviço. "Tem biblioteca" ≠ "biblioteca funciona". "Tem internet" ≠ velocidade, estabilidade ou uso pedagógico (`IN_INTERNET_ALUNOS` mede uso pelos alunos, desde 2019). Regra de produto: **nunca** converter existência em nota de qualidade; os textos dizem "declara ter".
- Vazio ≠ 0 (2022: 4.259 escolas em atividade com `IN_INTERNET` vazio; 2021/2023–2025: 0). A publicação tem estados "declarou que não tem", "não informado" e "escola fora da edição".

### Histórico
| Medida | Disponibilidade | Observação |
|---|---|---|
| `IN_AGUA_REDE_PUBLICA`, `IN_ENERGIA_REDE_PUBLICA`, `IN_ESGOTO_REDE_PUBLICA`, `IN_COZINHA`, `IN_QUADRA_ESPORTES`, `IN_LABORATORIO_*`, `IN_INTERNET` | 2007–2025 | estáveis |
| `IN_BIBLIOTECA` | 2009–2025 | 2007–2008 só `IN_BIBLIOTECA_SALA_LEITURA` |
| `IN_BANDA_LARGA` | 2008–2025 | |
| `IN_REFEITORIO` | 2012–2025 | |
| `IN_AGUA_FILTRADA` → `IN_AGUA_POTAVEL` | 2007–2018 → 2019–2025 | **redefinição** |
| `IN_BANHEIRO_FORA/DENTRO_PREDIO` → `IN_BANHEIRO` | 2007–2018 → 2019–2025 | **redefinição** |
| `QT_SALAS_EXISTENTES` → `QT_SALAS_UTILIZADAS_DENTRO/FORA`, `…_CLIMATIZADAS`, `…_ACESSIVEIS` | 2007–2018 → 2019–2025 | **redefinição** |
| Acessibilidade detalhada (`IN_ACESSIBILIDADE_*`) | 2019–2025 | antes só `IN_BANHEIRO_PNE` (2007+) |
| `QT_DESKTOP_ALUNO`, `QT_COMP_PORTATIL_ALUNO`, `QT_EQUIP_LOUSA_DIGITAL` | 2019–2025 | |
| `QT_PROF_*` (administrativos, bibliotecário, psicólogo, nutricionista…) | 2019–2025 | |
| `IN_AGUA_CARRO_PIPA`, `IN_ACESSIBILIDADE_SINALIZACAO` | 2024–2025 | |
| Gestor (`Tabela_Gestor`) | 2019–2025 | G14 |

Regra: **séries contínuas só dentro de 2007–2018 ou de 2019–2025**, salvo tabela de equivalência aprovada. A P10.3 publica o "ponto de quebra 2019" como marca no indicador.

## 2. Docentes
### Unidade
- `QT_DOC_BAS` (Tabela de Docente 2025; CSV único até 2024) conta docentes **por escola**. Um docente que atua em duas escolas conta nas duas.
- A Sinopse (nota oficial) conta o docente **uma única vez em cada nível de agregação**: Brasil, UF, município e etapa são contagens distintas; **o total do município não é a soma das etapas nem das escolas**.
- Medido: Σ `QT_DOC_BAS` das escolas = **2.939.002 (2024)** e 2.934.558 (2023); total de docentes distintos no Brasil na Sinopse 2025 = **2.407.049**. A soma de escolas **superconta** (~22%).
→ **Docentes não passam no teste `Σ escolas = município`.** Escola: usar `QT_DOC_BAS`. Município/UF/Brasil: usar o total oficial (Sinopse 2.1) ou o indicador oficial; nunca somar escolas.

### Formação e adequação
- Contagens por escolaridade (`QT_DOC_BAS_ESCO_SUP_GRAD`, `_LICEN`, `_SLICEN`, `_POS_ESPEC/_MESTRA/_DOUTO`, `_NENHUM`): 2007–2025.
- **Indicadores oficiais já calculados** (INEP, por escola/município/UF/Brasil): 
| Indicador | Sigla | Anos | Níveis |
|---|---|---|---|
| Adequação da formação docente | AFD | 2013–2025 | escola, município, UF/Brasil |
| Esforço docente | IED | 2013–2025 | idem |
| Regularidade do corpo docente | IRD | 2013–2025 | idem |
| % docentes com curso superior | DSU | 2011–2025 | idem |
| Média de alunos por turma | ATU | 2007–2025 | idem |
| Horas-aula diárias | HAD | 2010–2025 | idem |
| Complexidade de gestão | ICG | 2013(escola)/2016(mun)–2025 | idem |
| Distorção idade-série | TDI | 2006/2007–2025 | idem |
| Taxas de rendimento | — | 2007–2025 | idem |
| Taxas de transição | — | 2007–2021 | município, UF (sem escola) |
| Nível socioeconômico (INSE) | INSE | 2015–2023 | escola, município, UF |
| Remuneração média dos docentes | — | 2014–2021 | município, UF |
- Os 494 arquivos (zip) estão listados e testados (HEAD 494/494 = 200) em `inep_indicadores_arquivos.csv`; soma 7,0 GB para **todas** as edições e níveis; só 2025 = 512 MB. Cada arquivo traz nota técnica; as definições mudaram em alguns anos (ex.: `nota_tecnica_atualizacao_indicador_formacao_docente.pdf`, `nota_retificacao_afd_2020.pdf`).
- Preferir o indicador oficial ao recálculo (a nota técnica define grupos 1–5 de AFD etc.).

### O que NÃO existe aberto
- Nenhuma tabela individual de professor (nome, CPF). A P10 **não** cria cadastro de professores.
- SIOPE `Remuneracao_Siope` traz nome do profissional e salário individual → **proibido ingerir** (ver G8/G14).

## 3. Contrato de saída (P10.3)
- Escola: `exec_edu_school_year` com whitelist de `IN_*`/`QT_*` de infraestrutura e `QT_DOC_BAS` (escola); indicadores INEP por escola como medidas separadas (nunca mistura com contagem própria).
- Município/UF: percentual de escolas **em atividade** da rede (denominador = escolas em atividade da mesma dependência/ano) para cada `IN_*`; docentes só do total oficial; indicadores INEP municipais lidos prontos.
- Estados do dado: `declarou que tem`, `declarou que não tem`, `não informado`, `fora da edição`, `célula suprimida` (G14).

## 4. Limitações
- 2007–2018 e 2019–2025 não são comparáveis em várias famílias (acima).
- Os arquivos de indicadores têm layouts por indicador; a leitura dos cabeçalhos de cada um (13 famílias) fica para a P10.3 (nesta fase só a lista/URL/tamanho foi provada; um exemplar de Ideb e do Censo foi lido por completo).
