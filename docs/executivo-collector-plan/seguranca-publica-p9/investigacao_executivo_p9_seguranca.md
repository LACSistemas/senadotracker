# CÍVICA — P9: Investigação nacional de Segurança Pública

**Data das provas:** 21/10/2026 · **Escopo:** investigação documental. Nenhum collector, tabela, migration, backfill, alteração de PostgreSQL, alteração de frontend, commit ou push foi feito.
**Artefatos irmãos:** `investigacao_executivo_p9_fontes.json` (49 fontes), `…_testes.json` (49 testes), `…_indicadores.csv` (95 indicadores), `…_cobertura_ufs.csv` (324 linhas = 27 UFs × 12 famílias), `…_armazenamento.csv`, `…_plano_execucao.md`, `results.json`.

---

## 1. Resumo executivo

1. **Homicídio por município no Brasil inteiro é possível, e sem baixar nada novo.** O SIM já está preservado no SSD (324 arquivos definitivos 2013–2024 + 27 preliminares de 2025). Nele, mortes por agressão (CID-10 X85–Y09) e intervenção legal (Y35) por município de residência e de ocorrência reconciliam **exatamente** com o Atlas da Violência (ES 2023: 1.154 + 7 = 1.161; ES 2024: 1.043 + 21 = 1.064). Ressalva central: em vários estados a causa indeterminada (Y10–Y34) é grande (SP 2025 preliminar: 2.598 agressões e 5.376 indeterminadas), de modo que taxas de homicídio **não são comparáveis entre UFs sem mostrar esse resíduo**.
2. **O VDE/Sinesp cobre todas as 27 UFs, mas só tem município em 11 de 31 eventos.** Homicídio doloso, tentativa, latrocínio, lesão corporal seguida de morte, feminicídio (e tentativa), suicídio, mortes a esclarecer, mortes no trânsito e mandados de prisão têm município. Estupro, tráfico, furto/roubo de veículo, roubo de carga, roubo a instituição financeira, apreensões, desaparecidos e intervenção do Estado só existem por UF. O VDE não tem código IBGE: o cruzamento por nome normalizado casou 5.564 de 5.597 pares UF×município (27 “NÃO INFORMADO” + 6 grafias).
3. **Roubo e furto municipais não existem em cobertura nacional.** Há bases municipais operacionais em RJ, MG, ES, RS, CE/PE/AL (somente CVLI), SP (microdado, exige integração local) e DF (por Região Administrativa). 8 UFs (SC, SE, AC, AP, RN, PB, RO, RR) não tiveram arquivo estruturado localizado nas páginas testadas — isso não prova inexistência, apenas que não se encontrou fonte coletável.
4. **Efetivo existe por UF, não por município nem por unidade.** PM/PC/CBM/perícia/polícia penal por UF vêm do Raio-X do FBSP 2026 (PDF, 2025) e do ESTADIC 2023 (RO sem resposta). Guardas municipais têm base municipal oficial (MUNIC 2023: 1.322 municípios com guarda, 101.854 guardas). PF e PRF existem só como total nacional: o SIAPE traz “Sigiloso” em cargo e UF.
5. **Sistema prisional é o melhor caso de dado por unidade:** SISDEPEN 19º ciclo = 1.532 estabelecimentos, Código IBGE em 1.529, vagas e população por unidade, 1.737 colunas.
6. **Facções: não há fonte pública estruturada confiável.** O Mapa das Organizações Criminosas (SENAPPEN, 2024: 88 organizações, 1.760 pavilhões) é sigiloso; só circula uma versão resumida. Não será publicado mapa territorial de facções.
7. **Trânsito é rico, mas assimétrico:** frota municipal (Senatran, 5.573 linhas, 133.337.839 veículos em set/2026), RENAEST (8.659.572 sinistros, `codigo_ibge` nativo, mas só 23 UFs reportaram em 2024 e 4 estão ausentes: AP, MA, PA, RN), PRF (rodovias federais) e SIM (óbitos). Detran: 26 de 27 portais responderam, com poucas estatísticas estruturadas.
8. **Finanças:** a função 06 do RREO (Siconfi) já foi lida de ponta a ponta para ES 2024 (R$ 2,54 bi empenhados) e Vitória (R$ 76,8 mi), e reaproveita o collector financeiro existente.
9. **Armazenamento:** Cenário A ≈ 0,97 GiB no PostgreSQL (≈ 2,19 GiB com histórico de mudanças); B ≈ 1,32 GiB (2,94 GiB); C ≈ 2,86 GiB (6,31 GiB). RAW no SSD ≈ 13 GiB na carga inicial + ≈ 7,5 GiB/ano. O banco hoje tem 20,4 GiB; o SSD de 500 GB comporta tudo com folga.
10. **95 indicadores candidatos:** 15 prontos para contrato, 57 prontos com ressalvas, 10 a validar, 6 dependem de integração local, 4 só descoberta, 3 inviáveis com dado público.

---

## 2. Tabela executiva (as 15 áreas)

