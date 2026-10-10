# Investigação nacional do Poder Executivo para o Cívica

**Data:** 2026-10-09. **Modo:** somente investigação. Nenhum código de aplicação, migration, schema, job ou frontend foi alterado. Foram feitas amostragens HTTP pequenas, leitura de alguns arquivos nacionais (listados na seção 17) e leitura do repositório. Os arquivos baixados e os scripts de teste ficaram fora do repositório e foram descartados.
**Companheiro:** `investigacao_executivo_fontes.json` (26 fontes, famílias de coleta e vínculos demonstrados).

**Níveis de evidência:** `VERIFIED_API`, `VERIFIED_DATASET`, `DOCUMENTED_ONLY`, `INFERRED`, `BLOCKED`, `UNAVAILABLE`, `NOT_EVALUATED`. Métricas sem denominador conhecido ficam como `NOT_MEASURED`.

**Recortes de validação** (códigos IBGE oficiais): Brasil; ES (32); Vitória (3205309); Alto Rio Novo/ES (3200359, 7.760 hab., escolhido como município pequeno do ES); São Paulo (3550308); Belém/PA (1501402, escolhida como outra região, Norte). **Esses recortes não sustentam extrapolação nacional.** Quando um número é nacional, ele veio da própria fonte (`content-range`, `totalElements`, `totalRegistros`, arquivo lido por inteiro). Quando veio de amostra, o tamanho aparece ao lado.

---

## 1. Resumo executivo

1. **Dá para cobrir o Brasil inteiro (5.571 unidades municipais, 26 UFs e a União) com 8 famílias de coleta**, e a maior parte tem acesso aberto, sem chave, verificado hoje. Siconfi, PNCP, Obrasgov, DEMAS/Saúde, Transferegov, Portal da Transparência (CSV), INEP, Sinesp e TSE responderam com dados reais.
2. **A cadeia completa "governo → órgão → orçamento → despesa → contrato → fornecedor → obra → entrega → resultado" não fecha de ponta a ponta com dados abertos.** Há elos exatos isolados (seção 9), mas **nenhuma fonte nacional traz pagamento por credor para estados e municípios**. O Siconfi para em contas agregadas por ente, função e fonte. Os portais de transparência de cada ente seguem sendo a única fonte de empenho/pagamento por credor (essa necessidade é uma inferência, não foi testada ente a ente).
3. **Obras:** o Obrasgov tem ≈128.948 projetos (ES ≈1.879). Em 500 projetos amostrados nacionalmente, **0 eram exclusivamente municipais**: 475 federais, 23 estaduais, 2 federal+municipal. A lacuna de obras com recurso próprio de município é real, e **nenhuma base complementar nacional foi encontrada**. Isso não prova que elas não existam; só que não foram achadas.
4. **Saúde é o domínio mais rico em granularidade por estabelecimento** (CNES, leitos, SIA, SIH, Previne, com chave exata). O gargalo é operacional: observamos limite de 20 registros por página em `/cnes/estabelecimentos`.
5. **Educação tem perfil de escola viável** (Censo 2025: 214.192 linhas, 290 colunas; Ideb por escola 2005–2023). Mas **escolas públicas não têm CNPJ no Censo**, então despesa e transferência só se ligam à escola por código Inep, e nenhuma fonte de despesa por escola foi comprovada (FNDE: BLOCKED).
6. **Segurança:** o Sinesp VDE é arquivo anual (2025: 832.293 linhas, mensal, por município) **sem código IBGE**, só UF + nome. O vínculo territorial é `PROBABLE`.
7. **Conflitos de dados achados:** população de Vitória 2026 é 343.935 no SIDRA e 343.378 no Siconfi `/entes`; e nas demonstrações Siconfi a população embutida varia por ano. Per capita exige uma única fonte (IBGE).
8. **O que pedir ao produto (MVP 1):** 4 famílias (F0 referência, F1 Siconfi, F2 Portal/Transferegov, F3 PNCP) já sustentam finanças e contratos nacionais, com cobertura territorial verificável.

## 2. Descobertas mais importantes

| # | Descoberta | Evidência |
|---|---|---|
| 1 | Siconfi `/entes` lista **5.598 entes** (5.570 M + 26 E + 1 DF + 1 União), todos com CNPJ único. Isso dá a **ponte IBGE ↔ CNPJ** de todos os entes. | `VERIFIED_API` |
| 2 | Siconfi DCA 2023: **34/34** entes da amostra têm dados. | `VERIFIED_API` (n=34) |
| 3 | Siconfi RREO 2025 bimestre 3: **21/34** com dados; os 13 vazios têm até 33.726 hab., mas há municípios de 5,7 mil e 5,9 mil com dados. Zero registros ≠ zero despesa. Periodicidade semestral é hipótese. | `VERIFIED_API` + `INFERRED` |
| 4 | PNCP: **116.210** contratos publicados em jan/2025 e **175.646** em set/2026. Em jun/2021 a janela devolve 204 (vazia). Todo contrato amostrado (500) traz `niFornecedor` e `codigoIbge`. | `VERIFIED_API` |
| 5 | CNPJ do órgão do contrato = CNPJ do ente no Siconfi em apenas **71 de 107** contratos municipais amostrados (66%). O resto são fundos, autarquias e câmaras. Para esses vale o `codigoIbge` do próprio contrato. | `VERIFIED_API` (n=107) |
| 6 | Obrasgov: `totalElements` do endpoint de projetos **não é confiável** (devolve o tamanho da página). O total foi obtido por busca binária de páginas. O filtro por município foi ignorado; só `uf` funciona. | `VERIFIED_API` |
| 7 | DEMAS/Saúde expõe **113 recursos** em uma API única (CNES, leitos, equipamentos, profissionais, SIA, SIH, SIM, SINASC, Previne Brasil, vacinação, SISAGUA). | `VERIFIED_API` |
| 8 | O Portal da Transparência serve ZIPs mensais abertos (redirecionados para `dadosabertos-download.cgu.gov.br`). Despesas 2026-09: 65.634 linhas **agregadas** (UG × ação × elemento), sem NE e sem credor. Transferências 2026-08: 144.356 linhas com CNPJ do favorecido. | `VERIFIED_DATASET` |
| 9 | Censo Escolar 2025: 5.571 municípios; dependência 728 federal / 33.561 estadual / 128.145 municipal / 51.758 privada; 29.780 paralisadas e 3.872 extintas dentro do total. | `VERIFIED_DATASET` |
| 10 | Sinesp VDE 2025 tem 5.597 pares (UF, nome) distintos (> 5.571 municípios). Isso mostra variação de grafia e/ou entradas não municipais. | `VERIFIED_DATASET` |
| 11 | TSE 2024: 5.563 linhas de prefeito eleito, 5.552 UEs distintas, 78 no ES (= 78 municípios do ES). Dá a base de mandatos. | `VERIFIED_DATASET` |
| 12 | Querido Diário, SIOPS, FNDE (dados), FNS (dados), Atlas da Violência (API) e Receita (CNPJ aberto) **não puderam ser provados** (seção 10). Nenhum foi classificado como indisponível. | `BLOCKED` |

