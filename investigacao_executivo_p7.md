# Investigação P7: fechamento nacional da atuação política do Poder Executivo

Gerado em 2026-10-11 (versão atualizada). Dados: `investigacao_executivo_p7_fontes.json`.

## 1. Resumo executivo

Escopo: investigação; nada alterado no repositório além destes dois arquivos; sem commit/push. Esta versão **atualiza** a primeira entrega da P7 depois de atacar as lacunas que ela deixou.

**Correções a P5/P6 (comprovadas)**
- "Eleito = titular" é falso em 2026: **10 UFs** tiveram governador renunciando para disputar a eleição, cada uma com página oficial (Assembleia, governo ou agência estadual): GO, DF, MT, PB, PA, AC, RR, ES, MG e RJ. **O Amazonas não renunciou**: a lista da imprensa com 11 nomes estava errada nesse ponto.
- Auditoria: DF fora da conta (730/5.570 = 13,1%); portarias 58/128 vs 0 = consultas diferentes (AND de dois termos); DEC 2013 = 297 + 331 = 628 (DEC-sn descartado pelo script da P6); 37 assinaturas ausentes eram falha de regex (840/840).

**Lacunas fechadas nesta rodada**
- **Nomeações federais sem INLABS**: a listagem diária pública do DOU (`leiturajornal`) devolve todos os itens da seção 2 do dia, inclusive "Decreto de Pessoal" de "Atos do Poder Executivo". Três cadeias de ministros fechadas: **Saúde** (Queiroga exonerado em 01/01/2023; Nísia no SIAPE desde 01/01/2023; exoneração de Nísia e nomeação de Padilha no mesmo ato, DOU Ed. 46-A, Seção 2 Extra A, 10/03/2025; SIAPE confirma ingresso de Padilha em 10/03/2025), **Secom** (Pimenta exonerado a pedido e Sidônio nomeado em 14/01/2025) e **Justiça** (Dino exonerado a pedido a partir de 01/02/2024; Lewandowski ingressa em 01/02/2024).
- **Histórico mensal do SIAPE**: o Portal da Transparência negava acesso, mas o host da CGU entrega **2013-01 a 2026-07**. Seis snapshots lidos (34, 28, 39, 43, 38 e 38 ministros).
- **Signatário estadual**: governador nominal em decreto verificado em **19 UFs** (antes 8) e em **9 UFs para 2020** (antes 0). SP tem nome no repositório da Alesp (a P7 inicial dizia que não). Faltam documentos verificados em AP, CE, RJ e RR; PA, PB, RN e AL só no nível da edição do DOE.
- **Projeto → lei**: SAPL (Interlegis) tem API uniforme. No Piauí, 449 normas de 2025 e 449 com matéria vinculada; amostra de 60: 37 de autoria do Governador (ex.: PL Ordinária do Governo nº 101/2025 → Lei 8.914 de 2025-12-23). Nos municípios, **68 de 300** (22,7%) responderam no padrão `sapl.<município>.<uf>.leg.br`; em 12 instâncias detalhadas, 4 tinham lei ligada a projeto do Prefeito.
- **Custo de gabinete**: RS municipal (TCE-RS 2025, pagamentos): Agudo R$ 2,18 mi (1,6%), Caxias do Sul R$ 0,61 mi, Canoas R$ 26,3 mi, Pelotas e Porto Alegre com perímetros que exigem mapa de UO; ES (4 municípios) mantido; **TCE-SP não tem UO** (gabinete não isolável); RS estadual (dez/2025): Casa Civil R$ 10,2 mi, Casa Militar R$ 2,9 mi e Gabinete do Vice R$ 0,8 mi; MG: Gabinete Militar R$ 18,6 mi pagos em 2025.
- **Cadeias subnacionais**: ES (Secretário da Saúde, decretos 005-S, 007-S e 626-S) e município de SC (Abdon Batista: Portarias 554, 555 e 556/2024 exoneram três secretários citando a portaria de nomeação; a de 180/2023 foi localizada).
- **Diários municipais**: nova união deduplicada sem DF = **2699 municípios (48.5%) com publicação verificada em nível de portal**; 2885 (51.8%) contando clientes de portais sem edição recente; **2685 sem fonte**. Famílias novas verificadas: SIGPub (22 portais), DIO/ES-AMUNES, FAMEM/Siganet (MA) e SAPL (legislação); cinco candidatas localizadas (Assomasul, DOEMPI, publicacoesmunicipais, diariomunicipios, MPX).

**Ainda aberto**: exercício de prefeitos além de 3 capitais e 2 municípios de SC; nenhuma suplementar documentada caso a caso; AP, CE, RJ e RR sem decreto verificado; RJ sem fonte sobre o desfecho da eleição indireta; ponte SIAFI↔SIORG; vetos estaduais e municipais; ES, SP, RJ e PE (governador) sem custo de gabinete; TCE-PE inalcançável nesta rodada.

Gates (22): PARTIAL=11, PASS=1, PASS_WITH_CAVEATS=10. Experiências: 9 READY_FOR_CONTRACT, 13 NEEDS_VALIDATION.

## 2. Auditoria de consistência P5/P6

| Item | Achado | Conclusão |
|---|---|---|
| DF | IBGE devolve 5.571 (5.570 + DF); DF está na união P6 | municipal = 730/5.570 = 13,1%; DF só entre os 27 Executivos estaduais/distrital |
| Portarias | nomear/Portarias=58; exonerar/Portarias=128; exonerar nomear/Portarias=0; nomear exonerar/Portarias=0; exonerar nomear/todas=7; nomear/todas=142; exonerar/todas=138; *:*/Portarias=584; nomear OR exonerar/Portarias=584 | termos isolados medem publicações com o termo; dois termos = AND (0); OR não suportado (devolve o total); sem erro de serialização no JSON P6 |
| DEC 2013 | tipo=DEC → 297 DEC-n + 331 DEC-sn = 628 | script P6 exigia <numero>; sem queda de produção; separar por campo tipo |
| 37 assinaturas | causas: {'regex_nome_curto': 3, 'sem_marcador_independencia': 34} | 34 por entidades HTML, 3 por ordinal/nome curto; regex corrigida recupera 37/37 (840/840) |
| P5 seção 8 e lista de renúncias | eleito = titular; 11 governadores (imprensa) | 10 UFs com página oficial; AM não renunciou |

## 3. Universo territorial e identidade dos entes

Município: 5.570 (IBGE, 7 dígitos). DF: ente sem prefeitura (5300108). Executivos subnacionais: 27 (26 governadores + DF). Cobertura municipal calculada só sobre 5.570. Chave municipal TSE (SG_UE) ↔ IBGE segue sem tabela de equivalência.

## 4. Exercício efetivo da Presidência

Resultados da P6 preservados (840 decretos, assinatura 840/840 após correção, substitutos Alckmin, Mourão, Maia, Lewandowski, Temer como vice). Nova capacidade: para atos de pessoal, o DOU `leiturajornal` por data (seções do2/do2e) fornece o ato com edição, seção e página; combinado com o histórico mensal do SIAPE dá a data de ingresso. Ainda falta ato de posse/afastamento presidencial.

## 5. Exercício efetivo dos governadores

| UF | Eleito | Posse | Exercício | Ciclo fechado |
|---|---|---|---|---|
| ES | Renato Casagrande/Ricardo Ferraço (2022) | 2023-01-01 (INSTITUTIONAL_NEWS); 2026-04-02 (INSTITUTIONAL_NEWS) | decreto assinado por Casagrande em 2025-10-20 (DIO/ES ed. 26.591) | sim |
| MG | Zema/Mateus Simões (2022) | 2023-01-01 (INSTITUTIONAL_NEWS); 2026-03-22 (INSTITUTIONAL_NEWS) | Decreto 49.025/2025 e DNE 274/2025 com ROMEU ZEMA NETO no texto (ALMG) | sim |
| RJ | Witzel/Castro (2018) | 2020-08-28 (PRIMARY_DOCUMENT); 2021-04-30 (INSTITUTIONAL_NEWS); 2021-05-01 (INSTITUTIONAL_NEWS); 2026-03-23 (PRESS) | nenhum decreto assinado obtido | não |
| SP | Doria/Rodrigo Garcia (2018) | 2022-04-01 (INSTITUTIONAL_NEWS) | repositório Alesp de decretos disponível; nenhum decreto de governador fetchado | não |
| PE | Paulo Câmara/Luciana Santos (2018); Raquel Lyra (2022) | 2019-01-01 (PRIMARY_DOCUMENT); 2015-01-02 (PRIMARY_DOCUMENT) | Decreto 58.019/2025 assinado por Raquel Teixeira Lyra Lucena (Alepe Legis/SEFAZ-PE) | não |


