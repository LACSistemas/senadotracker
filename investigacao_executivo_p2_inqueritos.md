# CÍVICA — P2: Investigação nacional do ciclo de inquéritos policiais

Data da investigação: 2026-10-10. Escopo: somente investigação. Nenhum código de produção, banco, collector, migration ou configuração foi alterado. Arquivos anteriores (P0, P1, `investigacao_judiciario*.md`) não foram tocados. Os artefatos de teste ficaram no scratchpad da sessão, fora do repositório.

Companheiro estruturado: `investigacao_executivo_p2_inqueritos_fontes.json` (IDs estáveis: `SRC-*`, `DS-*`, `IND-*`, `TST-*`, `EV-*`, `COL-*`).

Classes de evidência usadas: `VERIFIED_API`, `VERIFIED_DATASET`, `DOCUMENTED_ONLY`, `INFERRED`, `BLOCKED`, `NOT_EVALUATED`, `UNAVAILABLE`. Na tabela estadual (seção 7) acrescento o **status de busca** pedido no prompt: *verificado*, *documentado*, *bloqueado*, *não localizado*, *não testado*. "Não localizado" significa que a busca foi feita e nada apareceu; **não prova inexistência**. Nenhuma fonte foi marcada `UNAVAILABLE` por um único erro HTTP.

---

## 1. Resumo executivo

**Pergunta central:** é possível acompanhar, para cada município ou estado, quantos inquéritos foram abertos, quantos concluídos e quantos seguem em investigação?

**Resposta curta: hoje, não, não de forma nacional, contínua e comparável.** O que existe é um mosaico:

| Etapa do fluxo | O que se comprovou | Abrangência real |
|---|---|---|
| **Entrada (instaurados)** | SSP-SP publica "Total de inquéritos instaurados" por trimestre desde 1995, aberto por Capital / Grande SP / Interior / DEINTER (13 colunas). Números de 2026 **reconferidos**: T1 = 28.460 + 19.465 + 73.411 = **121.336**; T2 = 29.614 + 20.879 + 75.369 = **125.862**. | 1 UF (SP). Sem município, sem delegacia. |
| **Entrada + saída por UF** | PISP 2017 (MJSP, ano-base 2017) traz, por UF, inquéritos instaurados (portaria, flagrante), remetidos com indiciamento, remetidos sem indiciamento e não remetidos, com recorte por homicídio doloso, lesão seguida de morte e latrocínio. PDF de 228 páginas lido. | 25 UFs responderam; RO e RR não; SP, MA e outras com lacunas. **Um único ano (2017).** |
| **Padrão nacional novo** | Portaria MJSP nº 1.145/2026 (lida na íntegra) define "instaurado", "concluído" e "elucidado" e cria seis índices (INEH, INEF, INRPH, INRPF, INIPH, INIPF), só para **homicídio e feminicídio**. Prazo de adequação de 180 dias já vencido (~agosto/2026). | Todos os integrantes do Sinesp. **Publicação pública dos índices: não localizada.** |
| **Esclarecimento por coorte** | ISP-RJ publica `base_elucidacao.csv` (semestral, 2013–2024S1), com acompanhamento de 24 meses após o registro. É coorte de verdade. | 1 UF (RJ), só letalidade violenta. |
| **Tramitação no MP** | CNMP "Ministério Público: um retrato" (BI nacional desde 2011) traz inquéritos recebidos, denúncias e arquivamentos. Edição mais recente localizada: 2021. Automação do Tableau **não comprovada**. Cada MP publica a própria consulta "Inquéritos policiais e seus andamentos no MP". | Nacional (BI) e por MP (consulta). |
| **Registro judicial** | DataJud responde nos 27 TJs: **6,05 milhões** de documentos da classe 279 (Inquérito Policial) somados nos 27 TJs. Movimentos de arquivamento, denúncia, desarquivamento e tramitação direta MP↔polícia existem. Cada documento traz o município IBGE do órgão julgador. | Judicial, não policial. Denominador desconhecido. |

**Conclusões que protegem o produto:**

1. **Fluxo operacional** (entradas, remessas, saldo) é parcialmente possível; **probabilidade de conclusão de coorte** só existe para homicídio/feminicídio (RJ hoje; resto do país depende do INEH).
2. **Nenhuma fonte nacional aberta chega a município ou delegacia** para inquéritos policiais. A única granularidade municipal é a do **órgão julgador** no DataJud, e ela descreve o Judiciário.
3. **Estoque pendente contínuo não foi localizado** em nenhuma UF. Há fotos pontuais (PISP 2017, "não remetidos"; 3,8 milhões em 2013 segundo o CNMP, por reportagem).
4. **Vínculo individual polícia→MP→juízo não é possível**: não há campo que ligue o inquérito (classe 279) à ação penal no DataJud.
5. Encontrei fontes não citadas no prompt: PISP (MJSP), `base_elucidacao.csv` (ISP-RJ), Portaria 1.145/2026, Sou da Paz (*Onde Mora a Impunidade*), estudo Adepol 2022, consultas por MP (MPF, MPDFT, MPGO, MPBA, MPAL), CNMP "Controle Externo da Atividade Policial em Números" (Tableau).

**Recomendação:** Cenário B (nacional com complementos estaduais), começando por SP (HTML estático), RJ (CSV), DataJud agregado e PISP (extração manual de PDF). Ver seção 15.

---

## 2. Novidades em relação à P0 e à P1

| Tema | P0/P1 | P2 |
|---|---|---|
| Eficácia policial | P1 §: "inquéritos instaurados/concluídos... não localizados" em fonte nacional aberta. | Localizados: PISP 2017 (UF), SSP-SP (trimestral), ISP-RJ (elucidação), Portaria 1.145/2026 (padrão). |
| Sinesp | Eventos do VDE (31), municipal em 11. | O texto do VDE só cita inquérito na **metodologia** de tentativa de homicídio/feminicídio (cruzamento BO×IP). **Não há indicador de inquérito no VDE.** |
| DataJud | Estrutura, 64 aliases, 350,8 mi documentos. | Classe 279 e correlatas contadas nos 27 TJs; vocabulário de movimentos de IP; **defeito de data compacta** (seção 6.4); limite de requisições (HTTP 429). |
| CNMP | Não investigado. | Mapeada a árvore de BIs; o BI "Inquérito Policial e seu andamento" **não é um BI nacional do CNMP**: é obrigação de transparência de cada MP. ELO/Resolução 110 testado e **refutado** como fonte de IP. |
| Semântica | Não havia. | Matriz com 15 termos (seção 9), ancorada na Portaria 1.145 e no vocabulário TPU. |

Reaproveitável do Cívica: normalização por **código IBGE** (o DataJud traz `orgaoJulgador.codigoMunicipioIBGE`), a infraestrutura DataJud já contratada na investigação do Judiciário (chave pública da Wiki, `search_after`, agregação em vez de espelhamento), cadastro institucional e a camada de agregados por fonte (`source_key`).

---

## 3. Fontes nacionais investigadas