## 3. Inventário de fontes nacionais

Classificação em seis camadas (`SOURCE_SYSTEM` → `PROVIDER` → `COLLECTOR_FAMILY` → `ENDPOINT` → `DATASET` → `PIPELINE`) está no JSON. Resumo:

| Fonte | Provider | Acesso | Status |
|---|---|---|---|
| IBGE Localidades / SIDRA | IBGE | REST aberto | `VERIFIED_API` |
| Siconfi (ORDS) | Tesouro | REST aberto, paginado | `VERIFIED_API` |
| Portal da Transparência (CSV) | CGU | ZIP aberto (302 → CGU) | `VERIFIED_DATASET` |
| Portal da Transparência (API) | CGU | exige chave (401) | `BLOCKED` |
| PNCP Consulta v1 | Gestão/SERPRO | REST aberto | `VERIFIED_API` |
| Compras.gov.br Dados Abertos | Gestão | REST aberto (77 paths, `codigoOrgao` obrigatório) | `VERIFIED_API` |
| Obrasgov | Gestão | REST aberto | `VERIFIED_API` |
| Transferegov especiais / fundo a fundo / TED | Gestão | PostgREST aberto | `VERIFIED_API` |
| Convênios / contratos de repasse | Gestão | **não localizado** em API (404 em 8 nomes testados) | `BLOCKED` |
| DEMAS Saúde (CNES, SIA, SIH, SISAB, SIM…) | Min. Saúde | REST aberto | `VERIFIED_API` |
| SIOPS / FNS (dados) | DATASUS/FNS | página; dados não provados | `BLOCKED` |
| Censo Escolar | INEP | ZIP aberto | `VERIFIED_DATASET` |
| Ideb | INEP | XLSX aberto | `VERIFIED_DATASET` |
| SIOPE / FNDE dados | FNDE | página 200; dados não localizados; catálogo exige token | `BLOCKED` |
| Sinesp VDE | MJSP | XLSX anual (exige User-Agent de navegador) | `VERIFIED_DATASET` |
| Atlas da Violência | IPEA | API não localizada (404) | `BLOCKED` |
| SNIS / SINISA | MCid | app web + ZIPs de planilhas; API não provada | `DOCUMENTED_ONLY` |
| TSE dados abertos | TSE | CKAN + CDN | `VERIFIED_DATASET` |
| SIORG | Gestão | serviço vivo, parâmetros não explorados | `DOCUMENTED_ONLY` |
| Querido Diário | OKBR | falha de handshake TLS neste host | `BLOCKED` |
| CNPJ aberto (RFB) / BrasilAPI | RFB / terceiro | RFB timeout; BrasilAPI unitário 200 | `BLOCKED` |
| ANEEL, ANTT, DNIT, SIOP, TCU, TCEs, portais estaduais | vários | não avaliados | `NOT_EVALUATED` |

**Fontes não previstas no prompt que entraram:** Compras.gov.br, TSE (mandatos), DEMAS (que absorve CNES, SIA, SIH, SISAB e SISAGUA numa só API), Querido Diário, SIORG e BrasilAPI.

**"Existe base mais completa que junte tudo?"** Pelo que foi testado, **não há uma base única**. A API DEMAS é a que mais concentra um domínio (saúde). O Portal da Transparência concentra o federal, e o Siconfi concentra entes. Plataformas agregadoras (Base dos Dados, Atlas) não foram usadas: a Base dos Dados exige credencial e a API do Atlas devolveu 404.

## 4. Dados efetivamente disponíveis por domínio

Legenda de cobertura: F federal, E estadual, M municipal, Est estabelecimento.

### 4.1 Infraestrutura e obras
- **Existe (Obrasgov):** id único, nome, descrição, espécie, natureza, situação, datas previstas e efetivas, tomador/executor/repassador (com CNPJ), eixo/tipo/subtipo, fontes de recurso (origem + valor previsto), geometria WKT (SIRGAS 2000) por endpoint próprio, execução física (percentual, situação, paralisações/cancelamentos, documentos) e execução financeira (empenho, NE, UG, PTRES, natureza de despesa, autor de emenda).
- **Cobertura:** ≈128.948 projetos no Brasil e ≈1.879 no ES. Execução física: 71.192 registros; financeira: 20.752 registros (não equivalem a projetos distintos).
- **Lacuna do pedido:** não aparecem **valor contratado**, **valor liquidado/pago** nem **empresa executora** nos campos amostrados. A execução financeira só traz empenho. O vínculo com contrato exigiria PNCP/Compras (seção 9, L5).
- **Obra exclusivamente de recurso próprio (pergunta crítica):** amostra nacional de 500 projetos em 5 páginas espalhadas: 475 Federal, 23 Estadual, 2 Federal+Municipal, **0 somente Municipal**. Um filtro `origem` não foi testado. Quantas obras exclusivamente municipais ficam fora: `NOT_MEASURED` (não há denominador). O PNCP traz contratos de obras (`categoriaProcesso`) e é o único candidato nacional encontrado para reduzir a lacuna, mas ele só cobre o que foi licitado por PNCP.
- **Deduplicação entre fontes:** o `idUnico` do Obrasgov é a única chave de projeto. Não há chave comum com PNCP; o vínculo é `PROBABLE`.

### 4.2 Educação
- **Censo Escolar 2025** (Tabela_Escola, 290 colunas): identidade (`CO_ENTIDADE`), localização (UF/município/distrito, `TP_LOCALIZACAO`), dependência, situação, infraestrutura (internet, biblioteca, laboratório, acessibilidade, salas, equipamentos), profissionais por categoria, vínculos com secretarias, parcerias com poder público. Matrículas, docentes, turmas e gestores estão em tabelas separadas (não lidas).
- **Cobertura:** 5.571 municípios; ES 3.847 escolas (3.176 públicas); Vitória 226 (125 públicas). Séries 1995–2025 listadas; só 2025 lido.
- **Ideb:** escolas anos iniciais 2023 com 64.921 linhas; 2005–2023 no cabeçalho; Ideb 2025 consta na página, mas o arquivo no padrão de URL não existe (próximo experimento).
- **Perfil individual de escola pública:** viável. Chave `CO_ENTIDADE`/`ID_ESCOLA`. **Escola pública não tem CNPJ** na base.
- **Despesa por escola:** não comprovada (FNDE BLOCKED).

