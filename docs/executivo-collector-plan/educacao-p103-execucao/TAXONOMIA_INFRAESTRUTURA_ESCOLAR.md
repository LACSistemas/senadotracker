# Taxonomia de infraestrutura escolar · P10.3 (G1)

Fonte: Censo Escolar da Educação Básica (INEP), **Tabela de Escola**, 2007–2025. Contrato de significado: **todas as respostas são autodeclaradas** de existência ou uso de uma dependência, serviço ou equipamento; não medem funcionamento, conservação, suficiência nem qualidade. A lista abaixo é a **whitelist gravada** em `exec_edu_infra_year` (`packages/db/src/exec/educacao-infra-catalog.ts`, fonte única do extrator, do banco e da leitura): 100 variáveis, das quais 100 foram conferidas ano a ano contra o ZIP oficial (`MATRIZ_VARIAVEIS_INFRAESTRUTURA_2007_2025.csv`, 0 divergências).

## Regras que valem para todas as variáveis

- **Estados do dado:** `SIM` (true), `NAO` (false = "declarou que não tem"), `NAO_INFORMADO` (NULL dentro da vigência: célula em branco ou código oficial "9 - Não informado"), `FORA_DA_EDICAO` (a pergunta não existia na edição). Nunca se grava "não" no lugar de ausência.
- **O ZIP histórico do INEP traz as colunas de todas as edições** e preenche com `0` (ou deixa em branco) as que ainda não existiam. Por isso o valor de uma variável **fora da vigência** é descartado e vira NULL: em 2011, `IN_AGUA_POTAVEL` vem `0` em 242.147 linhas, e isso **não** significa que nenhuma escola tinha água potável.
- **Quebra metodológica de 2019:** o questionário foi reformulado. Perguntas redefinidas ficam em **colunas separadas**, nunca fundidas: água filtrada (até 2018) × água potável (2019+); banheiro dentro/fora do prédio (até 2018) × banheiro (2019+); salas existentes (até 2018) × salas utilizadas dentro/fora (2019+); gerador × gerador a combustível fóssil; outras fontes × fontes renováveis; dependências adaptadas (até 2018) × oito recursos de acessibilidade detalhados (2019+).
- **Códigos especiais do dicionário oficial:** `9 - Não informado` (IN_ACESSO_INTERNET_COMPUTADOR e IN_ACES_INTERNET_DISP_PESSOAIS) e `88888 - valor extremo` (quantidades de equipamentos, de 2019 em diante) viram NULL e são contados em `exec_edu_infra_cov.coded_unknown` e `.extreme`; nunca entram em soma.
- **Universo da linha:** escola **em atividade** (`TP_SITUACAO_FUNCIONAMENTO = 1`) com identidade no cadastro da P10.1. Escola paralisada ou extinta não gera linha (não é "escola sem biblioteca"). Em 2022, 4.259 escolas ativas deixaram **todas** as perguntas em branco: ficam como NULL e contadas em `unanswered`.
- **Denominador do percentual:** `sim ÷ (sim + não)` dentro do mesmo grupo e edição. **Banda larga** só se aplica a escolas com internet (`applicableWhen = internet`): o branco é "não se aplica", não "não" (em 2025, 9.778 escolas sem internet ficam fora do denominador de banda larga). Os usos da internet (alunos, aprendizagem, administração, comunidade) foram respondidos por **todas** as escolas ativas (as sem internet respondem "não"), então o denominador deles é o conjunto das escolas em atividade.
- **Internet:** `internet` é "acesso à internet" declarado; não mede velocidade, estabilidade nem uso pedagógico. "Internet para ensino e aprendizagem" é outra pergunta (2019+). Não se deve rotular nenhuma escola como "conectada para aprender" a partir do acesso.
- **Valores atípicos mantidos:** quantidades declaradas muito altas (por exemplo, uma escola com milhares de salas ou computadores) são dado oficial e permanecem, exceto o código 88888. Ficam sinalizadas no relatório de qualidade; somas territoriais de quantidades devem ser lidas com essa ressalva.

## A. Serviços essenciais (água, energia, esgoto, lixo, sanitários)

