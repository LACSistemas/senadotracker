# P1 — Investigação expandida: segurança pública, bem-estar social e qualidade de vida

**Data:** 2026-10-10. **Modo:** somente investigação. Nenhum código de aplicação, schema, migration, collector ou frontend foi alterado; os arquivos P0 (`investigacao_executivo_nacional.md`, `investigacao_executivo_fontes.json`) ficaram intactos. Os testes foram pequenos e não destrutivos (HTTP, `Range`, listagens, amostras e leitura de alguns arquivos), com scripts descartáveis fora do repositório.
**Companheiro:** `investigacao_executivo_p1_fontes.json` (25 fontes, 25 testes, 69 indicadores, 17 relacionamentos, 18 oportunidades, 40 perguntas, famílias e lacunas).

**Convenções:** níveis de evidência `VERIFIED_API`, `VERIFIED_DATASET`, `DOCUMENTED_ONLY`, `INFERRED`, `BLOCKED`, `NOT_EVALUATED`, `UNAVAILABLE` (como na P0). Territórios-amostra da P0: Brasil, ES, Vitória/ES (3205309), Alto Rio Novo/ES (3200359), São Paulo/SP (3550308), Belém/PA (1501402). **Quatro municípios não sustentam estimativas nacionais**: contagens nacionais vêm da própria fonte (`numFound`, `localidades/N6`, linhas lidas). O IDs dos testes (`T01`…`T25`) apontam para a seção 19 e para o JSON.

---

## 1. Resumo executivo da P1

A P0 respondeu "quanto o governo gasta, contrata e entrega". A P1 responde **"como é viver em cada município"**. Quatro descobertas mudam o desenho do Cívica:

1. **O MDS publica um índice Solr aberto (MI Social) com 1,6 milhão de linhas municipais mensais desde 2003 e 280 campos úteis** (Bolsa Família, BPC, CadÚnico por faixa etária e sexo, CRAS/CREAS/Centro POP, repasses do SUAS, cisternas, fomento rural). É a maior fonte nova por relação esforço/valor: **um endpoint, um pipeline, 5.571 municípios por mês** (T01).
2. **Quase todo o "bem-estar" municipal passa por três APIs genéricas**: IBGE Agregados/SIDRA (4.448 tabelas com nível município, entre elas renda do Censo 2022, PIB, empresas, nascimentos, deficiência, quilombolas, MUNIC 2023), Ipeadata OData (539 séries do Atlas Brasil e homicídios por município 1980–2022) e BCB Olinda (Pix por município desde 11/2020). Um coletor "tabular dirigido por registro" cobre dezenas de indicadores (T02–T04, T06).
3. **A P0 estava imprecisa sobre segurança**: o Sinesp VDE só tem granularidade municipal para **11 dos 31 eventos**; estupro, furto/roubo de veículo e de carga, tráfico, desaparecidos e intervenção policial são **somente por UF**. Em compensação o Atlas da Violência (bloqueado na P0) está acessível via Ipeadata, com homicídios, homicídios de mulheres e de jovens **por município desde 1980** (T02, T07).
4. **Duas "perguntas óbvias" não têm resposta municipal**: *poder de compra* (a PNAD Contínua só tem município para as 27 capitais e o IPCA para 6 municípios) e *população em situação de rua* (não há campo no MI Social, só a oferta de Centro POP em 237 municípios). Isso é um achado, não uma falha de busca (T04, T24).

Também comprovamos o acesso programático (ou a rota de extração) a: SISDEPEN (1.532 unidades prisionais, 20 ciclos), PRF (acidentes georreferenciados), SENATRAN (frota por município), CAGED/RAIS (FTP), SNIS 2022 (planilhas), Anatel (banda larga por município desde 2007), INPE (focos de calor), S2iD (desastres desde 1991), TSE (comparecimento) e a granularidade **abaixo do município** (setor, bairro, grade de 1 km) do Censo 2022.

Resposta curta às perguntas finais está na seção 25.

## 2. O que a P1 acrescenta à P0

| Fonte/tema da P0 | Status P0 | O que a P1 acrescentou | Status P1 |
|---|---|---|---|
| `atlas_violencia_ipea` | BLOCKED (API 404) | Homicídios totais, femininos e de jovens por município 1980–2022 e 539 séries do Atlas Brasil via **Ipeadata OData** | VERIFIED_API |
| `sinesp_vde` | VERIFIED_DATASET (2025) | Arquivos de **2015 a 2026**; mapa por evento: município (11) × UF (20) × sempre zero (2) | VERIFIED_DATASET |
| `snis_sinisa` | DOCUMENTED_ONLY | Pacote SNIS 2022 lido (1.873 linhas × 94 colunas, `.xls`), rota de extração documentada; SINISA exige login | VERIFIED_DATASET / BLOCKED |
| `ibge_sidra` | só população | Catálogo N6 (4.448 tabelas), renda Censo 2022, PIB, CEMPRE, nascimentos, MUNIC; evidências negativas (PNAD, IPCA) | VERIFIED_API |
| `demas_dados_abertos_saude` | VERIFIED_API | SISVAN e vacinação existem em nível **individual**; SINASC continua vazio; S3 do OpenDataSUS 403 | VERIFIED_API |
| `tse_dados_abertos` | VERIFIED_DATASET | Comparecimento e abstenção por município/zona | VERIFIED_DATASET |
| `portal_transparencia_downloads` | bolsa-familia-pagamentos 403 | Substituído por MI Social (valores e famílias por município e mês) | inalterado (P0) |

Fontes **inéditas** (não existiam na P0): MI Social (MDS), Ipeadata OData, BCB Pix, IBGE FTP Censo 2022 (setor/bairro/grade), IBGE MUNIC, PRF, SISDEPEN, SENATRAN, PDET (CAGED/RAIS), Anatel, INPE (queimadas e TerraBrasilis), S2iD, ANEEL, FJP e Atlas Brasil (site). Famílias P0 F0–F8 preservadas; a P1 propõe F9–F13 (seção 21).

## 3. Descobertas inesperadas e oportunidades fora do escopo inicial

Dezoito oportunidades sustentadas por fonte verificada (todas no JSON, `product_opportunities`). Colunas: pergunta · por que importa · fonte e granularidade · período · conexão com o Cívica · atualização automática · cuidado.