### 4.3 Saúde
Distinção pedida:

| Dimensão | Fonte comprovada | Granularidade |
|---|---|---|
| Capacidade cadastrada | `cnes-leitos`, `cnes-equipamentos`, `cnes-profissionais`, `cnes/estabelecimentos` | Est × competência mensal |
| Capacidade disponível | `qt_sus`, `qt_uso`, `disp_sus` nos campos de leitos/equipamentos | Est |
| Produção | `sia-procedimentos-ambulatoriais`, `sih-procedimentos-hospitalares` | Est × procedimento × competência |
| Acesso | indicadores do Previne Brasil | município × quadrimestre |
| Resultado | SIM (mortalidade), SINASC | SIM funciona sem filtro, SINASC veio vazio |

- Em Alto Rio Novo: 19 estabelecimentos CNES e 0 registros SIH 2025 (município sem hospital, mas isso é inferência).
- Leitos de Vitória 202608: vazio, 202208: com dados. A defasagem de competência não foi medida.
- Restrito: SIH/SIA aparecem sem dados identificáveis de paciente (não verificado o conteúdo completo).
- Transferências FNS: via Portal (CSV de transferências). A API FNS não foi provada.

### 4.4 Segurança pública
- **Sinesp VDE 2025:** 832.293 linhas, 27 UFs, jan–dez/2025, mensal, por município e evento. Abrangência: 689.880 estadual, 73.893 Polícia Federal, 68.520 PRF. Eventos incluem homicídio doloso, feminicídio, latrocínio, tentativa de homicídio, morte por intervenção de agente do Estado, suicídio, mandados de prisão cumpridos, apreensões, desaparecidos.
- **Não achado:** efetivo policial, orçamento (só via Siconfi função 06), sistema prisional (Senappen) e unidades policiais. `NOT_EVALUATED`.
- **Padronização entre estados:** os dados existem na mesma planilha, mas as metodologias estaduais diferem. O arquivo traz coluna `abrangencia`. Comparar UFs sem nota metodológica seria incorreto.
- **Cuidado:** eventos raros aparecem com 648 linhas (poucas unidades). Ausência de linha não é zero.

### 4.5 Finanças públicas
Resposta à **questão fundamental**:

- **Menor granularidade no Siconfi (comprovada):** linha de demonstrativo (conta × coluna) por ente e período; na MSC, conta contábil × poder/órgão × função/subfunção × fonte (campos muitas vezes nulos) por mês. **Não há pagamento individual, credor nem NE.** Isso `VERIFIED_API` em DCA, RREO e MSC.
- **Orçamento × empenho × liquidação × pagamento:** o RREO Anexo 02 traz colunas de dotação inicial, atualizada e execução (empenhado/liquidado/pago), por função/subfunção. Para o federal, o Portal traz empenhado/liquidado/pago/RAP por UG × ação × elemento.
- **Para o que exigiria portal de transparência específico:** pagamento por credor, NE, processo e licitação de estados e municípios.
- **Cobertura histórica:** só DCA 2023, RREO 2024–2025 e MSC 2024 foram consultados. Histórico completo `NOT_MEASURED`.
- **Per capita:** denominador deve ser IBGE; Siconfi tem conflito (resumo, item 7; JSON `ibge_sidra`).

### 4.6 Licitações, contratos e fornecedores
- PNCP traz: órgão (CNPJ, esfera, poder), UASG, município/UF/IBGE, objeto, modalidade, valores (inicial, parcela, global, acumulado), vigência, tipo de contrato (inclui "Empenho"), categoria, fornecedor (`niFornecedor`, razão social, tipo de pessoa), subcontratado, emenda parlamentar, parcelas.
- **Itens e aditivos:** os endpoints de itens/atas/aditivos não foram abertos nesta rodada (`NOT_EVALUATED`). Campos `numeroRetificacao` e `valorAcumulado` indicam versionamento.
- **Retroatividade:** jun/2021 vazio. Janelas anteriores a 2023 não foram medidas, então não se pode afirmar completude histórica.
- **Publicação ≠ execução financeira:** nenhum campo de pagamento no contrato.
- **Cobertura por esfera (amostra n=500, jan/2025):** F 308, E 83, M 107, N 2.
- **Volume de contratações no 1º trim. 2025 (modalidades 6 e 8):** Vitória 532/633, Alto Rio Novo 7/16, São Paulo 3.559/2.836, Belém 466/462. Isso mostra presença do município no PNCP, **não completude**: o denominador legal é desconhecido.

### 4.7 Transferências e convênios
- **Transferegov Especiais:** já coletado pelo Cívica (`docs/investigacoes/emendas-pix.md`, `docs/contracts/emendas-pix.md`). Contagem reconfirmada hoje: 57.827 planos.
- **Fundo a fundo:** 25.972 planos, 31.026 beneficiários, 23.885 termos, 1.115.444 lançamentos financeiros (só contagens).
- **TED:** 6.176 planos e 4.905 termos, pouco relevante para município.
- **Convênios e contratos de repasse (a parte discricionária):** `BLOCKED` (nenhuma base PostgREST comprovada). Proximo experimento: baixar o ZIP `download-de-dados/convenios`.
- **Transferências constitucionais e legais:** o CSV `transferencias` do Portal cobre (FPE, FPM etc.), com CNPJ do favorecido e município SIAFI.
- **Ligação Legislativo ↔ Executivo:** o Obrasgov traz `autorEmenda` nas execuções financeiras e o PNCP traz `emendaParlamentar`. Ambos viraram candidatos de ligação a `budget_amendments`, sem teste de cruzamento.

### 4.8 Saneamento
- **SNIS/SINISA:** `DOCUMENTED_ONLY`. O app Série Histórica (`app4.cidades.gov.br/serieHistorica`) responde, mas é formulário (sem API provada). Há ZIPs de diagnósticos (Água e Esgoto 2023, Resíduos 2022).
- **SISAGUA via DEMAS:** população abastecida e tratamento de água, `VERIFIED_API` (1 registro lido).
- **Cobertura de água/esgoto/resíduos por município:** `NOT_MEASURED`.

## 5. Cobertura federal, estadual e municipal

| Fonte | Federal | Estadual | Municipal | Observação |
|---|---|---|---|---|
| Siconfi | sim (U) | 26 E + DF | 5.570 M | 1 consulta por ente |
| Portal (despesas) | sim | UF do local | município muitas vezes vazio | |
| Portal (transferências) | origem | favorecido (UF) | favorecido (município SIAFI) | |
| PNCP | 308/500 | 83/500 | 107/500 (amostra) | cobertura efetiva não medida |
| Compras.gov | sim | não | não | |
| Obrasgov | origem federal | 4,6% da amostra | 0,4% (federal+municipal) | |
| DEMAS | n/a | gestão E | gestão M | tipo de gestão por estabelecimento |
| Censo Escolar | 728 escolas | 33.561 | 128.145 | + 51.758 privadas |
| Sinesp | PF/PRF | sim | por município | |
| TSE | Presidente/Gov. (não lido) | idem | 5.563 eleitos | |