| ID | Fonte | Resultado | Evidência |
|---|---|---|---|
| SRC-CNMP-RETRATO | CNMP, "MP: um retrato" (BI Tableau) | Existe desde 2011; IP recebidos, denúncias, arquivamentos. 2016: 7.129.455 IP recebidos, 820.485 denúncias, 703.126 arquivamentos (reportagem do CNMP). Embed abre (HTTP 200); exportação CSV devolve 404/WAF. | DOCUMENTED_ONLY (valores); BLOCKED (automação) |
| SRC-CNMP-CEAP | CNMP, "Controle Externo da Atividade Policial em Números" (Tableau, inspeções de delegacias, Res. CNMP 20/2007) | Página e link do painel lidos. Conteúdo: inspeções às delegacias, não fluxo de IP. Painel não testado por trás do WAF. | DOCUMENTED_ONLY |
| SRC-CNMP-ELO | CNMP, ELO, Relatório 110 | Formulário com filtro por **conselheiro**; é relatório de processos do próprio CNMP. Hipótese de que fosse fonte de IP **refutada**. | VERIFIED (negativo) |
| SRC-MPS-IP | Portais de transparência dos MPs (MPF, MPDFT, MPGO, MPBA, MPAL) | Seção "Inquéritos policiais e seus andamentos no MP" existe em cada MP, por unidade/consulta; sem CSV/JSON/API visível. | VERIFIED_DATASET (existência da página); sem acesso estruturado |
| SRC-SENASP-PISP | MJSP/Senasp, Pesquisa Perfil das Instituições de Segurança Pública | **Ano-base 2017: PDF baixado e lido.** Ano-base 2022: página localizada, arquivo não obtido. Ano-base 2024: URL do PDF redireciona para login. | VERIFIED_DATASET (2017); DOCUMENTED_ONLY (2022); BLOCKED (2024) |
| SRC-SENASP-PORT1145 | Portaria MJSP 1.145/2026 + Res. ConSinesp 10/2025 | Texto lido (PDF oficial, 1 página do DOU). Define índices e prazos. | VERIFIED_DATASET (texto normativo) |
| SRC-SINESP-VDE | Sinesp VDE | Base 2015–2026 (xlsx). Sem indicador de IP. | VERIFIED_DATASET (negativo para IP) |
| SRC-DATAJUD | CNJ DataJud | Ver seção 6. | VERIFIED_API |
| SRC-SOUDAPAZ | Instituto Sou da Paz, *Onde Mora a Impunidade* (7ª ed., 2024) | Indicador de homicídios com denúncia até o fim do ano seguinte; 27 UFs via LAI; 19 UFs com dados completos na edição. | DOCUMENTED_ONLY |
| SRC-ADEPOL | Adepol do Brasil, pesquisa de resolutividade (2022) | Média nacional 64,16%; razão entre inquéritos **relatados e instaurados** (fluxo, não coorte). Relatório completo não localizado. | DOCUMENTED_ONLY |
| SRC-FBSP | Anuário Brasileiro de Segurança Pública / IPEA | Não avaliado para IP. | NOT_EVALUATED |

---

## 4. CNMP — dados de inquéritos

**O que o prompt chamou de seção "Inquérito Policial e seu andamento no Ministério Público" é, na prática, uma exigência de transparência por MP.**

Testes:

1. Portal do CNMP (`/portal/transparencia/relatorios-em-bi`): **40 painéis BI listados**. Nenhum se chama "inquérito policial". Os mais próximos: *Controle Externo da Atividade Policial em Números* (17232), *Monitoramento da Letalidade e Vitimização Policial* (19767, Power BI), *MP: um retrato* (14512, 12430) e *Inventário de Bases de Dados* (17744).
2. Busca textual encontrou a seção nos portais **do MPF, MPDFT, MPGO, MPBA e MPAL**. As páginas do MPDFT e MPGO descrevem "Dados e estatísticas da movimentação processual por unidade" e "Listagem por unidade ou membro (Resolução nº 110/CNMP)". A página do MPBA é um formulário de consulta por número, parte e documento.
3. O link `elo.cnmp.mp.br/pages/relatorios/resolucao110.seam`, que parecia ser a consolidação nacional, **não é**: o formulário filtra por conselheiro.

| Pergunta do prompt | Resposta (com evidência) |
|---|---|
| Dados publicados | Por MP: consulta por unidade/membro; nacional: BI "um retrato" com IP recebidos, denúncias, arquivamentos (DOCUMENTED_ONLY). |
| Séries históricas | "Um retrato" desde 2011 (DOCUMENTED_ONLY). |
| Nacional/todos os MPs | "Um retrato" cobre MPs estaduais e ramos do MPU (DOCUMENTED_ONLY). Por MP, cada um publica o seu. |
| Periodicidade | Anual no BI. Edição mais recente **localizada** na lista de BIs: 2021. Não há equivalente 2024–2026 na lista. |
| Arquivos CSV/XLSX/JSON/API | **Não comprovado.** MPF/MPDFT/MPGO/MPBA/MPAL: nenhum arquivo estruturado de IP nas páginas lidas (MPGO tem um PDF de relação de procuradorias, irrelevante). Tableau: `.csv` devolve 404 com WAF. |
| Granularidade territorial | Por unidade ministerial (promotoria/comarca) quando a consulta existe. Vínculo unidade→município **não testado** (`UNLINKED` até teste). |
| Procedimentos distintos ou movimentações | **Movimentações.** "Inquéritos recebidos" no BI soma entradas, incluindo devoluções. 7,1 milhões de IP recebidos em 2016 é maior que qualquer total de instauração pública, o que indica contagem de movimentos. |
| Retificações | Não documentadas publicamente. |

**Distinção preservada:** os dados de "inquérito civil" (MPPR, `ords.mppr.mp.br`, "Inqueritos Civis e seus Andamentos no MP") e o PIC-MP (classe 1733 na TPU, 7.486 documentos no TJES) **não são inquérito policial** e não devem ser somados.

**Estoque histórico:** reportagem de 2013 atribui ao CNMP 3,8 milhões de IP sem conclusão. Documentado por terceiros; **não reverificado** na fonte primária.

---

## 5. SENASP/Sinesp — produtividade e investigações

### 5.1 Pesquisa Perfil das Instituições de Segurança Pública (PISP)

**Ano-base 2017** (`relatorio_pesquisa_perfil_anobase_2017.pdf`, 10,8 MB, HTTP 206 com `Range`, 228 páginas): Tabelas 2.16 a 2.20 trazem, por UF, **total** e três recortes (homicídio doloso, lesão corporal seguida de morte, latrocínio):

| Tabela | Conteúdo | Total nacional impresso |
|---|---|---|
| 2.16 | Inquéritos instaurados **por portaria** | 783.989 |
| 2.17 | Inquéritos instaurados **por flagrante** | (UFs lidas; total não capturado) |
| 2.18 | Remetidos **com indiciamento** | 447.808 |
| 2.19 | Remetidos **sem indiciamento** | 129.295 |
| 2.20 | **Não remetidos** | 436.236 |

Limitações no próprio documento: "Os estados de Rondônia e Roraima não responderam"; legenda `-` (dado não informado ou inconsistente) e `---` (não respondeu). **SP aparece como `-` em todas as tabelas**, embora a SSP-SP publique o total. Isso mostra que o PISP não substitui a fonte estadual. A tabela 2.20 é rotulada "não remetidos"; se é saldo de fim de ano ou fluxo do ano não está definido no trecho lido (`INFERRED`: estoque aproximado).

Exemplo de leitura (ES, 2017, `INFERRED`): instaurados 12.033 + 8.362 = 20.395; remetidos 15.309 + 1.687 = 16.996; não remetidos 7.072. Não se pode transformar isso em taxa de conclusão (fluxos do ano, não coorte).