| # | Pergunta | Por que importa | Fonte / granularidade / período | Conexão | Auto | Cuidado |
|---|---|---|---|---|---|---|
| O01 | Quais municípios mais dependem de transferências de renda? | resiliência econômica das famílias | MI Social + SIDRA pop · município mensal · 2003–2026-09 | IBGE (EXACT), transferências P0 (territorial) | sim | famílias beneficiárias ≠ dependência; denominador 2022 |
| O02 | Qual a intensidade de pagamentos digitais (inclusão financeira)? | acesso a serviços bancários e atividade local | BCB Pix · município mensal · 2020-11.. | IBGE 7 (EXACT) | sim | local do pagador, não do domicílio; não é renda |
| O03 | Que banda larga fixa (velocidade/tecnologia) existe em cada município? | inclusão digital efetiva | Anatel · município mensal · 2007.. | IBGE (EXACT) | sim* | acessos ≠ domicílios; arquivo de GB |
| O04 | Onde houve desastres e quantos foram atingidos? | capacidade de adaptação a desastres | S2iD Atlas Digital · município/evento · 1991–2025 | IBGE (EXACT), Obrasgov (territorial) | sim | só registrados; não é exposição |
| O05 | Quais municípios têm mais focos de fogo? | exposição ambiental | INPE · ponto/município · 2023.. | IBGE (HIGH_CONFIDENCE) | sim | foco ≠ área queimada |
| O06 | Que capacidade institucional cada prefeitura declara? | segurança, proteção e política urbana | MUNIC 2023 · município · 2023 | IBGE (EXACT) | bienal | existência ≠ qualidade |
| O07 | Quão dependente do setor público é a economia local? | vulnerabilidade a ciclos fiscais | SIDRA 5938 (VAB adm. pública) · município · 2002–2021 | IBGE (EXACT) | anual | série termina em 2021 |
| O08 | Qual a estrutura empresarial e salarial? | dependência de poucos empregadores | SIDRA CEMPRE · município · 2006–2021 | IBGE (EXACT) | anual | termina em 2021 |
| O09 | Quantas pessoas quilombolas, indígenas, com deficiência ou autismo? | desigualdade e inclusão | Censo 2022 SIDRA · município · 2022 | IBGE (EXACT) | não (pontual) | `-` = zero absoluto |
| O10 | Como é o entorno urbano (calçada, rampa, arborização)? | qualidade da infraestrutura pública | Censo 2022 entorno · município/setor · 2022 | IBGE (EXACT) | não | só setores selecionados |
| O11 | Quem comparece e quem se abstém? | participação | TSE · município/zona · 2024 | tabela TSE→IBGE | por eleição | não mede participação social |
| O12 | Quantas unidades prisionais, com que capacidade? | segurança e direitos | SISDEPEN · estabelecimento · 2016–2025 | UF+município por nome (PROBABLE) | semestral | sem chave estável |
| O13 | Onde morrem pessoas em rodovias federais? | segurança viária | PRF · ponto (lat/lon, BR, km) · 2025 lido | município por nome (PROBABLE) | sim | só rodovias federais |
| O14 | Quão motorizado é o município? | mobilidade | SENATRAN · município mensal · 2024–2026 | nome (PROBABLE) | sim | frota registrada ≠ circulação |
| O15 | Onde há segurança hídrica rural apoiada (cisternas, fomento)? | isolamento rural | MI Social · município mensal | IBGE (EXACT) | sim | cobertura restrita a municípios do programa |
| O16 | Quanto o SUAS repassa e quanto sobra em saldo? | capacidade de atendimento | MI Social (`suas_repasse_*`, `suas_saldo_*`, IGD) | transferências P0 (territorial) | sim | campos sem documentação |
| O17 | Quantas pessoas vivem longe de um hospital (linha reta)? | acesso a serviços essenciais | grade 1 km (IBGE) + CNES lat/lon (P0) · 1 km · 2022 | derivável | parcial | linha reta ≠ tempo |
| O18 | Qual a continuidade de energia onde moram as pessoas? | vulnerabilidade energética | ANEEL DEC/FEC · conjunto elétrico · 2000.. | exige conjunto→município | sim | tabela de correspondência não localizada |

\* a atualização de arquivos gigantes exige estratégia de `Range` e reprocessamento do período novo.

## 4. Investigação expandida de segurança pública

### 4.1 Criminalidade e vitimização — prova por categoria

| Categoria pedida | Existe? | Fonte | Granularidade | Unidade |
|---|---|---|---|---|
| Homicídio doloso | sim | VDE (2015–2026-08) e Atlas/Ipeadata (1980–2022) | município | VDE: vítimas; Atlas: óbitos |
| Tentativa de homicídio | sim | VDE | município (3.217 municípios com ocorrência em jan–ago/2026) | vítimas |
| Latrocínio (roubo seguido de morte) | sim | VDE | município (253) | vítimas |
| Lesão corporal seguida de morte | sim | VDE | município (233) | vítimas |
| Feminicídio e tentativa | sim | VDE; Atlas (`HOMICF` = homicídios de mulheres) | município (VDE: 636 e 1.231) | vítimas / óbitos |
| Homicídios de jovens | sim | Atlas (`HOMICJ`) | município | óbitos |
| Mortes no trânsito | sim | VDE (estadual 3.224 mun.; PF/PRF 1.253), PRF datatran | município / ponto | vítimas / ocorrências |
| Suicídio | sim | VDE | município (2.798) | vítimas |
| Mandados de prisão cumpridos | sim | VDE | município (4.471) | mandados |
| Estupro e estupro de vulnerável | sim | VDE | **UF** (27 linhas por mês) | ocorrências |
| Furto/roubo de veículo; roubo de carga; roubo a instituição financeira | sim | VDE | **UF** | ocorrências |
| Tráfico de drogas; arma de fogo apreendida | sim | VDE | **UF** | ocorrências/armas |
| Pessoas desaparecidas e localizadas | sim | VDE | **UF** | pessoas |
| Morte por intervenção de agente do Estado | sim | VDE | **UF** (estadual, PF, PRF) | vítimas |
| Roubos e furtos em geral (patrimoniais) | **não** em fonte nacional verificada | — | — | — |
| Violência doméstica, sexual, racial, contra criança ou idoso | **não** como ocorrência por município | MUNIC mostra oferta de serviços (casas-abrigo, delegacias especializadas) | município | existência do serviço |
| Crimes cibernéticos; crimes ambientais; crimes contra patrimônio público | **não encontrados** nas bases nacionais testadas | — | — | — |
| Apreensão de cocaína e maconha (VDE) | coluna existe, **100% zero** | VDE | UF | não reportado, não inexistente |

**Ocorrências, vítimas, óbitos e procedimentos não são a mesma coisa.** O VDE usa `total` (ocorrências) e `total_vitima` (vítimas, com sexo e faixa etária); o Atlas conta **óbitos** (base de mortalidade); o PRF registra **ocorrências com mortos e feridos**. Não somar nem comparar sem harmonizar. Evidência: T02, T07, T08.

**Correção à P0:** os eventos municipais do VDE têm ~5.600 linhas por mês (zero preenchido); os demais têm 27 por mês. Por isso um "ranking de municípios por estupro" **não pode** ser construído com o VDE.

### 4.2 Estrutura da segurança

| Item | Resultado |
|---|---|
| Guardas municipais (existência e estrutura) | **MUNIC 2023**, 5.570 municípios (T06). Alto Rio Novo = não; Vitória, SP e Belém = sim |
| Delegacias especializadas, casas-abrigo, conselho tutelar | **MUNIC 2023**, mesmo universo; os quatro recortes têm delegacia especializada e conselho tutelar |
| Unidades prisionais | **SISDEPEN** (1.532 estabelecimentos no 19º ciclo) |
| Delegacias, batalhões, postos, efetivo, frota policial, orçamento por unidade, conselhos comunitários | **não encontrados** em cadastro nacional aberto (busca em catálogos MJSP/IBGE/Sinesp). `UNAVAILABLE` até prova em contrário; investigar os 27 estados só como complemento |

### 4.3 Funcionamento das instituições

Só existe **atividade** (mandados cumpridos, VDE municipal). **Eficácia** (crimes esclarecidos, inquéritos instaurados/concluídos, tempo de resposta, denúncias, medidas protetivas) não apareceu em fonte nacional aberta. O Disque 100 (MDHC) devolveu 404 na URL de dados abertos testada; o CNJ não foi testado nesta rodada (o repositório já tem a investigação do Judiciário em `investigacao_judiciario*.md`, que cobre o DataJud). Não confundir volume de atividade com eficácia.