**Cobertura territorial dos seis recortes:**

| Fonte (teste) | Vitória | Alto Rio Novo | São Paulo | Belém | ES | Brasil |
|---|---|---|---|---|---|---|
| Siconfi extrato 2024 (entregas) | 39 | 37 | 55 | 39 | n/t | 5.598 entes |
| Siconfi DCA 2023 | 307 itens | 158 | 414 | 214 | n/t | amostra 34/34 |
| Siconfi RREO 2025/3 | 467 | **0** | 661 | 510 | n/t | amostra 21/34 |
| PNCP contratações 2025T1 (mod. 6) | 532 | 7 | 3.559 | 466 | n/t | 175.646 contratos (set/2026) |
| CNES (1ª página) | 20 | 19 (total) | 20 | 20 | limite 20/pág. | n/t |
| SIH 2025 | sim | 0 | sim | sim | n/t | n/t |
| Previne | sim | sim | sim | sim | n/t | n/t |
| Obrasgov | n/t | n/t | 100 (1ª pág.) | 96/100 com tomador/exec. | ≈1.879 | ≈128.948 |
| Censo 2025 (escolas) | 226 | n/t | n/t | n/t | 3.847 | 214.192 |

n/t = não testado. Zero (Alto Rio Novo RREO/SIH) **não** é erro de coleta comprovado.

## 6. Resultados dos testes reais de APIs

(Detalhes de URL, parâmetros e contagens estão na seção 17 e no JSON.)

| Fonte | Método e endpoint | Status | Paginação | Filtro temporal | Filtro territorial | Amostra |
|---|---|---|---|---|---|---|
| IBGE localidades | GET `/localidades/estados/32/municipios` | 200 | n/a | n/a | por UF | ok |
| SIDRA | GET `/values/t/6579/n6/3205309,3205002/v/9324/p/last` | 200 | n/a | `p/last` | município | Vitória 343.935 (2026) |
| Siconfi entes | GET `/tt/entes` | 200 | `hasMore`, `limit` 6000 | n/a | n/a | 5.598 itens |
| Siconfi DCA | GET `/tt/dca?an_exercicio&no_anexo&id_ente` | 200 | `hasMore` | `an_exercicio` | `id_ente` | Vitória 307 linhas (DCA-Anexo I-C) |
| Siconfi RREO | GET `/tt/rreo?…&nr_periodo&co_tipo_demonstrativo&no_anexo` | 200 | idem | exercício/período | `id_ente` | Vitória 467 |
| Siconfi MSC | GET `/tt/msc_orcamentaria` | 200 | idem | exercício/mês | `id_ente` | itens de conta 6.22… com `poder_orgao` |
| PNCP contratos | GET `/api/consulta/v1/contratos?dataInicial&dataFinal&pagina&tamanhoPagina` | 200 / 204 | `totalPaginas`, 500/página aceito | por publicação | sem filtro municipal direto | 116.210 em jan/2025 |
| PNCP contratações | GET `/contratacoes/publicacao?…&codigoModalidadeContratacao&codigoMunicipioIbge` | 200 | idem | idem | município IBGE | Vitória 532 |
| Obrasgov | GET `/obrasgov/api/projeto-investimento?pagina&tamanhoDaPagina&uf` | 200 | Spring pageable | sem filtro de data | só `uf` | 128.948 (busca binária) |
| Obrasgov exec. | GET `/execucao-financeira?idUnico=`, `/execucao-fisica?idUnico=` | 200 | idem | n/a | por projeto | 9 fin. / 1 fís. no projeto testado |
| Obrasgov geometria | GET `/geometria?idUnico=` | 200 (400 sem id) | n/a | n/a | por projeto | POINT (-40.33778 -20.31944) |
| Transferegov | GET `/{base}/{tabela}?limit=1` + `Prefer: count=exact` | 206 | offset, 1.000 | n/a | n/a | contagens de 3 bases |
| DEMAS CNES | GET `/cnes/estabelecimentos?limit&offset&codigo_municipio` | 200 | offset; **limite efetivo 20** | n/a | `codigo_municipio` (6 dígitos) ou `codigo_uf` | 19 em Alto Rio Novo |
| DEMAS leitos/SIH/SIA/Previne | ver JSON | 200 | offset | `nu_comp`/`nu_ano` | `co_ibge` / `codigo_municipio` | amostras de Vitória |
| Portal CSV | GET `/download-de-dados/despesas-execucao/202609` | 302 → 200 | arquivo | mês | n/a | 65.634 linhas |
| INEP | GET (ZIP/XLSX) | 200 | arquivo | ano | n/a | ver 4.2 |
| Sinesp | GET XLSX | 200 com UA de navegador, 403 sem | arquivo | ano | por município (nome) | 832.293 linhas |
| TSE | GET ZIP | 200 | arquivo | eleição | UE TSE | 463.877 linhas |

**Comportamento diante de erros observado:**
- Transferegov (repo) já trata Cloudflare: HEAD recebe 403; é preciso `User-Agent` identificável.
- Sinesp: 403 sem UA de navegador.
- Obrasgov: swagger `/obrasgov/v3/api-docs` devolve 404; `geometria` sem id devolve 400.
- Compras.gov: omitir `codigoOrgao` devolve 404 "Resource not found", mensagem enganosa para parâmetro obrigatório.
- Portal: alguns datasets deram 500/403 sob o UA do teste (sem diagnóstico).
- **Observação sobre download:** o ZIP do Censo Escolar 2025 tinha 537 MB (HEAD indicou o tamanho; baixei mesmo assim para ler a tabela de escolas). Para os próximos anos, usar HEAD + Range e ler só o necessário.

## 7. Séries históricas e periodicidade

| Fonte | Periodicidade | Mais antiga confirmada | Mais recente confirmada |
|---|---|---|---|
| Siconfi | anual/bimestral/mensal | 2023 (DCA), 2024 (extrato/MSC) | 2025 (RREO b3), 2026 (entes) |
| Portal despesas | mensal | n/t | 2026-09 |
| Portal transferências | mensal | n/t | 2026-08 |
| PNCP | contínua | 2021-06 (vazio) | 2026-09 |
| Obrasgov | evento | dataInicialPrevista 2017 (amostra) | cadastro 2026 |
| CNES leitos | mensal | 200803 | 202208 (202608 vazio em Vitória) |
| SIH/SIA | mensal | 2017 (SIA) | 2026-01 (SIH) |
| Previne | quadrimestral | 2024Q1 | n/t |
| Censo Escolar | anual | 1995 (link) | 2025 |
| Ideb | bienal | 2005 | 2023 |
| Sinesp | mensal | 2024 (arquivo) | 2025-12 |
| TSE | por eleição | 2012 (listado) | 2024 |