**Renúncias de 2026 com página oficial:**

| UF | Quem | Data | Fonte |
|---|---|---|---|
| GO | Ronaldo Caiado → Daniel Vilela | 2026-03-31 | Alego (portal.al.go.leg.br/noticias/163542) e goias.gov.br |
| DF | Ibaneis Rocha → Celina Leão | renúncia 2026-03-28; posse 2026-03-30 | CLDF (cl.df.gov.br) |
| MT | Mauro Mendes → Otaviano Pivetta | 2026-03-31 | ALMT (al.mt.gov.br) |
| PB | João Azevêdo → Lucas Ribeiro | 2026-04-02 | A União/Governo da PB; existe também notícia de governador interino Adriano Galdino (data não extraída) |
| PA | Helder Barbalho → Hana Ghassan | renúncia 2026-04-02 | Alepa (alepa.pa.gov.br/Comunicacao/Noticia/11627) |
| AC | Gladson Cameli → Mailza Assis | comunicação 2026-03-24; efeito 2026-04-02 | Agência de Notícias do Acre |
| RR | Antonio Denarium → Edilson Damião | 2026-03-27 | ALERR (al.rr.leg.br) |
| ES | Renato Casagrande → Ricardo Ferraço | 2026-04-02 | portal do governo ES e Ales |
| MG | Romeu Zema → Mateus Simões | 2026-03-22 | ALMG |
| RJ | Cláudio Castro renuncia (2026-03-23); vice já vago; presidente do TJRJ interino; eleição indireta regulamentada pela Alerj | 2026-03-23 | ALERJ (Noticia 82480/83191) e TJRJ; resultado da eleição indireta não localizado |


PB e ES registram também interinidades (presidente da ALPB e Ricardo Ferraço "por seis dias"), sem data extraída. SP: Alesp indica sexta 01/04/2022; parte da imprensa cita 31/03 (anúncio de Doria). RJ: desfecho da eleição indireta não localizado. Exercício por assinatura de decreto: 19 UFs (seção 11).

## 6. Exercício efetivo dos prefeitos

| Município | Eventos | Fechado |
|---|---|---|
| Vitória/ES | 2026-04-04: renúncia de Lorenzo Pazolini na CMV; 2026-04-06: posse de Cris Samorini; termo de posse e sucessão definitiva | sim |
| Recife/PE | 2026-04-02: João Campos protocola renúncia; 2026-04-06: posse de Victor Marques (vice-prefeito vago); sessão solene 15h45 | sim |
| São Paulo/SP | 2021-05-16: Mesa Diretora declara extinção do mandato de Bruno Covas por morte (11h20); Ricardo Nunes já em exercício como prefeito em exercício; 2025-01-01: posse de Nunes (2º mandato) e vice | sim |
| Alto Rio Novo/ES | 2025-01-01: prefeito Alexandro de Melo Valim em exercício desde 2025 (fonte secundária) | não |
| Abdon Batista/SC | 2024-12-18..2024-12-23: decretos 163-168/2024 assinados por Jadir Luiz de Souza, Prefeito Municipal (PDF ICP-Brasil) | não |
| Chapecó/SC | 2024-12-19/20: decretos assinados eletronicamente (SEI) por prefeito | não |
| Belo Horizonte/MG | não testado | não |
| Curitiba/PR | não testado | não |
| Porto Alegre/RS | não testado | não |
| Salvador/BA | busca devolveu cronologia contraditória (Bruno Reis); não usado | não |


Suplementares TSE: {'2012': 110, '2016': 120, '2020': 36, '2024': 11}; casos individuais documentados: 0 (lacuna mantida). Capitais que renunciaram em 2026 segundo imprensa: Rio de Janeiro, Recife, Vitória, São Luís, Manaus, Boa Vista; Recife e Vitória confirmadas pelas Câmaras.

## 7. Posse, afastamento e sucessão

| ID | Escopo | Tipo | Data | Nível |
|---|---|---|---|---|
| SE7-ES-2026 | ES | SUCCEEDED | 2026-04-02 | INSTITUTIONAL_NEWS |
| SE7-MG-2026 | MG | SUCCEEDED | 2026-03-22 | INSTITUTIONAL_NEWS |
| SE7-RJ-2020 | RJ | ACTING | 2020-08-28 | PRIMARY_DOCUMENT |
| SE7-RJ-2021 | RJ | REMOVED/SUCCEEDED | 2021-05-01 | INSTITUTIONAL_NEWS |
| SE7-SP-2022 | SP | SUCCEEDED | 2022-04-01 | INSTITUTIONAL_NEWS |
| SE7-VIT-2026 | Vitória | RESIGNED/SUCCEEDED | 2026-04-06 | INSTITUTIONAL_NEWS |
| SE7-REC-2026 | Recife | RESIGNED/SUCCEEDED | 2026-04-06 | INSTITUTIONAL_NEWS |
| SE7-SPM-2021 | São Paulo (cidade) | TERM_ENDED_BY_DEATH/SUCCEEDED | 2021-05-16 | PRIMARY_DOCUMENT |


A tabela lista os eventos já fechados em campo; os de 2026 por UF estão na seção 5. Modelo: ELECTED, SWORN_IN, ACTING, TEMPORARILY_REPLACED, RETURNED, RESIGNED, REMOVED, SUCCEEDED, TERM_ENDED, UNKNOWN.

## 8. Provedores estaduais de diários municipais

SIGPub (22 portais de associações: AAM, AEMERJ, AGM, AMA, AMM-MG, AMM-MT, AMP, AMR, AMUPE, AMURC, APM, APPM, APRECE, AROM, FAMEP, FAMUP, FAMURS, FEMURN, FGM, MS/Assomasul, Sergipe, Maceió); DIO/ES (AMUNES + diários municipais, ids sequenciais); FAMEM/Siganet (MA). Siglas homônimas separadas: AMM-MG ≠ AMM-MT; AMP = Paraná; APM = SP. DOEM bloqueado por verificação de bot.

## 9. Plataformas compartilhadas e novas descobertas

| Portal | Clientes IBGE | Entidades | Última edição na home | Decretos/Portarias/Leis na edição | Municípios citados |
|---|---|---|---|---|---|
| aam | 61 | 153 | 2026-10-08 | 10/186/5 | 18 |
| aemerj | 10 | 14 | 2026-10-08 | 2/20/1 | 5 |
| agm | 99 | 128 | 2026-10-08 | 22/48/3 | 15 |
| ama | 91 | 108 | 2026-10-08 | 3/18/3 | 59 |
| amm-mg | 465 | 750 | 2026-10-08 | 70/129/39 | 223 |
| amm-mt | 136 | 167 | 2015-03-09 | 0/0/0 | 0 |
| amp | 178 | 188 | 2026-10-08 | 224/372/74 | 166 |
| amr | 14 | 32 | 2026-10-08 | 1/8/1 | 12 |
| amupe | 174 | 193 | 2026-10-08 | 28/73/17 | 51 |
| amurc | 15 | 16 | 2013-05-21 | 2/0/0 | 1 |
| apm | 7 | 8 | 2026-10-08 | 0/0/0 | 1 |
| appm | 31 | 34 | 2020-02-07 | 0/0/0 | 1 |
| aprece | 108 | 109 | 2026-10-08 | 22/91/16 | 50 |
| arom | 47 | 55 | 2026-10-08 | 71/157/8 | 51 |
| famep | 108 | 206 | 2026-10-08 | 5/339/4 | 67 |
| famup | 118 | 123 | 2026-10-08 | 1/27/6 | 64 |
| famurs | 266 | 303 | 2026-10-08 | 48/245/29 | 119 |
| femurn | 153 | 243 | 2026-10-08 | 27/155/20 | 116 |
| fgm | 55 | 78 | 2026-10-08 | 13/9/0 | 13 |
| ms | 0 | 59 | 2020-10-29 | 0/1/0 | 1 |
| sergipe | 7 | 12 | 2009-12-09 | 0/0/0 | 0 |


Famílias novas: **SIGPub** (VERIFIED_PUBLICATION em 15 portais com edição de 2026-10-08); **DIO/ES** (40 municípios em 9 edições AMUNES; ids 6060=2021-08-20, 8800=2024-01-31, 10000=2025-03-17, 11283=2026-07-08); **FAMEM/Siganet MA** (edição 3955 de 2026-10-09: 20 municípios, 14 decretos, 84 portarias); **SAPL** (legislação; 68/300 municípios amostrados). Candidatas sem acervo extraído: Assomasul (diariooficialms.com.br), DOEMPI, publicacoesmunicipais.com.br, diariomunicipios.com.br, MPX. Meta de 5 famílias: 4 verificadas. Lista de clientes ≠ acervo coletável.