### 4.4 Sistema penitenciário (SENAPPEN/SISDEPEN) — T09

20 arquivos CSV (2016-2S a 2025-2S). O 19º ciclo (2025-2S) tem **1.532 estabelecimentos × 1.737 colunas** (9,3 MB): nome, tipo, situação, endereço, bairro, CEP, âmbito, UF, município (nome), capacidade por regime (provisórios, fechado, semiaberto, aberto, RDD, medidas de segurança) e demais blocos. Permite análise por unidade, município e UF. **Limites:** sem identificador estável nem código IBGE (ligação por nome/CEP = PROBABLE); as colunas mudam entre ciclos; dados declarados pelas unidades; os relatórios em PDF não substituem a base.

### 4.5 Segurança viária — T08, T10

| Fonte | O que traz | Granularidade | Acesso |
|---|---|---|---|
| PRF datatran | 30 colunas: data, hora, UF, BR, km, município (nome), causa, tipo, classificação, fase do dia, clima, pista, traçado, pessoas, mortos, feridos, veículos, **lat/lon**, regional/delegacia/UOP | ponto (rodovias federais) | ZIP no Google Drive (82 links na página); `uc?export=download&id=` funcionou |
| Sinesp VDE "mortes no trânsito" | contagem por município | município (por nome) | XLSX |
| DEMAS/SIM | óbitos individuais (causa básica) | registro | API sem filtro municipal |
| SENATRAN | frota por UF/município (nome) × tipo × espécie × eixos: **275.557 linhas** em abril/2026 | município | XLSX mensal (HEAD 403; GET com `Range` 206) |
| DNIT, infrações, investimentos em segurança viária | `NOT_EVALUATED` | — | — |

Cuidado: PRF (só rodovias federais), VDE (registro estadual) e SIM (certidão de óbito) **definem eventos diferentes**.

## 5. Trabalho, renda e poder de compra

**Pergunta crítica: dá para medir poder de compra por município? Resposta verificada: não, só aproximações parciais.**

| Dimensão | Existe por município? | Evidência |
|---|---|---|
| Renda nominal (Censo 2022) | **sim**: rendimento médio, mediano e massa de rendimento do trabalho, 5.570 municípios (SIDRA 10289) | T04 |
| Renda real (corrigida pela inflação) | **parcial**: série Atlas (`RDPC`, R$ de 2010) em 1991/2000/2010; Censo 2022 é nominal. Deflator **nacional** é possível; **local** não | T02 |
| Custo de vida / inflação local | **não**: IPCA tem município em **6** localidades; INPC em 2; sem índice para 5.570 | T04 |
| PNAD Contínua (desemprego, informalidade, Gini anual) | **não**: nível N6 = **27 capitais** (e valores `...` até para capital em variáveis testadas) | T04 |
| Capacidade de consumo | **proxy**: Pix (valor e transações PF/PJ por município) e CAGED (salário de admissão) | T03, T11 |
| Desigualdade dentro do município | Gini 1991/2000/2010 (Atlas); **bairro e setor** em 2022 (renda do responsável) | T02, T05 |
| Emprego formal, setores, salários | CAGED mensal (2020–2026-08), RAIS (1985–2024), CEMPRE (2006–2021) | T11, T04 |
| Dependência do setor público | participação da administração pública no VAB (2002–2021) | T04 |

Valores reais (nominais, Censo 2022): rendimento médio mensal do trabalho **Vitória R$ 5.242, Alto Rio Novo R$ 1.902, São Paulo R$ 4.548, Belém R$ 2.987**; medianas R$ 2.500 / 1.212 / 2.100 / 1.400. PIB 2023 (mil R$): 28.257.606 / 152.485 / 1.066.825.105 / 40.536.062. Participação da administração pública no VAB (2021): 7,9% / **42,2%** / 7,3% / 21,3% — Alto Rio Novo é muito dependente do setor público.

**Conclusão metodológica:** o Cívica pode mostrar renda nominal municipal e sua distribuição, emprego formal e Pix; **não** pode afirmar "poder de compra" municipal sem declarar que falta índice de preços local. Se for mostrado, usar apenas comparação nacionalmente deflacionada e nomeá-la "renda real a preços nacionais".

## 6. Pobreza e proteção social

**MI Social (MDS) é a base** (T01). Estrutura: Solr em `aplicacoes.mds.gov.br/sagi/servicos/misocial`, documento = município × mês (`tipo_s=mes_mu`), chave `codigo_ibge` (6 dígitos) e `anomes_s`.

| Bloco de campos (amostra) | Exemplos | Observação |
|---|---|---|
| CadÚnico por pessoa | 57 campos `qtd_pes_cad_*` (faixa etária × sexo × beneficiário/não do PBF) | cobertura por faixa etária (0–4, 16–17, …) |
| CadÚnico por família | `cadun_qtd_familias_*`, `cadunico_tot_pes_ext_pob_pbf_i`, `cadun_qtde_fam_sit_extrema_pobreza_s` | pobreza e extrema pobreza |
| Bolsa Família | `qtd_familias_beneficiarias_bolsa_familia`, `valor_repassado_bolsa_familia`, `pbf_qtd_benef_primeira_infancia_bpi_i`, bloqueios/cancelamentos/concessões | série com valor até 2026-09 |
| BPC | `bpc_residencia_total_i`, idosos, PCD, valor | campos `bpc_*` |
| Equipamentos SUAS (CadSUAS) | `cadsuas_qtd_cras_i`, `cadsuas_qtd_creas_i`, `cadsuas_qtd_centro_pop_i`, `cadsuas_qtd_unidade_acolhimento_i`, profissionais | extração do CadSUAS por mês |
| Financiamento SUAS e IGD | `suas_repasse_*`, `suas_saldo_*`, `igd_pab_*`, `igd_pbf_*`, `igdm_f` | transferências de cofinanciamento |
| Segurança hídrica/rural | cisternas entregues, fomento rural | só municípios do programa |

Equipamentos em 2026-09 (T01): Vitória **12 CRAS, 3 CREAS, 2 Centros POP**; Alto Rio Novo 1 CRAS, 1 CREAS, sem Centro POP; São Paulo 54/32/6; Belém 12/5/2. Cobertura nacional dos campos (municípios com valor): CRAS 5.559, CREAS 2.758, unidade de acolhimento 2.778, Centro POP 237, conselho municipal de assistência 5.354. Famílias no Bolsa Família (2026-09): Vitória 19.085 (R$ 12.829.147), Alto Rio Novo 1.129, São Paulo 664.474, Belém 147.006.

**Mensal x anual:** o fluxo de benefícios e cadastros é mensal; equipamentos (CadSUAS) refletem a data de extração; valores de população/censo (`populacao_censo_2010`) são **antigos**.

**Cuidados que o dado impõe**
- Os meses **2026-10 a 2026-12 existem** como linhas, com valores repetidos do último mês (ex.: `bpc_residencia_total_i` idêntico) → tratar como preenchimento, não como observação. Usar apenas meses ≤ último mês real por campo.
- **Ausência de campo ≠ zero**: um município sem CREAS aparece sem o campo (2.758 têm valor em 5.570). Não exibir zero sem regra declarada.
- Os campos não têm documentação nem esquema oficial localizados; os nomes mudam por período (`..._ate_2019`, `..._apartir_2023`).
- Cadastro Único mede **demanda registrada**, não toda a população pobre.
- Nenhum dado pessoal foi acessado: todos os campos são agregados municipais.

## 7. População em situação de rua