**Ano-base 2022** (página `pesquisa-perfil-instituicoes-seguranca-publica-ano-base-2022` indicada por busca): a URL devolveu 404 no teste; a página-mãe de Pesquisa Perfil devolveu 200 com links apenas para a página institucional e a "base-de-dados" (404). **Não obtido; não classificado como inexistente.**

**Ano-base 2024** (`pisp-ano-base-2024.pdf`): a URL redireciona para `acl_users/credentials_cookie_auth/require_login` (HTTP 200 com página de login, também com `Range` e `Accept: application/pdf`). `BLOCKED` no momento do teste; pode estar em publicação.

### 5.2 Portaria MJSP nº 1.145, de 9/2/2026

Texto lido integralmente no PDF do DSpace do MJ (`bibliotecadigital.mj.gov.br/bitstream/1/16686/2/PRT_GM_2026_1145.pdf`). Pontos relevantes:

- **Elucidado** = IP ou procedimento análogo **relatado e remetido** ao Judiciário ou MP contendo (I) autoria e materialidade, (II) conclusão de inexistência de crime ou (III) excludentes de ilicitude/culpabilidade/extinção de punibilidade, **exceto prescrição**.
- **Concluído** = relatado e remetido ao Judiciário, **ainda que não elucidado**.
- **Instaurado** = formalizado e **vinculado a um registro em unidade de Polícia Judiciária**.
- **Procedimentos análogos** = autos de investigação de ato infracional.
- Índices: INEH/INEF = elucidados encaminhados ÷ instaurados; INRPH/INRPF = concluídos encaminhados ÷ instaurados; INIPH/INIPF = instaurados ÷ **registros** em unidades de PJ.
- Senasp deve fornecer solução de coleta em **180 dias**; integrantes do Sinesp têm 180 dias para se adequar; inadimplência pode ser divulgada em relatório público de adimplência (art. 10).
- Art. 8º §1º: serão divulgados "homicídios e feminicídios elucidados em face dos consumados", **sem** prever série por município ou delegacia.
- Periodicidade mensal "até o dia 15" aparece em resumo de busca; **não está no texto da Portaria** (que não traz o anexo). `DOCUMENTED_ONLY` e não confirmado.

**Implicação:** existe **coleta institucional** (obrigatória) e **definição nacional**, mas não localizei **publicação pública** dos índices (página de estatísticas do MJSP lida, sem menção a INEH). Nota semântica: o INEH usa como denominador "instaurados", não as ocorrências, e a coorte (período de apuração) **não está fixada no texto lido**.

### 5.3 Sinesp VDE e demais

O VDE (28/31 indicadores) não tem IP. O texto cita IP apenas como **chave de validação** (BO × procedimento investigativo) para tentativa de homicídio/feminicídio. Sinesp Integração e Sinesp Segurança: acesso restrito a integrantes; não confundir com fonte pública.

---

## 6. DataJud — relação entre investigação e Justiça

### 6.1 Acesso
`POST https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search`, header `Authorization: APIKey <chave pública da Wiki>`. HTTP 200 nos 27 TJs. **HTTP 429 ocorreu** após ~30 consultas agregadas em poucos segundos; retomei com pausa de 20–25 s. Qualquer collector precisa de limitador.

### 6.2 Classes (TPU) confirmadas no TJES, com contagem de documentos

| Código | Classe | Docs TJES |
|---|---|---|
| 279 | Inquérito Policial | 93.736 |
| 280 | Auto de Prisão em Flagrante | 60.225 |
| 278 | Termo Circunstanciado | 120.914 |
| 11041 | Inquérito Policial Militar | 6.540 |
| 1733 | Procedimento Investigatório Criminal (PIC-MP) | 7.486 |
| 272 | Representação Criminal/Notícia de Crime | 6.763 |
| 273 | Pedido de Arquivamento em Representação Criminal | 5 |
| 14678 | Acordo de Não Persecução Penal | 2.079 |
| 283 | Ação Penal – Procedimento Ordinário | 95.930 |

Também existem "Inquérito Extrajudicial", "Relatório de Investigações" e "Medidas Investigatórias sobre Organizações Criminosas".

### 6.3 Classe 279 nos 27 TJs (documentos processo×grau)
Total 6.049.533. Maiores: MG 1.585.419; SP 1.456.342; RS 320.050; BA 300.822; RJ 287.242; PR 221.035; CE 200.288; GO 192.513; SC 171.283; PA 166.149. Menores: RR 13.376; TJDFT 20.301; AP 27.602; AC 29.221; AL 30.876. Número de órgãos julgadores distintos por TJ: de 33 (AP) a 1.141 (SP). Detalhe por UF no JSON (`DS-DATAJUD-IP-UF`).

**Interpretação proibida:** esses números **não** são "inquéritos instaurados" por UF. TJDFT (20.301) é muito menor que PCDF (42.663 IP instaurados em 2023, imprensa), pois parte dos IPs não passa pelo sistema judicial como classe 279.

### 6.4 Defeito de data compacta
`dataAjuizamento` vem como `yyyyMMddHHmmss` (ex.: `20260819140928`) e o índice o lê como **milissegundos desde 1970**. Resultado: `date_histogram` mostra "anos" 2597–2612 e é inútil. Para contar por período, usar `range` com os próprios dígitos (`gte 20260101000000`, `lt 20260401000000`). Esse filtro **só alcança documentos com data compacta**; documentos com data ISO ficam fora e não foram quantificados. Todo coletor precisa tratar os dois formatos.

### 6.5 Vocabulário de movimentos da classe 279 (TJES, 93.736 docs)

| Cód. | Movimento | Docs |
|---|---|---|
| 26 | Distribuição | 60.601 |
| 36 | Redistribuição | 14.421 |
| 51 | Conclusão | 64.602 |
| 982 / 123 / 980 | Remessa | 43.324 / 14.261 / 3.660 |
| 132 / 979 / 981 | Recebimento | 54.517 / 4.940 / 4.804 |
| 1063 | **Determinação de arquivamento de procedimentos investigatórios** | 12.918 |
| 391 | **Denúncia** | 8.571 |
| 893 | **Desarquivamento** | 6.270 |
| 849 | Reativação | 4.793 |
| 14999 / 15000 | **Iniciada / Finalizada Tramitação Direta entre MP e Autoridade Policial** | 11.622 / 10.517 |
| 22 | Baixa Definitiva | 5.455 |
| 246 | Definitivo | 56.048 |
| 11878 | Prescrição | 10.876 |
| 11025 | Suspensão ou Sobrestamento | 3.438 |
| 10966 / 14738 | Mudança / Retificação de Classe Processual | 12.284 / 14.173 |

Contagens de movimento são **documentos com ao menos uma ocorrência**, não ocorrências.

### 6.6 Questão crítica: qual fração dos IPs vira registro judicial?
Teste com os únicos denominadores policiais verificados (SP):

| Período | SSP-SP instaurados | DataJud TJSP, classe 279, data compacta no trimestre | Razão |
|---|---|---|---|
| 2026 T1 | 121.336 | 59.372 | ≈ 0,49 |
| 2026 T2 | 125.862 | 69.069 | ≈ 0,55 |

**Leitura (`INFERRED`, ordem de grandeza):** é um **limite inferior** (exclui documentos com data ISO e IPs físicos), compara eventos diferentes (instauração × distribuição) e documentos podem ser múltiplos por IP. **Não usar o DataJud como retrato de todos os inquéritos.** Para o ES não há denominador policial; para os demais, não testado.