| Área | Fontes testadas | Cobertura Brasil | Cobertura UF | Cobertura municipal | Histórico | Estado |
|---|---:|---|---|---|---|---|
| Crimes contra a vida | 9 (S01, S03, S04, S20, S22, S24, S26–S28) | Sim: SIM (vítimas de agressão) e VDE | 27/27 (SIM, VDE) | **Nacional via SIM (5.570)**; VDE por nome (5.564 de 5.570 nomes municipais válidos diretamente; 6 por alias validado na P9.1; ver Errata); estadual RJ, MG, RS, CE, PE, AL | SIM 2013–2025p; VDE 2015–2026; Atlas 1980–2024 | READY_FOR_CONTRACT (SIM) / READY_WITH_CAVEATS (VDE) |
| Crimes patrimoniais | 8 | Só veículo, carga e instituição financeira (VDE) | 27/27 nesses três tipos | Só RJ, MG, ES, RS (+ SP e DF locais) | RJ 2003+; MG 2012+; ES 2018+; VDE 2015+ | PARTIAL |
| Violência sexual/doméstica | 4 (S01, S05, S20, S25) | Estupro e estupro de vulnerável (VDE, por UF); feminicídio com município | 27/27 | Feminicídio (VDE por nome); estupro municipal só em RJ, MG e SP | 2015–2026 | READY_WITH_CAVEATS |
| Drogas e armas | 5 | Tráfico, armas e drogas apreendidas (VDE, UF) | 27/27 | RJ (municípios e CISP), MG e ES parcial | 2015–2026 | READY_WITH_CAVEATS |
| Efetivo PM | 3 (S06, S07, S05) | Total 413.319 (2025) | 27/27 (FBSP); 26/27 (ESTADIC) | **Não** (sem fonte pública) | 2022 e 2025 (FBSP); ESTADIC 2023 | READY_WITH_CAVEATS (UF) / NOT_FEASIBLE (município) |
| Efetivo PC | 3 | Total 96.902 (2025) | 27/27 | **Não** (só existência de delegacia, MUNIC) | 2022 e 2025 | READY_WITH_CAVEATS (UF) |
| PF/PRF | 2 (S09, S06) | PF 12.536; PRF 12.328 (FBSP 2025); SIAPE PF 17.253 e PRF 14.000 vínculos | Não (SIAPE “Sigiloso”) | Não | 2025/2026 | NEEDS_VALIDATION |
| Guardas municipais | 2 (S08, S06) | 107.457 (FBSP) / 101.854 (MUNIC) | 27/27 | **Nacional (5.570, MUNIC)** | MUNIC 2023 (31/12/2022) | READY_FOR_CONTRACT |
| Unidades policiais | 4 (S21, S42, S43, S44) | Delegacias existentes (MUNIC) | Não padronizado | Existência de delegacia: 4.231 municípios; CISP RJ (138); PRF (delegacia/UOP) | MUNIC 2023 | PARTIAL |
| Atividade policial | 4 (S20, S21, S40, S41) | Mortes por intervenção, mandados (VDE); sem produtividade nacional | 27/27 só nesses itens | RJ (prisões, apreensões, UPP, policiais mortos) | 2003+ (RJ); 2015+ (VDE) | PARTIAL |
| Sistema prisional | 2 (S50, S51) | 19º ciclo; ciclos 11º–19º listados | 27/27 | **1.532 estabelecimentos** (1.529 com IBGE) | 2016–2025 (semestral) | READY_WITH_CAVEATS |
| Facções | 2 (S60, S61) | Só relatório resumido (88 Orcrims) | Não | Não | 2022–2024 | NOT_FEASIBLE (estruturado) / DISCOVERY_ONLY |
| Detran/Senatran | 3 (S70, S71, S74) | Frota nacional por município; infrações por UF | 27/27 | **Frota 5.529 de 5.572 (99,2 %)**; Detran: 26/27 portais com resposta, poucas bases | 2026-09 (frota); 2021-07+ (infrações) | READY_WITH_CAVEATS / LOCAL_INTEGRATION_REQUIRED (Detran) |
| Sinistros de trânsito | 3 (S72, S43/S73, S04) | RENAEST + PRF + SIM | RENAEST 23 UFs em 2024 (ausentes AP, MA, PA, RN); PRF 27/27; SIM 27/27 | RENAEST e PRF por município; SIM nacional | RENAEST 2018–2026-05; PRF 2007–2026; SIM 2013–2025p | READY_WITH_CAVEATS |
| Finanças de Segurança | 4 (S80–S83) | Portal da Transparência (União) | Siconfi por UF | Siconfi por município (RREO, função 06) | 2015–2026 | READY_FOR_CONTRACT (Siconfi) |

---

## 3. Inventário de fontes (49)

Estado operacional por fonte: 7 READY_FOR_CONTRACT, 22 READY_WITH_CAVEATS, 10 NEEDS_VALIDATION, 3 LOCAL_INTEGRATION_REQUIRED, 6 DISCOVERY_ONLY, 1 NOT_FEASIBLE_WITH_PUBLIC_DATA, 0 PROVEN_EXTERNAL_BLOCKER. O detalhe de cada fonte (URL, campos, limitações, coleta proposta) está em `investigacao_executivo_p9_fontes.json`.