**Resultado: não há contagem municipal aberta verificada.**

- MI Social: busca por `rua|pop_rua|situacao_rua` em 152 campos ativos (2026-09) não encontrou campo de população em situação de rua. O que existe é **oferta**: Centro POP em **237 municípios** (campo `cadsuas_qtd_centro_pop_i`) e unidades de acolhimento (2.778). Vitória 2 Centros POP; São Paulo 6; Belém 2.
- VIS DATA 3 (painel do MDS) respondeu 200 em HTML; API não localizada (T24).
- Ipea, Censo SUAS e Observatório de Direitos Humanos: **não verificados** nesta rodada (`NOT_EVALUATED`).

**Regra de interpretação para o produto:** (a) população efetiva, (b) estimativa estatística, (c) população cadastrada e (d) população atendida são quatro coisas distintas; **a ausência no CadÚnico não é inexistência de pessoas em situação de rua**; Centro POP mede oferta de serviço, não população. Não construir razão "pessoas/vaga" com os dados atuais.

## 8. Alimentação e nutrição

| Dimensão | Fonte | Granularidade | Evidência |
|---|---|---|---|
| Estado nutricional individual (peso, altura, IMC, idade, sexo, raça/cor, escolaridade, município, CNES) | SISVAN via DEMAS | registro anonimizado | VERIFIED_API (T18) |
| Política de segurança alimentar municipal (lei, câmara intersetorial, ações, recursos) | MUNIC 2023 e módulo Segurança Alimentar 2024 (`Base_de_dados_Seguranca_Alimentar_MUNIC.xlsx`) | município | VERIFIED_API / listagem FTP |
| Cisternas e fomento rural | MI Social | município mensal | VERIFIED_API |
| Insegurança alimentar grave (CadÚnico) | campo `sisan_prop_fam_insan_grave_atualiz_cadun_d` | município | presença **não confirmada** nos quatro recortes (`INFERRED`) |
| Alimentação escolar (PNAE) | FNDE | — | `BLOCKED` (P0) |
| Insegurança alimentar populacional (EBIA/POF) | IBGE | UF/Brasil | `NOT_EVALUATED` por município |

**Viés de cobertura:** o SISVAN só tem quem é acompanhado pela atenção primária; **não representa a população** e varia com a cobertura da APS. Não existe agregado municipal pronto, e os recursos testados não têm filtro de município (a coleta nacional exigiria varrer registros individuais).

## 9. Habitação e moradia

| Dimensão | Resultado |
|---|---|
| Déficit e inadequação habitacional | **FJP 2016–2019 só por região/UF** (abas Déficit, Rústicos, Improvisados, Cômodos, Famílias conviventes, Ônus, Total; T19). **Não há** déficit municipal atual em dado aberto verificado |
| Domicílios, moradores, tipo | Censo 2022: tabelas SIDRA 10054 e FTP por município/bairro/setor (`caracteristicas_domicilio1..3`) |
| Favelas e comunidades urbanas | FTP (resultados do universo e entorno); MUNIC 2023 informa se o município declara favelas/palafitas/cortiços |
| Ônus excessivo com aluguel | Censo 2022: não localizada tabela municipal pronta; FJP só UF |
| Programas habitacionais (Minha Casa, Minha Vida), regularização fundiária | `NOT_EVALUATED` |
| Áreas de risco | S2iD mostra danos a unidades habitacionais por desastre; mapeamento de áreas de risco não verificado |

Diferenciar sempre **déficit** (necessidade de novas moradias), **inadequação** (casa existente com problemas) e **precariedade/assentamentos**: as fontes acima medem coisas diferentes.

## 10. Saneamento e infraestrutura urbana

**SNIS 2022 — extração comprovada** (T12). O ZIP `diagnostico_tematico_visao_geral_ae_snis_2023_atualizado2.zip` (9,2 MB; **HEAD retorna 403, GET com `Range` e User-Agent de navegador funciona**) contém 8 planilhas aninhadas (`Planilha_AE2022_Completa_LPU/LEP/LPR`, regionais, microrregionais, resumos). `Planilha_LPU_Indicadores.xls`: **1.873 linhas × 94 colunas** (formato `.xls` BIFF, lido com `xlrd`). Resíduos (10,8 MB) e águas pluviais (4,1 MB) têm pacotes equivalentes; não foram abertos.

| Item | Situação |
|---|---|
| População atendida, perdas, tratamento, investimentos, tarifas | no `.xls` por **prestador** (município por nome); código IBGE não verificado |
| Série histórica | aplicação web `app4.cidades.gov.br/serieHistorica/` (Yii, formulário); **sem API comprovada** |
| SINISA (sucessor) | `sinisa.cidades.gov.br` redireciona para `/entrar` (login): `BLOCKED` para coleta automática |
| MUNIC saneamento 2023 | base em `Perfil_Municipios/Saneamento_2023/Base_de_Dados/` (listagem verificada) |
| Censo 2022 (água, esgoto, lixo, banheiro) | **não há** tabela municipal no SIDRA agregado (só 2010: tabelas 1436–1439); a fonte são os agregados do FTP (`caracteristicas_domicilio`), **ZIPs não lidos** nesta rodada |
| PNSB | SIDRA 263 tabelas N6, **2008** (a edição 2017 está no FTP); defasada |
| Qualidade da água | DEMAS `/sisagua/*` (P0), amostra de população abastecida verificada |
| Drenagem/alagamentos | S2iD (eventos) + SNIS águas pluviais (declaração) |

Atenção: planilhas SNIS são declaratórias e por prestador; um município pode ter vários prestadores e um prestador vários municípios.

## 11. Mobilidade e acessibilidade

| Pergunta | Resposta verificada |
|---|---|
| Frota e motorização | SENATRAN (275.557 linhas em abril/2026), município por **nome** |
| Transporte coletivo (existência, tipo, isenção, acessibilidade da frota) | MUNIC 2023 (tabelas 8443–8446), 5.570 municípios |
| Acidentes e mortes | PRF (ponto) e VDE/SIM |
| Tempo de deslocamento casa-trabalho, meio de transporte predominante | **não localizado em SIDRA N6** nesta rodada (`NOT_EVALUATED`) |
| Entorno urbano (calçada, rampa, iluminação, arborização) | Censo 2022 (setores selecionados) |
| **Quantas pessoas vivem longe de hospital/escola/CRAS?** | **Parcialmente possível**: grade estatística de **1 km** (população, 2022) + coordenadas do CNES (P0) + CRAS sem coordenada pública verificada → distância em **linha reta**. Tempo de deslocamento exige malha viária oficial que **não foi verificada** (DNIT e OSM não testados). Não produzir tempos a partir de linha reta |

## 12. Ambiente, clima e riscos

| Fonte | O que traz | Evidência |
|---|---|---|
| INPE Queimadas | focos mensais por município (`municipio_id`), lat/lon, bioma, `risco_fogo`, `numero_dias_sem_chuva`, `precipitacao`, FRP; arquivos de 123 MB/mês; diretório mensal 2023-01..2026-10 | T14 |
| S2iD/Atlas Digital | desastres 1991–2025 por município: tipologia COBRADE, mortos, desabrigados, desalojados, afetados por seca, danos a unidades habitacionais/saúde/ensino, prejuízos (86 MB) | T15 |
| TerraBrasilis (WFS) | PRODES por bioma; camada municipal **não identificada** | T21 |
| INMET | lista de estações automáticas (lat/lon); séries não testadas | T22 |
| ANA/Hidroweb | `BLOCKED` (token 401); CKAN 404 | T25 |
| CEMADEN | site respondeu; dados `NOT_EVALUATED` | — |
| Qualidade do ar, calor extremo, arborização | não verificados | — |