### 6.7 Relação inquérito → ação penal
O documento tem `numeroProcesso`, classe, assuntos, órgão julgador (`codigo`, `nome`, `codigoMunicipioIBGE`), sistema, formato e movimentos. **Nenhum campo de processo relacionado**. Só 0,5% dos IPs do TJSP (7.470 de 1,46 milhão) têm o movimento "Denúncia" (391), o que indica que o oferecimento aparece em outro processo. Vínculo IP↔AP: `UNLINKED`.

### 6.8 Duração (amostra ilustrativa)
400 IPs do TJES mais recentemente atualizados que têm Distribuição (26) e Arquivamento (1063): mediana **120 dias**, p25 28, p75 563, p90 1.391. Viés de seleção (só arquivados, só atualizados recentemente) e relógio **judicial**, não policial. Prova de viabilidade, não indicador.

### 6.9 Município
`orgaoJulgador.codigoMunicipioIBGE` está presente. TJES, classe 279, municípios: Serra 14.152; Vila Velha 13.016; Vitória 11.931; Cariacica 11.160 (69 municípios distintos). **É o município do juízo**, não o do fato nem o da delegacia.

---

## 7. Inventário das 27 UFs

Status de busca: V = verificado (acesso e leitura), D = documentado (só texto/imprensa), B = bloqueado, NL = não localizado, NT = não testado. "Mensal" é a periodicidade da fonte, não do dado público confirmado.

| UF | Fonte | Abertura | Conclusão | Pendentes | Mensal | Municipal | Delegacia | API/arquivo | Evidência |
|---|---|---|---|---|---|---|---|---|---|
| SP | SSP-SP, "Dados trimestrais" (`assets/estatistica/trimestral/*.htm`, índice JSON) | **V** (instaurados, 1995–2026T2) | NL | NL | Trimestral | Não (Capital, Gde SP, Interior, 10 DEINTER) | Não | HTML estático + JSON de índice | VERIFIED_DATASET |
| PR | SESP/CAPE (BI Qlik); PCPR (imprensa) | D (operações, ex.: Verão Maior 1.492 instaurados, 95,4% concluídos e remetidos) | D (idem) | NL | NL | NT | NT | BI Qlik (NT) | DOCUMENTED_ONLY |
| ES | CKAN `dados.es.gov.br` (SESP: 42 datasets), Observatório, Anuário IJSN 2023 | NL | NL | NL | NL | NL (só DataJud judicial) | NL | CKAN 200, nenhum dataset de IP | VERIFIED (negativo) / UNAVAILABLE não aplicado |
| MG | SEJUSP, dados abertos (CSV de crimes violentos) | NL (PISP 2017: 127.043 por portaria) | NL | NL | NL | NL | NL | CSV de crimes, não de IP | DOCUMENTED_ONLY |
| RJ | ISPdados (17 arquivos listados) | NL | **V** (elucidação por coorte, só letalidade violenta) | NL | Semestral | Não | Não | CSV + PDF | VERIFIED_DATASET |
| DF | SSP-DF (apresentações mensais); PCDF | D (apresentação 2016 com "Produtividade PCDF: IP instaurados"; 2023: 42.663 na imprensa) | D | NL | Mensal (histórico) | Não | Não | PDF | DOCUMENTED_ONLY |
| RS | SSP-RS, indicadores criminais | NL (PISP 2017: 196.985) | NL | D (imprensa: ~1,6 mi em andamento) | NL | NL | NL | XLS de crimes | DOCUMENTED_ONLY |
| SC | SSP-SC | NL (PISP 2017: 51.198) | NL | NL | NL | NL | NL | página testada devolveu 404 | NL |
| GO | SSP-GO | D (imprensa: 46.923 em 2023; 50.464 em 2024) | D (remetidos com autoria definida: 40.463 → 45.796) | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| BA | SSP-BA | D (35.409 em 2021; 24.065 em 2022, mudança de metodologia declarada) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| PE | SDS-PE | D (taxa 63,51% em 2022, Adepol) | D | NL | NL | NL | NL | URL testada 404 | DOCUMENTED_ONLY |
| CE | SSPDS-CE | NL | NL | NL | NL | NL | NL | domínio sem resposta em 1 tentativa | NT |
| MS | SEJUSP-MS | NL (PISP 2017: 28.849) | D (Adepol: 94,9%) | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| MT | SESP-MT | NL (PISP 2017: 21.746) | D (Adepol: 93,51%) | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| PA | SEGUP-PA | NL (PISP 2017: 21.737) | D (Adepol: 89,59%) | NL | NL | NL | NL | URL testada 404 | DOCUMENTED_ONLY |
| MA | SSP-MA | NL (PISP 2017: sem resposta) | D (Adepol: 96,65%) | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| AC | PCAC; SSP-AC | NL (PISP 2017: 1.059 + 2.030) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| AL | SSP-AL | NL (PISP 2017: 8.064 + 6.370) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| AM | SSP-AM | NL (PISP 2017: 9.750 + 5.358) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| AP | SEJUSP-AP | NL (PISP 2017: 2.259 + 2.572) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| PB | SESDS-PB | NL (PISP 2017: 21.617) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| PI | SSP-PI | NL (PISP 2017: 6.382 + 6.477) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| RN | SESED-RN / PCRN | NL (PISP 2017: 8.597) | NL | NL | Nota Sou da Paz 2026 indica adoção do padrão nacional no SISMVI | NL | NL | NL | DOCUMENTED_ONLY |
| RO | SESDEC-RO | NL (PISP 2017: não respondeu) | NL | NL | NL | NL | NL | NL | NT |
| RR | SESP-RR | NL (PISP 2017: não respondeu) | NL | NL | NL | NL | NL | NL | NT |
| SE | SSP-SE | NL (PISP 2017: 7.729) | NL | NL | NL | NL | NL | NL | DOCUMENTED_ONLY |
| TO | SSP-TO | NL (PISP 2017: `---`) | NL | NL | NL | NL | NL | NL | NT |

Notas:
- **Só SP e RJ têm leitura verificada de arquivo estadual.** Em todos os demais, a cobertura veio de PISP 2017 (um ano) ou de imprensa.
- As taxas da Adepol (MS, MT, PA, MA, PE) são **razões de fluxo** do estudo de 2022 reportadas por veículos; não são coorte.
- A varredura de páginas iniciais de estatística (RS, SC, GO, BA, PE, CE, MT, MS, PA, DF, MG) **não encontrou menção a "inquérito" na página de entrada** de nenhuma. Isso não prova ausência em subpáginas, painéis dinâmicos ou PDFs.
- Painéis em JavaScript (Qlik do PR, vários BIs) **não foram renderizados**; `NT`.

---

## 8. Aprofundamento de SP, PR e ES