| Família | Fontes |
|---|---|
| Criminalidade nacional | S01 VDE, S02 Mapa da Segurança Pública, S03 Atlas/Ipeadata, S04 SIM |
| Efetivo | S05 Anuário FBSP, S06 Raio-X FBSP, S07 ESTADIC, S08 MUNIC, S09 SIAPE, S10 portais estaduais de transparência, S11 PISP (descontinuada; última edição 2020) |
| Estaduais | S20–S21 RJ/ISP; S22 MG; S23 RS; S24 ES; S25 SP; S26 CE; S27 PE; S28 AL; S29 BA; S30 DF; S31 GO; S32 PR; S33 PA; S34 PI; S35 MT; S36 MS; S37 TO/AM/MA; S38 SC/SE/AC/AP/RN/PB/RO/RR |
| Atividade e unidades | S40 (RJ: policiais mortos, armas, drogas, UPP), S41 Portaria 1.145/2026, S42 MUNIC delegacias, S43 PRF unidades, S44 cadastro de delegacias |
| Prisional | S50 SISDEPEN, S51 Anuário parte 6 |
| Facções | S60 Mapa Orcrim, S61 Fogo Cruzado |
| Trânsito | S70 frota, S71 infrações, S72 RENAEST, S73 PRF datatran, S74 Detrans |
| Finanças | S80 Siconfi, S81 Portal da Transparência, S82 Anuário gastos, S83 P3/P4 e PNCP |
| Território | S90 fundação territorial do `civica_exec` |

---

## 4. Provas operacionais (o que foi realmente lido)

Todos os testes (HTTP, tamanho, campos, registros, resultado) estão em `investigacao_executivo_p9_testes.json`. Os mais determinantes:

- **VDE:** `bancovde-{2015..2026}.xlsx`, todos com 206 em GET com `Range`; HEAD retorna 403 (usar GET e User-Agent de navegador). 2025: 832.302 linhas; 2026: 618.206 (9 meses). Apenas 12,4 % das linhas são não-zero. Totais 2025: homicídio doloso 31.518 vítimas; feminicídio 1.578; latrocínio 805.
- **SIM RAW (local):** reconciliação exata com o Atlas no ES (2023 e 2024). Mortes no trânsito (V01–V99 + Y85.0), 2023: ES 819, SP 5.132, RS 1.770, MG 3.351.
- **Ipeadata `AVIOL12_HOMIC` (+F, +J):** 445.240 linhas (204.928 municipais, 1980–2022; UF até 2024). O filtro `TERCODIGO` é ignorado, então a resposta vem completa. Não é fonte independente do SIM.
- **RJ ISP:** `BaseMunicipioMensal.csv` com 14.076 linhas, 92 municípios, código IBGE de 7 dígitos, 2014-01 a 2026-09, 62 colunas; base por CISP com 38.410 linhas, 138 CISPs, 2003–2026.
- **MG SEJUSP:** 853 municípios, 2012–2026; “Crimes Violentos 2024–2026” = 399.204 linhas (32,2 MB). **Cuidado:** meses futuros vêm preenchidos com zero até dez/2026, embora o arquivo diga “Atualizado Setembro 2026”.
- **ES SESP:** `OCORRENCIAS.csv` com 651.581 linhas (53,2 MB), 2018-01 a 2026-09-30, 78/78 municípios casam por nome. Cobre patrimônio, estelionato e crimes informáticos; **não** traz homicídios. `ENVOLVIDOS` e `OBJETOS` têm atributos pessoais (orientação sexual, marcas de aparelhos) e **não devem ser coletados**.
- **SP:** `SPDadosCriminais_{2022..2026}.xlsx` (~200 MB/ano), nível de boletim, com endereço e coordenadas; 2002–2021 retornam 404.
- **RS:** XLSX por ano com abas mensais por município (2025 = 968 KB) e ZIP de ocorrências (18,4 MB) com atributos de vítima.
- **CE, PE, AL, DF:** CVLI de PE (86.290 linhas, 2004–2026-09), AL (2012–ago/2026, 2,56 MB), CE (XLSX mensais por tipo) e DF (XLSX por Região Administrativa e RISP, 2014–2026).
- **FBSP Raio-X 2026:** PDF de 1,85 MB; Tabela 2 (Brasil, 2025): PM 413.319; CBM 63.002; PC 96.902; perícia 19.340; polícia penal 91.850; PF 12.536; PRF 12.328; GM 107.457; total 818.521. A extração das linhas de SP e RS da Tabela 2 não ficou confiável e precisa de conferência manual.
- **ESTADIC 2023:** PM 398.455 e PC 107.968 (26 UFs; RO sem resposta). **MUNIC 2023:** 1.322 municípios com guarda; MSEG283 = 101.854; delegacia de polícia civil em 4.231 municípios.
- **SISDEPEN 19º ciclo:** 9,3 MB, 1.532 × 1.737; 1.360 celas físicas + 172 domiciliares; 1.527 estaduais, 5 federais.
- **Senatran frota:** 737 KB, 5.573 linhas, 133.337.839 veículos; 5.529 de 5.572 casam por nome (99,2 %).
- **RENAEST:** 56 ZIPs mensais cumulativos (10-2021 a 05-2026); último ZIP = 529 MB; Acidentes 2,73 GB e Vítimas 1,85 GB descompactados; 8.659.572 linhas de acidente com `codigo_ibge`.
- **PRF:** `datatran2026.zip`, 48.712 linhas, 27 UFs, até 31/08/2026, 4.121 mortos; campos regional, delegacia e UOP.
- **Siconfi:** RREO Anexo 02 função “Segurança Pública” lido (ES 2024: R$ 2.542.606.519,59 + intra R$ 62.078.602,47; Vitória R$ 76.842.715,85 + R$ 12.150.348,81).