**Exposição ≠ dano**: focos de calor e áreas de risco medem exposição; o S2iD mede dano **registrado** (sujeito a subnotificação). Mostrar separadamente.

## 13. Inclusão digital

| Fonte | Resultado |
|---|---|
| Anatel banda larga fixa | ZIP de 1,05 GB; colunas Ano, Mês, Grupo Econômico, Empresa, CNPJ, Porte, UF, Município, **Código IBGE Município**, Faixa de Velocidade, Tecnologia, Meio de Acesso, Acessos; primeiro membro 2007–2010 (T13) |
| Anatel telefonia móvel | 3,2 GB (acessos); **cobertura móvel** no caminho testado deu 404 |
| Censo 2022 | tabela 10201: moradores de 10+ anos com conexão domiciliar (Vitória 287.312 moradores; classes não detalhadas nesta rodada) |
| Censo Escolar (P0) | `IN_INTERNET` por escola |
| Cetic.br/NIC.br | `NOT_EVALUATED` |

Acessos (contratos) por prestadora **não são domicílios conectados**; para isso o Censo 2022 é a fonte (pontual). Granularidade abaixo do município só no Censo (setor).

## 14. Infância, juventude e envelhecimento

| Indicador | Fonte | Granularidade | Observação |
|---|---|---|---|
| Nascidos vivos registrados | SIDRA 2609 | município, 2003–2024 (Vitória 3.486; Alto Rio Novo 89; SP 121.047; Belém 13.842 em 2024) | registrados no ano, não ocorridos |
| Mortalidade infantil | Atlas (`ADH_MORT1`) | município, 1991/2000/2010 | defasada (Vitória 11,4‰; Alto Rio Novo 15,6‰ em 2010) |
| Primeira infância | MI Social (benefício primeira infância); MUNIC (plano municipal, comitê, política) | município | oferta e cobertura de programa |
| CadÚnico por faixa etária (0–4, 16–17…) | MI Social | município mensal | demanda registrada |
| Conselho tutelar | MUNIC 2023 | município | existência |
| Idosos | BPC-idoso (MI Social); população por idade (SIDRA 9514, 2022); razão de dependência (Atlas) | município | grupos etários detalhados não lidos |
| Creche, evasão | Censo Escolar (P0) | escola | já mapeado |
| Trabalho infantil, gravidez na adolescência, acolhimento institucional | não localizados em fonte municipal aberta | — | `NOT_EVALUATED` |
| Idosos que vivem sozinhos | Censo 2022 (microdado/tabela não localizada) | — | `NOT_EVALUATED` |

## 15. Justiça, direitos e serviços de proteção

- **CNJ/DataJud:** já investigado no repositório (`investigacao_judiciario*.md`); não repetido.
- **Defensoria Pública (unidades, cobertura):** nenhuma base nacional aberta localizada (`UNAVAILABLE` por ora).
- **Conselhos tutelares, casas-abrigo, delegacias especializadas, plano para mulheres:** MUNIC 2023, existência por município (T06).
- **Registro civil / sub-registro:** SIDRA traz nascidos vivos registrados; o portal de transparência do registro civil devolve HTML sem API; sub-registro municipal sem fonte (`BLOCKED`/`HYPOTHESIS`).
- **Disque 100/violações de direitos:** URL de dados abertos 404.
- **Medidas protetivas, atendimento a vítimas:** não localizados fora do Judiciário.

## 16. Outros domínios relevantes descobertos autonomamente

Participação eleitoral (TSE, T17); vulnerabilidade e continuidade energética (ANEEL DEC/FEC por conjunto elétrico e CDE, T16); inclusão financeira (Pix); dependência do setor público (VAB administração pública); estrutura empresarial (CEMPRE); diversidade e inclusão (quilombolas, indígenas, PcD, autismo, nacionalidade — Censo 2022); capacidade institucional dos municípios (MUNIC: planos, conselhos, estrutura de saúde, educação, cultura, esporte, habitação, transporte, meio ambiente); cultura e esporte (MUNIC: equipamentos culturais em 5.518 municípios, sistema de esporte); agropecuária familiar (Censo Agropecuário 2017, 1.145 tabelas N6); população em unidades de conservação; fogo; desastres; frota.

## 17. Catálogo de indicadores e granularidade

O JSON contém **69 indicadores** com ID estável (`IND.<DOMÍNIO>.<NOME>`), definição, fonte, unidade, granularidade, temporalidade, evidência, classificação metodológica e limitações. Distribuição por família de collector: F9 tabulares 31, F7 segurança 12, F10 proteção social 12, F11 trabalho/renda/finanças 5, F13 infraestrutura setorial 3, F8 saneamento 2, F12 ambiente 2, F5 saúde 1, F0 referência 1. Classes metodológicas usadas: dado censitário, dado amostral, registro administrativo, indicador derivado, estimativa estatística, índice composto, dado geoespacial, dado autodeclarado.

## 18. Matriz de fontes, cobertura e histórico

Matriz por indicador-chave (BR = nacional, UF, MUN = município, <MUN = abaixo do município):

| Indicador | Fonte | BR | UF | MUN | <MUN | Histórico | Atualização | Evidência |
|---|---|---|---|---|---|---|---|---|
| Homicídios (óbitos) | Ipeadata/Atlas | sim | sim (até 2024) | sim (até 2022) | não | 1980–2022 | anual | VERIFIED_API |
| Homicídio doloso (vítimas) | VDE | sim | sim | sim (nome) | não | 2015–2026-08 | mensal | VERIFIED_DATASET |
| Estupro, tráfico, roubo de veículo | VDE | sim | sim | **não** | não | 2015–2026-08 | mensal | VERIFIED_DATASET |
| Acidentes em rodovia federal | PRF | sim | sim | nome | **ponto** | anos em Drive | contínua | VERIFIED_DATASET |
| Unidades prisionais | SISDEPEN | sim | sim | nome | estabelecimento | 2016–2025 | semestral | VERIFIED_DATASET |
| Guarda/delegacia especializada/conselho tutelar | MUNIC | sim | sim | sim | não | 2023 (módulos antigos) | bienal | VERIFIED_API |
| Renda do trabalho | Censo 2022 SIDRA | sim | sim | sim | **bairro/setor (FTP)** | 2022 | pontual | VERIFIED_API |
| Renda per capita, Gini, IDHM | Atlas/Ipeadata | sim | sim | sim | não | 1991/2000/2010 | decenal | VERIFIED_API |
| PIB e VAB | SIDRA 5938 | sim | sim | sim | não | 2002–2023 (VAB até 2021) | anual | VERIFIED_API |
| Empresas, assalariados, salários | SIDRA CEMPRE | sim | sim | sim | não | 2006–2021 | anual | VERIFIED_API |
| Saldo de emprego formal | CAGED | sim | sim | sim | não | 2020–2026-08 | mensal | VERIFIED_DATASET |
| Pix | BCB | sim | sim | sim | não | 2020-11.. | mensal | VERIFIED_API |
| PBF, BPC, CadÚnico, CRAS/CREAS | MI Social | sim | sim | sim | não | 2003–2026-09 | mensal | VERIFIED_API |
| Déficit habitacional | FJP | sim | sim | **não** | não | 2016–2019 | irregular | VERIFIED_DATASET |
| Água e esgoto (prestador) | SNIS | sim | sim | sim (nome) | não | 2022 | anual | VERIFIED_DATASET |
| Banda larga fixa | Anatel | sim | sim | sim | não | 2007.. | mensal | VERIFIED_DATASET |
| Desastres | S2iD | sim | sim | sim | evento | 1991–2025 | anual | VERIFIED_DATASET |
| Focos de calor | INPE | sim | sim | sim | **ponto** | 2023.. | mensal | VERIFIED_DATASET |
| Frota | SENATRAN | sim | sim | sim (nome) | não | 2024.. | mensal | VERIFIED_DATASET |
| Comparecimento | TSE | sim | sim | sim | zona | 2024 | por eleição | VERIFIED_DATASET |
| Poder de compra/custo de vida | — | — | RMs/capitais (IPCA) | **não** | — | — | — | VERIFIED_API (negativo) |
| População em situação de rua | — | — | — | **não** | — | — | — | BLOCKED |