## 10. Cobertura municipal deduplicada

Denominador 5.570 (sem DF). P6 730; SIGPub ativo 1942; DIO/ES 40; FAMEM 20 (novos 19). União verificada **2699 (48.5%)**; com clientes de portais sem edição recente **2885 (51.8%)**; sem fonte **2685**.

| UF | Verificado | Com clientes | Total |
|---|---|---|---|
| AC | 0 | 0 | 22 |
| AL | 92 | 92 | 102 |
| AM | 62 | 62 | 62 |
| AP | 3 | 3 | 16 |
| BA | 72 | 84 | 417 |
| CE | 116 | 116 | 184 |
| ES | 41 | 41 | 78 |
| GO | 151 | 151 | 246 |
| MA | 47 | 47 | 217 |
| MG | 479 | 479 | 853 |
| MS | 10 | 10 | 79 |
| MT | 3 | 136 | 142 |
| PA | 111 | 111 | 144 |
| PB | 125 | 125 | 223 |
| PE | 178 | 178 | 185 |
| PI | 1 | 32 | 224 |
| PR | 202 | 202 | 399 |
| RJ | 41 | 41 | 92 |
| RN | 156 | 156 | 167 |
| RO | 47 | 47 | 52 |
| RR | 14 | 14 | 15 |
| RS | 284 | 284 | 497 |
| SC | 293 | 293 | 295 |
| SE | 29 | 33 | 75 |
| SP | 116 | 122 | 645 |
| TO | 26 | 26 | 139 |


Ordem gulosa de adaptadores: SIGPub (portais ativos)→1942, DOM/SC→2235, BaseInstarSpider→2339, BaseDoemSpider→2395, DIO-ES/AMUNES→2435, BaseDospSpider→2475, BaseMunicipioOnlineSpider→2501, BaseAdiariosV1Spider→2524, FAMEM/Siganet-MA→2544. Níveis: PROVIDER_CLIENT (2885), VERIFIED_PUBLICATION em nível de portal (2699), VERIFIED_DECREE (decretos individuais: SC, 2 PDFs), VERIFIED_HISTORICAL_SERIES (DOM/SC 2008+, DIO/ES 2021+, SIGPub desde 2009 informado), OPERATIONAL_COLLECTION_POSSIBLE (DOM/SC, DIO/ES). A cobertura por tipo de documento por município não foi medida (só por edição).

## 11. Atos normativos das 27 UFs

| UF | Tipo de evidência | Anos | Evidência |
|---|---|---|---|
| AC | VERIFIED_DOC | 2020+2025 | decretos 6.835/2020 e 11.628/2025: Gladson de Lima Cameli, Governador |
| AM | VERIFIED_DOC | 2025 | decreto 51.978/2025: Wilson Miranda Lima |
| BA | VERIFIED_DOC | 2025 | decreto 23.362/2025 (PDF SEFAZ): Jerônimo Rodrigues; LegislaBahia HTML sem nome |
| DF | VERIFIED_DOC | 2020+2025 | decretos 40.708/2020 e 46.742/2025: Ibaneis Rocha; republicação marcada |
| ES | VERIFIED_DOC | 2025 | DIO/ES: decretos -S assinados Casagrande |
| GO | VERIFIED_DOC | 2020+2025 | decretos 9.705/2020 e 10.639/2025: Caiado |
| MA | VERIFIED_DOC | 2025 | decreto 40.801/2025: Carlos Brandão |
| MG | VERIFIED_DOC | 2020+2025 | DEC 47.925/2020 e 49.025/2025 (ALMG): Zema Neto; DNE |
| MS | VERIFIED_DOC | 2020+2025 | decretos 15.486/2020 e 16.588/2025: Azambuja / Riedel |
| MT | VERIFIED_DOC | 2020+2025 | DOE 2020-04-03 e decreto 1.691/2025: Mauro Mendes |
| PE | VERIFIED_DOC | 2020+2025 | decretos 49.055/2020 e 58.019/2025: Paulo Câmara / Raquel Lyra |
| PI | VERIFIED_DOC | 2025 | decreto 23.699/2025: Rafael Tajra Fonteles; SAPL liga lei a projeto |
| PR | VERIFIED_DOC | 2020 | decreto 4.569/2020 (DOE 10677): Ratinho Junior |
| RO | VERIFIED_DOC | 2026 | decreto 31.210/2026: Marcos José Rocha dos Santos (assinatura eletrônica) |
| RS | VERIFIED_DOC | 2021 | decreto 56.199/2021: Eduardo Leite |
| SC | VERIFIED_DOC | 2025 | decreto 1.303/2025 (leis.alesc.sc.gov.br/ato-normativo/53548): Jorginho Mello |
| SE | VERIFIED_DOC | 2025 | decreto 1.267/2025: Fábio Mitidieri |
| SP | VERIFIED_DOC | 2020+2023 | decretos 65.051/2020 e 67.634/2023 (repositório Alesp): Doria / Tarcísio |
| TO | VERIFIED_DOC | 2025 | DOE 2025-03-07: Wanderlei Barbosa Castro |
| PA | DOE_LEVEL | 2025 | DOE 2025-12-01 (98 decretos): Helder Zahluth Barbalho no cabeçalho; assinatura por decreto não extraída |
| PB | DOE_LEVEL | 2025 | DOE 2025-12-24 (66 decretos): Governador João Azevêdo Lins Filho |
| RN | DOE_LEVEL | 2025 | DOE 2025-04-09 (30 decretos): Fátima Bezerra no cabeçalho |
| AL | DOE_LEVEL | 2025 | DOE AL (viewPdf/51533): Paulo Dantas citado; assinatura não isolada |
| CE | LEAD | - | decretos 36.xxx/2025 em seplag.ce.gov.br; URL testada devolveu 404 |
| AP | LEAD | - | DOE 8555 baixado; nome não localizado no texto extraído |
| RJ | NOT_TESTED | - | portal candidato 404; sem documento |
| RR | NOT_TESTED | - | ALERR e portal alcançáveis; decreto não fetchado |


VERIFIED_DOC = documento com governador nominal; DOE_LEVEL = edição do diário com decretos e nome no cabeçalho; LEAD = fonte localizada sem documento verificado. 2020 verificado em 9 UFs (AC, DF, GO, MG, MS, MT, PE, PR, SP; RS 2021). Leis e nomeações só em PI (SAPL) e ES (DIO).

## 12. Signatários estaduais

Nome do governador no documento: 19 UFs (AC, AM, BA, DF, ES, GO, MA, MG, MS, MT, PE, PI, PR, RO, RS, SC, SE, SP, TO). BA: LegislaBahia (HTML) não mostra nome, o PDF da SEFAZ mostra. SP: repositório de decretos da Alesp traz DORIA (2020) e TARCÍSIO DE FREITAS (2023). Assinatura eletrônica (RO, PI) aparece como "assinado eletronicamente por". Classe: SIGNED_BY_PERSON nos 19; PUBLISHED_DURING_TERM em PA, PB, RN, AL; sem classificação em AP, CE, RJ, RR.

## 13. Signatários municipais

Sem ampliação além da P6 (PDF 9/9 em Abdon Batista e Chapecó; página 10/40). DIO/ES: o cabeçalho das edições da Serra lista Prefeito e secretariado, permitindo ligar edição a titular.

## 14. Ministros: nomeação e exoneração

| Cadeia | Eventos |
|---|---|
| Ministro de Estado da Saúde | 2021-03-23: Queiroga ingressa (SIAPE 202301); 2023-01-01: EXONERAR Marcelo Queiroga (DOU seção 2, 01/01/2023); 2023-01-01: Nísia Trindade: ingresso no SIAPE e contrassinatura de decreto de 01/01/2023 (decreto próprio de nomeação não localizado); 2025-03-10: EXONERAR Nísia Verônica Trindade Lima e NOMEAR Alexandre Rocha Santos Padilha (DOU Ed. 46-A, Seção 2 Extra A); 2025-03-10: Padilha: ingresso 10/03/2025, diploma DECRETO (SIAPE 202504) |
| Ministro da Secretaria de Comunicação Social | 2025-01-14: EXONERAR, a pedido, Paulo Roberto Severo Pimenta; 2025-01-14: NOMEAR Sidônio Cardoso Palmeira |
| Ministro da Justiça e Segurança Pública | 2023-01-01: Flávio Dino ingresso (SIAPE 202301); 2024-02-01: EXONERAR, a pedido, a partir de 01/02/2024, Flávio Dino (DOU do2e de 31/01/2024); 2024-02-01: Enrique Ricardo Lewandowski ingresso (SIAPE 202502), diploma DECRETO; decreto de nomeação não localizado na varredura |