Histórico completo por fonte (profundidade, lacunas) é `NOT_MEASURED`, exceto onde indicado.

## 8. Granularidade e chaves de integração

| Entidade | Chave | Forma | Observação |
|---|---|---|---|
| Município | IBGE 7 dígitos | Siconfi, PNCP, Obrasgov (por UF), Censo, Ideb | referência |
| Município | IBGE 6 dígitos | DEMAS | dropa o DV |
| Município | código SIAFI | Portal transferências | requer tabela |
| Município | `SG_UE` | TSE | requer tabela |
| Município | nome + UF | Sinesp | `PROBABLE` |
| Ente | CNPJ | Siconfi `/entes`, Transferegov, PNCP, Obrasgov | `EXACT` para prefeituras |
| Órgão federal | código SIAFI / SIORG / UASG | Portal, Compras, PNCP | não cruzado nesta rodada |
| Estabelecimento de saúde | `co_cnes` | DEMAS (int vs string com zeros) | normalizar |
| Escola | `CO_ENTIDADE` = `ID_ESCOLA` | Censo, Ideb | pública sem CNPJ |
| Obra | `idUnico` | Obrasgov | só nela |
| Contrato | `numeroControlePNCP` | PNCP | |
| Fornecedor | `niFornecedor` (CNPJ/CPF) | PNCP, Compras | repo já normaliza |
| NE | `numeroNotaEmpenhoGerada` + `ugEmitente` | Obrasgov | e `numeroContratoEmpenho` no PNCP |
| Emenda | código 12 dígitos | Transferegov/Portal/Obrasgov (`autorEmenda`) | já usado pelo Cívica |

## 9. Relacionamentos demonstrados

Classes: `EXACT`, `HIGH_CONFIDENCE`, `PROBABLE`, `UNLINKED`, `CONFLICT`.

| # | Cadeia | Classe | Exemplo real | O que falta |
|---|---|---|---|---|
| L1 | Obra → executor (CNPJ) → ente Siconfi → IBGE | **EXACT** | Obra `136848.32-35` ("Pavimentação… Iconha/ES"), executor CNPJ `27165646000185` = Siconfi `3202603 Iconha/ES` | — |
| L2 | Estabelecimento → produção/capacidade | **EXACT** (com normalização) | CNES `0011738` (Hospital Santa Rita de Cássia, Vitória, IBGE6 `320530`) aparece em leitos (2008, 2022), SIH (2025, 2026) e SIA (2025) | — |
| L3 | Contrato PNCP → órgão → ente Siconfi | **EXACT** em prefeituras (71/107) e **HIGH_CONFIDENCE** via `codigoIbge` nos demais | Prefeitura de Vitória CNPJ `27142058000126` = Siconfi `3205309` | fundos/autarquias com CNPJ próprio |
| L4 | Escola (Ideb) → Censo | **HIGH_CONFIDENCE** (inferido; mesma chave Inep) | `ID_ESCOLA` 11024372 etc. | cruzamento empírico não executado |
| L5 | Obra → NE → contrato PNCP | **PROBABLE** | exec. financeira traz `2025NE000300`/UG 160017; PNCP traz `numeroContratoEmpenho` (ex. `2023NE001786`) | NE nula na amostra do ES; PNCP não filtra por NE |
| L6 | Ocorrência Sinesp → município | **PROBABLE** (nome) | — | código IBGE |
| L7 | Transferência federal → município | **EXACT** por CNPJ do favorecido; **PROBABLE** por código SIAFI sem tabela | Portal `63606479000124 ESTADO DO ACRE` | tabela SIAFI→IBGE |

**Cinco exemplos solicitados:**
1. *Transferência → município → projeto:* **L7 + L1** parcialmente; o elo transferência→projeto específico não foi demonstrado (as transferências do Portal são por ação/favorecido, não por obra).
2. *Escola → município → indicadores:* **L4** (inferido).
3. *CNES → produção:* **L2** (demonstrado).
4. *Contrato → fornecedor → órgão:* **L3** (demonstrado; 500/500 com `niFornecedor`).
5. *Obra → contrato → execução financeira:* **L5** **não** provado. Elo ausente: chave comum entre execução financeira do Obrasgov e contrato PNCP.

## 10. Lacunas de cobertura e limitações

**Lacunas de dados:**
- Pagamento por credor/NE para estados e municípios: sem fonte nacional comprovada.
- Obras com recurso exclusivamente municipal: 0 em amostra de 500; sem base complementar encontrada.
- Valor contratado/liquidado/pago e empresa executora em obras: não vistos no Obrasgov.
- Convênios discricionários: não localizado em API aberta.
- Despesa por escola e por estabelecimento de saúde: não comprovada.
- Efetivo policial, sistema prisional, saneamento por município: não medidos.

**Bloqueios técnicos e próximo experimento:**

| Item | Sintoma | Classificação técnica | Próximo experimento |
|---|---|---|---|
| Querido Diário | `SSLV3_ALERT_HANDSHAKE_FAILURE` (Node, curl, Python) | TLS servidor/rede | outra rede/host; checar versão TLS |
| RFB CNPJ aberto | timeout | rede/host | outro host; mirror oficial |
| SIOPS | falha de conexão (CGI) | endpoint legado | localizar URL atual de exportação |
| FNDE dados | `dadosabertos.fnde.gov.br` sem conexão; `dados.gov.br` 401 | sem chave/endpoint | obter token do catálogo |
| Portal API | 401 | exige chave | cadastrar chave |
| Portal datasets 500/403 | `obras-publicas`, `contratos`, `pessoal-executivo` 500; `licitacoes`, `orcamento-receita`, `bolsa-familia` 403 | possivelmente UA/WAF e URLs de mês | repetir com URL do HTML e UA de navegador |
| Atlas da Violência | 404 | URL de API errada | localizar documentação |
| Ideb 2025 | 404 no padrão atual | nome de arquivo diferente | ler a aba da página de resultados |
| Convênios | 404 em 8 bases | nome da base desconhecido | baixar ZIP `convenios` |
| Sinesp (página) | 404/403 | anti-bot | URLs diretas funcionaram |