Falhas e limites dos testes: o Overpass (OSM) retornou 504 (unidades policiais no OSM ficam em DISCOVERY_ONLY, inconclusivo); o portal de MS recusou conexão; a API do Fogo Cruzado exige cadastro e o site respondeu com desafio anti-bot; a primeira baixada do Mapa 2026 truncou em 120 s e foi refeita com 600 s.

---

## 5. Criminalidade

**Taxonomia.** O VDE usa eventos (33, dos quais 5 de bombeiro, só por UF), o SIM usa CID-10 e os estados usam naturezas próprias (RJ: títulos de ISP; MG: 13 naturezas de crimes violentos; SP: rubricas do Código Penal; CE/PE/AL: CVLI). Não existe equivalência 1:1.

| Conceito | Medida | Observação |
|---|---|---|
| Homicídio (SIM) | óbitos por agressão + intervenção legal, residência ou ocorrência | saúde pública; inclui homicídios culposos e legítima defesa; não é crime “comprovado” |
| Homicídio doloso (VDE) | **vítimas** | informadas pelas polícias; não é o mesmo que o SIM (ES 2025: SIM prelim 919 vs. VDE 762) |
| CVLI (estados) | ocorrências/vítimas por critério estadual | agrega homicídio, latrocínio e lesão seguida de morte; definição muda por UF |
| Roubo/furto | ocorrências registradas | depende de propensão a registrar; não é “crime consumado” |

**Regras de método:** vítimas ≠ ocorrências; ocorrência ≠ crime provado; zeros do VDE podem ser zero reportado ou ausência de relato (a fonte não distingue; a apreensão de cocaína, lida só pela coluna `total`, parecia 100 % zero, mas o valor está em `total_peso` — ver Errata); o resíduo de causa indeterminada deve acompanhar todo indicador de homicídio do SIM.

**Cobertura efetiva de crimes patrimoniais.** Por UF no VDE: roubo/furto de veículo, roubo de carga, roubo a instituição financeira. Municipais: RJ (roubo transeunte, celular, coletivo, veículo, carga, comércio, residência; furtos; estelionato, extorsão, sequestro), MG (roubo e furto por alvo), ES (roubos, furtos, estelionato, informáticos), RS; SP e DF exigem integração local.

---

## 6. Efetivos

Quatro conceitos que não se misturam: **quadro previsto**, **efetivo da ativa**, **vínculos (SIAPE)** e **lotação operacional**. Só o FBSP traz previsto × existente.

| Corporação | Brasil | UF | Município | Unidade |
|---|---|---|---|---|
| PM | 413.319 (FBSP 2025) / 398.455 (ESTADIC 2023) | 27/27 (FBSP); 26/27 (ESTADIC) | não | não |
| PC | 96.902 / 107.968 | idem | não (existência de delegacia em 4.231 municípios) | não |
| PF | 12.536 (FBSP) / 17.253 vínculos (SIAPE) | não (SIAPE “Sigiloso”) | não | não |
| PRF | 12.328 / 14.000 vínculos | não | não | PRF publica regional/delegacia/UOP nas ocorrências, não efetivo |
| Guarda municipal | 107.457 (FBSP) / 101.854 (MUNIC) | 27/27 | **1.322 municípios com guarda (MUNIC)** | não |

A diferença entre FBSP e ESTADIC (PM 413 mil × 398 mil; PC 97 mil × 108 mil) vem de datas e conceitos distintos e **não deve ser “conciliada”**: mostrar as duas com a data. O MJSP/PISP teve sua última edição em 2020.

---

## 7. Unidades policiais

- **Delegacias:** não existe cadastro nacional aberto (S44, DISCOVERY_ONLY). MUNIC 2023 dá apenas existência de delegacia por município (4.231) e de especializadas. RJ publica as 138 CISPs; PRF expõe regional/delegacia/UOP de cada ocorrência (lista de unidades derivável, não cadastro oficial).
- **Batalhões:** sem fonte pública nacional ou estadual encontrada. Fica DISCOVERY_ONLY; não inferir a partir de notícias.
- OSM (Overpass 504): inconclusivo.

---

## 8. Atividade policial e inquéritos

Públicos e estruturados: RJ (prisões em flagrante, apreensões de armas e drogas, UPP, policiais mortos), VDE (mandados de prisão cumpridos, mortes por intervenção do Estado, armas apreendidas, policiais vitimados), MG/ES parcialmente. **Inquéritos:** a evidência da P2 permanece — SP trimestral, RJ taxa de elucidação por coorte, Portaria MJSP 1.145/2026 (padrão nacional ainda sem publicação de dados) e DataJud classe 279 (processo judicial, não inquérito policial). Medir “inquéritos e resultados” nacionalmente **não é viável** com dado público hoje; o RJ é o piloto possível.

---

## 9. Sistema prisional

SISDEPEN 19º ciclo: 1.532 estabelecimentos (1.527 estaduais, 5 federais), Código IBGE em 1.529. Há capacidade e população por unidade, por regime e por gênero, e servidores. Ciclos 11º–19º aparecem na página (2016–2025). Estabelecimentos por UF constam em `sisdepen_uf.json` (ex.: ES 56, GO 81, CE 34). **Atenção:** somas ingênuas das colunas de vagas/população dobram sub-colunas e **não devem ser publicadas**; o contrato deve fixar quais colunas definem capacidade e população (taxa de ocupação = NEEDS_VALIDATION).

---

## 10. Facções e crime organizado