Método: `https://www.in.gov.br/leiturajornal?secao=do2|do2e&data=DD-MM-AAAA` devolve JSON com todos os itens do dia; filtrar `hierarchyStr` contendo "Atos do Poder Executivo" e `artType` "Decreto de Pessoal"; abrir `/web/dou/-/{urlTitle}` traz edição, seção, página e texto. Histórico SIAPE mensal pelo host CGU (2013-01..2026-07). Limitações: o decreto de nomeação de Nísia (2023-01-01) e o de Lewandowski não foram localizados na varredura; snapshots trazem linhas legadas (Queiroga ainda aparecia em 2023-01); a varredura de todas as datas de posse não foi feita.

## 15. Secretários estaduais

| Data | Evento | Documento |
|---|---|---|
| 2024-11-01 | exercício: Miguel Paulo Duarte Neto assina convênio como Secretário | DIO/ES ed. 2025-01-02 (id 9781) |
| 2025-01-02 | Decreto 005-S: exonera Miguel Paulo Duarte Neto | DIO/ES ed. 26.391 (id 9786), publ. 2025-01-03 |
| 2025-01-02 | Decreto 007-S: nomeia Tyago Ribeiro Hoffmann | DIO/ES ed. 26.391 (id 9786) |
| 2025-01-07 | exercício: Hoffmann presidente nato de órgão colegiado | DIO/ES id 9793 |
| 2026-03-31 | último ato localizado assinado como Secretário (03/04/2026 edições) | DIO/ES ids 11018, 11030, 11047 |
| 2026-03-31 | Decreto 626-S: designa Gleikson Barbosa dos Santos para responder pelo cargo | DIO/ES id 11021 (2026-04-01) |


Lacunas: saída de Hoffmann; nomeação de Miguel Duarte em 2023. MG DNE e SP DOE não testados.

## 16. Secretários municipais

| Data | Evento |
|---|---|
| 2023-02-24 | Portaria 180/2023 (nomeação de Saimon Eduardo Mancheim, Secretário de Agricultura e Meio Ambiente): ato DOM/SC 4591466; PDF é imagem |
| 2024-12-30 | Portaria 554/2024 exonera Saimon Mancheim "nomeado através da Portaria nº 180/2023" |
| 2024-12-30 | Portaria 555/2024 exonera Telmo José Gerent (Secretário de Cultura e Turismo; Portaria 258/2021) |
| 2024-12-30 | Portaria 556/2024 exonera Valdir Santos de Lis (Secretário de Esportes; Portaria 102/2023) |


A portaria de nomeação localizada (180/2023) é PDF-imagem; as três exonerações citam a portaria original, o que fecha o vínculo por referência. Taxonomia comissão/função/efetivo exige texto.

## 17. Ligação SIAPE ↔ SIORG

SIORG (336 unidades) não tem SIAFI/SIAPE. SIAPE tem COD_ORG_EXERCICIO e diploma/ingresso por cargo, em histórico mensal. Match por nome normalizado: 29/39; sem match 10 (ex.: MIN DA INTEG E DO DESENV REGIONAL, MIN GESTAO E INOV EM SERV PUBLICOS, MINISTERIO DO MEIO AMBIENTE). Recomendação: tabela curada versionada SIAFI↔SIORG.

## 18. Estrutura administrativa histórica

Federal: SIORG versionado, sem ocupante; ocupante vem do SIAPE e do DOU. Subnacional: sem fonte nacional; DIO/ES, DOM/SC e TCE (UO) dão listagens por município.

## 19. Projetos de iniciativa do Executivo

| Escopo | Resultado |
|---|---|
| Federal | autoria institucional (Câmara); veto→lei 86% (P6) |
| Piauí (SAPL) | 449 normas de 2025, todas com matéria; 37/60 da amostra de autoria do Governador; ex.: PL Ordinária do Governo nº 101/2025 → Lei 8.914/2025 |
| Municípios (SAPL) | 68/300 amostrados com API; 4 de 12 instâncias com lei ligada a projeto do Prefeito (Perdizes, Adamantina, Roraínópolis, Sete Lagoas); Recife usa SAPL legado com PLE |
| ES, MG, SP, RJ, PE | não testados |


Cuidado: no SAPL o autor é a pessoa (Prefeito/Governador); isto prova quem encaminhou, não responsabilidade pessoal pelo conteúdo. Classe: INITIATIVE_BY_OFFICEHOLDER.

## 20. Sanções, vetos e normas resultantes

Sem novos testes federais. Vetos estaduais e municipais não medidos (o SAPL tem campo para veto em normas; não explorado). P6 preservado: 765 vetos, 660 com norma gerada.

## 21. Custo dos gabinetes municipais

**ES 2024 (paga)**

| Município | Órgão | UO | Empenhada | Paga |
|---|---|---|---|---|
| ALTO RIO NOVO | GABINETE DO PREFEITO | FUNDO MUNICIPAL DE PROTEÇÃO DEFESA CIVIL - FUNMPDEC | 0 | 0 |
| ALTO RIO NOVO | GABINETE DO PREFEITO | GABINETE DO PREFEITO | 466,843 | 459,115 |
| CARIACICA | SECRETARIA MUNICIPAL DE GOVERNO E RECURSOS HUMANOS | SECRETARIA MUNICIPAL DE GOVERNO E RECURSOS HUMANOS | 22,119,848 | 21,122,772 |
| CARIACICA | SECRETARIA MUNICIPAL DE HABITACAO | GABINETE DO PREFEITO | 16,926,397 | 12,265,866 |
| LINHARES | Gabinete do Prefeito | Controladoria Geral do Municipio | 570,722 | 565,190 |
| LINHARES | Gabinete do Prefeito | Gabinete do Prefeito | 3,234,800 | 3,220,242 |
| LINHARES | Gabinete do Prefeito | Ouvidoria Geral do Município | 159,550 | 157,722 |
| SERRA | COORDENADORIA DE GOVERNO | Coordenadoria de Governo | 11,234,919 | 10,202,958 |
| VITORIA | SECRETARIA DE GOVERNO | SECRETARIA DE GOVERNO | 24,411,730 | 17,830,266 |


**RS 2025 (pagamentos, dt_operacao em 2025)**

| Município | Órgão orçamentário | UO | Pago |
|---|---|---|---|
| PM DE AGUDO | GABINETE DO PREFEITO | 1 Estrutura do Gabinete | 2,175,890 |
| PM DE CANOAS | GABINETE DO PREFEITO | 1 GABINETE DO PREFEITO E ORGAOS INTEGRANTES | 26,304,950 |
| PM DE CAXIAS DO SUL | EXECUTIVO ADMINISTRACAO DIRETA | 2 GABINETE DO PREFEITO | 610,260 |
| PM DE CAXIAS DO SUL | EXECUTIVO ADMINISTRACAO DIRETA | 4 SECRETARIA DE GOVERNO MUNICIPAL | 18,878 |
| PM DE PELOTAS | Secretaria Municipal de Governo e Ações Estratégicas | 23 Secretaria Municipal de Governo e Ações Estratégicas | 2,060,090 |
| PM DE PELOTAS | Gabinete do Prefeito | 16 Chefia de Gabinete | 3,667,645 |
| PM DE PELOTAS | Gabinete do Prefeito | 17 Procuradoria Geral do Municipio | 9,650,190 |
| PM DE PELOTAS | Gabinete do Prefeito | 18 Assessoria de Comunicação Social | 1,107,561 |
| PM DE PELOTAS | Gabinete do Prefeito | 92 Coordenadoria de Transparência e Controle Interno | 1,170,910 |
| PM DE PELOTAS | Gabinete do Prefeito | 93 Gabinete da Vice Prefeita | 722,273 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 1 GABINETE DO PREFEITO | 26,080,312 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 10 GABINETE DE COMUNICACAO SOCIAL | 2,495,943 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 10 GABINETE DO PREFEITO | 22,654,883 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 11 GABINETE DA CAUSA ANIMAL | 1,090,994 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 11 GABINETE DO PREFEITO | 1,085,996 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 12 FUNDO MUNICIPAL DOS DIREITOS DOS ANIMAIS  FMDA | 7,229 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 13 GABINETE DE INOVACAO | 773,241 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 13 GABINETE DO PREFEITO | 180 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 14 GABINETE DO PREFEITO | 128,611 |
| PM DE PORTO ALEGRE | GABINETE DO PREFEITO | 14 SISTEMA MUNICIPAL DE PROTECAO E DEFESA CIVIL | 42,052 |
| PM DE PORTO ALEGRE | SECRETARIA MUNICIPAL GERAL DE GOVERNO | 1 SECRETARIA MUNICIPAL GERAL DE GOVERNO | 15,518,574 |
| PM DE PORTO ALEGRE | SECRETARIA MUNICIPAL GERAL DE GOVERNO | 2 SECRETARIA MUNICIPAL GERAL DE GOVERNO | 627,423 |
| PM DE PORTO ALEGRE | SECRETARIA MUNICIPAL GERAL DE GOVERNO | 3 SECRETARIA MUNICIPAL GERAL DE GOVERNO | 668,705 |
| PM DE PORTO ALEGRE | SECRETARIA MUNICIPAL GERAL DE GOVERNO | 4 SECRETARIA MUNICIPAL GERAL DE GOVERNO | 11,219 |
| PM DE PORTO ALEGRE | SECRETARIA MUNICIPAL GERAL DE GOVERNO | 5 SECRETARIA MUNICIPAL GERAL DE GOVERNO | 7,804,705 |
| PM DE PORTO ALEGRE | SECRETARIA MUNICIPAL GERAL DE GOVERNO | 6 SECRETARIA MUNICIPAL GERAL DE GOVERNO | 25,526 |
| PM DE PORTO ALEGRE | SECRETARIA MUNICIPAL GERAL DE GOVERNO | 7 SECRETARIA MUNICIPAL GERAL DE GOVERNO | 162,275 |