**Limitações estatísticas:** amostras de 34 (Siconfi), 500 (PNCP, Obrasgov), 1 estabelecimento por fonte de saúde. Nenhuma estimativa nacional de cobertura de PNCP, CNES ou Obrasgov foi feita (denominador desconhecido).

## 11. Arquitetura de collectors proposta

### Desenho A — cobertura máxima com fontes centralizadas (MVP nacional)

| Família | Sistemas | Datasets | Pipelines | Formato | Incremental | Volume provável |
|---|---|---|---|---|---|---|
| F0 Referência | IBGE, SIDRA, TSE, Siconfi `/entes` | 4–5 | 1 | JSON + CSV | anual | pequeno |
| F1 Finanças de entes | Siconfi | DCA, RREO, RGF, MSC | 1 | JSON ORDS | por ente × exercício × período; `extrato_entregas` indica retificação | ~5.598 entes × anexos × períodos (milhares a dezenas de milhares de req. por exercício) |
| F2 Federal e transferências | Portal CSV + Transferegov | despesas, transferências, orçamento, emendas; PostgREST | 2 | ZIP/CSV + PostgREST | competência mensal; PostgREST recarga | ZIP de MBs por mês |
| F3 Contratações | PNCP (+ Compras.gov) | contratos, contratações | 1 | JSON | janela por `dataAtualizacao` | 100–175 mil contratos/mês |

Total: **4 famílias, 4 a 5 pipelines**. Nacional para finanças, transferências e contratos.

### Desenho B — cobertura ampliada

Acrescenta:

| Família | Sistemas | Observação |
|---|---|---|
| F4 Obras | Obrasgov | recarga por UF; paginação 100 |
| F5 Saúde | DEMAS | muitos recursos, **limite de 20/pág.** observado em CNES |
| F6 Educação | INEP Censo, Ideb (+ FNDE se provado) | arquivo anual |
| F7 Segurança | Sinesp VDE | arquivo anual; exige UA de navegador |
| F8 Saneamento | SNIS/SINISA | só após provar acesso |
| B Complementos | portais estaduais/municipais e TCEs | **só se uma lacuna real persistir** (pagamento por credor, obras próprias). O número deve ser definido depois de F1–F3, pois o dado hoje é insuficiente para prever |

**Número de collectors:** são 8 famílias ou até 9. Os dados mostram menos que "milhares", mas **mais que 8 se a lacuna de pagamento por credor municipal for tratada**. Não foi forçado nenhum número.

### Requisitos transversais

- **Full load e incremental:** arquivos mensais/anuais = recarga + upsert por competência; APIs com data = janela de atualização; PostgREST = recarga.
- **Versionamento/retificação:** `extrato_entregas.data_status` (Siconfi), `dataAtualizacaoGlobal`/`numeroRetificacao` (PNCP), `Last-Modified`/ETag (CSV), todos observados.
- **Deduplicação/idempotência:** chaves por fonte (seção 8).
- **Retry:** o repo já tem `InstitutionalHttp` (exponencial, `Retry-After`).
- **Fontes indisponíveis:** ver 10; falhar a execução e manter a última publicação ativa (padrão de `active_*_publications`).
- **Observabilidade e cobertura:** reutilizar métricas por escopo; adicionar painel de cobertura por município × fonte × competência, **com denominador explícito ou `NOT_MEASURED`**.

### Matriz de dependências

| Família | Depende de |
|---|---|
| F1 Siconfi | F0 (entes, IBGE, CNPJ) |
| F2 Portal/Transferegov | F0 (SIAFI→IBGE, CNPJ) |
| F3 PNCP | F0 (CNPJ e IBGE) e F1 (identidade de órgão) |
| F4 Obras | F0, F3, F2 (emendas) |
| F5 Saúde | F0 (IBGE6↔IBGE7) |
| F6 Educação | F0 |
| F7 Segurança | F0 (nome→IBGE; `PROBABLE`) |
| F8 Saneamento | F0 |

## 12. Reutilização da infraestrutura Cívica

Verificação feita por leitura de código/documentos (não por execução).

| Componente existente | Finalidade atual | Reutilização no Executivo | Adaptação necessária | Grau |
|---|---|---|---|---|
| `institutional-http.ts` (`InstitutionalHttp`) | host oficial, timeout, limite de bytes, retry, `Retry-After` | transporte de PNCP, Siconfi, DEMAS, Obrasgov | acrescentar hosts (`apidatalake.tesouro.gov.br`, `apidadosabertos.saude.gov.br`, etc.); UA de navegador só para Sinesp | **comprovado** (lido doc + código) |
| `docs/collectors/institutional-ingestion.md`, `institutional-run.ts`, `institutional-storage.ts` | raw → normalizado → publicação com checkpoints, `--resume`, `--dry-run`, `--force` | modelo de execução das novas famílias | novos escopos | **comprovado** |
| `raw_objects`, `institutional_collection_batches`, `active_institutional_publications` | evidência bruta e lote ativo | idem | — | **comprovado** (migrations lidas) |
| `pncp-enrichment.ts` | PNCP Consulta v1 filtrado por `cnpjOrgao` das Casas | ponto de partida de F3 | remover filtro de Casa; ampliar para modalidades e janela nacional | **comprovado** (código lido) |
| `postgres-pix-transferegov.ts` | PostgREST completo, paginação, `content-range`, manifest | modelo para fundo a fundo e TED | novas tabelas | **comprovado** |
| `postgres-pix-portal.ts`/`pix-collect.ts` | ZIP CSV do Portal | modelo para despesas e transferências | novos layouts | **comprovado** (existe; só lido o nome e o doc do contrato) |
| `suppliers`, `supplier_identifiers`, `supplier-identity.ts` | normalização e validação de CNPJ/CPF | fornecedores do PNCP | — | **comprovado** (exports lidos) |
| `budget_amendments`, `special_action_plans` | emendas Pix | ligação Legislativo↔Executivo | chave `autorEmenda`/`emendaParlamentar` ainda não cruzada | parcial |
| `state-budget` (ES/MG/RS) | emendas estaduais com `municipality_ibge_code` | ligação a obras e transferências estaduais | — | hipotético |
| `core/control-plane`, `core/scheduler`, `core/revision`, `core/observability` | agendamento, revisão, métricas | idem | novos provedores no registry | hipotético (não lido em detalhe) |
| `core/registry/national-finance-registry.ts` | registro de **casas legislativas** (UFs) e status de fonte | modelo de registro por fonte | o registro é de Casas; precisa de "territórios" | **comprovado, adaptação grande** |
| `packages/domain/src/temporal.ts` | base temporal por ano de identificador/apresentação | análise por ano/mês | **não** modela mandato nem gestão | **comprovado (limite)** |

## 13. Matriz comparativa dos três MVPs