### 8.1 São Paulo
- **Fonte:** `https://www.ssp.sp.gov.br/assets/estatistica/trimestral/dadosTrimestral.json` lista 32 anos (1995 a 2026; 2026 só com 2 trimestres). Cada item aponta para `assets/estatistica/trimestral/arquivos/AAAA-TT.htm`. O site é uma SPA Angular; o índice e os `.htm` são estáticos, sem autenticação (HTTP 200).
- **Reconferido:** T1/2026 = 121.336 (PDF espelhado por terceiro, mesmos valores) e T2/2026 = 125.862 (HTML oficial `2026-02.htm`). A soma das 3 colunas (Capital + Grande SP + Interior) confere com o total, e o Interior confere com a soma dos 10 DEINTER.
- **Série (4º trimestre):** 2005 = 75.651; 2012 = 106.715; 2019 = 89.292; 2025 = 105.375.
- **Arquivos antigos:** `1995-01` e `1999-04` devolveram 404, apesar de listados no índice. Padrão de nome pode diferir; **não considerar indisponível**.
- **Município/delegacia:** não. O nível mais fino é DEINTER (10) + Capital + Grande SP + Interior. As bases mensais por município/delegacia (`SPDadosCriminais_AAAA.xlsx`, 2022 a 2025 no JS) contam **ocorrências**, não procedimentos.
- **Relatados/concluídos/pendentes:** nenhuma ocorrência das palavras relatad-, conclu-, remetid-, pendent-, arquiv- nos arquivos trimestrais lidos (2005, 2012, 2019, 2025).
- **Retificações:** o Manual de Interpretação da SSP (29 páginas) descreve retificações de dados "no Diário Oficial e Internet"; os arquivos trimestrais têm notas de rodapé de retificação (ex.: extorsão mediante sequestro). Ou seja, existem e a série é **revisável**.
- **Atenção territorial:** o manual explica que o IP pode ser instaurado em unidade diferente da do BO. A unidade de instauração e a do fato divergem.
- **Escopo:** "Atividades de polícia judiciária" separa boletins, termos circunstanciados e inquéritos. Existem blocos de ocorrências envolvendo policiais (civis e militares). Não confundir **produtividade da Polícia Civil** (inquéritos, TCs) com **atividade policial geral** (prisões, apreensões) no mesmo quadro.
- **Coleta automática:** viável (HTML estático + JSON de índice).

### 8.2 Paraná
- **Fontes:** `seguranca.pr.gov.br/CAPE/Estatisticas` (página testada, 200, 143 KB) leva a um **BI Qlik** (`bi2.pr.gov.br`) e a relatórios de mortes e anuário. A página não menciona "inquérito". O BI **não foi renderizado**.
- **Séries regulares:** não localizadas. PCPR publica balanços de **operações** (ex.: "Verão Maior Paraná": 1.492 instaurados no período; 95,4% concluídos e remetidos ao MP). Isso **não** é taxa estadual de conclusão: o período é curto, o escopo é de operação e a coorte nasce majoritariamente de flagrantes.
- **Digitalização:** notícia oficial informa inquéritos "100% digitais" via Celepar/PPJ-e e 77.168 inquéritos elaborados no sistema (DOCUMENTED_ONLY). Isso aponta que a fonte administrativa existe e que o DataJud TJPR (221.035 documentos da classe 279) refletirá esse fluxo.
- **PISP 2017:** PR por portaria 54.655; flagrante 43.476; não remetidos 67.357; remetidos "---" (não respondeu).

### 8.3 Espírito Santo
Cinco fontes testadas:

| Fonte | Resultado |
|---|---|
| CKAN `dados.es.gov.br`, organização SESP | 42 conjuntos (ocorrências, violência contra mulher, homicídios, microdados do Anuário 2024). **Nenhum de inquérito.** Busca `q=inquerito`: 0. |
| Observatório da Segurança, "Série histórica de dados" | Página lida; sem menção a inquérito. |
| Anuário Estadual de Segurança Pública 2023 (IJSN, 131 páginas) | 2 páginas citam inquérito, em texto: "DHPM relatou 63,1% dos inquéritos instaurados em 2022" (sem totais). |
| PCES (`pc.es.gov.br/atuacao-da-policia-civil`) | Descrição institucional; sem números. |
| Balanço da DEHPP 2025 (busca) | 796 homicídios dolosos, menor número desde 1996; sem totais de IP. |

**Conclusão ES:** sem abertura, relatados, pendentes por delegacia ou município **localizados**. O único recorte de ES disponível é o **judicial** (DataJud TJES: 93.736 documentos da classe 279, 69 municípios de órgão julgador, com Serra, Vila Velha, Vitória e Cariacica entre os maiores). Não substitui a fonte policial. Para homicídio e feminicídio, a Portaria 1.145 deve produzir dado oficial no futuro.

**Exemplos reais pedidos (abertura e conclusão/remessa):**
- SP: abertura (SSP, seção 8.1); remessa: não encontrada.
- PR: abertura e conclusão **somente de operação** (imprensa oficial).
- ES: abertura/remessa **não localizadas**; fica o exemplo PISP 2017 (instaurados 20.395; remetidos 16.996) e o judicial (DataJud).

---

## 9. Taxonomia do ciclo investigativo

Legenda: **E/S** = evento ou estado; **P/M** = procedimento ou movimentação; **Rep.** = pode ocorrer mais de uma vez; **Rev.** = reversível; **Enc.** = implica encerramento definitivo; **Comp.** = comparável entre estados; **ID** = identificador único público.

| Termo | Definição institucional (fonte) | Etapa | Instituição | E/S | P/M | Rep. | Rev. | Enc. | Comp. | ID |
|---|---|---|---|---|---|---|---|---|---|---|
| Registrado | Registro (BO) em unidade de PJ; base do INIPH (Portaria 1.145) | Pré-IP | Polícia Civil | Evento | Ocorrência | Sim (complementar) | Sim (natureza muda no IP) | Não | Parcial | BO (não público) |
| Instaurado | IP formalizado e vinculado a registro em unidade de PJ (Port. 1.145 §3º); por portaria ou flagrante (PISP) | Entrada | Polícia Civil | Evento | Procedimento | Não | Não | Não | **Parcial**: SP, PISP e Portaria alinhados em conceito; contagem por UF não auditada | Nº do IP (não público em agregados) |
| Distribuído | Distribuição ao juízo (TPU 26) | Judicial | Judiciário | Evento | Movimentação | Sim (redistribuição 36) | Sim | Não | Sim dentro do DataJud | `numeroProcesso` |
| Em andamento / pendente | Sem relato ou remessa (PISP "não remetidos"; imprensa "em andamento") | Estoque | Polícia Civil | **Estado** | Procedimento | — | Sim | Não | **Não** | — |
| Diligenciado / devolvido | Devolvido pelo juízo/MP à polícia para diligências | Entre etapas | MP/Judiciário→PC | Evento | Movimentação | **Sim** | Sim | Não | Não | — (movimento de remessa/recebimento) |
| Relatado | Relatório final da autoridade policial; condição do "concluído" | Saída policial | Polícia Civil | Evento | Procedimento | Possível (após devolução) | Sim | Não | Parcial | — |
| Concluído | Relatado e remetido ao Judiciário, mesmo que não elucidado (Port. 1.145 §2º) | Saída policial | Polícia Civil | Evento | Procedimento | Sim | Sim (devolução) | **Não** | Só homicídio/feminicídio, a confirmar | — |
| Remetido | Envio ao Judiciário/MP; PISP separa **com** e **sem** indiciamento | Saída policial | Polícia Civil | Evento | Movimentação | **Sim** | Sim | **Não** | Parcial | Movimento 982/123 no DataJud |
| Recebido (MP) | Entrada no MP; no CNMP "um retrato" soma movimentos | Tramitação MP | MP | Evento | **Movimentação** | Sim | Sim | Não | Sim no BI | — |
| Indiciado | Ato da autoridade policial atribuindo autoria; PISP: "remetidos com indiciamento" | Saída policial | Polícia Civil | Evento | Procedimento | Não | Possível | Não | Parcial | — |
| Esclarecido / elucidado | Port. 1.145 §1º: relatado e remetido com autoria+materialidade, ou inexistência de crime, ou excludentes (exceto prescrição). RJ: Res. SESEG 1.234/2018 com 24 meses. Sou da Paz: denúncia até fim do ano seguinte. | Desfecho investigativo | Polícia Civil (ou MP, conforme fonte) | Estado | Procedimento | — | Sim | Não | **Não entre fontes** (3 definições) | — |
| Solucionado | Termo coloquial; sem definição normativa localizada | — | — | — | — | — | — | — | **Não usar** | — |
| Denunciado | Oferecimento de denúncia; TPU 391 "Denúncia" no IP | Tramitação MP | MP | Evento | Procedimento | Possível | Não | Não | Só via MP | — |
| Arquivado | TPU 1063 "Determinação de arquivamento de procedimentos investigatórios"; MP promove, juiz decide | Tramitação MP/juízo | MP e Judiciário | Evento | Procedimento | Sim | **Sim (893 Desarquivamento)** | **Não** | Parcial | `numeroProcesso` |
| Reaberto | TPU 893 Desarquivamento; 849 Reativação | Pós-arquivamento | Judiciário | Evento | Procedimento | Sim | Sim | Não | Sim dentro do DataJud | idem |