| Código | Campo oficial | Tipo | Vigência | Comparabilidade | Nome | Nota |
|---|---|---|---|---|---|---|
| `agua_rede` | `IN_AGUA_REDE_PUBLICA` | sim/não | 2007–2025 | comparável nas edições em que existe | Água da rede pública |  |
| `agua_poco` | `IN_AGUA_POCO_ARTESIANO` | sim/não | 2007–2025 | comparável nas edições em que existe | Água de poço artesiano |  |
| `agua_cacimba` | `IN_AGUA_CACIMBA` | sim/não | 2007–2025 | comparável nas edições em que existe | Água de cacimba, cisterna ou poço |  |
| `agua_rio` | `IN_AGUA_FONTE_RIO` | sim/não | 2007–2025 | comparável nas edições em que existe | Água de fonte, rio, igarapé ou córrego |  |
| `agua_inexistente` | `IN_AGUA_INEXISTENTE` | sim/não | 2007–2025 | comparável nas edições em que existe | Sem abastecimento de água |  |
| `agua_pipa` | `IN_AGUA_CARRO_PIPA` | sim/não | 2024–2025 | variável nova (sem série anterior) | Água por carro-pipa |  |
| `agua_filtrada` | `IN_AGUA_FILTRADA` | sim/não | 2007–2018 | encerrada (até 2018) | Água filtrada para os alunos | Redefinida em 2019 (IN_AGUA_POTAVEL): pergunta diferente, não comparar. |
| `agua_potavel` | `IN_AGUA_POTAVEL` | sim/não | 2019–2025 | variável nova (sem série anterior) | Fornece água potável para consumo | Substitui IN_AGUA_FILTRADA em 2019 (pergunta redefinida). |
| `energia_rede` | `IN_ENERGIA_REDE_PUBLICA` | sim/não | 2007–2025 | comparável nas edições em que existe | Energia da rede pública |  |
| `energia_inexistente` | `IN_ENERGIA_INEXISTENTE` | sim/não | 2007–2025 | comparável nas edições em que existe | Sem energia elétrica |  |
| `energia_gerador` | `IN_ENERGIA_GERADOR` | sim/não | 2007–2018 | encerrada (até 2018) | Gerador | Em 2019 vira gerador a combustível fóssil. |
| `energia_gerador_fossil` | `IN_ENERGIA_GERADOR_FOSSIL` | sim/não | 2019–2025 | variável nova (sem série anterior) | Gerador movido a combustível fóssil |  |
| `energia_alternativa` | `IN_ENERGIA_OUTROS` | sim/não | 2007–2018 | encerrada (até 2018) | Outras fontes de energia | Em 2019 vira fontes renováveis ou alternativas. |
| `energia_renovavel` | `IN_ENERGIA_RENOVAVEL` | sim/não | 2019–2025 | variável nova (sem série anterior) | Fontes de energia renováveis ou alternativas |  |
| `esgoto_rede` | `IN_ESGOTO_REDE_PUBLICA` | sim/não | 2007–2025 | comparável nas edições em que existe | Esgoto na rede pública |  |
| `esgoto_fossa` | `IN_ESGOTO_FOSSA` | sim/não | 2007–2025 | comparável nas edições em que existe | Esgoto em fossa |  |
| `esgoto_fossa_septica` | `IN_ESGOTO_FOSSA_SEPTICA` | sim/não | 2019–2025 | variável nova (sem série anterior) | Esgoto em fossa séptica |  |
| `esgoto_fossa_comum` | `IN_ESGOTO_FOSSA_COMUM` | sim/não | 2019–2025 | variável nova (sem série anterior) | Esgoto em fossa rudimentar ou comum |  |
| `esgoto_inexistente` | `IN_ESGOTO_INEXISTENTE` | sim/não | 2007–2025 | comparável nas edições em que existe | Sem esgotamento sanitário |  |
| `lixo_coleta` | `IN_LIXO_SERVICO_COLETA` | sim/não | 2007–2025 | comparável nas edições em que existe | Lixo recolhido por serviço de coleta |  |
| `lixo_queima` | `IN_LIXO_QUEIMA` | sim/não | 2007–2025 | comparável nas edições em que existe | Lixo queimado |  |
| `lixo_enterra` | `IN_LIXO_ENTERRA` | sim/não | 2007–2025 | comparável nas edições em que existe | Lixo enterrado |  |
| `banheiro` | `IN_BANHEIRO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Banheiro na escola | Substitui banheiro dentro/fora do prédio (até 2018). |
| `banheiro_dentro` | `IN_BANHEIRO_DENTRO_PREDIO` | sim/não | 2007–2018 | encerrada (até 2018) | Banheiro dentro do prédio |  |
| `banheiro_fora` | `IN_BANHEIRO_FORA_PREDIO` | sim/não | 2007–2018 | encerrada (até 2018) | Banheiro fora do prédio |  |
| `banheiro_ei` | `IN_BANHEIRO_EI` | sim/não | 2009–2025 | comparável nas edições em que existe | Banheiro adequado à educação infantil |  |
| `banheiro_func` | `IN_BANHEIRO_FUNCIONARIOS` | sim/não | 2019–2025 | variável nova (sem série anterior) | Banheiro exclusivo para funcionários |  |
| `banheiro_chuveiro` | `IN_BANHEIRO_CHUVEIRO` | sim/não | 2012–2025 | comparável nas edições em que existe | Banheiro ou vestiário com chuveiro |  |

## B. Conectividade e tecnologia

| Código | Campo oficial | Tipo | Vigência | Comparabilidade | Nome | Nota |
|---|---|---|---|---|---|---|
| `internet` | `IN_INTERNET` | sim/não | 2007–2025 | comparável com ressalvas | Acesso à internet | Declara acesso; não mede velocidade, estabilidade nem uso pedagógico. Em 2022, 4.259 escolas ativas deixaram em branco. |
| `banda_larga` | `IN_BANDA_LARGA` | sim/não | 2008–2025 | comparável com ressalvas | Internet banda larga | Definição de banda larga do questionário; não é velocidade medida. |
| `internet_alunos` | `IN_INTERNET_ALUNOS` | sim/não | 2019–2025 | variável nova (sem série anterior) | Internet para uso dos alunos |  |
| `internet_admin` | `IN_INTERNET_ADMINISTRATIVO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Internet para uso administrativo |  |
| `internet_aprendizagem` | `IN_INTERNET_APRENDIZAGEM` | sim/não | 2019–2025 | variável nova (sem série anterior) | Internet para ensino e aprendizagem | Uso declarado nos processos de ensino e aprendizagem; não equivale a "escola conectada para aprender". |
| `internet_comunidade` | `IN_INTERNET_COMUNIDADE` | sim/não | 2019–2025 | variável nova (sem série anterior) | Internet para uso da comunidade |  |
| `internet_comp_aluno` | `IN_ACESSO_INTERNET_COMPUTADOR` | sim/não | 2019–2025 | variável nova (sem série anterior) | Alunos acessam a internet por computadores da escola |  |
| `internet_disp_pessoal` | `IN_ACES_INTERNET_DISP_PESSOAIS` | sim/não | 2019–2025 | variável nova (sem série anterior) | Alunos acessam a internet por dispositivos pessoais |  |
| `computador` | `IN_COMPUTADOR` | sim/não | 2007–2025 | comparável nas edições em que existe | Computador para uso técnico e administrativo |  |
| `lab_informatica` | `IN_LABORATORIO_INFORMATICA` | sim/não | 2007–2025 | comparável nas edições em que existe | Laboratório de informática |  |
| `desktop_aluno` | `IN_DESKTOP_ALUNO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Computador de mesa em uso pelos alunos |  |
| `portatil_aluno` | `IN_COMP_PORTATIL_ALUNO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Computador portátil em uso pelos alunos |  |
| `tablet_aluno` | `IN_TABLET_ALUNO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Tablet em uso pelos alunos |  |
| `equip_tv` | `IN_EQUIP_TV` | sim/não | 2007–2025 | comparável nas edições em que existe | Televisão |  |
| `equip_dvd` | `IN_EQUIP_DVD` | sim/não | 2007–2025 | comparável nas edições em que existe | DVD ou Blu-ray |  |
| `equip_som` | `IN_EQUIP_SOM` | sim/não | 2012–2025 | comparável nas edições em que existe | Aparelho de som |  |
| `equip_multimidia` | `IN_EQUIP_MULTIMIDIA` | sim/não | 2012–2025 | comparável nas edições em que existe | Projetor multimídia |  |
| `equip_lousa_digital` | `IN_EQUIP_LOUSA_DIGITAL` | sim/não | 2019–2025 | variável nova (sem série anterior) | Lousa digital |  |
| `equip_impressora` | `IN_EQUIP_IMPRESSORA` | sim/não | 2007–2025 | comparável nas edições em que existe | Impressora |  |
| `equip_copiadora` | `IN_EQUIP_COPIADORA` | sim/não | 2007–2025 | comparável nas edições em que existe | Copiadora |  |
| `equip_scanner` | `IN_EQUIP_SCANNER` | sim/não | 2019–2025 | variável nova (sem série anterior) | Scanner |  |
| `equip_parabolica` | `IN_EQUIP_PARABOLICA` | sim/não | 2007–2025 | comparável nas edições em que existe | Antena parabólica |  |
| `qt_comp_aluno` | `QT_COMP_ALUNO` | quantidade | 2007–2018 | encerrada (até 2018) | Computadores em uso pelos alunos | Série interrompida em 2018; de 2019 vem separada por tipo (desktop, portátil, tablet). |
| `qt_computador` | `QT_COMPUTADOR` | quantidade | 2007–2018 | encerrada (até 2018) | Computadores na escola (total) |  |
| `qt_desktop_aluno` | `QT_DESKTOP_ALUNO` | quantidade | 2019–2025 | variável nova (sem série anterior) | Computadores de mesa em uso pelos alunos |  |
| `qt_portatil_aluno` | `QT_COMP_PORTATIL_ALUNO` | quantidade | 2019–2025 | variável nova (sem série anterior) | Computadores portáteis em uso pelos alunos |  |
| `qt_tablet_aluno` | `QT_TABLET_ALUNO` | quantidade | 2019–2025 | variável nova (sem série anterior) | Tablets em uso pelos alunos |  |
| `qt_tv` | `QT_EQUIP_TV` | quantidade | 2013–2025 | comparável nas edições em que existe | Televisores |  |
| `qt_multimidia` | `QT_EQUIP_MULTIMIDIA` | quantidade | 2013–2025 | comparável nas edições em que existe | Projetores multimídia |  |
| `qt_lousa_digital` | `QT_EQUIP_LOUSA_DIGITAL` | quantidade | 2019–2025 | variável nova (sem série anterior) | Lousas digitais |  |

## C. Ambientes pedagógicos

| Código | Campo oficial | Tipo | Vigência | Comparabilidade | Nome | Nota |
|---|---|---|---|---|---|---|
| `biblioteca` | `IN_BIBLIOTECA` | sim/não | 2009–2025 | comparável nas edições em que existe | Biblioteca |  |
| `sala_leitura` | `IN_SALA_LEITURA` | sim/não | 2009–2025 | comparável nas edições em que existe | Sala de leitura |  |
| `biblioteca_ou_leitura` | `IN_BIBLIOTECA_SALA_LEITURA` | sim/não | 2007–2025 | comparável nas edições em que existe | Biblioteca e/ou sala de leitura | Única variável de leitura presente nas 19 edições; 2007–2008 não separam biblioteca de sala de leitura. |
| `lab_ciencias` | `IN_LABORATORIO_CIENCIAS` | sim/não | 2007–2025 | comparável nas edições em que existe | Laboratório de ciências |  |
| `lab_educ_prof` | `IN_LABORATORIO_EDUC_PROF` | sim/não | 2022–2025 | variável nova (sem série anterior) | Laboratório de educação profissional |  |
| `quadra` | `IN_QUADRA_ESPORTES` | sim/não | 2007–2025 | comparável nas edições em que existe | Quadra de esportes |  |
| `quadra_coberta` | `IN_QUADRA_ESPORTES_COBERTA` | sim/não | 2011–2025 | comparável nas edições em que existe | Quadra de esportes coberta |  |
| `quadra_descoberta` | `IN_QUADRA_ESPORTES_DESCOBERTA` | sim/não | 2011–2025 | comparável nas edições em que existe | Quadra de esportes descoberta |  |
| `parque_infantil` | `IN_PARQUE_INFANTIL` | sim/não | 2007–2025 | comparável nas edições em que existe | Parque infantil |  |
| `patio_coberto` | `IN_PATIO_COBERTO` | sim/não | 2012–2025 | comparável nas edições em que existe | Pátio coberto |  |
| `patio_descoberto` | `IN_PATIO_DESCOBERTO` | sim/não | 2012–2025 | comparável nas edições em que existe | Pátio descoberto |  |
| `piscina` | `IN_PISCINA` | sim/não | 2019–2025 | variável nova (sem série anterior) | Piscina |  |
| `auditorio` | `IN_AUDITORIO` | sim/não | 2012–2025 | comparável nas edições em que existe | Auditório |  |
| `sala_artes` | `IN_SALA_ATELIE_ARTES` | sim/não | 2019–2025 | variável nova (sem série anterior) | Sala ou ateliê de artes |  |
| `sala_musica` | `IN_SALA_MUSICA_CORAL` | sim/não | 2019–2025 | variável nova (sem série anterior) | Sala de música ou coral |  |
| `sala_danca` | `IN_SALA_ESTUDIO_DANCA` | sim/não | 2019–2025 | variável nova (sem série anterior) | Sala ou estúdio de dança |  |
| `sala_multiuso` | `IN_SALA_MULTIUSO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Sala multiuso |  |
| `sala_professor` | `IN_SALA_PROFESSOR` | sim/não | 2007–2025 | comparável nas edições em que existe | Sala de professores |  |
| `sala_diretoria` | `IN_SALA_DIRETORIA` | sim/não | 2007–2025 | comparável nas edições em que existe | Sala de diretoria |  |
| `sala_aee` | `IN_SALA_ATENDIMENTO_ESPECIAL` | sim/não | 2007–2025 | comparável nas edições em que existe | Sala de recursos multifuncionais (AEE) |  |