| | MVP 1 — nacional mínimo | MVP 2 — políticas públicas | MVP 3 — conectado |
|---|---|---|---|
| Famílias | F0, F1, F2, F3 | + F4, F5, F6, F7 | + F8, convênios, complementos B |
| Comprovadamente possível | finanças por ente (Siconfi), despesas federais e transferências (Portal CSV), contratos PNCP, mandatos TSE, perfil territorial, cobertura por município | obras por UF, estabelecimento de saúde com capacidade/produção, perfil de escola, ocorrências mensais por município | CNES→produção, obra→executor→ente, contrato→órgão→ente |
| Depende de novas provas | RGF/MSC em escala; histórico; completude de PNCP | FNDE, SIOPE, SIOPS, esgoto/resíduos, efetivo policial | NE → contrato; convênios; pagamento por credor |
| Inviável com o que foi achado | pagamento por credor municipal; obras com recurso próprio | despesa por escola/estabelecimento; comparação direta de crimes entre UFs sem nota metodológica | causalidade política; cadeia completa orçamento→resultado |
| Provas/métricas disponíveis | Siconfi 34/34 e 21/34; PNCP amostras | CNES, SIH; Obrasgov amostra | 71/107 CNPJ; L2 exato |
| Custo operacional | baixo-médio | alto (saúde: 20 reg./pág.) | alto + manutenção de mapas |

## 14. Riscos técnicos

1. **Paginação limitada** em DEMAS (20/pág. observado) e Obrasgov (totais não confiáveis) elevam tempo e requisições.
2. **WAF/anti-bot:** Sinesp (UA), Cloudflare no Transferegov (já tratado), Portal (500/403 sem diagnóstico).
3. **Mudança de URL sem aviso:** Censo 2025 com underscore no nome, Ideb 2025 fora do padrão.
4. **Chaves territoriais inconsistentes** (IBGE 6/7, SIAFI, TSE, nome): exigem tabela e testes de colisão.
5. **Denominadores conflitantes** (população Siconfi vs SIDRA).
6. **Completude declarada não é completude real:** PNCP, Obrasgov e CNES são alimentados pelos entes.
7. **Retificações retroativas** (RREO, PNCP) exigem versionamento.
8. **Interpretação:** cadastro de capacidade não é capacidade disponível; despesa não é resultado; zero não é ausência.
9. **Tamanho de arquivo:** Censo Escolar chega a 537 MB; Portal CSV de despesas ≈56 MB/mês.
10. **Dependência de terceiros** (BrasilAPI, Querido Diário) sem SLA.

## 15. Perguntas ainda não respondidas

1. Qual a **completude** do PNCP por município frente ao universo legal de contratações?
2. Existe base nacional de **obras exclusivamente municipais/estaduais**? (Não achada.)
3. Quais campos de **itens e aditivos** do PNCP permitem acompanhar execução?
4. O Portal tem o ZIP de **convenios** utilizável, e qual sua chave?
5. O **FNDE/SIOPE/SIOPS** têm exportação aberta programática?
6. Como o **Ideb 2025** é distribuído?
7. Qual o **limite real de página** nos demais recursos DEMAS (só CNES foi confirmado em 20)?
8. A **MSC** traz função/subfunção/fonte preenchidos em quantos entes? (amostra de 1 ente.)
9. Qual a **política de retificação** do RREO e como detectar em `extrato_entregas`?
10. **Gestão e mandato:** como tratar prefeito cassado, renúncia, eleição suplementar e interventor? (TSE não resolve.)
11. Há **identificador de órgão estadual/municipal** comum entre Siconfi e PNCP além do CNPJ?

## 16. Próximas investigações recomendadas

1. Baixar e ler o ZIP **convenios** do Portal; testar `transferencias` histórico (6 meses).
2. **Cruzamento empírico Censo × Ideb** por código Inep.
3. Testar **PNCP** itens/aditivos/atas e tentar casar uma NE de uma obra do ES com o PNCP.
4. Mapear **MSC** para 10–20 entes (função/subfunção/fonte).
5. Medir **completude** do PNCP em 20 municípios com um parâmetro externo (RREO/Siconfi).
6. Localizar **Ideb 2025**, SIOPS/SIOPE exports, SINISA.
7. Resolver **Querido Diário** e **CNPJ RFB** de outra rede.
8. Montar a **tabela de equivalência** IBGE7/IBGE6/SIAFI/TSE e testar colisões.
9. Definir como o Cívica representará **mandato/gestão** do Executivo (seção 7 do prompt; ver abaixo).

### Dimensão temporal e mandatos (resultado parcial)

- **O que existe:** `temporal.ts` do Cívica só distingue ano de identificador, ano de apresentação e atividade (legislativo). **Não há** modelo de mandato executivo.
- **O que as fontes dão:** TSE dá eleito por município (5.563 linhas em 2024; 78 no ES). Siconfi dá exercício e período. PNCP dá `dataAssinatura`, `dataVigenciaInicio/Fim`, `dataAtualizacao`. Obrasgov dá `dataInicialPrevista/Efetiva`, `dataSituacao`.
- **Proposta (não implementada):** guardar sempre **a data do evento** e **a competência**, e só então fazer um *join* temporal com uma tabela de mandatos (TSE + exceções). Rotular como "gestor na data do evento", **nunca** como responsável pela obra ou contrato. Exceções (cassação, renúncia, suplementar) precisam de fonte além do TSE (`NOT_MEASURED`).
- **Casos a modelar:** obra iniciada em uma gestão e concluída em outra; contrato assinado numa gestão e pago em outra; renomeação de secretarias (SIORG não testado em histórico); revisões retroativas.

## 17. Inventário de evidências, URLs, consultas e datas

Todas em **2026-10-09**, salvo indicação.