Regras de uso:
- **Elucidado ≠ denunciado ≠ condenado.** A Portaria 1.145 inclui *inexistência de crime* e *excludentes* como elucidação; a definição do Sou da Paz exige **denúncia**.
- **Remessa ao MP não encerra**: pode haver devolução (14999/15000 mostram tramitação direta MP↔polícia).
- **Arquivamento é reversível** (893, 849).
- **PIC-MP (classe 1733) e inquérito civil não são IP.**

---

## 10. Indicadores efetivamente possíveis

| ID | Indicador | Viabilidade | Fonte | Observação |
|---|---|---|---|---|
| IND-OPEN-SP-QTR | IP instaurados por trimestre, SP, por macro-região | **Possível** (VERIFIED_DATASET) | SSP-SP | 1995–2026T2. Revisável. |
| IND-OPEN-UF-2017 | IP instaurados por UF e tipo (portaria/flagrante; HD/LCSM/latrocínio) | **Possível, ano único** | PISP 2017 | RO, RR, SP e outras com lacuna. |
| IND-SENT-UF-2017 | Remetidos com/sem indiciamento por UF | **Possível, ano único** | PISP 2017 | Fluxos, não coorte. |
| IND-NOTSENT-UF-2017 | "Não remetidos" por UF | **Possível, ano único** | PISP 2017 | Semântica de estoque não confirmada. |
| IND-CLEAR-RJ-COHORT | Elucidação por coorte semestral (24 meses), RJ | **Possível** | ISP-RJ | Percentual publicado; contagens só no infográfico (PDF). Letalidade violenta, homicídio, morte por intervenção, policiais mortos em serviço. |
| IND-INEH-NATIONAL | INEH/INEF/INRPH/INIPH | **Não verificável hoje** | Sinesp | Padrão existe; publicação não localizada. |
| IND-MP-MOVES | IP recebidos, denúncias, arquivamentos (movimentos) | **Parcial** | CNMP BI | Último localizado: 2021. Automação não comprovada. |
| IND-JUD-IP-DOCS | Docs classe 279 por tribunal/órgão/município/mês | **Possível** (VERIFIED_API) | DataJud | Não é instauração. Tratar data compacta. |
| IND-JUD-IP-ARCH | IPs com movimento de arquivamento/denúncia/desarquivamento | **Possível** (agregação) | DataJud | Cobre só IP com registro judicial. |
| IND-JUD-IP-DUR | Duração entre marcos judiciais | **Viável**, amostra feita | DataJud | Relógio judicial; viés de sobrevivência. |
| IND-COHORT-GENERAL | Probabilidade de conclusão de coorte de IPs (geral) | **Inviável** | — | Falta identificador/coorte. |
| IND-BACKLOG-NATIONAL | Estoque pendente por UF/delegacia, série contínua | **Inviável** | — | Só foto PISP 2017 e menções de imprensa. |
| IND-FLOW-RATIO | Concluídos do mês ÷ instaurados do mês | **Proibido** | — | Não é taxa de conclusão. |

### 10.1 Volume, estoque, fluxo, desfecho (matriz do prompt)
- **Volume:** instaurados — SP (trimestral), UF (2017), judicial (DataJud). Relatados, remetidos — só 2017 por UF. Arquivados/denunciados — MP (BI anual) e DataJud (parcial).
- **Estoque:** inicial e final, acervo por delegacia/tipo — **não localizados**.
- **Fluxo:** entradas versus saídas — SP só tem entradas; PISP 2017 tem as duas, em ano único. Tempo até remessa/conclusão — **não** disponível; tempo judicial até arquivamento — viável por amostra. Devolução para diligências — vocabulário existe (remessa/recebimento, tramitação direta), mas sem semântica comprovada de "devolução". Reaberturas — 893/849 no DataJud.
- **Desfechos:** coorte — só homicídio/feminicídio e só em RJ hoje; Sou da Paz (denúncia até ano seguinte) em 19 UFs com dados completos na edição 2024.
- **Por tipo penal:** PISP 2017 (homicídio doloso, lesão seguida de morte, latrocínio); RJ (letalidade, feminicídio); Portaria 1.145 (homicídio, feminicídio). Roubo e violência sexual: **sem fonte localizada**.

### 10.2 Regra fundamental
Nenhuma razão entre saída do mês e entrada do mês foi calculada nesta investigação. Com dados agregados de fluxo só se mede **fluxo operacional**.

---

## 11. Cobertura territorial

| Nível | Policial | Ministerial | Judicial |
|---|---|---|---|
| Nacional | PISP 2017 (UF), Portaria 1.145 (a publicar) | CNMP BI | DataJud (27 TJs) |
| UF | SP (T), RJ (elucidação), PISP 2017 (25 UFs) | BI por MP | DataJud |
| Macrorregião/DEINTER | SP (10 DEINTER) | — | — |
| Município | **Nenhuma fonte policial** | Por unidade (NT) | `codigoMunicipioIBGE` do órgão julgador (município do **juízo**) |
| Delegacia | **Nenhuma** | — | — |

Cuidado de atribuição: SP explica que o IP pode correr em unidade diferente da do fato. Delegacias regionais (DEINTER) cobrem vários municípios; **não atribuir** a produção da unidade ao município onde fica.

---

## 12. Cobertura histórica

| Fonte | Janela | Granularidade |
|---|---|---|
| SSP-SP trimestral | 1995 (alguns arquivos 404) a 2026T2 | Trimestre |
| PISP | Ano-base 2004–07, 2012, 2017 (lido), 2022, 2024 | Ano |
| ISP-RJ elucidação | 2013S1–2024S1 | Semestre (3 metodologias: Primeira versão, Resolução SESEG 1234/2018, Carta do Rio) |
| CNMP "um retrato" | 2011 a 2021 (última localizada) | Ano |
| DataJud | Sem recorte confiável antes de 2020 (histórico da P-Judiciário); datas compactas e sentinela | Evento com data/hora |
| Portaria 1.145 | 2026 em diante | — |

A série do RJ mudou de metodologia **três vezes**; comparar semestres de metodologias distintas exige nota.

---

## 13. Identificadores e relacionamentos