| Produto | Descrição | Decisão |
|---|---|---|
| A | Catálogo de relatórios oficiais públicos (títulos, data, link, órgão) | Viável (DISCOVERY_ONLY): sem dados de pessoas ou territórios |
| B | Indicadores indiretos (homicídios, apreensões, letalidade, prisões) apresentados **sem** atribuição a organizações | Viável pelos eixos A e D; deve ter nota metodológica |
| C | Mapa de presença ou controle territorial de facções | **Não será feito.** Mapa Orcrim é sigiloso; Fogo Cruzado não é oficial; menções, prisões e notícias não provam controle |

Resposta honesta: informação confiável sobre facções é limitada a (i) a existência de 88 organizações e 1.760 pavilhões em 2024 conforme versão resumida do SENAPPEN e (ii) indicadores gerais de violência. Nada com nome de pessoa, apelido ou localização de integrante.

---

## 11. Detran e Senatran

- Frota (S70): por município, tipo, combustível, ano de fabricação, cor e potência; mensal; set/2026 testado. Cruzamento com IBGE por nome (5.529 de 5.572).
- Infrações (S71): 73 arquivos mensais (2021-07 a 2026-09), **por UF de jurisdição do veículo**, não do local da infração.
- Detrans (S74): 26 dos 27 portais responderam 200 (RN 503; TO com aviso de suspensão). Dados estruturados foram achados em poucos; GO tem multas via CKAN. Não há padrão: a resposta a “Detran nas 27 UFs” é **não** como base estruturada, **sim** como existência de portais.

---

## 12. Trânsito

| Base | Unidade | Cobertura | Observação |
|---|---|---|---|
| RENAEST | sinistro e vítima, município (`codigo_ibge`) | 2018: 25 UFs; 2019: 27; 2020: 26; 2021: 26; 2022: 26; 2023: 25; 2024: 23; 2025: 23 | cobertura desigual: RS reporta só fatais (1.511 sinistros e 1.644 óbitos em 2024); DF = 1 município; MG 298.644 sinistros |
| PRF datatran | rodovias federais | 27 UFs | subconjunto geográfico |
| SIM (V01–V99 + Y85.0) | óbito por município | 27 UFs | ES 2023: 819 óbitos SIM vs. 972 RENAEST — conceitos diferentes (residência/ocorrência vs. 30 dias) |
| VDE | mortes no trânsito | município por nome | segue notificação policial |

**Não somar** RENAEST, PRF e VDE: são sobrepostos. Comparação entre UFs só com cobertura do RENAEST mostrada ao lado.

---

## 13. Finanças

Siconfi RREO Anexo 02, função 06, com subfunções (Policiamento, Defesa Civil, Informação e Inteligência), usa o `exec_fin_fact` e o collector financeiro existentes. Respeitar a distinção **dotação → empenho → liquidação → pagamento** (o RREO traz empenhada até o bimestre). Portal da Transparência: `despesas-execucao/202509` (zip, 7,6 MB) e `orcamento-despesa/2025` (808 KB) abertos; `/despesas/2025` retorna 403. Despesa de pessoal por corporação e contratos por órgão exigem integração (P3/P4).

---

## 14. Cobertura territorial

- **Território:** 5.631 entidades no `civica_exec`; crosswalk por nome para VDE, Senatran, RS, ES, PRF; IBGE nativo em SIM, RENAEST, SISDEPEN, RJ, MG (6 dígitos), SP e MUNIC.
- **Municipal nacional comprovada:** homicídio (SIM: 5.570 com código IBGE), VDE por nome (5.564 de 5.570 nomes municipais válidos casam diretamente = 99,89 %; mais 6 por alias validado; 27 pares "NÃO INFORMADO" ficam fora; total de 5.597 pares; ver Errata), guarda municipal (MUNIC 5.570), frota (5.529 de 5.572, 99,2 %), existência de delegacia (MUNIC).
- **Municipal por UF:** RJ, MG, RS, ES, CE/PE/AL (CVLI), SP (local), DF (RA).
- Detalhe por UF × família × fonte em `investigacao_executivo_p9_cobertura_ufs.csv`.

---

## 15. Metodologia e comparabilidade

- Prova mínima de “operacional”: arquivo baixado e lido, campos e contagem registrados.
- Denominadores: taxas usam a população do SIDRA 6579 já carregada. **Não há estimativa oficial para 2007, 2010, 2022 e 2023**: não interpolar em silêncio.
- **Enganosos se comparados:** (i) homicídio SIM entre UFs com resíduo de indeterminadas muito diferente (SP, MG, RJ); (ii) VDE vs. SIM; (iii) CVLI entre estados (definições distintas); (iv) roubo/furto entre estados (propensão a registrar); (v) sinistros RENAEST entre UFs (cobertura); (vi) efetivo bruto sem população ou área; (vii) infrações por UF de jurisdição do veículo; (viii) série MG com zeros futuros.
- Nunca construir um “índice de segurança” único.

---

## 16. Arquitetura (reuso da fundação)

Reutilizar: `exec_entity` (UF e município), `exec_ind_def/value/latest`, `exec_story`, `exec_publication` (fatias dataset × UF × competência), `exec_raw_manifest`, `exec_fin_fact`, `run-queue.ts`, `assertVolume`/`assertPgHeadroom`, RAW em `D:\Civica\raw`, intervalos semiabertos. Novo apenas onde o dado não cabe em indicador: um cadastro de estabelecimentos prisionais (≈ 1.532 linhas largas) e, se aprovado, uma tabela de efetivo por UF×corporação×data. Persistir só linhas não-zero do VDE com marcador de universo por UF×mês, e agregações (nunca boletins, vítimas, endereços ou coordenadas).