- Agudo: Órgão Gabinete do Prefeito/UO Estrutura do Gabinete: R$ 2.175.890 de R$ 133,1 mi (1,6%)
- Caxias do Sul: UO Gabinete do Prefeito R$ 610.260
- Canoas: Gabinete do Prefeito e Órgãos Integrantes R$ 26,3 mi (dezenas de "Gabinete do Secretário" não são do prefeito)
- Pelotas: órgão Gabinete do Prefeito contém Procuradoria Geral (R$ 9,65 mi), Chefia de Gabinete (R$ 3,67 mi), Comunicação (R$ 1,11 mi), Controle Interno (R$ 1,17 mi) e Gabinete da Vice (R$ 0,72 mi)
- Porto Alegre: UO Gabinete do Prefeito R$ 26,1 mi e 22,7 mi em código de UO reaproveitado (nomes diferentes por exercício); Secretaria Geral de Governo à parte (R$ 15,5 mi na UO 1)

Avisos: código de UO reaproveitado entre exercícios (Porto Alegre); órgão "Gabinete do Prefeito" abriga PGM (Pelotas); UO homônima sob outro órgão (Cariacica); "Gabinete do Secretário" ≠ gabinete do prefeito (Canoas). SP: o TCE-SP só informa órgão (Prefeitura, Câmara, autarquias), sem unidade orçamentária: gabinete não isolável. PE: TCE-PE inalcançável nesta rodada. Camadas: DIRECT_OFFICE_EXPENSE (UO Gabinete), CABINET_COST (órgão Gabinete do Prefeito), GOVERNMENT_BODY_COST (Secretaria de Governo), NOT_ATTRIBUTABLE ("Gabinete do Secretário"). Nunca despesa pessoal do prefeito.

## 22. Custo dos gabinetes estaduais

**MG 2025** (dados.mg.gov.br, despesa por empenho): UO 1071 Gabinete Militar do Governador, empenhado R$ 42.308.465; liquidado R$ 21.358.582; pago R$ 18.612.466 (359 empenhos); sem folha. **RS dezembro/2025** (dados.rs.gov.br, 351.323 linhas): órgão "Governo do Estado": Casa Civil do Gabinete do Governador R$ 10.169.923 pagos; Casa Militar do Gabinete do Governador R$ 2.861.496; Gabinete do Vice-governador R$ 802.386. Armadilha: "Gabinete e Órgãos Centrais" é a UO de cada secretaria (Educação: R$ 1,05 bi pagos em dezembro), não o gabinete do governador. ES, SP, RJ e PE não varridos (ES: dataset de 1,2–1,5 GB/ano; PE: TCE-PE sem resposta).

## 23. Remuneração, cargos e pessoal

SIAPE mensal 2013–2026 disponível no host CGU (~80 MB/mês): cargos comissionados e servidores agregáveis por mês; não processado além dos ministros. Atos de subsídio: sem novas medições.

## 24. Contrato canônico de identidade e temporalidade

Estado atual lido (leitura): migrations.ts define people, profiles, mandates, exercise_periods (start/end, CHECK end>=start, FK para mandates), candidacies (office TEXT); apps/collector/src/postgres-collector.ts grava civica.exercise_periods na mesma forma. Incompatibilidades:
- mandates e exercise_periods exigem profiles de parlamentar (FK por batch+person): executivos precisam de perfil ou de tabela própria
- sem entidade de cargo/órgão/unidade com versão
- sem campos de fonte, confiança, motivo de encerramento, data de publicação/efeito (só em payload JSON)
- sem entidade de ato normativo, assinatura, nomeação, exoneração, veto como linhas
- candidacies.office é texto; resultado eleitoral e vice sem coluna
- suplementar não tem representação própria

| Caso | Conflito/observação |
|---|---|
| mesmo prefeito em duas eleições | nenhum |
| vice que assume | mandato ≠ exercício exige tabela de evento |
| governador substituído temporariamente (RJ 2020-21) | exercise_periods não tem tipo |
| ministro que muda de pasta | sem entidade de cargo |
| secretaria extinta | sem versão de órgão |
| nomeação e exoneração no mesmo ano | exigem eventos com data de publicação e efeito |
| decreto por substituto | ato precisa de signatário + titular na data |
| ato republicado | sem relação de versão (DF mostra republicação) |
| eleição suplementar | mandato ordinário e suplementar na mesma UE |
| despesa de gabinete atravessando dois mandatos | unidade orçamentária contínua; titular muda |

Chaves: IK7-PERSON=hash(título eleitoral), IK7-HOLDING=pessoa+cargo+ente+início+fonte, IK7-ACT-ES=edição DIO/ES id + número do decreto-S, IK7-ACT-DOMSC=código do ato, IK7-ACT-STATE=URL/ID estável por portal (AC detalhar/N, GO legislacoes/N, ALMG DEC/N/ano), IK7-UNIT-MUN=CodigoUnidadeOrcamentaria+município (nome não confiável), IK7-SIORG=id SIORG numérico (ex.: 304). Nenhuma migration criada.

## 25. Matriz de cobertura federal/estadual/municipal

| Esfera | Roster | Exercício | Atos | Nomeações | Estrutura | Custo |
|---|---|---|---|---|---|---|
| Federal | completo | assinatura 840/840 | completo | 3 cadeias + DOU diário | SIORG + SIAPE mensal | institucional |
| Estadual (27) | completo | 2 ciclos fechados; 10 sucessões 2026; assinatura em 19 UFs | documento em 23 UFs | ES 1 cadeia | não avaliada | MG, RS |
| Municipal (5.570) | completo | 3 sucessões em capitais; 2 SC | 48.5% em nível de portal; SAPL ~23% | 1 município SC | TCE (UO) | ES + RS |

## 26. Matriz de relacionamentos comprovados