| Chave | Situação | Classificação |
|---|---|---|
| UF ↔ UF | PISP, SSP-SP, ISP-RJ, DataJud usam UF | `EXACT` |
| Município ↔ IBGE (DataJud) | `orgaoJulgador.codigoMunicipioIBGE`; TJTO tinha código 0 na P-Judiciário | `EXACT` (com exceções) |
| Município ↔ município policial | Sem fonte | `UNLINKED` |
| DEINTER SP ↔ municípios | Não testado | `PROBABLE` se tabela oficial existir (NT) |
| Delegacia ↔ território | Não localizado | `UNLINKED` |
| Unidade do MP ↔ município/comarca | Não testado | `UNLINKED` (NT) |
| IP (classe 279) ↔ ação penal | Sem campo de ligação | `UNLINKED` |
| IP policial ↔ IP judicial | Sem número comum em agregados | `UNLINKED` |
| Classe/Movimento TPU | Códigos estáveis nas amostras | `EXACT` |
| Vocabulários PISP ↔ Portaria 1.145 | Conceitos próximos, definições diferentes | `PROBABLE`, **não fundir** sem tabela de conversão |
| Vocabulário SP ↔ PISP | "Total de inquéritos instaurados" ↔ portaria + flagrante | `PROBABLE` |

Datas a manter separadas: instauração, movimentação, relatório, remessa, arquivamento, publicação da estatística, distribuição judicial. O DataJud só dá as de movimentação e distribuição; SP dá o trimestre de **instauração**.

---

## 14. Exemplos reais

1. **SP T2/2026:** Capital 29.614; Grande SP 20.879; Interior 75.369 (DEINTER 1–10: 7.712; 9.716; 11.461; 6.919; 5.987; 6.497; 9.535; 4.701; 9.754; 3.087); Estado 125.862.
2. **PISP 2017, ES:** 12.033 (portaria) + 8.362 (flagrante); remetidos com indiciamento 15.309; sem indiciamento 1.687; não remetidos 7.072; homicídio doloso por portaria 1.024.
3. **RJ 1º semestre 2024:** taxa de elucidação de letalidade violenta 29,3%; homicídio 24,8%; morte por intervenção de agente do Estado 49,3%; policiais mortos em serviço 100% (n pequeno). Intervalo de 24 meses; unidade é registro, não vítima.
4. **PR, operação "Verão Maior":** 1.492 instaurados, 95,4% concluídos e remetidos. **Operação, não taxa estadual.**
5. **DataJud, TJES, IP recente** (`50096570820268080021`, 2ª Vara Criminal de Guarapari, IBGE 3202405): distribuição em 19/08/2026, redistribuição, retificação de classe, conclusão, petições. Sem campo de arquivamento.
6. **CNMP 2016 (por reportagem):** 7.129.455 IP recebidos; 820.485 denúncias; 703.126 arquivamentos.

---

## 15. Arquitetura de collectors

Famílias propostas (reaproveitando o que já existe no Cívica):

| ID | Família | Formato | Exemplos |
|---|---|---|---|
| COL-HTML-STATIC | HTML estático com índice JSON | HTML | SSP-SP trimestral |
| COL-CSV-OPEN | CSV aberto | CSV | ISP-RJ `base_elucidacao.csv` |
| COL-DATAJUD-AGG | Agregação DataJud (classe × movimento × órgão × mês) | API | 27 TJs; limitador obrigatório |
| COL-PDF-MANUAL | Extração de PDF/anuário, carga assistida | PDF | PISP, anuários |
| COL-BI-EMBED | BI embarcado (Tableau/Qlik/Power BI) | JS | CNMP, PR; **não estimado**; só com teste de exportação |
| COL-PER-MP | Consulta por MP | Formulário | MPDFT, MPGO, MPBA, MPAL, MPF |

| | **A. Nacional centralizado** | **B. Nacional + complementos estaduais** | **C. Cobertura estadual ampliada (27 UFs)** |
|---|---|---|---|
| Cobertura territorial | 27 UFs só no judicial; policial: 1 ano (PISP 2017) | Igual à A + SP, RJ (e outras se localizadas) | Teórica 27; comprovada: 2 |
| Granularidade | UF; município judicial | UF; macrorregião SP; município judicial | Dependente; sem evidência municipal policial |
| Profundidade histórica | PISP anual esparso; DataJud pós-2020 | + SP desde 1995; RJ desde 2013 | Desconhecida |
| Fontes | 3–4 | 5–6 | 27+ |
| Famílias de collector | 3 (DATAJUD-AGG, PDF-MANUAL, BI-EMBED) | 4–5 (+ HTML-STATIC, CSV-OPEN) | 6, com 1 adaptador por formato por UF |
| Complexidade | Baixa/Média | Média | Alta |
| Volume | Pequeno (agregados) | Pequeno | Médio |
| Manutenção | Baixa | Média (SP é revisável; RJ muda metodologia) | Alta |
| Lacunas | Sem fluxo contínuo policial nacional | Cobre só UFs verificadas | **Promessa de cobertura nacional não sustentada por evidência** |

**Recomendação:** B. Não prometer cobertura nacional de fluxo policial. Reavaliar quando o Sinesp publicar o INEH (homicídio/feminicídio), que seria o primeiro dado nacional contínuo com definição única.

---

## 16. Oportunidades de produto

Somente o que as fontes permitem **hoje**:

1. **Perfil estadual de SP:** instaurados por trimestre e macrorregião, série 1995–2026 (com nota de revisão e de que não é produtividade total).
2. **Panorama nacional "o que se sabe, o que não se sabe":** matriz 27 UFs × etapa do fluxo com o status da seção 7. A honestidade da cobertura **é** o produto.
3. **Ficha de elucidação do RJ por coorte**, com a explicação dos 24 meses e das três metodologias.
4. **Judiciário × investigação:** IPs registrados na Justiça por comarca/município, linha do tempo de marcos (arquivamento, denúncia, desarquivamento, tramitação direta MP↔polícia), sempre como "o que o Judiciário vê".
5. **Glossário interativo** (seção 9): "esclarecido ≠ denunciado ≠ condenado".
6. **Monitor do INEH:** página que fica vazia até a publicação, com a Portaria, as fórmulas e o prazo de 180 dias.
7. **Fluxo conceitual** `Instaurado → Em investigação → Relatado → MP → Denúncia / Arquivamento`: cada seta aparece **apenas** onde há dado e semântica (hoje: setas isoladas por UF/etapa, nenhuma sequência completa).

**Não propor:** ranking de eficácia policial entre UFs, "taxa de conclusão" mensal, mapa municipal de inquéritos policiais, perfil de delegacia.

---

## 17. Lacunas

1. Estoque pendente contínuo em qualquer UF.
2. Município e delegacia em qualquer fonte policial pública localizada.
3. Publicação pública do INEH/INIPH/INRPH e do anexo da Resolução ConSinesp 10/2025.
4. PISP 2022 e 2024 (arquivos).
5. Automação das exportações do Tableau do CNMP.
6. Qualquer informação de roubo e violência sexual por fase do IP.
7. Linkagem IP↔AP.
8. Denominador do DataJud fora de SP.
9. Retificações da SSP-SP não catalogadas.
10. 25 UFs sem fonte estadual verificada.

---

## 18. Próximos experimentos