**Privacidade:** SP, RS, ES, CE, PE e AL oferecem microdados com atributos pessoais ou locais; o collector deve **agregar em streaming** e descartar os campos antes de gravar. O RAW desses arquivos só deve ser preservado se a política de privacidade aprovar (ou preservar apenas o recorte agregado).

---

## 17. Armazenamento

Fórmulas e premissas por componente estão em `investigacao_executivo_p9_armazenamento.csv`. Medidas reais usadas: `exec_ind_value` 4.071.624 linhas = 796.958.720 B (**196 B/linha com índices**); `exec_change_log` 15.086.184 linhas = 3,43 GB (**227 B/linha**); banco total 20,4 GiB; `max_wal_size` = 1 GiB.

| Cenário | Linhas (acumulado) | PostgreSQL (sem histórico de mudanças) | Com `exec_change_log` completo |
|---|---:|---:|---:|
| A — agregados territoriais | 5,77 M | 0,97 GiB | 2,19 GiB |
| B — + estrutura institucional | 7,63 M | 1,32 GiB | 2,94 GiB |
| C — + granularidade pública ampliada | 16,29 M | 2,86 GiB | 6,31 GiB |

RAW no SSD: ≈ 13,4 GiB (carga inicial + 1º ano), com maior peso em RENAEST (≈ 3,9 GiB), SP (≈ 2,6 GiB), ES (≈ 2,1 GiB) e MG (≈ 1,3 GiB); crescimento ≈ 7,5 GiB/ano em versões mensais. Staging ≤ 2 GiB (leitura em fluxo). WAL e backup são premissas de projeção (não medidas). Atualização mensal ≈ 150 mil linhas (0,35 GiB/ano sem log). O `exec_change_log` é o maior consumidor do schema; a retenção de 12 meses planejada deve ser aplicada.

---

## 18. Respostas às 32 perguntas

1. **Homicídios por município em todo o Brasil?** Sim, via SIM RAW local (5.570 municípios; 2013–2025 preliminar), reconciliado com o Atlas. O VDE cobre 5.564 de 5.570 nomes municipais válidos diretamente (99,89 %) e 6 por alias validado (ver Errata). Ressalva: resíduo de causa indeterminada.
2. **Roubos e furtos municipais?** Não nacionalmente. Só RJ, MG, ES, RS (operacionais), SP e DF (integração local). Nacional por UF apenas para veículos, carga e instituição financeira.
3. **Crimes com cobertura nacional?** Homicídio/agressões (SIM e VDE), feminicídio, latrocínio, lesão seguida de morte, estupro e estupro de vulnerável, tráfico, roubo/furto de veículo, roubo de carga, roubo a instituição financeira, armas apreendidas, desaparecidos, mortes por intervenção — todos por UF; municipais só os 11 eventos listados.
4. **Somente estadual?** Roubo de transeunte, celular, comércio, residência; estelionato, extorsão, sequestro; naturezas de CVLI (definições próprias); produtividade (RJ).
5. **UFs com base municipal operacional?** RJ, MG, RS, ES (patrimônio), CE, PE, AL (CVLI), DF (por RA); SP com integração local. BA, GO, PR, PA, PI, MT, MS, TO, AM e MA a validar; SC, SE, AC, AP, RN, PB, RO e RR sem fonte localizada.
6. **Histórico?** SIM 2013–2025p (Atlas 1980–2024); VDE 2015–2026; RJ 2003/2014+; MG 2012+; ES 2018+; PE 2004+; AL 2012+; DF 2014+; RENAEST 2018–2026-05; PRF 2007+; SISDEPEN 2016–2025.
7. **Efetivo da PM por UF?** Sim, FBSP 2025 (27 UFs) e ESTADIC 2023 (26 UFs). SP e RS exigem conferência manual do PDF.
8. **PM por município?** Não há fonte pública.
9. **PC por UF e município?** UF sim; município não (só existência de delegacia por MUNIC).
10. **Delegacias?** Parcial: existência por município (MUNIC), CISPs do RJ e unidades PRF; sem cadastro nacional.
11. **Batalhões?** Não encontrados.
12. **PF e PRF?** Apenas totais nacionais (FBSP; SIAPE com “Sigiloso” em cargo/UF).
13. **Guardas municipais?** Sim, por município (MUNIC 2023) e UF; 2022/2023.
14. **Operações públicas?** RJ (flagrantes, apreensões, UPP), VDE (mandados, intervenções, armas); sem base nacional de operações.
15. **Inquéritos e resultados?** Não nacionalmente; RJ tem elucidação por coorte; Portaria 1.145/2026 pode viabilizar no futuro.
16. **Informação confiável sobre facções?** Só relatórios oficiais resumidos (existência e quantidades); nada territorial ou de pessoas.
17. **Produto responsável sobre crime organizado?** Sim, apenas Produtos A e B (catálogo oficial e indicadores gerais, sem atribuição). Mapa territorial: não.
18. **Quantos presídios?** 1.532 estabelecimentos no 19º ciclo (1.527 estaduais, 5 federais; 1.529 com código IBGE).
19. **Capacidade e população por unidade?** Sim (SISDEPEN); a taxa de ocupação exige contrato fechando quais colunas definem cada coisa.
20. **Detran nas 27 UFs?** Não como dado estruturado; 26 de 27 portais responderam, poucos com estatísticas; Senatran cobre frota e infrações nacionalmente.
21. **Frota municipal?** Sim (Senatran): total por município e por tipo, combustível, ano e potência.
22. **Acidentes nacionais e municipais?** RENAEST (município, cobertura desigual), PRF (rodovias federais, município), SIM (óbitos, município) e VDE (mortes, município por nome).
23. **Cruzar com SIM?** Sim, por município e ano, com ressalvas de conceito (ES 2023: 819 SIM × 972 RENAEST).
24. **Reutilizar o que o Executivo coletou?** Sim: SIM RAW, território, população, Siconfi RAW (ES e Vitória 2024), exec_story/ind/publication/manifest, collector financeiro, evidências P0–P8, P1 e P2.
25. **Denominadores IBGE?** Taxas de homicídio, latrocínio, feminicídio (por 100 mil mulheres), estupro, letalidade, efetivo por habitante, frota por mil habitantes, despesa per capita, mortes no trânsito, GM por habitante.
26. **Séries históricas?** SIM, VDE, RJ, MG, ES, PE, AL, DF, RENAEST, PRF, SISDEPEN, Siconfi, frota (a construir por snapshots).
27. **Comparáveis entre estados?** SIM (com resíduo mostrado), VDE por UF, SISDEPEN, Siconfi, frota, GM, PRF; efetivo comparável apenas por habitante com data.
28. **Enganosos?** Ver §15.
29. **PostgreSQL?** 0,97 / 1,32 / 2,86 GiB (A/B/C), até 2,19 / 2,94 / 6,31 GiB com histórico de mudanças.
30. **SSD?** ≈ 13,4 GiB na carga inicial e ≈ 7,5 GiB/ano.
31. **Top 10 (valor editorial × viabilidade):**
    1. IND.SEG.A02 — taxa de homicídios (SIM), com resíduo de indeterminadas;
    2. IND.SEG.A05/A07/A09 — homicídio doloso, latrocínio e feminicídio (VDE);
    3. IND.SEG.F08 — mortes no trânsito (SIM) por município;
    4. IND.SEG.F06 — mortes em sinistros (RENAEST) com cobertura ao lado (F12);
    5. IND.SEG.F02 — veículos por mil habitantes;
    6. IND.SEG.B12/B13 — guardas municipais;
    7. IND.SEG.B08 — profissionais de segurança por mil habitantes (UF);
    8. IND.SEG.D01–D03 — estabelecimentos, vagas e população prisional;
    9. IND.SEG.G01–G03 — despesa em Segurança (total, subfunção, per capita);
    10. IND.SEG.C07 — letalidade policial por 100 mil habitantes (VDE).