Regra de comparabilidade: só comparar municípios com a **mesma metodologia e o mesmo período**; indicadores estaduais não viram municipais; `-`, `...`, `X` (SIDRA), zero explícito, ausência de campo e valor suprimido por sigilo são estados distintos.

## 19. Testes reais de APIs e datasets

Todos em 2026-10-10 (detalhes no JSON `tests`).

| ID | Fonte | Requisição | Status | Resultado resumido |
|---|---|---|---|---|
| T01 | MI Social | `GET /sagi/servicos/misocial?q=*:*&wt=json` | 200 | 1.604.448 documentos; 288 meses; 5.571/mês; CRAS/CREAS/Centro POP e PBF dos 4 recortes |
| T02 | Ipeadata | `Metadados` e `ValoresSerie(...)` | 200 | 3.606 séries; ADH_IDHM 16.776 linhas; homicídios 445.240 (204.928 municipais) |
| T03 | BCB Pix | `TransacoesPixPorMunicipio(DataBase=@DataBase)` | 200 | DataBase = mês inicial; 72 linhas para Vitória desde 2020-11 |
| T04 | IBGE Agregados | `/v3/agregados?nivel=N6` | 200 | 4.448 tabelas; PNAD N6 = 27 capitais; IPCA N6 = 6 |
| T05 | IBGE FTP/geoftp | listagens | 200 | setor/bairro/distrito/município; grade 1/5/10 km; faces |
| T06 | MUNIC | `/agregados/{id}/localidades/N6` | 200 | 5.570 localidades |
| T07 | Sinesp VDE | `Range bancovde-{2015..2026}.xlsx` | 206 | 12 arquivos; 31 eventos |
| T08 | PRF | Drive `uc?export=download` | 206 | `datatran2025.csv`, 30 colunas |
| T09 | SISDEPEN | CSV 19º ciclo | 200 | 1.532 unidades × 1.737 colunas |
| T10 | SENATRAN | `Range` XLSX (HEAD 403) | 206 | 275.557 linhas |
| T11 | PDET | `curl --list-only ftp://` | 226 | CAGED 2020–2026-08; RAIS 1985–2024; layout com 23 campos |
| T12 | SNIS | ZIP aninhado + `xlrd` | 206/200 | 1.873 × 94 |
| T13 | Anatel | `Range` + inflate parcial | 206 | 1,05 GB; coluna Código IBGE |
| T14 | INPE | `Range` CSV | 206 | município_id, lat/lon, risco de fogo |
| T15 | S2iD | `Range` CSV | 206 | 86 MB; Cod_IBGE_Mun |
| T16 | ANEEL | CKAN | 200 | DEC/FEC 17 recursos; CDE 110 recursos |
| T17 | TSE | ZIP 1,5 MB | 200 | QT_APTOS, COMPARECIMENTO, ABSTENCOES |
| T18 | DEMAS | SISVAN/PNI `limit=2` | 200 | registros individuais |
| T19 | FJP | XLSX | 200 | só região/UF |
| T20–T25 | Atlas Brasil, TerraBrasilis, INMET, Registro Civil, VIS DATA 3, bloqueios | vários | 200/401/403/404 | ver JSON |

**Valores de referência dos territórios (verificados)**

| Medida | Vitória | Alto Rio Novo | São Paulo | Belém |
|---|---|---|---|---|
| Homicídios 2022 (Atlas) | 90 | 0 | 344 | 339 |
| IDHM 2010 / Gini 2010 | 0,845 / 0,60 | 0,664 / 0,52 | 0,805 / 0,62 | 0,746 / 0,61 |
| Mortalidade infantil 2010 (‰) | 11,4 | 15,6 | 13,2 | 16,1 |
| Analfabetismo 15+ (2022, Atlas) | 2,2% | 12,7% | 2,6% | 3,0% |
| Renda média do trabalho 2022 | R$ 5.242 | R$ 1.902 | R$ 4.548 | R$ 2.987 |
| Pessoas com deficiência 2022 | 6,3% | 9,7% | 6,4% | 8,5% |
| Pessoas quilombolas 2022 | 0 | 0 | 739 | 1.361 |
| Empresas 2021 / nascidos vivos 2024 | 22.094 / 3.486 | 152 / 89 | 638.246 / 121.047 | 19.642 / 13.842 |
| CRAS / CREAS / Centro POP | 12 / 3 / 2 | 1 / 1 / — | 54 / 32 / 6 | 12 / 5 / 2 |
| Famílias no Bolsa Família (2026-09) | 19.085 | 1.129 | 664.474 | 147.006 |
| Guarda municipal / delegacia especializada (2023) | sim / sim | não / sim | sim / sim | sim / sim |

## 20. Relacionamentos entre indicadores e entidades do Cívica

| Cruzamento | Classe | Observação |
|---|---|---|
| MI Social (IBGE 6), CAGED (IBGE 6) ↔ município | EXACT com tabela IBGE6→IBGE7 | mesma regra do DEMAS (P0) |
| Pix, Anatel, S2iD, Ipeadata, SIDRA ↔ município | EXACT | IBGE 7 dígitos |
| INPE ↔ município | HIGH_CONFIDENCE | código do INPE não conferido contra IBGE |
| VDE, PRF, SENATRAN, SISDEPEN, SNIS ↔ município | PROBABLE | só UF + nome |
| TSE ↔ município | EXACT por tabela de equivalência (P0) | |
| Vulnerabilidade (CadÚnico) × cobertura de CRAS | vínculo territorial; associação possível | não causal |
| Homicídios × guarda/delegacia | vínculo territorial e temporal (2022 × 2023) | causalidade **não** demonstrada |
| Desastres × obras de drenagem (Obrasgov) | vínculo territorial | sem identificador comum |
| Banda larga × escolas conectadas | vínculo territorial | |
| CNES (lat/lon) + grade 1 km → população a X km | derivável (linha reta) | tempo de deslocamento indisponível |
| Pix × CAGED × renda do Censo | associação estatística possível | períodos diferentes |
| MI Social (BPC/PBF) × transferências do Portal (P0) | vínculo territorial; valores não conciliados | fontes diferentes |

**Mandatos:** a P1 não atribui resultados sociais a gestores. Mesmo com séries mensais (MI Social, Pix, CAGED, VDE), apenas **coincidência temporal** com mandatos (TSE) é possível; qualquer cruzamento deve usar a data do evento e declarar que não é causal.

## 21. Proposta de famílias de collectors