| ID | A | B | Classe | Base | Estado |
|---|---|---|---|---|---|
| R7-01 | decreto -S (ES) | nomeação/exoneração de secretário | EXACT | texto do decreto "Nomear/Exonerar X para o cargo Y" | VERIFIED_DATASET |
| R7-02 | secretário nomeado | exercício | HIGH_CONFIDENCE | atos assinados pelo secretário em edições posteriores | VERIFIED_DATASET |
| R7-03 | governador (ES/MG/PE/AC/DF/GO/MS/MT) | decreto estadual | EXACT | nome no documento | VERIFIED_DATASET |
| R7-04 | prefeito renunciante | sucessor | EXACT | ata/notícia da Câmara com termo de posse | VERIFIED_API |
| R7-05 | governador afastado (RJ 2020) | vice em exercício | HIGH_CONFIDENCE | STJ + ALERJ | VERIFIED_API |
| R7-06 | ministro (SIAPE) | unidade SIORG | PROBABLE | nome normalizado: 29/39 exato | VERIFIED_DATASET |
| R7-07 | ministro (SIAPE) | unidade SIORG (10 restantes) | UNLINKED | nomes abreviados/obsoletos | VERIFIED_DATASET |
| R7-08 | município | portal SIGPub | EXACT | entidade "Município de X" na busca avançada + UF do portal | VERIFIED_API |
| R7-09 | município | edição publicada | HIGH_CONFIDENCE | nome do município no texto da edição de 2026-10-08 | VERIFIED_DATASET |
| R7-10 | UO "Gabinete do Prefeito" | prefeito | INSTITUTIONAL_ONLY | perímetro contábil; nunca despesa pessoal | VERIFIED_DATASET |
| R7-11 | Cariacica UO Gabinete (350100) | órgão Habitação | CONFLICT | nome de UO sob órgão de outra natureza | VERIFIED_DATASET |
| R7-12 | GABINETE MILITAR (MG UO 1071) | Governador | INSTITUTIONAL_ONLY | unidade do gabinete; sem folha | VERIFIED_DATASET |
| R7-13 | eleição suplementar | interrupção de mandato | HIGH_CONFIDENCE | TSE (P6); sem data de afastamento | VERIFIED_DATASET |
| R7-14 | ato republicado (DF) | ato original | EXACT | nota "Republicado ... Edição Extra nº 05-A" | VERIFIED_API |
| R7-15 | ministro (DOU decreto de pessoal) | ingresso SIAPE | HIGH_CONFIDENCE | mesma data de efeito (Padilha 2025-03-10) | VERIFIED_DATASET |
| R7-16 | exoneração municipal (Abdon Batista) | portaria de nomeação | EXACT | texto cita "nomeado através da Portaria nº N/AAAA" | VERIFIED_API |
| R7-17 | norma estadual PI (SAPL) | projeto do Governador | EXACT | campo materia da normajuridica + autoria | VERIFIED_API |
| R7-18 | norma municipal SAPL | projeto do Prefeito | HIGH_CONFIDENCE | materia + autoria "Prefeito" em 4 de 12 instâncias | VERIFIED_API |
| R7-19 | UO Gabinete do Prefeito (RS/ES) | perímetro contábil | INSTITUTIONAL_ONLY | código de UO por exercício; nunca despesa pessoal | VERIFIED_DATASET |
| R7-20 | ministro (SIAPE mensal) | período no cargo | PROBABLE | primeiro e último snapshot com o titular; linhas legadas exigem cruzar com DOU | VERIFIED_DATASET |

## 27. Estratégia consolidada de collectors

| Ordem | Família | Reuso | Viabilidade |
|---|---|---|---|
| 1 | TSE roster e fotos (executivos) | apps/collector/src/elections.ts (estender relevant()); portrait-mirror.ts | READY_FOR_CONTRACT |
| 2 | Atos federais Senado+Planalto (incl. DEC-sn) | novo | READY_FOR_CONTRACT |
| 3 | Vetos Senado | novo | READY_FOR_CONTRACT |
| 4 | Viagens+pagamentos federais | national-finance-registry (P3/P4) | READY_FOR_CONTRACT |
| 5 | DIO/ES por id (DOE + AMUNES + diários municipais) | state/providers (padrão) | READY_FOR_CONTRACT |
| 6 | DOM/SC por categoria | state/providers | READY_FOR_CONTRACT |
| 7 | SIGPub (22 portais, PDFs por edição) | novo; exige parsing de PDF e descoberta de URLs | NEEDS_VALIDATION |
| 8 | Portais de normas estaduais (AC, DF, GO, MG, MS, MT, PE) | state/providers | NEEDS_VALIDATION |
| 9 | Despesa de gabinete por TCE/estado (ES, MG) | national-finance-registry | NEEDS_VALIDATION |
| 10 | SIAPE snapshots + ponte SIORG | novo | NEEDS_VALIDATION |
| 11 | DOU leiturajornal (decretos de pessoal por data) | novo | READY_FOR_CONTRACT |
| 12 | SAPL API (normas, matérias, autoria) Estados e Câmaras | apps/collector/src/state/providers (padrão) | READY_FOR_CONTRACT |
| 13 | FAMEM/Siganet MA | novo | NEEDS_VALIDATION |
| 14 | SIAPE mensal via host CGU | national-finance-registry | READY_FOR_CONTRACT |


Ordem: TSE/fotos → federal (atos, vetos, viagens, DOU de pessoal, SIAPE mensal) → DIO/ES → DOM/SC → SAPL (estados e Câmaras) → SIGPub → portais estaduais → custos de gabinete (ES, RS, MG) → ponte SIAFI↔SIORG.

## 28. Estimativa de custo e atualização

DOU leiturajornal: 1 requisição por seção/dia (≈ 4 por dia) + 1 por decreto de pessoal; 2013–2026 ≈ 5 mil dias úteis. SIAPE: 160 arquivos de ~80 MB (≈ 13 GB), só ministros/comissionados. DIO/ES: ~2,7 edições/dia. SIGPub: 15 portais ativos, 1 PDF/dia útil (0,8–19 MB). SAPL: API paginada, 1–3 requisições por norma. TCE-RS: 1,35 GB/ano; TCE-ES: 660 MB/ano; MG: 23 MB/ano. Federal DEC-n+DEC-sn: ~5,2 mil + ~4,7 mil páginas.

## 29. Prontidão das experiências do Cívica

| # | Experiência | Dados | Cobertura | Histórico | Autoria | Prontidão |
|---|---|---|---|---|---|---|
| 1 | Presidentes eleitos | TSE 2014/2018/2022 | 100% | 2014–2022 | eleição | READY_FOR_CONTRACT |
| 2 | Governadores eleitos | TSE | 27 UFs | 2014–2022 | eleição | READY_FOR_CONTRACT |
| 3 | Prefeitos eleitos | TSE | 5.5 mil por ciclo | 2012–2024 | eleição | READY_FOR_CONTRACT |
| 4 | Fotos históricas | TSE fotos | 100% prefeitos 2020/2024 | 2012–2024 (amostra) | candidatura | READY_FOR_CONTRACT |
| 5 | Titulares efetivamente em exercício | posse/sucessão oficial em 12 UFs e 3 capitais; assinatura de decretos em 19 UFs; federal por assinatura | 12 UFs com evento; 2 ciclos fechados | pontual | documental | NEEDS_VALIDATION |
| 6 | Substituições e sucessões | TSE suplementares; 2026 por Assembleias/Câmaras | 10 UFs 2026 + 3 capitais | 2012–2026 | documental | NEEDS_VALIDATION |
| 7 | Decretos assinados | federal 840/840; 19 UFs; SC | federal completo; estadual 19/27 | 2013–2026 federal | SIGNED_BY_PERSON onde há nome | NEEDS_VALIDATION |
| 8 | Leis sancionadas | normaGerada; Planalto; SAPL-PI | federal; PI | 2013–2026 | institucional | NEEDS_VALIDATION |
| 9 | Projetos do Executivo | Câmara institucional; SAPL (PI, municípios) | federal + PI + ~8% municípios | 2013+ | INITIATIVE_BY_OFFICEHOLDER (SAPL) | NEEDS_VALIDATION |
| 10 | Vetos | Senado processo | 765 | 2013–2026 | institucional | READY_FOR_CONTRACT |
| 11 | Medidas provisórias | Senado | série anual | 2013–2026 | institucional | READY_FOR_CONTRACT |
| 12 | Ministros por período | SIAPE mensal 2013–2026 + DOU leiturajornal | 3 cadeias verificadas; 6 snapshots lidos | 2013–2026 | decreto/diploma | NEEDS_VALIDATION |
| 13 | Secretários por período | DIO/ES decretos-S; DOM/SC portarias | 1 cadeia ES; 1 município SC | ES 2021+ | decreto/portaria | NEEDS_VALIDATION |
| 14 | Nomeações | DOU leiturajornal; DIO/ES; ALMG DNE | federal por data; ES/MG | parcial | decreto | NEEDS_VALIDATION |
| 15 | Exonerações | DOU leiturajornal; DIO/ES; DOM/SC | federal; ES; Abdon Batista | parcial | decreto/portaria | NEEDS_VALIDATION |
| 16 | Organograma | SIORG | federal | versionado | institucional | READY_FOR_CONTRACT |
| 17 | Cargos comissionados | SIAPE agregado | federal | mensal 2013–2026 disponível | institucional | NEEDS_VALIDATION |
| 18 | Servidores agregados | SIAPE | federal | mensal 2013–2026 | institucional | NEEDS_VALIDATION |
| 19 | Subsídios e remuneração oficial | atos de fixação | esparso | - | - | DISCOVERY_ONLY |
| 20 | Custo do gabinete | TCE-ES 2024; TCE-RS 2025; MG 2025; RS estado dez/2025 | ES 78 + RS 497 municípios (dados); MG; RS | 1 ano | INSTITUTIONAL_ONLY | NEEDS_VALIDATION |
| 21 | Despesas institucionais | Portal Transparência federal | federal | mensal | institucional | READY_FOR_CONTRACT |
| 22 | Cartões corporativos | CPGF | federal | mensal | sigilo 96% | NEEDS_VALIDATION |
| 23 | Viagens | PT viagens | federal 2025 | 1 ano | institucional | READY_FOR_CONTRACT |
| 24 | Agendas oficiais | - | - | - | - | DISCOVERY_ONLY |