32. **Fontes realmente prontas?** As sete READY_FOR_CONTRACT: S04 SIM, S08 MUNIC, S20 e S21 RJ/ISP, S40 RJ, S80 Siconfi e S90 território. Com ressalvas (22), as principais: S01 VDE, S22 MG, S23 RS, S24 ES, S50 SISDEPEN, S70 Senatran, S72 RENAEST, S73 PRF, S06/S07 efetivo.

### Respostas extras (da seção de resultado executivo)

- **Indicadores com evidência real:** 72 (15 prontos para contrato + 57 com ressalvas). Dos 57, 13 são específicos de um estado (A25–A37).
- **Dependem de integração estadual/local:** 16 (6 `LOCAL_INTEGRATION_REQUIRED` + 10 `NEEDS_VALIDATION`), mais os 13 indicadores estaduais acima.
- **Bloqueados:** 0 por bloqueio externo provado; 3 inviáveis com dado público (efetivo PM/PC por município, inquéritos nacionais, presença de organizações por UF); 4 somente descoberta.
- **Cobertura municipal nacional comprovada:** homicídio SIM, VDE (11 eventos), guardas municipais, frota, existência de delegacia.
- **Melhor ordem:** P9.1 → P9.5 (parte SIM/Senatran) → P9.3 (GM e efetivo UF) → P9.4 → P9.2 → P9.6 → P9.7 (ver plano).
- **Descartar:** mapa de facções, ENVOLVIDOS/OBJETOS do ES, boletins e coordenadas de SP, atributos de vítima do RS, somas cruas do SISDEPEN, índice único de segurança, Fogo Cruzado como fonte oficial, interpolação de população em 2022–2023.

---

## 19. Gates