| ID | Experimento | Objetivo |
|---|---|---|
| NEXT-1 | Obter PISP 2022 (e 2024) por canal alternativo (navegador, LAI) e extrair as tabelas de IP | Segundo ponto da série por UF |
| NEXT-2 | Extrair as tabelas PISP 2017 completas (2.16–2.20 + por tipo) para um dataset estruturado | Base de comparação inicial |
| NEXT-3 | Medir o DataJud: razão IP/denúncia por tribunal, formato de data (compacto × ISO) e custo/limite de requisições | Contrato "documento ≠ procedimento" |
| NEXT-4 | Testar Tableau do CNMP "um retrato" com cliente headless para extrair "IP recebidos/denúncias/arquivamentos" | Resolver BLOCKED |
| NEXT-5 | Pedir por LAI ao Senasp a série INEH/INIPH/INRPH e o anexo da Res. ConSinesp 10/2025 | Fonte nacional |
| NEXT-6 | Varredura de PDFs e anuários de SC, GO, BA, PE, CE, DF, MG, RS (anuário/relatório de gestão) | Fechar o quadro dos 25 UFs |
| NEXT-7 | Tabela oficial DEINTER→município (SSP-SP) | Elevar vínculo de `PROBABLE` a `EXACT` |
| NEXT-8 | Reprodutibilidade do `base_elucidacao.csv` (contagens do infográfico) | Obter numerador/denominador |
| NEXT-9 | Testar se o `.htm` trimestral de SP antigo (1995–1999) existe sob outro nome | Fechar histórico |
| NEXT-10 | Teste de consulta por MP (MPDFT) para ver se há paginação e volume | Avaliar COL-PER-MP |

---

## 19. Gates

| Gate | Estado | Justificativa |
|---|---|---|
| `P2_NATIONAL_SOURCE_DISCOVERY` | **PASS_WITH_CAVEATS** | Fontes nacionais e novas localizadas (PISP, Portaria 1.145, CNMP, DataJud, ISP-RJ, Sou da Paz, Adepol, MPs); lacunas de acesso. |
| `P2_CNMP_VERIFICATION` | **PARTIAL** | Árvore de BIs verificada; seção "Inquérito Policial e andamento" é por MP; ELO refutado; Tableau sem automação provada; última edição localizada 2021. |
| `P2_SENASP_VERIFICATION` | **PARTIAL** | Portaria 1.145 e PISP 2017 verificados; PISP 2022/2024 não obtidos; INEH sem publicação localizada; VDE sem IP. |
| `P2_DATAJUD_LINKAGE` | **PARTIAL** | Classes e movimentos verificados em 27 TJs; defeito de data; denominador só em SP; ligação IP↔AP inexistente. |
| `P2_STATE_COVERAGE` | **PARTIAL** | 27 UFs com linha explícita; só SP e RJ com arquivo verificado; ES testado em 5 fontes sem IP. |
| `P2_INVESTIGATION_SEMANTICS` | **PASS_WITH_CAVEATS** | Matriz de 15 termos com definição oficial (Port. 1.145) e vocabulário TPU; comparabilidade entre estados não demonstrada. |
| `P2_OPENING_COUNTS` | **PARTIAL** | SP trimestral verificado; UF só em 2017. |
| `P2_COMPLETION_COUNTS` | **PARTIAL** | PISP 2017 (remetidos), RJ (coorte, homicídio); PR só operação. |
| `P2_BACKLOG_COUNTS` | **PARTIAL** (tendendo a BLOCKED para série contínua) | PISP 2017 "não remetidos" e imprensa; nenhuma série. |
| `P2_TERRITORIAL_GRANULARITY` | **PARTIAL** | Município só no órgão julgador (judicial); policial: DEINTER em SP; delegacia: nenhuma. |
| `P2_HISTORICAL_COVERAGE` | **PARTIAL** | SP desde 1995 e RJ desde 2013; demais, anos isolados. |
| `P2_COLLECTOR_FEASIBILITY` | **PASS_WITH_CAVEATS** | Cenário B viável (SP, RJ, DataJud, PISP); cenário C sem evidência; BIs embarcados não estimáveis. |

---

## 20. Inventário de evidências e consultas

| ID | Consulta | Resultado |
|---|---|---|
| EV-SP-IDX | `GET https://www.ssp.sp.gov.br/assets/estatistica/trimestral/dadosTrimestral.json` | 200, 17 KB, 32 anos |
| EV-SP-2602 | `GET .../trimestral/arquivos/2026-02.htm` | 200, 91 KB; 125.862 |
| EV-SP-PDF-Q1 | PDF do 1º tri/2026 (espelho de terceiros) | 200; 121.336 |
| EV-SP-HIST | `.../arquivos/{2005-04,2012-04,2019-04,2025-04}.htm` | 200 (4); `1995-01`, `1999-04`: 404 |
| EV-SP-MANUAL | Manual de Interpretação (29 p.) | 200; trecho sobre IP e unidade |
| EV-SP-SPA | `/main.*.js` | endpoints `assets/estatistica/*` identificados |
| EV-PISP17 | `.../download/pesquisa-perfil/relatorio_pesquisa_perfil_anobase_2017.pdf` (206, 10,8 MB, 228 p.) | tabelas 2.16–2.20 |
| EV-PISP24 | `.../pesquisaperfil/pisp-ano-base-2024.pdf` | login redirect (3 tentativas) |
| EV-PORT1145 | `bibliotecadigital.mj.gov.br/bitstream/1/16686/2/PRT_GM_2026_1145.pdf` | 200, texto lido |
| EV-VDE | página VDE 2022–2023 | 200; só 3 menções a IP (metodologia) |
| EV-CNMP-BI | `/portal/transparencia/relatorios-em-bi` | 200; 40 painéis |
| EV-CNMP-ELO | `elo.cnmp.mp.br/.../resolucao110.seam` | 200; filtro por conselheiro |
| EV-CNMP-TABLEAU | Tableau Public (embed 200; `.csv` 404; WAF) | automação não provada |
| EV-MPS | MPF, MPDFT, MPGO, MPBA, MPAL | 200; páginas de consulta |
| EV-MPPR | `ords.mppr.mp.br/ords/f?p=121:2` | inquérito **civil** |
| EV-DJ-27 | 27 aliases, `term classe.codigo=279` | 200 nos 27 |
| EV-DJ-ES | agregações TJES (classes, movimentos, municípios) | 200; vocabulário |
| EV-DJ-SP | contagens TJSP T1/T2 2026 por range | 59.372; 69.069 |
| EV-DJ-429 | rajada de agregações | HTTP 429 |
| EV-RJ-CSV | `ispdados.rj.gov.br/Arquivos/base_elucidacao.csv` | 200, 1.344 B, 24 linhas |
| EV-RJ-PDF | `infografico_taxa_elucidacao_resultado.pdf` | 200, 2 páginas |
| EV-ES-CKAN | `dados.es.gov.br/api/3/action/package_search` | 200; 42 datasets; `q=inquerito`: 0 |
| EV-ES-ANU | Anuário IJSN 2023 | 200; 2 páginas, texto |
| EV-PR-CAPE | `seguranca.pr.gov.br/CAPE/Estatisticas` | 200; BI Qlik (não renderizado) |
| EV-DF-APR | apresentação SSP-DF (70 p.) | 200; 2016, "produtividade PCDF" |
| EV-UF-LANDING | 12 páginas estaduais de estatística | 7 com 200; 0 menções a "inquérito" na página de entrada; 404 em SC, PE, PA; 1 sem resposta (CE) |
| EV-PRESS | Buscas sobre Adepol, GO, BA, PE, MS, MT, PA, MA, DF, Sou da Paz, Portaria 1.145 | resultados de imprensa; `DOCUMENTED_ONLY` |

Limites respeitados: consultas pequenas, sem autenticação, sem contornar WAF, sem acesso a sistemas internos, sem dados individuais. Chave do DataJud é a pública da Wiki; não foi reproduzida em arquivo do repositório.