## 30. Lacunas definitivas e dependências externas

| ID | Bloqueio | Responsável | Impacto | Alternativa |
|---|---|---|---|---|
| B7-1 | INLABS (cadastro) | responsável do produto | nomeações de segundo escalão em massa com garantia de completude | leiturajornal por data já recupera decretos de pessoal da Presidência sem login; INLABS passa a ser opcional |
| B7-2 | SIGPub: busca e calendário não reproduzíveis por script simples | engenharia | histórico por município | PDFs de edição pela home; pedir arquivo à associação |
| B7-3 | DOEM (verificação de bot) | acordo com IBDM | 56 municípios QD | nenhuma legítima sem acordo |
| B7-4 | Endpoint do Portal da Transparência com AccessDenied | - | nenhum: host CGU entrega 2013–2026 | usar dadosabertos-download.cgu.gov.br |
| B7-5 | 2685 municípios sem fonte | descoberta | cobertura nacional | diários próprios, TCEs, associações ainda não mapeadas |
| B7-6 | Tabela SIAFI↔SIORG inexistente | construção manual | vínculo cargo-unidade | tabela curada |
| B7-7 | TCE-PE inalcançável nesta rodada | repetir | PE estado e municípios | repetir; P4 já verificou |
| B7-8 | AP, CE, RJ, RR sem decreto verificado; RJ pós-eleição indireta sem fonte | trabalho de descoberta | 4 UFs | DOE de cada UF |
| B7-9 | TCE-SP sem unidade orçamentária | fonte | gabinete de prefeitos SP | portais municipais ou TCM-SP (capital) |


Acesso externo: DOEM (acordo); INLABS passa a opcional. Publicação futura: posse de 2027. Descoberta: municípios sem fonte, AP/CE/RJ/RR.

## 31. Gates

| Gate | Estado | Prova | Cobertura | Limitação | Próxima ação |
|---|---|---|---|---|---|
| P7_P5_P6_CONSISTENCY | PASS | quatro divergências reconciliadas | completa | arquivos anteriores não corrigidos | notas de correção na consolidação |
| P7_EXECUTIVE_ROSTER_INTEGRITY | PASS_WITH_CAVEATS | TSE por ciclo; DF separado | 5.5 mil prefeitos/ciclo | UEs sem eleito 1/50/74/40; sem tabela IBGE↔SG_UE | tabela de equivalência |
| P7_FEDERAL_OFFICE_HOLDING | PASS_WITH_CAVEATS | assinatura 840/840; substitutos | 2013–2026 amostral | sem ato de posse; bordas por amostra | varrer DEC-n e DEC-sn completos |
| P7_STATE_OFFICE_HOLDING | PARTIAL | ciclos fechados ES e MG; 10 UFs com sucessão de 2026 documentada institucionalmente | 12 UFs com evento oficial (ES, MG, RJ, SP, PE + GO, DF, MT, PB, PA, AC, RR) | 15 UFs sem evento próprio; RJ pós-renúncia sem desfecho; exercício por assinatura só em 19 UFs | completar eventos de 2022–2025 |
| P7_MUNICIPAL_OFFICE_HOLDING | PARTIAL | 3 sucessões em capitais com documento da Câmara; 2 SC por assinatura | 10 testados: 3 fechados, 2 por assinatura, 1 parcial, 4 não avaliados | nenhuma suplementar individual documentada | atas das Câmaras |
| P7_SUCCESSION_DOCUMENTATION | PARTIAL | 18 eventos de sucessão com fonte institucional | amostral | afastamentos temporários quase ausentes (RJ 2020; PB e ES com notícia de interinidade sem data) |  |
| P7_STATE_SIGNATORIES | PASS_WITH_CAVEATS | nome do governador no documento em 19 UFs; 4 em DOE sem assinatura isolada; 4 sem verificação | 19/27 verificadas; 2020 em 9 UFs | AP, CE, RJ, RR sem documento; ES só 2025 | testar 2020 nas demais |
| P7_MUNICIPAL_SIGNATORIES | PARTIAL | PDF 9/9; página 10/40 | 2 municípios | só SC | amostrar SIGPub e DIO/ES |
| P7_MUNICIPAL_PROVIDER_DISCOVERY | PASS_WITH_CAVEATS | 4 famílias novas verificadas (SIGPub, DIO/ES, FAMEM/Siganet, SAPL) e 5 candidatas localizadas | 4 de 5 meta | candidatas sem acervo extraído | sondar Assomasul, DOEMPI |
| P7_MUNICIPAL_COVERAGE_UNION | PASS_WITH_CAVEATS | 2699 verificados em nível de portal; 2885 com clientes | 48.5%–51.8% | verificação por portal, não por município; decretos individuais só SC | amostra por município |
| P7_STATE_NORMATIVE_COVERAGE | PARTIAL | documento real em 23 UFs (19 com nome); SAPL-PI liga lei a projeto | 23/27 com documento | 2020 em 9 UFs; leis e nomeações só em PI e ES | testar leis 2020 |
| P7_FEDERAL_APPOINTMENTS | PASS_WITH_CAVEATS | 3 cadeias com saída ou entrada por DOU e SIAPE | 3/3 (uma com ambos extremos em DOU) | decretos de nomeação de Nísia e Lewandowski não localizados; amostra de ministros | varrer todas as datas de posse |
| P7_STATE_APPOINTMENTS | PARTIAL | 1 cadeia no ES | 1/3 | demais UFs não testadas | repetir em MG (DNE) e SP |
| P7_MUNICIPAL_APPOINTMENTS | PARTIAL | 1 nomeação + 3 exonerações com referência | 1 município | PDF da nomeação é imagem; exercício não medido | ampliar a DIO/ES |
| P7_SIAPE_SIORG_IDENTITY | PARTIAL | 29/39 por nome exato; sem chave comum | 74% | nome não é identidade | tabela SIAFI↔SIORG |
| P7_EXECUTIVE_LEGISLATIVE_LINKAGE | PARTIAL | PI: projeto do Governador→lei por ID; SAPL municipal em 22,7% dos municípios amostrados e 4 de 12 instâncias com cadeia | federal + PI + ~8% dos municípios (estimativa) | vetos estaduais/municipais não medidos; autoria é pessoa | testar vetos e ES/MG/SP/RJ/PE |
| P7_CABINET_COST_MUNICIPAL | PASS_WITH_CAVEATS | UO Gabinete do Prefeito isolada em ES (4 municípios) e RS (5 municípios); TCE-SP sem UO; PE sem acesso | ES+RS (575 prefeituras em dados) ; SP não isolável | perímetros heterogêneos; mapa por município obrigatório | tabela UO→camada |
| P7_CABINET_COST_STATE | PARTIAL | MG Gabinete Militar 2025; RS Casa Civil/Casa Militar/Vice dez/2025 | 2 de 5 estados | ES, SP, RJ, PE não varridos; RS só um mês; sem folha em MG | varrer 12 meses RS e dados ES |
| P7_CANONICAL_TEMPORAL_MODEL | PASS_WITH_CAVEATS | modelo atual lido; 10 casos conceituais | conceitual | incompatibilidades listadas; nada implementado | decisão de modelagem |
| P7_COLLECTOR_FEASIBILITY | PASS_WITH_CAVEATS | 14 famílias ordenadas | - | SIGPub, portais estaduais e FAMEM NEEDS_VALIDATION |  |
| P7_PRODUCT_READINESS | PARTIAL | 9 READY_FOR_CONTRACT, 13 NEEDS_VALIDATION e 2 DISCOVERY_ONLY de 24 | - | titulares efetivos e nomeações subnacionais parciais |  |
| P7_RESEARCH_CLOSURE | PASS_WITH_CAVEATS | mapa final emitido; lacunas atribuídas a acesso, descoberta ou publicação futura | - | investigação não esgota o nível municipal | decisão de implementação |

## 32. Inventário de fontes, testes e evidências