| Gate | Estado | Justificativa |
|---|---|---|
| G01_REUSE_PREVIOUS_EVIDENCE | PASS | P0–P8, P1 e P2 reaproveitadas; sem descoberta genérica repetida |
| G02_NATIONAL_CRIME_SOURCES | PASS_WITH_CAVEATS | VDE e SIM lidos; VDE sem IBGE; SIM com resíduo |
| G03_STATE_CRIME_SOURCES | PARTIAL | 9 UFs operacionais ou integráveis; 10 a validar; 8 sem fonte localizada |
| G04_MUNICIPAL_CRIME_COVERAGE | PARTIAL | homicídio nacional; roubo/furto só em 4–6 UFs |
| G05_CRIME_TAXONOMY | PASS_WITH_CAVEATS | equivalências por UF não são 1:1 |
| G06_PM_PC_STAFFING | PARTIAL | UF sim; município não; SP e RS exigem conferência |
| G07_PF_PRF_GUARDAS | PARTIAL | GM municipal sim; PF/PRF só nacional |
| G08_POLICE_UNITS | PARTIAL | existência de delegacia, CISP e PRF; sem cadastro nem batalhões |
| G09_POLICE_ACTIVITY | PARTIAL | RJ e VDE; sem base nacional |
| G10_PRISON_SYSTEM | PASS_WITH_CAVEATS | 1.532 unidades lidas; colunas a fechar |
| G11_ORGANIZED_CRIME_EVIDENCE | PASS_WITH_CAVEATS | avaliado; conclusão: sem fonte estruturada; só produtos A/B |
| G12_SENATRAN_DETRAN | PARTIAL | Senatran sim; Detran sem base padrão |
| G13_TRAFFIC_ACCIDENTS | PASS_WITH_CAVEATS | RENAEST, PRF, SIM lidos; cobertura desigual |
| G14_PUBLIC_FINANCE | PASS_WITH_CAVEATS | Siconfi lido para ES/Vitória; demais entes não consultados |
| G15_TERRITORIAL_IDENTITY | PASS_WITH_CAVEATS | frota: 5.529 de 5.572 (99,2 %); VDE: 5.564 de 5.570 nomes válidos diretos + 6 aliases; exceções tratadas |
| G16_INDICATOR_FEASIBILITY | PASS | 95 indicadores classificados |
| G17_METHODOLOGICAL_COMPARABILITY | PASS_WITH_CAVEATS | lista de comparações enganosas explicitada |
| G18_STORAGE_PROJECTION | PASS_WITH_CAVEATS | bytes por linha medidos; contagens de linhas extrapoladas com fórmula |
| G19_OPERATIONAL_TESTS | PASS_WITH_CAVEATS | 49 testes; 46 fontes com leitura real; as demais (portais de MS, PA, PI, MT e afins) ficam NEEDS_VALIDATION |
| G20_IMPLEMENTATION_PLAN | PASS | P9.1–P9.7 em `…_plano_execucao.md` |
| G21_ARTIFACT_CONSISTENCY | PASS | contagens e IDs conferidos entre os artefatos |
| G22_NO_IMPLEMENTATION | PASS | nenhum collector, migration, tabela, frontend, commit ou push |

---

## 20. Limitações

- Provas de 21/10/2026; portais mudam sem aviso (principalmente links do gov.br e Drives).
- “Sem fonte localizada” não significa que não exista; 10 estados ficaram a validar.
- A Tabela 2 do Raio-X foi lida do PDF; SP e RS exigem conferência.
- Estimativas de linhas para estados não lidos por completo são extrapolações (premissas no CSV).
- Séries de frota e efetivo só se tornam históricas se capturadas periodicamente (snapshots).


---

## Errata (P9.1, 21/10/2026)

Corrigida na origem durante a execução da P9.1; as evidências originais foram preservadas.

1. **Contagem dos gates.** O resumo da P9 informou 6 PASS / 10 PASS_WITH_CAVEATS / 6 PARTIAL. Os 22 estados da seção 19 e de `results.json` somam **5 PASS, 10 PASS_WITH_CAVEATS e 7 PARTIAL** (verificado por programa; nenhum estado de gate foi alterado). `results.json` passou a trazer `gates_resumo`.
2. **Cobertura municipal do VDE, com denominadores.** Pares UF × município distintos no arquivo: **5.597**; pares com nome municipal válido: **5.570**; "NÃO INFORMADO": **27** (um por UF); casados diretamente por nome normalizado: **5.564 de 5.570** (99,89 % dos nomes válidos); casados por alias validado manualmente contra o IBGE: **6** (BARÃO DE MONTE ALTO, SANTO ANTÔNIO DO LEVERGER, ARÊS, AÇU, SÃO LUIZ, GRACHO CARDOSO); não conciliados: **0**. A porcentagem de 99,9 % da P9 usava como denominador os 5.570 nomes válidos e ignorava os 27 pares "NÃO INFORMADO" (cujos valores existem: ver `crosswalk_vde_ibge.csv` da P9.1).
3. **Calendário territorial.** O diretório do `civica_exec` tem 5.571 municípios (inclui Boa Esperança do Norte/MT, data de instalação não comprovada); o universo do VDE tem 5.570 nomes e não inclui esse município; o SIM só o registra quando há óbito com o código. Nada foi inventado para o período anterior à existência administrativa.
4. **Apreensão de cocaína e maconha.** A P9 leu apenas a coluna `total` e classificou o evento como 100 % zero. O valor está em `total_peso` (unidade não declarada no arquivo). Corrigido na P9.1.
5. **"Mortes no trânsito" do VDE.** Esse evento tem abrangência PF/PRF (rodovias federais), não é o total de mortes no trânsito. O evento estadual com município é "Morte no trânsito ou em decorrência dele (exceto homicídio doloso)". Os dois são indicadores distintos na P9.1.
6. **Universo municipal do VDE por mês.** Cada mês dos eventos com município traz o universo completo de 5.597 pares (inclusive zeros); o número de "municípios distintos por nome" (5.298) da primeira leitura de P9 contava nomes repetidos entre UFs uma só vez.