## D. Alimentação e apoio

| Código | Campo oficial | Tipo | Vigência | Comparabilidade | Nome | Nota |
|---|---|---|---|---|---|---|
| `cozinha` | `IN_COZINHA` | sim/não | 2007–2025 | comparável nas edições em que existe | Cozinha |  |
| `refeitorio` | `IN_REFEITORIO` | sim/não | 2012–2025 | comparável nas edições em que existe | Refeitório |  |
| `despensa` | `IN_DESPENSA` | sim/não | 2012–2025 | comparável nas edições em que existe | Despensa |  |

## E. Acessibilidade

| Código | Campo oficial | Tipo | Vigência | Comparabilidade | Nome | Nota |
|---|---|---|---|---|---|---|
| `banheiro_pne` | `IN_BANHEIRO_PNE` | sim/não | 2007–2025 | comparável com ressalvas | Banheiro acessível a pessoas com deficiência ou mobilidade reduzida | Redação do item mudou em 2019 (dependência existente e utilizada). |
| `dependencias_pne` | `IN_DEPENDENCIAS_PNE` | sim/não | 2007–2018 | encerrada (até 2018) | Dependências e vias adequadas a pessoas com deficiência | Substituída em 2019 pelos recursos de acessibilidade detalhados. |
| `acess_corrimao` | `IN_ACESSIBILIDADE_CORRIMAO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Corrimão e guarda-corpos |  |
| `acess_elevador` | `IN_ACESSIBILIDADE_ELEVADOR` | sim/não | 2019–2025 | variável nova (sem série anterior) | Elevador |  |
| `acess_piso_tatil` | `IN_ACESSIBILIDADE_PISOS_TATEIS` | sim/não | 2019–2025 | variável nova (sem série anterior) | Pisos táteis |  |
| `acess_vao_livre` | `IN_ACESSIBILIDADE_VAO_LIVRE` | sim/não | 2019–2025 | variável nova (sem série anterior) | Portas com vão livre de 80 cm |  |
| `acess_rampa` | `IN_ACESSIBILIDADE_RAMPAS` | sim/não | 2019–2025 | variável nova (sem série anterior) | Rampas |  |
| `acess_sinal_sonoro` | `IN_ACESSIBILIDADE_SINAL_SONORO` | sim/não | 2019–2025 | variável nova (sem série anterior) | Sinalização sonora |  |
| `acess_sinal_tatil` | `IN_ACESSIBILIDADE_SINAL_TATIL` | sim/não | 2019–2025 | variável nova (sem série anterior) | Sinalização tátil |  |
| `acess_sinal_visual` | `IN_ACESSIBILIDADE_SINAL_VISUAL` | sim/não | 2019–2025 | variável nova (sem série anterior) | Sinalização visual |  |
| `acess_sinalizacao` | `IN_ACESSIBILIDADE_SINALIZACAO` | sim/não | 2024–2025 | variável nova (sem série anterior) | Sinalização de acessibilidade (geral) |  |
| `acess_inexistente` | `IN_ACESSIBILIDADE_INEXISTENTE` | sim/não | 2019–2025 | variável nova (sem série anterior) | Nenhum recurso de acessibilidade |  |

## F. Instalações e capacidade

| Código | Campo oficial | Tipo | Vigência | Comparabilidade | Nome | Nota |
|---|---|---|---|---|---|---|
| `predio_compartilhado` | `IN_PREDIO_COMPARTILHADO` | sim/não | 2007–2025 | comparável nas edições em que existe | Prédio compartilhado com outra escola |  |
| `salas_existentes` | `QT_SALAS_EXISTENTES` | quantidade | 2007–2018 | encerrada (até 2018) | Salas de aula existentes | Até 2018: salas existentes. De 2019 só as utilizadas: série descontínua. |
| `salas_utilizadas` | `QT_SALAS_UTILIZADAS` | quantidade | 2007–2025 | comparável com ressalvas | Salas de aula utilizadas (dentro e fora do prédio) | Presente nas 19 edições; o conceito de "utilizada" passa a ser explícito em 2019. |
| `salas_dentro` | `QT_SALAS_UTILIZADAS_DENTRO` | quantidade | 2019–2025 | variável nova (sem série anterior) | Salas de aula utilizadas dentro do prédio |  |
| `salas_fora` | `QT_SALAS_UTILIZADAS_FORA` | quantidade | 2019–2025 | variável nova (sem série anterior) | Salas de aula utilizadas fora do prédio |  |
| `salas_climatizadas` | `QT_SALAS_UTILIZA_CLIMATIZADAS` | quantidade | 2019–2025 | variável nova (sem série anterior) | Salas de aula climatizadas |  |
| `salas_acessiveis` | `QT_SALAS_UTILIZADAS_ACESSIVEIS` | quantidade | 2019–2025 | variável nova (sem série anterior) | Salas de aula acessíveis |  |

## Famílias definidas na especificação e o que o Censo permite

| Família da especificação | Cobertura real |
|---|---|
| A. Serviços essenciais | água (rede, poço, cacimba, rio, carro-pipa, potável/filtrada), energia (rede, gerador, renovável), esgoto (rede, fossas), coleta de lixo, banheiros |
| B. Conectividade e tecnologia | internet, banda larga, usos da internet (2019+), computadores, equipamentos, lab. de informática |
| C. Ambientes pedagógicos | biblioteca/sala de leitura, laboratórios, quadra, pátio, parque infantil, artes/música/dança (2019+) |
| D. Alimentação e apoio | cozinha, refeitório, despensa |
| E. Acessibilidade | banheiro acessível (2007+), dependências adaptadas (até 2018), oito recursos detalhados (2019+) |
| F. Instalações e capacidade | salas utilizadas/existentes/climatizadas/acessíveis, prédio compartilhado |

Não criado por não existir no Censo como variável de escola: velocidade de internet, estado de conservação, número de banheiros acessíveis, equipamentos por aluno oficial. Os `QT_PROF_*` (profissionais não docentes) e `Tabela_Gestor`/`Tabela_Docente` ficaram **fora** (dados de pessoas; ver `PRIVACIDADE_PUBLICABILIDADE_P103.md`).