| Família | Status | Sistemas | Datasets | Frequência | Backfill / incremental | Volume | Complexidade |
|---|---|---|---|---|---|---|---|
| F0 Referência (P0) | estendida | + malhas IBGE, geoftp, TSE comparecimento | malha 2024, grade, faces | por edição | por arquivo | baixo | baixa |
| F5 Saúde (P0) | estendida | + SISVAN, PNI, SIM, SINASC | registro individual | contínua | paginação por offset (20/pág.) | muito alto | alta — decidir se agrega |
| F7 Segurança (P0) | estendida | + VDE 2015–2026, PRF (Drive), SISDEPEN | XLSX/CSV | mensal/semestral | arquivo anual/ciclo | médio | média |
| F8 Saneamento (P0) | estendida | + SNIS xls, MUNIC saneamento | `.xls` aninhados | anual | pacote anual | baixo | média |
| **F9 Indicadores tabulares** | nova | IBGE Agregados/SIDRA, MUNIC, Ipeadata OData, IBGE FTP | registro de 30–60 tabelas/séries (de 4.448 e 3.606) | por pesquisa | período novo por tabela; Ipeadata recarga | baixo–médio | **baixa**: um coletor genérico |
| **F10 Proteção social** | nova | MDS MI Social (Solr) | 1 índice | mensal | `fq=anomes_s` por mês desde 2003 | 5.571 docs/mês | baixa técnica, alta curadoria |
| **F11 Trabalho, renda e finanças** | nova | PDET (FTP/7z), BCB Olinda | CAGEDMOV, RAIS, Pix município | mensal | CAGED 2020–, Pix 2020-11– | CAGED ~50 MB/mês | média |
| **F12 Ambiente e risco** | nova | INPE focos, S2iD, TerraBrasilis, INMET | CSV/WFS/API | mensal/anual | arquivo mensal / consolidado | alto (123 MB/mês) | média–alta |
| **F13 Infra setorial** | nova | Anatel, ANEEL, SENATRAN | ZIP/Parquet/XLSX | mensal | arquivo cumulativo (Range) | muito alto (1 GB e 3,2 GB) | alta |

### Cenários

**A. Centralizada (poucas integrações, cobertura nacional básica):** F9 + F10 + F11, com ajustes em F0 e F7. Cerca de **3 coletores novos, 8 sistemas**. Cobre renda do Censo 2022, PIB, empresas, nascimentos, deficiência, MUNIC (estrutura de segurança e proteção), homicídios municipais 1980–2022, Atlas/IDHM, CRAS/CREAS/BPC/PBF/CadÚnico, CAGED e Pix.

**B. Ampliada:** acrescenta F12 e F13 e estende F5/F7/F8: INPE, S2iD, TerraBrasilis, INMET, Anatel, ANEEL, SENATRAN, PRF, SISDEPEN, SNIS, IBGE por setor/bairro, DEMAS individual. Granularidade e riscos maiores (arquivos de GB, chaves por nome).

### Dependências

| Família | Depende de |
|---|---|
| F9, F10, F11, F12, F13 | F0 (tabela IBGE6/IBGE7/nome→IBGE/TSE) |
| F7 | F0 (nome→IBGE; PROBABLE) |
| F13 (ANEEL) | tabela conjunto elétrico→município (não localizada) |
| F10, F9 | população SIDRA (denominador único, ver conflito da P0) |

**Reuso da infraestrutura P0:** `InstitutionalHttp` (retry/limite) serve a F9–F12; `raw_objects`, checkpoints e `active_*_publications` servem a todos; PDET (FTP) e Drive exigem transportes novos.

## 22. Perguntas de produto possíveis

40 perguntas no JSON (`product_questions`). Classificação: **ANSWERABLE_NOW** (fonte verificada com o dado exato), **ANSWERABLE_WITH_WORK** (fonte verificada, exige agregação/ligação), **HYPOTHESIS** (depende de fonte ou modelo não verificados), **UNAVAILABLE** (sem fonte aberta localizada).

- **ANSWERABLE_NOW (21):** homicídios por município desde 1980 (Q01), de jovens e de mulheres (Q02), eventos só por UF (Q03), feminicídios 2026 (Q04), renda média e mediana (Q05), Gini e IDHM (Q06–Q07), Bolsa Família por mês (Q08), CRAS/CREAS/Centro POP (Q09), BPC (Q10), CadÚnico por faixa etária (Q11), SUAS/IGD (Q12), participação do setor público (Q13, Q39), empresas e massa salarial (Q14), Pix (Q16), PcD e autismo (Q17), quilombolas e indígenas (Q18), guarda/delegacia/casa-abrigo/conselho (Q19), comparecimento (Q37), capital × interior (Q40).
- **ANSWERABLE_WITH_WORK (10):** emprego formal mensal (Q15), distância a hospital em linha reta (Q20), acidentes em rodovias (Q22), unidades prisionais (Q23), veículos por habitante (Q24), focos de calor (Q25), desastres desde 1991 (Q26), banda larga (Q27), domicílios sem esgoto adequado (Q28, Censo 2022 FTP), cobertura de água/esgoto por prestador (Q29).
- **HYPOTHESIS (4):** tempo real até hospital (Q21), poder de compra real (Q33), sub-registro de nascimento (Q34), insegurança alimentar grave (Q38).
- **UNAVAILABLE (5):** população em situação de rua (Q30), déficit habitacional municipal atual (Q31), custo de vida municipal (Q32), taxa de esclarecimento de crimes (Q35), efetivo policial (Q36).

## 23. Lacunas e fontes bloqueadas

| Lacuna | Situação | Próximo experimento |
|---|---|---|
| População em situação de rua municipal | sem fonte aberta verificada | testar Censo SUAS, VIS DATA 3 (rede), Ipea/MDS |
| Efetivo policial, delegacias (cadastro), inquéritos, tempo de resposta | não localizados | catálogos MJSP/Sinesp, ANP/Estadic, portais estaduais |
| Crimes cibernéticos/ambientais; violência doméstica/sexual/racial/infantil por município | não localizados | fontes estaduais e o Anuário FBSP (não é API) |
| Déficit habitacional municipal atual | só UF (FJP) | testar Censo 2022 FTP (domicílios e favelas) e CadÚnico |
| Custo de vida municipal | inexistente | só deflator nacional/regional |
| Tempo de deslocamento a serviços | sem malha viária oficial | DNIT/OSM (não oficial), a decidir |
| Saneamento do Censo 2022 | ZIPs do FTP não lidos | ler `Agregados_por_municipios_caracteristicas_domicilio*.zip` (dicionário 2026-05-20) |
| SINISA | login | verificar API pública ou arquivos |
| Acesso à justiça (Defensoria) e medidas protetivas | não testados | CNJ, DPU, ANADEP |
| ANA (token), ANCINE (403/404), IBRAM (sem conexão), BCB Estban (404), MDHC (404), INEP indicadores (404) | bloqueios técnicos | repetir de outra rede, achar caminhos atuais |
| SINASC (vazio), SIM/SISVAN sem filtro municipal | limitações do DEMAS | OpenDataSUS via outro caminho (S3 deu 403) |
| IDHM municipal pós-2010 | não existe em Ipeadata | acompanhar nova edição do Atlas com Censo 2022 |

## 24. Próximas investigações