| Teste | Resultado | Evidência |
|---|---|---|
| T7-AUD1 | PASS | DF aparece na união P6 (QD 1); sem DF: P6 = 730/5.570 (13,1%) |
| T7-AUD2 | PASS | nomear=58, exonerar=128; "exonerar nomear"=0 (AND); "nomear OR exonerar"=584=total (OR não suportado); sem categoria: nomear=142, exonerar=138; unidade = publicação com o termo; sem erro de serialização |
| T7-AUD3 | PASS | DEC=628 (297 DEC-n + 331 DEC-sn); script P6 exigia <numero> e descartou DEC-sn; sem queda normativa |
| T7-AUD4 | PASS | 37/37 falhas de extração (34 entidades HTML, 3 ordinal/nome curto); 37/37 recuperadas; 840/840 |
| T7-GOV | PARTIAL | ES e MG ciclo fechado; RJ, SP, PE parciais |
| T7-GOV-2026 | PASS_WITH_CAVEATS | 10 UFs com página institucional: GO (Alego, 2026-03-31), DF (CLDF, renúncia 03-28, posse 03-30), MT (ALMT, 03-31), PB (A União/Governo, 04-02), PA (Alepa, renúncia 04-02), AC (Agência AC, comunicação 03-24 com efeito 04-02), RR (ALERR, 03-27), ES (04-02), MG (03-22), RJ (renúncia 03-23; ALERJ regula eleição indireta). Amazonas NÃO renunciou (corrige lista da imprensa) |
| T7-GOV-SIG | PASS_WITH_CAVEATS | 2025: AC, AM, BA(PDF SEFAZ), DF, ES, GO, MA, MG, MS, MT, PE, PI, RO, SC, SE, TO, SP(2023); 2020: AC, DF, GO, MG, MS, MT, PE, PR, SP; RS 2021; PA/PB/RN/AL só edição do DOE com decretos e nome no cabeçalho; AP, CE, RJ, RR sem documento verificado |
| T7-MAYOR | PARTIAL | ver mayor_office_holding |
| T7-PROV | PASS_WITH_CAVEATS | SIGPub 22 portais, 2195 municípios clientes; DIO/ES AMUNES 40; FAMEM/Siganet MA 20 municípios em 1 edição; SAPL em 68/300 municípios amostrados (legislação); candidatos Assomasul, DOEMPI, publicacoesmunicipais, diariomunicipios, MPX sem acervo extraído |
| T7-UNION | PASS_WITH_CAVEATS | verificada 2699 (48.5%); com clientes sem edição recente 2885 (51.8%); sem fonte 2685 |
| T7-FED-CHAINS | PASS_WITH_CAVEATS | Saúde: Queiroga exonerado 2023-01-01 (DOU do2); Nísia ingresso 2023-01-01 (SIAPE 202301/202502); EXONERAR Nísia + NOMEAR Padilha no DOU Ed. 46-A Seção 2 Extra A de 2025-03-10; SIAPE 202504 Padilha ingresso 2025-03-10. Secom: Pimenta exonerado a pedido e Sidônio nomeado em 2025-01-14 (do2e). Justiça: Dino exonerado a pedido a partir de 2024-02-01 (do2e 2024-01-31); Lewandowski ingresso 2024-02-01 (SIAPE 202502) |
| T7-SIAPE-HIST | PASS | HTTP 200 em 201301..202607; ministros por snapshot: 34 (2013-01), 28 (2016-01), 39 (2019-01), 43 (2023-01), 38 (2025-02), 38 (2025-04); linhas legadas aparecem (ex.: Queiroga ainda em 2023-01) |
| T7-ES-CHAIN | PASS_WITH_CAVEATS | Decreto 005-S exonera Miguel Paulo Duarte Neto; 007-S nomeia Tyago Ribeiro Hoffmann (02.01.2025); exercício assinado até 2026-03-31; Decreto 626-S designa Gleikson Barbosa dos Santos para responder pelo cargo |
| T7-MUN-CHAIN | PASS_WITH_CAVEATS | Portarias 554, 555 e 556/2024 (2024-12-30) exoneram três secretários citando a portaria de nomeação (180/2023, 258/2021, 102/2023); Portaria 180/2023 localizada (ato 4591466, publicada 2023-02-24) com PDF-imagem sem texto |
| T7-SAPL-PI | PASS | 449 normas de 2025, 449 com matéria vinculada (100%); amostra de 60: 37 com autoria Governador/Governo (ex.: Projeto de Lei Ordinária do Governo nº 101/2025 → Lei 8.914 de 2025-12-23, autor Rafael Tajra Fonteles) |
| T7-SAPL-MUN | PASS_WITH_CAVEATS | 68/300 municípios com API SAPL no padrão sapl.<municipio>.<uf>.leg.br (22,7%); em 12 instâncias: 4 com normas de 2025 ligadas a matéria e autoria Prefeito/Executivo (Perdizes MG, Adamantina SP, Roraínópolis RR, Sete Lagoas MG), 2 com normas sem matéria, 6 sem normas de 2025 |
| T7-SIAPE-SIORG | PARTIAL | sem chave comum; nome normalizado exato 29/39; 10 sem match |
| T7-CAB-MUN | PASS_WITH_CAVEATS | ES e RS isolam UO; TCE-SP só órgão (sem UO); ver municipal_cabinet_costs |
| T7-CAB-STATE | PASS_WITH_CAVEATS | MG Gabinete Militar R$ 18,6 mi pagos; RS Casa Civil/Casa Militar/Vice no órgão "Governo do Estado" em dez/2025; ES, SP, RJ e PE não varridos (TCE-PE inalcançável nesta rodada) |
| T7-MODEL | PASS | ver canonical_model_audit |


- p7/portarias_recon.json
- p7/bad_cat.json
- p7/bad2.json
- p7/sigpub_assoc.json
- p7/sigpdf.json
- p7/union2.json
- p7/final_union.json
- p7/dioscan_9781_9815.json
- p7/dioscan_11015_11060.json
- p7/dioes_mun.json
- p7/statedoc.json
- p7/statedoc2.json
- p7/siape_siorg.json
- p7/escab.json
- p7/mg_Empenho_2025.csv
- p7/prov_probe.json
- p7/sig2020.json
- p7/sig3.json
- p7/sig4.json
- p7/sapl_pi.json
- p7/sapl_scan.json
- p7/sapl_mun.json
- p7/rscab.json
- p7/rsstate.json
- p7/famem_ed.json
- p7/siape_hist_201301.json
- p7/padilha_chain.json
- p7/dom_secret.json
- p7/fam.json
- p7/dou_min_*.json

## 33. Conclusões e recomendação de implementação

**Respostas**

- A. Governadores: posse e exercício fechados em ES e MG; sucessão de 2026 oficial em mais 8 UFs (GO, DF, MT, PB, PA, AC, RR, RJ); RJ, SP e PE parciais; decretos com governador nominal em 19 UFs.
- B. Prefeitos: 3 sucessões documentadas em capitais (Vitória, Recife, São Paulo), 2 municípios de SC por assinatura; 4 dos 10 não testados.
- C. Municípios novos fora de QD/DOM-SC: 1969 verificados em nível de portal; 2155 com clientes.
- D. Cobertura de decretos/leis/portarias municipais: individual só em SC e em SAPL (~23% dos municípios, cadeia utilizável em ~1/3 das instâncias); nos demais, publicação por edição.
- E. Signatários: estaduais em 19 UFs; municipais em 2 municípios de SC.
- F. Cadeia nomeação→exercício→exoneração: 3 federais (ministros), 1 estadual (ES), 1 municipal parcial (Abdon Batista).
- G. SIAPE↔SIORG: sem chave comum; 29/39 por nome exato.
- H. Projeto→lei: federal (veto), PI (SAPL) e ~8% dos municípios estimado; vetos locais não medidos.
- I. Custo de gabinete: sim em ES e RS municipal, MG e RS estadual; não em SP municipal (sem UO); perímetro por município.
- J. Prontas para implementar: 9 experiências READY_FOR_CONTRACT; 13 NEEDS_VALIDATION.
- K. Dependem de terceiros: DOEM; INLABS apenas como reforço; publicação de 2027.
- L. Cobertura máxima realista: municipal ≈ 52% por portal; documentos individuais muito menos; federal completo.
- M. Ordem de implementação: seção 27.

**Decisão por frente**
- Implementar agora: perfis eleitos e fotos; atos federais; vetos e MPs; viagens e pagamentos; ministros por DOU+SIAPE; DIO/ES; DOM/SC; SAPL (API).
- Implementar com cobertura parcial explícita: titulares em exercício; decretos estaduais em 19 UFs; custo de gabinete ES/RS/MG; SIGPub.
- Prova técnica adicional localizada: ponte SIAFI↔SIORG; vetos em SAPL; AP/CE/RJ/RR; TCE-PE; nomeações em MG e SP.
- Aguardar acesso externo: DOEM.
- Não implementar: ranking de gastos de gabinete entre municípios sem mapa de UO; atribuição pessoal de despesas; agendas.