| ID | Consulta | Resultado |
|---|---|---|
| E1 | `GET https://servicodados.ibge.gov.br/api/v1/localidades/estados/32/municipios` | 200 JSON |
| E2 | `GET https://apisidra.ibge.gov.br/values/t/6579/n6/3205309,3205002/v/9324/p/last` | 200; Vitória 343.935 (2026) |
| E3 | `GET https://apidatalake.tesouro.gov.br/ords/siconfi/tt/entes` | 200; 5.598 itens (M 5.570, E 26, D 1, U 1) |
| E4 | `GET …/tt/dca?an_exercicio=2023&no_anexo=DCA-Anexo I-D&id_ente={IBGE}` | 34/34 amostra com dados |
| E5 | `GET …/tt/rreo?an_exercicio=2025&nr_periodo=3&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo 01&id_ente={IBGE}` | 21/34 |
| E6 | `GET …/tt/extrato_entregas?id_ente={IBGE}&an_referencia=2024` | Vitória 39; Alto Rio Novo 37; SP 55; Belém 39 |
| E7 | `GET …/tt/msc_orcamentaria?id_ente=3205309&an_referencia=2024&me_referencia=12&co_tipo_matriz=MSCC&classe_conta=6&id_tv=ending_balance` | 200; campos de função/subfunção nulos nos itens iniciais |
| E8 | `GET https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=20250101&dataFinal=20250131&pagina=1&tamanhoPagina=10` | 116.210 / 11.621 páginas |
| E9 | idem, 2026-09-01..30 | 175.646 |
| E10 | idem, 2021-06-01..30 | HTTP 204 |
| E11 | `…/contratacoes/publicacao?…&codigoModalidadeContratacao=6&codigoMunicipioIbge=3205309` (2025T1) | 532 (Vitória), 7 (A. Rio Novo), 3.559 (SP), 466 (Belém) |
| E12 | idem mod. 8 | 633 / 16 / 2.836 / 462 |
| E13 | PNCP `contratos` 2025-01, página 50 × 500 | 500; F 308 / E 83 / M 107 / N 2; 71/107 CNPJ no Siconfi |
| E14 | `GET https://api.obrasgov.gestao.gov.br/obrasgov/api/projeto-investimento?pagina=&tamanhoDaPagina=100[&uf=ES]` (busca binária) | BR ≈128.948; ES ≈1.879 |
| E15 | Obrasgov 5 páginas (50, 300, 700, 1000, 1250) × 100 | Federal 475 / Estadual 23 / Fed+Mun 2 |
| E16 | Obrasgov `execucao-fisica`/`execucao-financeira`/`geometria` | 71.192 / 20.752 registros; geometria 200 por `idUnico` |
| E17 | `https://api.transferegov.gestao.gov.br/{fundoafundo,ted,transferenciasespeciais}/…` com `Prefer: count=exact` | contagens no JSON |
| E18 | `https://apidadosabertos.saude.gov.br/static/swagger.json` | 113 paths, v1.8.32 |
| E19 | DEMAS `cnes/estabelecimentos?limit=1000&codigo_uf=32` | 20 registros |
| E20 | DEMAS leitos/SIH/SIA/Previne/SISAGUA/SIM/SINASC | amostras (SINASC vazio) |
| E21 | `GET https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao/202609` (302 → CGU) | ZIP 7.093.274 B; CSV 55.928.502 B; 65.634 linhas |
| E22 | `…/transferencias/202608` | ZIP 3.248.867 B; 144.356 linhas |
| E23 | `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2025_.zip` | 537.217.189 B; Tabela_Escola 214.192 linhas |
| E24 | `https://download.inep.gov.br/ideb/resultados/divulgacao_anos_iniciais_escolas_2023.xlsx` | 50.701.900 B; 64.921 linhas |
| E25 | `https://www.gov.br/mj/…/download/dnsp-base-de-dados/bancovde-2025.xlsx` (UA de navegador) | 26.643.031 B; 832.293 linhas |
| E26 | `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip` | 463.877 linhas; 5.563 prefeitos eleitos |
| E27 | `https://dadosabertos.compras.gov.br/v3/api-docs` + `…/modulo-contratos/1_consultarContratos?codigoOrgao=26000…` | 77 paths; dados |
| E28 | `https://brasilapi.com.br/api/cnpj/v1/27142058000126` | 200 |
| E29 | Querido Diário, RFB CNPJ, SIOPS, `dadosabertos.fnde.gov.br`, Atlas, convênios | falhas na seção 10 |
| E30 | Repo: `docs/investigacoes/emendas-pix.md`, `docs/contracts/emendas-pix.md`, `docs/collectors/institutional-ingestion.md`, `apps/collector/src/pncp-enrichment.ts`, `postgres-pix-transferegov.ts`, `core/registry/national-finance-registry.ts`, `packages/db/src/migrations.ts`, `packages/domain/src/{temporal,supplier-identity,state-budget}.ts`, `investigacao_judiciario.md` | lidos |

### Amostra sorteada (Siconfi)
30 municípios sorteados por LCG com semente 42 sobre a lista de 5.570 entes `M`, mais os 4 recortes nomeados. Lista completa no log da execução; amostra pequena, sem estratificação.

---

## Gates finais

| Gate | Estado | Justificativa | Pendências |
|---|---|---|---|
| `EXECUTIVE_SOURCE_DISCOVERY` | **PASS_WITH_CAVEATS** | 26 fontes inventariadas; mais de uma dezena com dados reais lidos. Fontes não previstas incluídas (Compras, TSE, DEMAS, SIORG). | FNDE, SIOPE/SIOPS, convênios, SINISA, ANEEL/ANTT/DNIT/TCEs não resolvidos. |
| `EXECUTIVE_API_VERIFICATION` | **PASS_WITH_CAVEATS** | Siconfi, PNCP, Compras, Obrasgov, Transferegov, DEMAS, IBGE com chamadas reais e amostras. Datasets Portal, INEP, Sinesp, TSE lidos. | 7 fontes `BLOCKED` (seção 10); limites de taxa não medidos; sem teste de carga. |
| `EXECUTIVE_TERRITORIAL_COVERAGE` | **PARTIAL** | 5.571 unidades municipais confirmadas em duas fontes; Siconfi lista 5.598 entes; Censo cobre 5.571. Amostras de 4 municípios e 30 sorteados (Siconfi). | Cobertura efetiva de PNCP, CNES e Obrasgov por município `NOT_MEASURED`; ES e Brasil não percorridos por inteiro. |
| `EXECUTIVE_HISTORICAL_COVERAGE` | **PARTIAL** | Anos lidos: Censo 2025, Ideb 2005–2023, Sinesp 2025, TSE 2024, PNCP 2021-06→2026-09. | Profundidade por fonte não percorrida; PNCP pré-2023, Siconfi pré-2023, CNES recente não medidos. |
| `EXECUTIVE_IDENTITY_LINKAGE` | **PARTIAL** | L1, L2 e L3 demonstrados; 71/107 de CNPJ exato. | L4 não cruzado, L5 não provado, Sinesp por nome, tabelas SIAFI/TSE/IBGE6 por construir; conflito de população. |
| `EXECUTIVE_COLLECTOR_ARCHITECTURE` | **PASS_WITH_CAVEATS** | Desenhos A (4 famílias) e B (até 9), matriz de dependências e reuso mapeado ao repo. | Reuso de scheduler/revisão apenas lido por nome; sem prova de execução. |
| `EXECUTIVE_MVP_READINESS` | **PARTIAL** | MVP 1 tem as bases comprovadas; MVP 2 depende de F4–F7 operacionais; MVP 3 depende de L5 e de convênios. | Provas listadas na seção 16. |