1. Ler os ZIPs municipais do Censo 2022 (`caracteristicas_domicilio1–3`, `renda_responsavel`, `alfabetizacao`) e registrar colunas, supressões e cobertura.
2. Abrir as planilhas SNIS de resíduos e águas pluviais e verificar se há código IBGE; confirmar o desenho do SINISA.
3. Descobrir o dicionário completo do MI Social (campos por período, quais param de ser atualizados) e testar retificações retroativas.
4. Cobrir a lacuna institucional de segurança: Estadic, Sinesp (outras abas/arquivos) e portais estaduais para efetivo e delegacias.
5. Testar CNJ/DataJud e Defensoria para acesso à justiça (reuso do que já está no repositório).
6. Procurar tabela conjunto elétrico→município (ANEEL) e quantificar DEC/FEC municipal.
7. Medir Anatel por Range (primeiros e últimos meses) e validar contagem de municípios com banda larga.
8. Avaliar OSM/OSRM como alternativa **não oficial** para tempos de deslocamento e documentar licença e risco de dependência.
9. Testar INEP indicadores educacionais, Censo SUAS, SISAGUA municipal e PNAE (FNDE).
10. Mapear o código IBGE do INPE e a cobertura espacial do TerraBrasilis em nível municipal.

## 25. Gates e avaliação de prontidão

| Gate | Estado | Justificativa e evidência | Pendências |
|---|---|---|---|
| `P1_SOURCE_DISCOVERY` | **PASS_WITH_CAVEATS** | 25 fontes registradas (21 com acesso verificado, 3 `BLOCKED`, 1 `DOCUMENTED_ONLY`): MI Social, Ipeadata, Pix, SIDRA N6, MUNIC, VDE 2015–2026, PRF, SISDEPEN, SENATRAN, CAGED/RAIS, SNIS, Anatel, INPE, S2iD, ANEEL, TSE, FJP | bloqueios técnicos agregados em `p1_blocked_misc` (ANA, ANCINE, IBRAM, BCB Estban, MDHC, INEP) e SINISA (login) |
| `P1_SECURITY_DEPTH` | **PARTIAL** | municipal comprovado para 11 eventos; UF-only para 18–20; prisional, viário e estrutura (MUNIC) comprovados | efetivo, delegacias, eficácia, crimes cibernéticos/ambientais/domésticos por município não localizados |
| `P1_SOCIAL_WELLBEING_COVERAGE` | **PARTIAL** | proteção social, renda, ambiente, digital e infância cobertos; moradia, alimentação municipal agregada e situação de rua sem dado municipal | situação de rua, déficit habitacional atual, saneamento Censo 2022 não lido |
| `P1_CREATIVE_DISCOVERY` | **PASS_WITH_CAVEATS** | 18 oportunidades fora do escopo explícito, cada uma com fonte verificada; nenhuma inventada | oportunidades dependentes de arquivos de GB não têm custo medido |
| `P1_MUNICIPAL_GRANULARITY` | **PASS_WITH_CAVEATS** | 5.570/5.571 municípios em MI Social, SIDRA N6, MUNIC, Pix (estrutura), CAGED; setor/bairro/grade 1 km no Censo 2022 (listagem) | PNAD e IPCA não são municipais; VDE só 11 eventos; granularidade sub-municipal não lida |
| `P1_HISTORICAL_COVERAGE` | **PASS_WITH_CAVEATS** | MI Social 2003–2026, homicídios 1980–2022, S2iD 1991–2025, RAIS 1985–2024, VDE 2015–2026, Anatel 2007– | IDHM decenal (2010); CEMPRE e VAB param em 2021; INPE mensal só desde 2023 |
| `P1_INDICATOR_VALIDITY` | **PARTIAL** | 69 indicadores com limites declarados | definição de homicídio do Atlas e campos do MI Social não documentados; SINASC vazio |
| `P1_IDENTITY_LINKAGE` | **PARTIAL** | IBGE 6/7 EXACT para MI Social, Pix, Anatel, S2iD, CAGED, Ipeadata, SIDRA | VDE, PRF, SENATRAN, SISDEPEN e SNIS só por nome (PROBABLE); conjunto elétrico sem tabela |
| `P1_COLLECTOR_CONSOLIDATION` | **PASS_WITH_CAVEATS** | cenário A: ~3 coletores novos cobrem o núcleo; B acrescenta 2 famílias | F13 e F12 têm alto custo de dados; transportes novos (FTP, Drive) |
| `P1_PRODUCT_OPPORTUNITIES` | **PASS_WITH_CAVEATS** | 18 oportunidades e 40 perguntas classificadas por viabilidade | 5 perguntas indisponíveis e 4 hipóteses declaradas |

### Respostas finais

**A. O que agora sabemos sobre a vida em um município que não sabíamos na P0?** Renda do trabalho (média e mediana) e desigualdade; dependência do setor público; emprego formal mensal; uso de Pix; famílias no Bolsa Família e BPC; quantos CRAS, CREAS e Centros POP existem; se há guarda municipal, delegacia especializada, casa-abrigo, conselho tutelar; homicídios (incluindo mulheres e jovens) desde 1980; desastres desde 1991; focos de calor; banda larga fixa por velocidade; frota; unidades prisionais; pessoas com deficiência, autismo, quilombolas e indígenas; entorno urbano; comparecimento eleitoral; no nível de bairro/setor, renda do responsável e características dos domicílios.

**B. Indicadores para todos ou quase todos os municípios:** renda do Censo 2022, PIB, empresas/salários (até 2021), nascidos vivos, deficiência/autismo/quilombolas/indígenas, MUNIC 2023 (5.570), MI Social (5.571 por mês), IDHM/Gini/renda (5.564, 1991–2010), homicídios (5.564, 1980–2022), Pix, CAGED, S2iD, INPE (por município_id), Anatel. **Não** para todos: PNAD (27 capitais), IPCA (6), eventos do VDE além dos 11, Centro POP (237) e CREAS (2.758) como oferta existente.

**C. Mudanças mensais, anuais e entre períodos de gestão:** mensal — MI Social, Pix, CAGED, VDE, Anatel, INPE, SENATRAN; anual — homicídios, CEMPRE, PIB, nascidos vivos, SNIS, SISDEPEN (semestral); decenal/pontual — IDHM, Gini, Censo 2022. Mandatos municipais: há séries mensais para cruzar por data de evento com mandatos (TSE), sem atribuir causalidade.

**D. O que cabe nos collectors já previstos:** VDE 2015–2026, PRF e SISDEPEN em F7; SNIS e MUNIC saneamento em F8; SISVAN/PNI/SIM em F5; malhas e TSE em F0. O resto (SIDRA/Ipeadata/MUNIC, MI Social, CAGED/Pix) pede **três famílias novas, mas genéricas** (F9, F10, F11); F12/F13 só se o produto precisar de ambiente e infraestrutura setorial.

**E. Maior potencial para virar plataforma de exploração territorial e social:** MI Social (proteção social mensal por município), Censo 2022 com renda e domicílios por bairro/setor, Pix (inclusão financeira), S2iD e INPE (risco), Anatel (conectividade) e a grade de 1 km com coordenadas de serviços (acesso por distância), além do índice de capacidade institucional (MUNIC).

**F. Perguntas sem fonte pública adequada:** população em situação de rua por município; poder de compra/custo de vida municipal; efetivo policial e eficácia investigativa; deficit habitacional municipal atual; sub-registro de nascimento municipal; tempo real de deslocamento a serviços; acesso à Defensoria e medidas protetivas; crimes cibernéticos e ambientais; violência doméstica, sexual e racial por município; saneamento do Censo 2022 em nível municipal sem leitura do FTP.
