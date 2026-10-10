# Investigação exploratória do Poder Judiciário para o Cívica

**Escopo:** investigação somente. Nenhum código, banco, collector, migration ou configuração do repositório foi alterado; as consultas foram pequenas, não destrutivas e limitadas (amostras, agregações e contagens). Os artefatos de coleta ficaram fora do repositório. Este arquivo é a única entrega.
**Data da investigação:** 07–08/10/2026. Todos os números abaixo foram observados nessa janela; "hoje" = 08/10/2026.
**Convenção de evidência:** `E01…E24` remetem à Parte XII. Quando um valor vem de documentação e não de inspeção, está marcado como **DOCUMENTADO**. Percentuais só aparecem quando o denominador é observado na própria fonte.

Classes de granularidade: **COMPROVADO** (inspeção real satisfatória) · **DOCUMENTADO** · **PARCIAL** · **HIPÓTESE** · **NÃO COMPROVADO** · **INDISPONÍVEL** · **RESTRITO**.
Maturidade de fonte: **A** API/arquivo estruturado com acesso comprovado · **B** estruturado, extração ou cobertura limitada · **C** documentos/páginas que exigem processamento · **D** só documentação/painel/evidência insuficiente · **E** acesso restrito ou inviabilidade comprovada.

---

# Parte I — Resumo executivo

## Panorama

O Judiciário tem **uma única fonte nacional processual realmente aberta e programática** — a API pública do DataJud — e ela é boa para o que promete e silenciosa sobre o que mais interessaria a um "perfil de magistrado". Fora dela, a transparência é **desigual e fragmentada**: um tribunal superior (STJ) publica um conjunto de dados abertos diários de alta qualidade; a Justiça Eleitoral publica decisões com o nome de quem decidiu; a remuneração individual existe em escala nacional, mas apenas em um painel Qlik (e em um projeto de terceiros que a normaliza); o STF não oferece dados abertos estruturados de julgamentos e sua política de robôs restringe o acompanhamento processual.

Em termos de produto: **dá para construir com dados reais um Cívica Judiciário institucional e por tribunal/unidade** (volume, sistemas, classes, assuntos, linha do tempo de marcos, atualização, órgãos julgadores), e **um recorte individual profundo em um único tribunal superior (STJ)**. **Não dá**, com o que está público e acessível programaticamente, para construir perfis nacionais de magistrados com atos atribuídos, produtividade individual comparável ou votos nominais no STF.

## Principais descobertas

1. **DataJud responde em 64/64 aliases** (STJ, TST, TSE, STM, 27 TJs, 6 TRFs, 24 TRTs, 3 TJMs) e soma **350,8 milhões de documentos** (processo×grau). Esquema idêntico em todos os 13 tribunais amostrados. **Não há partes, magistrado, valor da causa nem documentos**: só capa, classe, assuntos, órgão julgador e movimentos com data/hora e complementos tabelados (E02–E06).
2. **A linha do tempo de um processo é reconstruível com carimbo de data/hora por movimento** e códigos TPU (distribuição, conclusão, sentença, trânsito em julgado, baixa). Em uma coorte do TJES (2.147 processos ajuizados em 01–07/01/2025), 129 têm sentença de procedência **e** trânsito, e 108 têm trânsito **e** baixa definitiva (E05). Mas **a semântica não é universal** e o próprio DataJud diz que a base cobre processos "em tramitação **e os baixados a partir de 1º/01/2020**" (E17).
3. **A única fonte nacional que atribui atos a pessoas é a Justiça Eleitoral**: o dataset "Processual" do TSE traz, por decisão, `NM_AUTOR_DECISAO` (nome) + tipo (Sentença/Despacho/Decisão), data, instância e UF, atualizado diariamente (E11). Só nome, sem ID, e só processos eleitorais por pleito.
4. **O STJ publica dados abertos diários de ponta** (21 datasets em CKAN): ata de distribuição com **ministro relator por processo** (3.497 registros num único dia, 35 relatores), acervo em tramitação, espelhos de acórdão, pautas futuras, precedentes qualificados, diárias e **folha de pagamento nominal desde 01/2020 até 07/2026** com rubricas, incluindo ministros (E10).
5. **Remuneração individual existe em escala, mas sem ID e sem API**: o Painel de Remuneração do CNJ (92 órgãos, Qlik) e o DadosJusBr (terceiro; 124 órgãos catalogados, 86 com dado em 06/2026) trazem nome + função + lotação + rubricas por mês; em 82 de 86 órgãos o dado oficial está em XLS que "necessita simulação de usuário"; só 6 de 86 têm matrícula (E12, E13). Normas de 2026 (Res. CNJ 681/2026, contracheque único; Portaria 244/2026) mudam o cenário nos próximos meses.

## Limitações estruturais

- **Unidade ≠ pessoa.** Nenhuma fonte nacional liga processo → magistrado. O DataJud só dá `orgaoJulgador` (código, nome, município IBGE). Em 2º grau o nome do órgão **às vezes embute o desembargador** (TJES: "GAB. DESEMB. <NOME> - VITORIA") e às vezes não (TRF1: "Gabinete 06"; TJMG: "4ª Câmara Criminal") — **associação inferida e específica por tribunal** (E08).
- **Sem identificador de pessoa.** Remuneração, folha, atas e decisões usam **nome**; não há matrícula/ID comum. Homonímia e troca de nome são riscos reais (também apontados pela Transparência Brasil, E13).
- **Qualidade do dado processual é heterogênea**: `sistema` "Inválido" em 14,4% dos documentos do TJES; `dataAjuizamento` sentinela (1900-01-14) em milhares de documentos TJES e em **71% do STJ**; 18% dos documentos do TJES **sem movimentos**; texto corrompido por codificação em nomes de órgão do STJ e TJRJ (E02, E04, E06).
- **Confiabilidade operacional**: tempos de 3 a 50 s, HTTP 429, 504 e `es_rejected_execution_exception` observados; defasagem de atualização de 1 a 37 dias entre tribunais (E03); instabilidade operacional (E24).
- **Termo de uso do DataJud** (v1.2): uso "não comercial", proíbe "distribuir, vender ou explorar comercialmente" a informação derivada e pede ciência ao CNJ de estudos/relatórios publicados (E01). Precisa de parecer jurídico antes de qualquer produto público.

## Oportunidades de maior valor

1. **Panorama nacional/por tribunal/por unidade** a partir de agregações DataJud (sem espelhar processos).
2. **Vertical STJ**: ministros (relatorias, acervo, pautas, acórdãos, remuneração, diárias, contratos) — o único recorte com dado individual aberto, diário e de múltiplas facetas.
3. **Justiça Eleitoral por magistrado/autor de decisão** (TSE Processual), com todas as ressalvas de nome-sem-ID.
4. **Grandes litigantes por CNPJ** no STJ (partes com CNPJ em atas/acervo) — liga ao cadastro de fornecedores do Cívica.
5. **Contratos dos tribunais por CNPJ** via PNCP (cobertura baixa e desigual, E14).

## Principais incertezas

- Metodologia e dados abertos de **produtividade** (Justiça em Números / Módulo de Produtividade Mensal): só painéis (Qlik) vistos; sem prova de download em massa ou de produção por magistrado.
- **Votos individuais**: STF **RESTRITO/NÃO COMPROVADO**; STJ **PARCIAL** (texto livre do acórdão).
- **Cobertura de remuneração** do painel oficial por mês e por tribunal (só o painel mostra "Controle de envio").
- **Estabilidade** da chave pública do DataJud (o CNJ pode trocá-la a qualquer momento) e dos limites de uso.

---

# Parte II — Inventário de fontes

Maturidade segundo a régua do mandato. "Evidência" = onde está o que foi visto.

| # | Fonte | Órgão | URL | Domínio | Formato | Granularidade | Cobertura (observada) | Histórico | Acesso | Maturidade | Evid. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | API Pública DataJud | CNJ | `https://api-publica.datajud.cnj.jus.br/api_publica_{alias}/_search` | J1, J2, J3, J8 | JSON (Elasticsearch DSL) | processo×grau, movimento | 64/64 aliases; 350,8 mi documentos | processos em tramitação + baixados desde 01/01/2020 (doc.) | chave pública publicada na Wiki; termo de uso | **A** | E01–E08 |
| F02 | Wiki DataJud (acesso, endpoints, glossário, termo de uso) | CNJ | `https://datajud-wiki.cnj.jus.br/api-publica/` | J2 | HTML | — | — | — | aberto | A (doc.) | E01 |
| F03 | Tabelas Processuais Unificadas (SGT) | CNJ | `https://www.cnj.jus.br/sgt/` | J2 | HTML + Excel + WebService (doc.) | classe, assunto, movimento, documento | versão 06/10/2026 | por versão | aberto | **B** | E18 |
| F04 | Painel de Remuneração dos Magistrados | CNJ | `https://www.cnj.jus.br/transparencia-cnj/remuneracao-dos-magistrados/` → `paineisanalytics.cnj.jus.br` | J5 | Qlik Sense (painel); download por ano na UI (relato de terceiro) | nominal, mensal | "92 órgãos" (texto oficial) | desde 2017–2018 (norma/relato) | painel público; automação só por simulação de usuário (relato) | **D/B** | E13 |
| F05 | Justiça em Números / Painéis CNJ | CNJ | `https://justica-em-numeros.cnj.jus.br/`, `paineisanalytics.cnj.jus.br` | J3 | SPA/Qlik; relatório PDF | tribunal, unidade (painéis) | — | série anual | aberto na UI; sem bulk comprovado | **D** | E16 |
| F06 | Painel de Estatísticas do Poder Judiciário (DataJud) | CNJ | `https://www.cnj.jus.br/datajud/painel-estatistica` | J3 | iframe Qlik | órgão, mês, grau | — | — | UI | **D** | E16 |
| F07 | Justiça Aberta | CNJ/Corregedoria | `.../corregedoria-nacional-de-justica/justica-aberta/` | J4 | HTML | **cartórios** (não juízes) | extrajudicial | — | aberto | **E** p/ magistrados | E19 |
| F08 | Atos normativos CNJ (atos.cnj.jus.br) | CNJ | `https://atos.cnj.jus.br/` | todos | HTML/PDF | — | Portaria 374/2026, Res. 681/2026, Portaria 244/2026 | — | aberto | A (doc.) | E13, E17 |
| F09 | STJ — Dados Abertos | STJ | `https://dadosabertos.web.stj.jus.br/` (CKAN) | J2, J3, J4, J5, J6, J7, J8 | CSV, JSON, ZIP, GZ | processo, ministro, acórdão, pagamento | 21 datasets; 8 inspecionados | ata: 1.026 arquivos diários; folha: 2020-01→2026-07 | aberto, sem chave | **A** | E10 |
| F10 | TSE — Dados Abertos "Processual" | TSE | `https://dadosabertos.tse.jus.br/` (CKAN) → `cdn.tse.jus.br/estatistica/sead/odsele/processual/` | J4, J6 | CSV em ZIP | decisão (com nome do autor) | pleitos 2020/2022/2024/2026 | por ciclo | aberto | **A** | E11 |
| F11 | STF — Portal, Corte Aberta, Transparência | STF | `https://portal.stf.jus.br/`, `transparencia.stf.jus.br` | J6, J5, J7 | HTML, painéis Qlik | processo, ministro | — | — | `robots.txt` bloqueia `/processos`; Qlik responde 403 a cliente não-navegador | **E/D** | E15 |
| F12 | CSJT/TST — Dados Abertos | CSJT | `https://www.csjt.jus.br/web/csjt/dados-abertos` | J3, J5, J7 | CSV/PDF/Excel exportados de painéis | lotação, contratos, TIC | — | — | aberto | **C/D** | E20 |
| F13 | DadosJusBr (terceiro, não oficial) | Transparência Brasil / República.org | `https://api.dadosjusbr.org/v2/` | J5 | JSON + ZIP (datapackage CSV) | contracheque nominal mensal | 124 órgãos cat.; 86 com dado em 2026/06 | mensal | aberto | **A** (terceiro) | E12 |
| F14 | PNCP — Consulta e Busca | Min. Gestão | `https://pncp.gov.br/api/consulta/v1/…`, `/api/search/` | J7 | JSON | contrato, contratação, fornecedor (CNPJ) | TJES: 2/25/9/4 contratos em 2023/24/25/26 | desde 2023 (amostra) | aberto | **A** (cobertura baixa) | E14 |
| F15 | Portal TJES (transparência, magistrados) | TJES | `https://www.tjes.jus.br/` | J1, J4 | HTML, Google Docs | comarca/unidade/magistrado | — | — | aberto | **C** | E21 |
| F16 | Portal TJMG | TJMG | `https://www.tjmg.jus.br/portal-tjmg/transparencia/` | J3, J7 | HTML | — | — | — | aberto | **C/D** | E21 |
| F17 | Portal TJSP | TJSP | `https://www.tjsp.jus.br/Transparencia` | J3, J7 | (resposta vazia ao cliente) | — | — | — | **não comprovado** | **D** | E21 |
| F18 | Portal TJRJ | TJRJ | `https://www.tjrj.jus.br/transparencia/` | J3 | HTML | — | — | — | aberto | **C/D** | E21 |
| F19 | Portal e **API TJBA** | TJBA | `https://transparencia-service-api.tjba.jus.br/{unidades,comarcas,metas}` | J1, J3 | JSON | unidade (código CNJ), comarca | 1.782 unidades; 241 comarcas; metas de 866 unidades | ano corrente | aberto | **A** (tribunal-específica) | E09 |
| F20 | Consulta pública ONIT / contribuições Transparência Brasil | CNJ/ONIT; TB | PDF ago/2026 | J5 | PDF | — | — | — | aberto | A (doc.) | E13 |
| F21 | Base dos Dados | (terceiro) | `https://basedosdados.org/` | — | — | — | **não utilizado** | — | — | — | — |
| F22 | Censo do Judiciário 2023 (painéis) | CNJ | `https://www.cnj.jus.br/painel-censo2023-magistrados` | J4 | Qlik | agregado | — | 2023 | aberto | **D** (agregado) | E16 |
| F23 | Módulo de Produtividade Mensal (Provimento CNJ 49/2015) | CNJ | painel "Produtividade Mensal" (relato) | J3, J4 | Qlik | unidade/juiz (norma) | **não verificado** | — | — | **D** | E19 |
| F24 | Portal de Gestão Documental/Transparência de outros TRFs/TRTs | — | — | — | — | — | **não investigado** | — | — | — | — |

Resumo: **23 fontes investigadas** (F21 só visitada, F24 não investigada).

---

# Parte III — Análise por domínio J1–J8

## J1 — Tribunais e estrutura judiciária

**O que existe e foi observado.**

- **Lista de tribunais**: os 64 aliases do DataJud (E01) cobrem STJ, TST, TSE, STM, 6 TRFs, 24 TRTs, 27 TJs (incl. TJDFT) e 3 Tribunais de Justiça Militar estaduais (TJMMG, TJMRS, TJMSP). **Não há aliases para os TREs** (Justiça Eleitoral regional) nem STF. As **TPU** têm tabelas por justiça/grau (Trabalho 1º/2º/TST; Federal 1º/2º/JEF/Turmas Recursais/TNU/TRU; Estadual 1º/2º/JE/Turmas/Fazenda; Militar; Eleitoral zonas/TRE/TSE; Superiores STF/STJ/CJF/CNJ) — mas **classes, assuntos, movimentos e documentos**, **não unidades** (E18).
- **Unidade (órgão julgador)** no DataJud: `orgaoJulgador.{codigo, nome, codigoMunicipioIBGE}` no processo **e em cada movimento** (E02, E06). No TJES, `cardinality` de `orgaoJulgador.codigo` = **409** e **69** municípios IBGE distintos (aproximado) (E02). A norma diz que os códigos de órgão são "registrados no Sistema Corporativo do CNJ" (busca web, E22); **não encontrei cadastro nacional público de unidades** (nem hierarquia comarca→vara).
- **Chave estável da unidade**: `(tribunal, orgaoJulgador.codigo)` — **COMPROVADO** que o código é o mesmo usado fora do DataJud: o `codCnjUnidade` 77829 da **API do TJBA** ("VARA RECESSO CIVEL DE SERRINHA") é exatamente `orgaoJulgador.codigo` 77829 no DataJud TJBA, com 16 processos (E09).
- **Árvore**: tribunal → grau → unidade → município IBGE é montável. **Comarca/seção/subseção/turma como nível próprio e relação pai-filho: NÃO** na fonte nacional; só tribunal-específico (TJBA expõe `comarcas` e `unidades` com código CNJ; TJES publica "Comarca/Unidade/Magistrado" em Google Docs, E21).
- **Histórico** (criação, extinção, competência, composição): **não fornecido** pelo DataJud; só se infere pela primeira/última aparição de um código ou por fontes dos tribunais. TJTO devolveu `codigoMunicipioIBGE: 0` na amostra (E06).
- **Superiores**: o `orgaoJulgador` é grosso. STJ: "Superior Tribunal de Justiça" (código 12728, nome com codificação corrompida); TST: "Gabinete da Presidência"; TSE: "GABINETE CGE" (E06). **Turma/Seção do STJ não vem no DataJud**; vem nas atas/acervo (`codigoOrgaoJulgador` T1…T6, S1…S3, CE) (E10).

**Veredito J1:** árvore nacional **PARCIAL** (tribunal→grau→unidade→município); níveis intermediários e história **NÃO COMPROVADOS** nacionalmente.

## J2 — Processos judiciais

**Mapeamento de campos (observado × glossário).** O glossário oficial (E01) lista exatamente os campos abaixo; as 13 amostras confirmaram que **nada além disso aparece** (`partes`, `valorCausa`, `magistrado`, `documentos` ausentes).

| Campo | Classe | Observação |
|---|---|---|
| `id` (`Tribunal_Grau_Órgão…_Número`), `numeroProcesso`, `tribunal`, `grau` | **1 Nativo** | `grau`: G1, G2, JE, TR, TRU, SUP |
| `dataAjuizamento` | **1 Nativo, com validade condicionada** | string `AAAAMMDDhhmmss`; sentinelas (1900-01-14) — E04 |
| `classe`, `assuntos[]` (TPU) | **1 Nativo** | `classe` reflete o **estado atual**; a original é recuperável por movimento "Evolução da Classe Processual" (código 14739, 322 ocorrências na coorte TJES) |
| `orgaoJulgador` (processo e movimento) | **1 Nativo** | ver J1 |
| `sistema.nome`, `formato` | **1 Nativo, ruidoso** | "PJe"/"Pje"/"Inválido"/"Outros" — E02 |
| `nivelSigilo` | **1 Nativo** | **0 em 100% das amostras; `nivelSigilo>0` = 0 documentos** no TJES e no TJMG ⇒ processos sigilosos **não aparecem** (RESTRITO por desenho) |
| `movimentos[].{codigo,nome,dataHora}` | **1 Nativo** | média 38,3, máx. 329 por documento (coorte TJES); **565.275 documentos (18,0%) do TJES sem `movimentos`** |
| `movimentos[].complementosTabelados[]` | **1 Nativo** | ex.: `tipo_de_distribuicao_redistribuicao=sorteio`, `tipo_de_conclusao=para julgamento`, `tipo_de_documento=Certidão` |
| `dataHoraUltimaAtualizacao`, `@timestamp` | **1 Nativo** | permite consulta incremental |
| Data da sentença / trânsito / baixa | **2 Derivável com regra objetiva** | via códigos TPU (219/220/221 sentenças, 848 trânsito, 22 baixa definitiva, 246 "Definitivo") — **semântica a validar com a TPU** |
| Situação (em curso/baixado/arquivado/suspenso) | **3 Inferível com incerteza** | depende da última sequência de movimentos |
| Acórdão, recurso, remessa, mudança de unidade | **2/3** | acórdão **não é movimento próprio** observado; mudança de unidade = `orgaoJulgador` do movimento ≠ anterior (Redistribuição, código 36, 533 na coorte) |
| Partes, litigantes, advogados | **4 Indisponível no DataJud** | existem no STJ (CNPJ) e TSE — ver J8 |
| Magistrado, relator | **4 Indisponível no DataJud** | proxy por gabinete em 2º grau (E08) |
| Valor da causa | **4 Indisponível** | — |
| Documento/inteiro teor | **4 Indisponível** | sem link no DataJud |

**Profundidade temporal (cobertura de registros).** `_count` por ano de `dataAjuizamento` (E04):

| Ano de ajuizamento | TJES | TJMG | TRF1 | STJ |
|---|---:|---:|---:|---:|
| ≤ 1999 | 14.217 | 3.318.420 | 61.517 | 2.626.878 |
| 2000–2009 | 102.693 | 3.087.390 | 391.062 | 1.122 |
| 2010–2014 | 220.651 | 4.326.477 | 675.933 | 3.837 |
| 2015 | 81.331 | 1.610.766 | 197.313 | 2.510 |
| 2018 | 140.586 | 1.966.804 | 462.937 | 21.422 |
| 2020 | 230.227 | 2.057.469 | 1.022.686 | 14.400 |
| 2022 | 319.046 | 2.536.371 | 1.324.832 | 19.433 |
| 2024 | 325.983 | 2.771.270 | 1.385.854 | 122.094 |
| 2025 | 342.021 | 2.860.559 | 1.635.726 | 427.584 |
| 2026 (até 08/10) | 296.960 | 1.749.156 | 1.470.492 | 342.397 |

Leitura: o DataJud é um **estoque** — processos em tramitação (qualquer ano de origem) mais baixados desde 2020 — e **não** um registro de todos os ajuizamentos históricos. Contagens por ano antes de 2020 só descrevem **o que ainda tramita**. Para o STJ, 2.626.882 documentos (71,3%) têm `dataAjuizamento` < 1990, **anterior à criação do tribunal** ⇒ valor-sentinela; o ano verdadeiro está no `numeroProcesso` (ex.: TJES `00004551520188080008` tem `dataAjuizamento` 1900-01-14, mas ano CNJ 2018).

**Teste de linha do tempo (TJES, processo real, identificadores omitidos).** 41 movimentos, todos com carimbo e órgão (E05):

```
+0d    26   Distribuição (sorteio)                  [5º Juizado Especial Cível – Vitória]
+0d    12740 de Conciliação (designada)
+7d    12740 de Conciliação (cancelada)
+78d   85   Petição (Contestação)
+247d  51   Conclusão (para despacho)
+288d  51   Conclusão (para julgamento)
+289d  219  Procedência
+289d  12187 Homologação de Decisão de Juiz Leigo
+330d  1051 Decurso de Prazo
+548d  848  Trânsito em julgado
+548d  14739 Evolução da Classe Processual
… até +636d (Conclusão para despacho)
```

O que se prova: distribuição, conclusão, sentença, trânsito e mudança de classe são **eventos datados e individualmente identificáveis**. O que **não** se prova: **quem** sentenciou (aqui a decisão foi de **juiz leigo, homologada** — mesmo com um magistrado identificado, a atribuição de autoria seria enganosa), nem se o processo está encerrado.

**Casos pedidos no teste** (resultado observado ou "não testado"):

| Caso | Resultado |
|---|---|
| Movimentos repetidos | **Presentes** (2 "Decurso de Prazo" idênticos no mesmo segundo) — exige deduplicação |
| Múltiplos assuntos | **Presentes** (2–6 assuntos nas amostras) — sem indicação de principal |
| Redistribuição / mudança de órgão | **Presente** (código 36; `orgaoJulgador` por movimento) |
| Recurso e retorno / sentença sem trânsito / baixa sem encerramento / suspensão / reabertura | **Códigos existem** (ex.: 22 baixa, 848 trânsito; "Reativação" aparece 123 vezes por nome); **sequências não validadas** individualmente — **NÃO COMPROVADO** como regra geral |
| Duplicidade entre instâncias | **Esperada**: o `id` inclui o grau; o mesmo `numeroProcesso` pode aparecer em G1 e G2 (contagem de "processos" ≠ contagem de documentos) — não medida |

**Granularidade temporal**: dia e hora/minuto/segundo por movimento — **COMPROVADO**; distribuição de duração por classe/assunto e percentis são **viáveis por agregação** (tempos entre marcos) — **HIPÓTESE sólida, não executada em escala**.

**Amostragem**: 13 tribunais com conteúdo de documento (E06): TJES, TJMG, TJSP, TJRJ, TJBA, TJTO, TRF1, TRF3, TRT2, TRT3, STJ, TST, TSE. **Esquema idêntico**; diferenças em **qualidade** (sistema "Inválido" em TJMG/TJRJ; IBGE 0 no TJTO), **granularidade do órgão** (vara × gabinete × cadeira × tribunal) e **volume de movimentos**.

**Consulta incremental** — COMPROVADO: no TJES, 58.846 documentos foram atualizados só em 07/10/2026 (`_count` por `dataHoraUltimaAtualizacao`, ~1,9% do índice em um dia); paginação por `search_after` em `@timestamp` funciona (E07). **Espelhar** a base inteira (350,8 mi documentos × dezenas de movimentos) é desproporcional; a estratégia viável é **agregar** (contagens/percentis por tribunal×unidade×classe×mês) e coletar processo-a-processo sob demanda.

**Veredito J2:** metadados de processo e linha do tempo de marcos **COMPROVADOS (A)**; atribuição a magistrado, partes, valor, documento **INDISPONÍVEIS no DataJud**.

## J3 — Produtividade e desempenho

| Indicador | Existe oficialmente? | Evidência | Reconstruível a partir de dados abertos? | Comparável entre tribunais? | Observações |
|---|---|---|---|---|---|
| Casos novos, pendentes, baixados (por tribunal/unidade/ano) | **Sim** (Justiça em Números, DataJud Painel de Estatísticas) | **DOCUMENTADO** + painéis Qlik (E16) | **PARCIAL**: contagens por `dataAjuizamento` e movimento 22 (baixa) do DataJud são **estoque 2020+** | **Não sem ajuste** (qualidade e normalização variam) | denominador oficial não obtido |
| Taxa de congestionamento, IAD, tempo médio | **Sim** (metodologia CNJ) | **DOCUMENTADO** (não abri a metodologia nesta rodada) | **HIPÓTESE** | idem | usar só se reproduzidos com a mesma fórmula |
| Idade do acervo pendente | derivável | — | **Viável**: `dataAjuizamento` (válida) ou ano do CNJ no `numeroProcesso` | com ressalva de sentinelas | STJ/TJES têm milhares de datas inválidas |
| Tempo entre marcos | derivável | E05 | **Viável** por movimento | só com TPU homologada | semântica por tribunal a validar |
| Processos sem movimento / paralisados | derivável | E02 (18% sem movimentos no TJES) | **Parcial**: "sem movimentos" ≠ paralisado; "último movimento antigo" é derivável | — | |
| Metas Nacionais por unidade | **Sim** | **TJBA publica via API** (E09) | **COMPROVADO só no TJBA** | **Não** | demais tribunais: painéis/HTML |
| Produtividade por magistrado | **Norma existe** (Provimento CNJ 49/2015: módulo de produtividade mensal de juízes e serventias) | busca web (E19) | **NÃO COMPROVADO**: a divulgação nominal de produtividade de juízes foi retirada do ar em 2015 (Justiça Aberta) e hoje a Justiça Aberta cobre cartórios | — | tratar como **INDISPONÍVEL/RESTRITO** até prova em contrário |
| Despesa por processo, força de trabalho × volume | **Painéis** | E16 | **HIPÓTESE** (exige folha + volume) | — | folha nominal só em STJ (aberta) e painel/DadosJusBr |
| Decisões por autor (eleitoral) | **Dado aberto** | E11 | **COMPROVADO** (contagem por nome) | só Justiça Eleitoral | volume ≠ qualidade |

Risco de viés: produção por órgão ≠ produção individual; competência, comarca e carga diferem; juiz leigo, assessoria e mutirões geram atos sob a assinatura de outro. **Não propor ranking de magistrados.**

## J4 — Magistrados

**Resumo por informação** (pertence à pessoa ou só à unidade?):

| Informação | Fonte | Pertence a | Classe |
|---|---|---|---|
| Nome, cargo, lotação mensal, remuneração | CNJ Painel; DadosJusBr; STJ folha | **pessoa** (nome-chave) | PARCIAL/COMPROVADO (STJ) |
| Matrícula | só STJ (`cd_matricula`); 6/86 órgãos no DadosJusBr | pessoa | PARCIAL |
| Ministro relator por processo | STJ ata/acervo/espelhos | **pessoa** (nome) no ato de distribuição | COMPROVADO (STJ) |
| Autor da decisão | TSE Processual | **pessoa** (nome) | COMPROVADO (eleitoral) |
| Relatoria em 2º grau (via gabinete) | DataJud `orgaoJulgador` | **gabinete** (nome às vezes embute a pessoa) | PARCIAL, inferido |
| Processos "sob responsabilidade" | — | — | **NÃO COMPROVADO** |
| Sentenças/despachos por juiz de 1º grau | — | — | **INDISPONÍVEL** nacionalmente |
| Nomeação, posse, promoção, remoção, aposentadoria | — | — | **NÃO COMPROVADO** (nenhum cadastro nacional aberto encontrado) |
| Tempo entre marcos por magistrado | — | — | **NÃO COMPROVADO** (exigiria mapa unidade↔pessoa↔período) |

Respostas diretas: **não existe cadastro nacional nominal aberto** de magistrados (carreira) — o mais próximo é a folha mensal nominal (painel CNJ/DadosJusBr). **Não há identificador persistente interoperável**. Mudança de vara é **observável apenas indiretamente** (string `local_trabalho` variando entre meses, p.ex. "VITORIA - 3º JUIZADO ESPECIAL CIVEL" no TJES) e **não há chave** para ligá-la ao `orgaoJulgador.codigo` do DataJud (junção por texto: **INFERIDA**).

## J5 — Remuneração

- **Painel oficial CNJ** (E13): dados enviados pelos tribunais por planilha padronizada (Portaria 63/2017; Res. 215/2015), apresentados em Qlik Sense; texto oficial: "dados de **92 órgãos**". Segundo a Transparência Brasil (ago/2026), o painel permite baixar as tabelas "Contracheque", "Direitos pessoais", "Indenizações" e "Direitos eventuais" de **todos os órgãos por ano**, mas exige selecionar o ano; a automação depende de **simulação de usuário**; "continua sendo meramente um dashboard e não efetivamente um portal de dados abertos". Há aba "Controle de envio" (quem deixou de enviar em um mês). Problemas relatados: nome "0" agregando um órgão inteiro, sem ID, sem separação ativo/inativo, retroativos sem detalhamento.
- **DadosJusBr** (terceiro, E12): 124 órgãos catalogados (27 TJs, 24 TRTs, 6 TRFs, 27 TREs, 5 superiores, 3 militares, 30 MPs, 2 conselhos). Em **06/2026**, **86 têm dado** (81 do Judiciário) — **ausentes**: TJAM, TJMG, TJPB, TRF3, TRT18, TRT21, TRT22 e 6 TREs. Metadados de acesso do dado **oficial** de origem: `formato_aberto=false` em 82/86; `NECESSITA_SIMULACAO_USUARIO` em 81; extensão XLS em 82; `tem_matricula` em 6; `tem_lotacao` em 86; remuneração básica "DETALHADO" em 86. Total de **25.669 membros ativos** nos 81 órgãos do Judiciário com dado. O pacote mensal (ex.: TJES 2026-06) traz `nome`, `funcao`, `local_trabalho`, `salario`, `beneficios`, `descontos`, `remuneracao` e uma tabela de rubricas (10.618 linhas para 413 contracheques; categorias: contracheque, direitos pessoais, indenizações, direitos eventuais).
- **STJ — folha oficial aberta** (E10): CSV de 108,6 MB, **2020-01 a 2026-07**, nominal (`Nome`, `cd_matricula`), com `Cargo` (inclui "Ministro do Superior Tribunal de Justiça"), `Lotação` (ex.: "Gabinete da Ministra …"), 15 colunas de valores (remuneração paradigma, vantagens pessoais, subsídio, indenizações, vantagens eventuais, gratificações, previdência, IR, retenção por teto, diárias, total de créditos/débitos, líquido) e `CategoriaVinculo/Situacao`. **Inclui servidores, aposentados e pensionistas** — população separada por `CategoriaVinculo`.
- **Normas de 2026** (E13): **Res. CNJ 681/2026** (28/05/2026) institui **contracheque único**, taxonomia padronizada de rubricas via instruções normativas, 60 dias para adequação; **Portaria CNJ 244/2026** (02/06/2026) cria GT sobre remuneração (debates de ago–nov/2026); a TB cita a **IN 36/2026** e uma tese do STF (maio/2026) sobre retroativos — **não verifiquei o texto desses dois**.

Respostas: dados mensais individualizados de **todos** os tribunais — **PARCIAL** (92 no painel oficial; 81 no terceiro em 06/2026); formato real — **Qlik/XLS; só o STJ publica CSV direto**; histórico — **STJ 2020-01→2026-07 comprovado**, demais órgãos **só pelo painel/DadosJusBr (não medi a profundidade por órgão)**; identidade para ligar a carreira/órgão — **só nome** (+ matrícula em 6 órgãos); separar regular de extraordinário — **PARCIAL** (categorias "direitos pessoais/eventuais/indenizações"; taxonomia nova em implantação); evolução mensal por magistrado — **viável por nome com risco de homônimo**.

## J6 — Julgamentos, decisões e votos

| Camada | STF | STJ | TSE/Justiça Eleitoral |
|---|---|---|---|
| Identificar julgamento e resultado | **NÃO COMPROVADO** (nenhum dataset aberto localizado) | **COMPROVADO**: espelhos de acórdão (`id`, processo, classe, órgão julgador, `ministroRelator`, `dataDecisao`, `ementa`, `decisao`, `tema`, `teseJuridica`) | **COMPROVADO**: decisões por processo (data, tipo, instância, autor) |
| Composição/ministros presentes | RESTRITO/NÃO COMPROVADO | **PARCIAL**: texto `decisao` cita quem votou com o relator, quem presidiu, ausências (quando houver) | — |
| Votos nominais estruturados | **RESTRITO**: acompanhamento processual sob `Disallow: /processos`; busca de jurisprudência atrás de desafio anti-robô (HTTP 202); painéis em Qlik com 403 a cliente não-navegador | **NÃO estruturado**: texto livre; extração por regex/PLN | — |
| Divergência/vencido/vista | — | **PARCIAL em texto**: no arquivo de 676 acórdãos da 1ª Turma (até 24/08/2026), 665 mencionam unanimidade, 11 maioria e 11 "vencido"; voto-vista aparece em texto | — |
| Pauta | — | **COMPROVADO**: `pautas-futuras` (58 recursos, diário) | — |
| Íntegra | — | **COMPROVADO**: "Íntegras de decisões terminativas e acórdãos do DJ" (2.641 recursos, diários) | — |

**Pergunta-teste: "em quais julgamentos o ministro X votou e qual posição adotou?"** — STF: **não comprovado/restrito**. STJ: **parcialmente respondível**, e apenas por interpretação do texto do acórdão (votantes que acompanham o relator; vencidos), não por campo. Atenção: os "espelhos" são **subconjunto selecionado** pela Secretaria de Jurisprudência (ementas com novidade), não todos os acórdãos; o conjunto completo está nas "Íntegras" (texto).

## J7 — Gastos, contratos e fornecedores

- **PNCP** (E14): consulta pública sem chave. TJES (`cnpj` 27.476.100/0001-45, "Poder Judiciário do Estado do Espírito Santo"): contratos publicados no PNCP — **2023: 2; 2024: 25; 2025: 9; 2026 (até 08/10): 4**; contratações (pregões) publicadas em 2025: 94. Campos por contrato: `numeroControlePNCP`, `objetoContrato`, `valorInicial`, `valorGlobal`, `dataAssinatura`, `dataVigenciaInicio/Fim`, **`niFornecedor` (CNPJ de 14 dígitos)**, `nomeRazaoSocialFornecedor`, `tipoPessoa`, `categoriaProcesso`. O endpoint de contratações expõe `emendaParlamentar`. **Não há valor pago**; `valorAcumulado` veio nulo. Limite: 365 dias por consulta.
- **Conclusão para o PNCP**: **o CNPJ do fornecedor permite a junção com o cadastro de fornecedores do Cívica** (COMPROVADO no formato); **cobertura do PNCP para tribunais é baixa e desigual** (contratos anteriores à adesão e fora do regime da Lei 14.133 não aparecem) — **não** é o universo dos gastos.
- **STJ** (E10): `diarias-e-passagens` (CSV com dicionário; atualizado 07/2025), folha (acima). Contratos e execução orçamentária do STJ: **não inspecionados**.
- **CSJT/TST** (E20): contratos (consulta com exportação CSV/Excel/XML), execução orçamentária de TIC (CSV de painel). **Não testado programaticamente.**
- Portais de tribunais (E21): estrutura de "Licitações, contratos e instrumentos de cooperação" em HTML (TJBA, TJES); **sem API** exceto TJBA (apenas metas/unidades).
- **Orçamento/dotação/empenho/liquidado/pago por tribunal**: **NÃO COMPROVADO** nesta rodada (não localizei uma fonte nacional estruturada).

## J8 — Grandes litigantes

- **DataJud**: **sem partes** ⇒ **INDISPONÍVEL** para litigância nacional.
- **STJ ata de distribuição de um dia (07/10/2026)** (E10): 3.497 distribuições; 13.038 partes; 5.304 com `numeroCNPJ`; **3.089 processos (88,3%) com ao menos uma parte com CNPJ**. Ranking observado em um dia (processos distintos): MP-SP 263, TJSP 203, Fazenda Nacional 143, Banco do Brasil 111, União 106, INSS 102, Bradesco 64, MP-MG 59, MP-RS 54, MP-PR 50. **O CNPJ permite uma chave consistente entre dias e com o Cívica**; 7.658 partes sem CNPJ (pessoas físicas ou PJ sem cadastro) **não** devem ser tratadas.
- **TSE Processual**: dataset "partes" (110 MB, 2024) existe; **conteúdo não inspecionado** (DOCUMENTADO).
- **Painel de Grandes Litigantes do CNJ**: **não localizado/não testado** nesta rodada.
- Resposta: **PARCIAL** — CNPJ consistente **no STJ** (e potencialmente TSE); nacionalmente **limitado a agregações publicadas**.


---

# Parte IV — Dicionário de dados observados

## IV.1 DataJud (observado em 13 tribunais; esquema único)

| Campo | Tipo (obs.) | Semântica | Preenchimento observado | Fonte |
|---|---|---|---|---|
| `id` | keyword | `TRIBUNAL_GRAU_NÚMERO` (ex.: `TJES_JE_5001…`) | 100% das amostras | E02 |
| `tribunal` | keyword | sigla | 100% | E06 |
| `numeroProcesso` | keyword | número CNJ sem máscara (20 dígitos) | 100% | E02 |
| `grau` | keyword | `G1`, `G2`, `JE`, `TR`, `TRU`, `SUP` | 100% | E03 |
| `dataAjuizamento` | string `AAAAMMDDhhmmss` | capa; **tratada como data pelo índice** | válida na maioria; sentinelas (1900-01-14) | E04 |
| `nivelSigilo` | long | sigilo | sempre 0 (documentos sigilosos não aparecem) | E02 |
| `formato.{codigo,nome}` | obj | físico/eletrônico | presente | E02 |
| `sistema.{codigo,nome}` | obj | sistema processual | ruidoso: "PJe", "Pje", "Inválido" (14,4% TJES), "Outros" | E02 |
| `classe.{codigo,nome}` | obj | classe TPU **atual** | presente | E02 |
| `assuntos[].{codigo,nome}` | array | assuntos TPU | 1–6 nas amostras; ausência de "principal" | E05, E06 |
| `orgaoJulgador.{codigo,nome,codigoMunicipioIBGE}` | obj | unidade **atual** | presente; IBGE 0 no TJTO; nomes com codificação corrompida (STJ, TJRJ) | E06 |
| `movimentos[].{codigo,nome,dataHora}` | array | movimento TPU com instante UTC | média 38,3; máx. 329 (coorte TJES); 18% dos documentos TJES sem a lista | E02, E05 |
| `movimentos[].complementosTabelados[]` | array | `{codigo, descricao, valor, nome}` | ~30–50% dos movimentos | E05 |
| `movimentos[].orgaoJulgador` | obj | unidade do movimento | presente em 100% dos movimentos amostrados | E06 |
| `dataHoraUltimaAtualizacao`, `@timestamp` | datetime | controle de ingestão | presente; defasagem 1–37 dias entre tribunais | E03 |

## IV.2 STJ — Dados Abertos (E10)

| Dataset | Campos relevantes (dicionário oficial) | Observado |
|---|---|---|
| Atas de Distribuição | `numeroUnico`, `numeroRegistro`, `dataHoraDistribuicao`, `descFormaDistribuicao` (Registro/Distribuição/Redistribuição), `siglaClasse`, `codigoClasseCNJ`, `codigoOrgaoJulgador` (CE, S1–S3, T1–T6), **`nomeMinistroRelator`**, `codigoAssuntoCNJ`, `partes[]{descTipoParte, nomeParte, numeroCNPJ, advogados[]{codigoOAB, nomeAdvogado}}` | 3.497 registros em 07/10/2026; 35 valores de relator (inclui "PRESIDENTE DO STJ" e "VICE-PRESIDENTE DO STJ"); `codigoOrgaoJulgador` nulo em 50% (registros à Presidência) |
| Acervo em tramitação | idem + `Data` (corte diário), `dataRecebimento`, `assuntoCompleto`, `listaAssuntos`, `segredoJustica`, `pedidoDeLiminar`, `sobrestado`, `localProcesso`, `origem`, `UF`, `dataUltimaDecisao`, `dataUltimaDistribuicao` | arquivo diário `processos_tramitando_20261007.json.gz` |
| Espelhos de acórdãos (por órgão) | `id`, `numeroProcesso`, `siglaClasse`, `nomeOrgaoJulgador`, **`ministroRelator`**, `ementa`, `tipoDeDecisao` (ACÓRDÃO/DECISÃO), `dataDecisao`, **`decisao`** (texto com votação), `jurisprudenciaCitada`, `teseJuridica`, `tema`, `referenciasLegislativas`, `acordaosSimilares`, `dataPublicacao` | 676 acórdãos no arquivo da 1ª Turma de 23/09/2024 a 24/08/2026 |
| Folha de pagamento | `AnoMesReferencia`, `Lotação`, `cd_matricula`, `Cargo`, valores (15 colunas), `Nome`, `TipoServidor`, `Situacao`, `CategoriaVinculo`, `Acumula folha` | 2020-01 → 2026-07; CSV 108,6 MB; separador vírgula, decimal vírgula |
| Pautas futuras, Precedentes qualificados, Diárias e passagens, Íntegras | presentes no CKAN | **não inspecionados em conteúdo** (exceto metadados) |

## IV.3 TSE — Processual (E11)

`DT_GERACAO, HH_GERACAO, ANO_ELEICAO, NR_PROCESSO, SG_UF_TRIBUNAL, SG_UF_TRIBUNAL_ORIGEM, NR_INSTANCIA_ORIGEM, NR_INSTANCIA, SQ_DECISAO, DT_DECISAO, NM_AUTOR_DECISAO, DS_TIPO_DECISAO` (12 colunas). Amostra de 40.001 linhas do arquivo 2024: 35.882 processos, 24 UF-tribunais, 3.149 autores distintos, tipos de decisão dominados por Sentença (18.564), Despacho (15.243), Decisão (5.128). Arquivo gerado em 08/10/2026 05:00; `Last-Modified` 08/10/2026.

## IV.4 DadosJusBr — pacote mensal (E12)

`contracheque.csv` (`id_contracheque, orgao, mes, ano, nome, matricula, funcao, local_trabalho, salario, beneficios, descontos, remuneracao, situacao`), `remuneracao.csv` (`tipo, categoria, item, valor, desambiguacao_micro, desambiguacao_macro`), `metadados.csv` (acesso, extensão, flags de completude), `coleta.csv` (repositório e versão do coletor).

## IV.5 PNCP e TJBA

- **PNCP contratos** (E14): `numeroControlePNCP`, `anoContrato`, `objetoContrato`, `valorInicial`, `valorGlobal`, `valorAcumulado`, `dataAssinatura`, `dataVigenciaInicio/Fim`, `niFornecedor`, `tipoPessoa`, `nomeRazaoSocialFornecedor`, `categoriaProcesso`, `orgaoEntidade{cnpj, razaoSocial, esferaId, poderId}`, `unidadeOrgao`.
- **TJBA API** (E09): `unidades` {`idUnidade`, `dsUnidade`, `idMunicipio`, `flAtivo`}; `comarcas` {`idComarca`, `dsComarca`}; `metas` {`instancia`, `comarca`, `codCnjComarca`, `unidade`, `codCnjUnidade`, `meta1…meta10_2Grau`, `ano`}.

---

# Parte V — Matriz de granularidade

Linhas: domínio. Colunas: nível. Células: classe — nota.

| Domínio | Nacional | Segmento | Tribunal | Região | Unidade | Pessoa | Processo | Evento | Documento | Financeiro |
|---|---|---|---|---|---|---|---|---|---|---|
| **J1 Estrutura** | COMPROVADO (64 aliases) | COMPROVADO | COMPROVADO | PARCIAL (IBGE do município da unidade; TJTO=0) | COMPROVADO (código+nome; TJES 409) | INDISPONÍVEL | n/a | n/a | n/a | n/a |
| **J2 Processos** | COMPROVADO (350,8 mi docs) | COMPROVADO | COMPROVADO | PARCIAL | COMPROVADO | **INDISPONÍVEL** (DataJud); PARCIAL (gabinete em 2º grau) | COMPROVADO (metadados) | COMPROVADO (movimento com instante e complemento) | **INDISPONÍVEL** | n/a |
| **J3 Produtividade** | DOCUMENTADO (painéis) | DOCUMENTADO | DOCUMENTADO | NÃO COMPROVADO | PARCIAL (TJBA metas; DataJud derivável) | **NÃO COMPROVADO / RESTRITO** | n/a | n/a | n/a | HIPÓTESE |
| **J4 Magistrados** | PARCIAL (folha nominal 81–92 órgãos) | PARCIAL | PARCIAL | NÃO COMPROVADO | PARCIAL (`local_trabalho` texto) | PARCIAL (nome; sem ID) — COMPROVADO no STJ | **COMPROVADO só em STJ (relator) e TSE (autor)** | PARCIAL | NÃO COMPROVADO | COMPROVADO no STJ |
| **J5 Remuneração** | PARCIAL | PARCIAL | PARCIAL (86/124 em 06/2026, terceiro) | n/a | PARCIAL (lotação texto) | COMPROVADO (nominal) | n/a | n/a | n/a | **COMPROVADO** (rubrica/mês no STJ e DadosJusBr) |
| **J6 Julgamentos/votos** | NÃO COMPROVADO | — | STF: **RESTRITO**; STJ: COMPROVADO (acórdão); TSE: COMPROVADO (decisão) | n/a | PARCIAL (órgão colegiado no STJ) | STJ: PARCIAL (relator estruturado; votantes em texto); STF: RESTRITO | COMPROVADO (STJ, TSE) | STJ: COMPROVADO (acórdão); voto individual: **PARCIAL (texto)** | STJ: COMPROVADO (íntegras) | n/a |
| **J7 Gastos/contratos** | PARCIAL (PNCP) | PARCIAL | COMPROVADO (TJES no PNCP) | n/a | NÃO COMPROVADO | n/a | n/a | n/a | PARCIAL (PNCP) | contrato: COMPROVADO; **pagamento: NÃO COMPROVADO** |
| **J8 Litigantes** | NÃO COMPROVADO (DataJud sem partes) | — | STJ: COMPROVADO | n/a | n/a | n/a (PF fora de escopo) | STJ: COMPROVADO (CNPJ da parte) | n/a | n/a | n/a |

---

# Parte VI — Matriz de cobertura

## VI.1 Cobertura institucional e temporal do DataJud (64 aliases; denominador = os 64 aliases publicados na Wiki)

Cobertura institucional: **64/64 aliases respondem** (um alias nunca "vazio"). **Não há alias para STF nem TREs**. Não calculo percentual de cobertura **de processos** porque não obtive um denominador oficial comparável (Justiça em Números só em painel).

| Medida | Resultado |
|---|---|
| Documentos totais | 350.778.610 (Superior 8.414.141; Estadual 256.345.221; Federal 56.048.979; Trabalho 29.907.339; Militar estadual 62.930) |
| Defasagem da última atualização (dias, 08/10/2026) | mín. 1 · mediana 7 · máx. 37 |
| ≤ 2 dias | 26 aliases · 3–14 dias: 20 · > 14 dias: 18 |
| Mais defasados | TJPR (01/09), TJAP (11/09), TJMA (12/09), TJAM (13/09), TJTO (13/09), TJBA (14/09), TRT4 (14/09), TJAC (15/09) |
| Profundidade temporal (documentado) | processos em tramitação + baixados desde 01/01/2020 (E17) |
| Frequência futura | **Portaria CNJ 374/2026** (14/08/2026): envio **diário**, prazo de **180 dias** para adequação ⇒ a defasagem deve cair a partir de ~fev/2027 |

Tabela completa por alias:

| Alias | Segmento | Documentos (processo×grau) | Última atualização (max `dataHoraUltimaAtualizacao`) | Defasagem (dias, em 08/10/2026) | Graus presentes (documentos) |
|---|---|---:|---|---:|---|
| `stj` | Superior | 3.684.932 | 2026-10-07 | 1 | SUP 3.684.932 |
| `stm` | Superior | 27.556 | 2026-10-01 | 7 | G1 18.942, SUP 8.614 |
| `tse` | Superior | 90.926 | 2026-10-06 | 2 | SUP 90.926 |
| `tst` | Superior | 4.610.727 | 2026-10-01 | 7 | SUP 4.610.727 |
| `trf1` | Federal | 7.342.499 | 2026-10-07 | 1 | JE 3.775.666, G1 2.151.744, G2 815.896, TR 597.442, TRU 1.751 |
| `trf2` | Federal | 4.447.300 | 2026-09-15 | 23 | JE 1.866.196, G1 1.668.241, G2 482.264, TR 428.585, TRU 2.014 |
| `trf3` | Federal | 17.594.308 | 2026-10-07 | 1 | G1 6.371.566, JE 5.958.259, G2 3.634.427, TR 1.606.884, TRU 20.875 |
| `trf4` | Federal | 14.735.908 | 2026-10-07 | 1 | JE 5.609.607, G1 4.625.649, G2 2.668.186, TR 1.780.926, TRU 36.675 |
| `trf5` | Federal | 7.311.700 | 2026-09-25 | 13 | JE 4.048.262, G1 1.436.560, TR 1.434.095, G2 385.622, TRU 7.161 |
| `trf6` | Federal | 4.617.264 | 2026-09-15 | 23 | JE 1.775.202, G1 1.765.271, G2 720.894, TR 355.251, TRU 646 |
| `trt1` | Trabalho | 2.646.630 | 2026-09-16 | 22 | G1 1.989.359, G2 657.271 |
| `trt2` | Trabalho | 5.368.453 | 2026-10-06 | 2 | G1 4.193.455, G2 1.174.980 |
| `trt3` | Trabalho | 4.297.218 | 2026-10-07 | 1 | G1 3.381.036, G2 916.182 |
| `trt4` | Trabalho | 2.030.044 | 2026-09-14 | 24 | G1 1.506.670, G2 523.374 |
| `trt5` | Trabalho | 1.328.690 | 2026-09-24 | 14 | G1 995.952, G2 332.738 |
| `trt6` | Trabalho | 1.010.930 | 2026-09-21 | 17 | G1 805.053, G2 205.877 |
| `trt7` | Trabalho | 717.811 | 2026-09-24 | 14 | G1 557.491, G2 160.320 |
| `trt8` | Trabalho | 603.770 | 2026-10-07 | 1 | G1 483.721, G2 120.049 |
| `trt9` | Trabalho | 1.604.700 | 2026-10-07 | 1 | G1 1.257.078, G2 347.622 |
| `trt10` | Trabalho | 640.425 | 2026-09-21 | 17 | G1 508.083, G2 132.342 |
| `trt11` | Trabalho | 401.987 | 2026-10-05 | 3 | G1 323.303, G2 78.684 |
| `trt12` | Trabalho | 1.005.717 | 2026-10-06 | 2 | G1 801.330, G2 204.387 |
| `trt13` | Trabalho | 349.736 | 2026-09-29 | 9 | G1 255.599, G2 94.137 |
| `trt14` | Trabalho | 271.388 | 2026-10-02 | 6 | G1 200.605, G2 70.783 |
| `trt15` | Trabalho | 3.802.679 | 2026-10-06 | 2 | G1 2.915.631, G2 887.048 |
| `trt16` | Trabalho | 429.107 | 2026-09-16 | 22 | G1 339.021, G2 90.086 |
| `trt17` | Trabalho | 619.087 | 2026-10-06 | 2 | G1 466.196, G2 152.891 |
| `trt18` | Trabalho | 841.041 | 2026-10-07 | 1 | G1 683.784, G2 157.257 |
| `trt19` | Trabalho | 448.370 | 2026-09-24 | 14 | G1 372.976, G2 75.394 |
| `trt20` | Trabalho | 242.112 | 2026-10-03 | 5 | G1 184.355, G2 57.757 |
| `trt21` | Trabalho | 270.537 | 2026-10-06 | 2 | G1 212.283, G2 58.254 |
| `trt22` | Trabalho | 277.777 | 2026-10-07 | 1 | G1 201.580, G2 76.197 |
| `trt23` | Trabalho | 360.470 | 2026-10-06 | 2 | G1 290.421, G2 70.049 |
| `trt24` | Trabalho | 338.660 | 2026-10-07 | 1 | G1 257.691, G2 80.969 |
| `tjac` | Estadual | 993.586 | 2026-09-15 | 23 | G1 526.506, JE 352.595, TR 65.122, G2 49.363 |
| `tjal` | Estadual | 3.105.639 | 2026-09-29 | 9 | G1 2.272.106, G2 380.519, JE 358.240, TR 94.774 |
| `tjam` | Estadual | 4.711.586 | 2026-09-13 | 25 | G1 2.216.651, JE 1.580.423, TR 479.401, G2 435.111 |
| `tjap` | Estadual | 744.704 | 2026-09-11 | 27 | JE 318.680, G1 294.928, G2 89.096, TR 42.000 |
| `tjba` | Estadual | 15.723.042 | 2026-09-14 | 24 | G1 7.748.185, JE 5.541.950, TR 1.405.642, G2 1.027.265 |
| `tjce` | Estadual | 4.935.657 | 2026-10-07 | 1 | G1 3.480.333, JE 690.673, G2 566.560, TR 198.091 |
| `tjdft` | Estadual | 543.297 | 2026-09-16 | 22 | G1 360.574, JE 110.067, G2 64.622, TR 8.034 |
| `tjes` | Estadual | 3.147.022 | 2026-10-07 | 1 | G1 1.688.732, JE 1.026.837, G2 278.472, TR 152.981 |
| `tjgo` | Estadual | 7.323.100 | 2026-09-15 | 23 | G1 4.289.120, JE 1.849.976, G2 935.323, TR 242.122 |
| `tjma` | Estadual | 4.069.397 | 2026-09-12 | 26 | G1 2.699.356, G2 694.263, JE 524.638, TR 151.140 |
| `tjmg` | Estadual | 37.390.773 | 2026-10-06 | 2 | G1 22.297.721, JE 10.408.430, G2 3.673.962, TR 997.109 |
| `tjms` | Estadual | 3.607.960 | 2026-09-30 | 8 | G1 2.285.039, JE 795.252, G2 452.186, TR 75.482 |
| `tjmt` | Estadual | 4.647.817 | 2026-10-05 | 3 | G1 2.660.213, JE 1.223.366, G2 505.083, TR 259.155 |
| `tjpa` | Estadual | 3.748.491 | 2026-10-07 | 1 | G1 2.540.822, JE 731.582, G2 347.027, TR 129.060 |
| `tjpb` | Estadual | 2.694.811 | 2026-09-30 | 8 | G1 1.630.041, JE 539.562, G2 413.535, TR 111.673 |
| `tjpe` | Estadual | 6.852.614 | 2026-09-25 | 13 | G1 5.062.992, JE 925.173, G2 671.380, TR 150.442 |
| `tjpi` | Estadual | 2.267.564 | 2026-09-23 | 15 | G1 1.346.074, JE 437.873, G2 404.325, TR 79.292 |
| `tjpr` | Estadual | 12.887.735 | 2026-09-01 | 37 | G1 6.638.074, JE 3.524.534, G2 2.034.906, TR 689.724 |
| `tjrj` | Estadual | 24.221.920 | 2026-10-07 | 1 | G1 16.667.535, JE 4.312.903, G2 2.612.576, TR 545.178 |
| `tjrn` | Estadual | 2.788.225 | 2026-10-06 | 2 | G1 1.294.631, JE 963.450, G2 323.715, TR 206.429 |
| `tjro` | Estadual | 2.365.347 | 2026-10-07 | 1 | G1 1.203.384, JE 783.844, G2 229.108, TR 149.011 |
| `tjrr` | Estadual | 380.496 | 2026-09-30 | 8 | G1 218.002, JE 100.426, G2 48.631, TR 13.437 |
| `tjrs` | Estadual | 14.385.741 | 2026-09-30 | 8 | G1 8.005.349, JE 3.655.664, G2 2.157.482, TR 567.246 |
| `tjsc` | Estadual | 10.964.870 | 2026-09-24 | 14 | G1 7.092.831, JE 2.437.151, G2 1.217.638, TR 217.122, TRU 128 |
| `tjse` | Estadual | 3.341.348 | 2026-09-23 | 15 | G1 1.969.232, JE 682.338, G2 355.709, TR 334.069 |
| `tjsp` | Estadual | 75.661.482 | 2026-10-07 | 1 | G1 57.706.149, G2 6.520.022, JE 5.768.870, TR 597.078 |
| `tjto` | Estadual | 2.840.997 | 2026-09-13 | 25 | G1 1.822.784, JE 513.958, G2 421.334, TR 82.921 |
| `tjmmg` | Militar estadual | 31.464 | 2026-10-06 | 2 | G1 28.372, G2 3.092 |
| `tjmrs` | Militar estadual | 11.097 | 2026-10-01 | 7 | G1 8.881, G2 2.216 |
| `tjmsp` | Militar estadual | 20.369 | 2026-10-03 | 5 | G1 11.945, G2 8.424 |

## VI.2 Completude de atributos (DataJud, amostral)

| Atributo | Observado |
|---|---|
| `sistema` válido | TJES: PJe 1.687.195 + "Pje" 547.346 + Projudi 89.185 + Eproc 17.360 + Outros 353.925; "Inválido" **452.011 (14,4%)** |
| `dataAjuizamento` válida | TJES: 1.642 docs < 1995; STJ: 2.626.882 (71,3%) < 1990 |
| `movimentos` | TJES: 565.275 (18,0%) sem a lista |
| Município IBGE da unidade | presente nas amostras (TJTO = 0) |
| `nivelSigilo` > 0 | 0 no TJES e no TJMG (sigilosos ausentes) |

## VI.3 Remuneração e demais fontes

| Fonte | Cobertura institucional | Temporal | Registros | Atributos |
|---|---|---|---|---|
| CNJ Painel | "92 órgãos" (texto oficial) | 2017/2018→ (norma/relato) | não medido | nome, cargo, lotação, rubricas (relato TB) |
| DadosJusBr 2026/06 | 86/124 com dado (81 do Judiciário); ausentes: TJAM, TJMG, TJPB, TRF3, TRT18, TRT21, TRT22, 6 TREs | mensal | 25.669 membros ativos (81 órgãos) | matrícula em 6/86 |
| STJ folha | 1 órgão | 2020-01→2026-07 | 108,6 MB | matrícula, lotação, 15 colunas |
| STJ ata | 1 órgão | 1.026 arquivos diários | 3.497 em 07/10/2026 | relator, partes+CNPJ |
| TSE Processual | Justiça Eleitoral (TSE+TREs por UF) | pleitos 2020/22/24/26 | ≥ 40.001 decisões (amostra) | autor da decisão (nome) |
| PNCP (TJES) | 1 órgão | 2023→ | 2/25/9/4 contratos | CNPJ fornecedor |
| TJBA API | 1 tribunal | 2026 | 866 unidades com metas | código CNJ da unidade |

---

# Parte VII — Identidade e relacionamentos

| Relação | Chave | Classe | Evidência |
|---|---|---|---|
| Tribunal ↔ unidade | `(tribunal, orgaoJulgador.codigo)` | **Chave composta determinística** | E02, E09 |
| Unidade ↔ município | `codigoMunicipioIBGE` | Chave oficial explícita (TJTO = 0 ⇒ falha) | E06 |
| Unidade (DataJud) ↔ unidade (tribunal) | `codCnjUnidade = orgaoJulgador.codigo` | **Chave oficial explícita** (TJBA) | E09 |
| Unidade ↔ magistrado | nome do gabinete (2º grau) ou `local_trabalho` (remuneração) | **Inferida** (texto, por tribunal) | E08, E12 |
| Magistrado ↔ carreira | — | **Não comprovada** | — |
| Magistrado ↔ processo | `ministroRelator` (STJ), `NM_AUTOR_DECISAO` (TSE) | **Associação por nome**; DataJud: inviável | E10, E11 |
| Processo ↔ movimento | `id`/`numeroProcesso` + `movimentos[]` | **Chave composta determinística** | E02 |
| Processo ↔ decisão/voto | STJ: `numeroProcesso` ↔ espelho; votos em texto | **Dependente de processamento documental** | E10 |
| Decisão ↔ voto ↔ ministro | texto de `decisao` | **Dependente de PLN** | E10 |
| Tribunal ↔ pagamento (remuneração) | `orgao` + nome + mês | **Inferida** (sem ID) | E12 |
| Tribunal ↔ contrato ↔ fornecedor | `niFornecedor` (CNPJ), `orgaoEntidade.cnpj` | **Chave oficial explícita** (PNCP) | E14 |
| Pessoa jurídica ↔ processo | `numeroCNPJ` (STJ, parcial) | Chave oficial explícita **onde cadastrada** (5.304/13.038 partes) | E10 |
| Mesmo processo em dois graus/tribunais | `numeroProcesso` (CNJ) | Chave oficial; **não verificada** a deduplicação | — |

**Relacionamentos inviáveis mesmo com as entidades isoladas disponíveis**: processo→magistrado no DataJud; carreira→lotação histórica→unidade por código; remuneração→processo; voto→ministro em formato estruturado no STF. **Nomes iguais não são identidade**: TB aponta homônimos e mudanças de nome como causa de erro.

---

# Parte VIII — Indicadores e métricas

| Indicador | Classe | Fórmula / fonte | Denominador | Restrições |
|---|---|---|---|---|
| Documentos por tribunal/grau | **Derivado (COMPROVADO)** | `hits.total` por alias/grau | documentos (processo×grau), **não** processos | duplicidade entre graus; estoque, não fluxo |
| Documentos por unidade | **Derivado** | agregação por `orgaoJulgador.codigo` | idem | códigos reorganizados no tempo |
| Atualização/defasagem | **Derivado** | `max(dataHoraUltimaAtualizacao)` | — | indica frescor, não completude |
| Qualidade do dado (inválidos, sem movimento) | **Derivado** | contagens de `sistema` "Inválido", datas sentinela, ausência de `movimentos` | total de documentos do tribunal | só diagnóstico |
| Tempo até marco (sentença, trânsito, baixa) | **Derivável (HIPÓTESE sólida)** | diferença entre `dataHora` de movimentos TPU | processos com os dois marcos | semântica por tribunal; censura à direita |
| Distribuição de duração por classe/assunto | **Derivável** | percentis (p50/p90) | processos concluídos no recorte | só 2020+ para baixados; viés de sobrevivência |
| Idade do acervo | **Derivável** | `hoje − data válida` (ou ano do número CNJ) | processos com data válida | sentinelas |
| Movimentos por dia/hora | **Derivável** | contagem por `dataHora` | movimentos | fuso (UTC) |
| Casos novos/baixados/pendentes, taxa de congestionamento, IAD | **Oficiais (DOCUMENTADO)** | metodologia CNJ (Justiça em Números) | definidos pelo CNJ | **não reproduzíveis com segurança** a partir do estoque DataJud sem validar a metodologia |
| Metas Nacionais por unidade | **Oficial** | TJBA API (`metaN`) | — | só TJBA comprovado |
| Relatorias por ministro, redistribuições | **Derivado do STJ** | contagem de `nomeMinistroRelator` por `descFormaDistribuicao` | distribuições do dia/período | vale para o STJ; registro à Presidência ≠ relatoria |
| Unanimidade/maioria/vencidos | **Derivado de texto** | regex em `decisao` | acórdãos do espelho | espelho é **subconjunto** selecionado |
| Decisões por autor (eleitoral) | **Derivado** | contagem por `NM_AUTOR_DECISAO` × `DS_TIPO_DECISAO` | decisões do ciclo | nome sem ID; volume ≠ qualidade; pode incluir quem assina por delegação |
| Remuneração bruta/líquida por mês | **Oficial/derivado** | colunas da folha (STJ) / pacote DadosJusBr | — | taxonomia de rubricas em transição (Res. 681/2026) |
| Grande litigante (STJ) | **Derivado** | processos distintos por `numeroCNPJ` | distribuições do período | cobre só partes com CNPJ cadastrado |

**Indicadores a não calcular nesta fase**: produtividade individual de juízes, "ranking" de magistrados, qualquer índice composto sem comparabilidade demonstrada.

---

# Parte IX — Viabilidade das páginas

| Página | A. Pergunta editorial | B. Indicadores sustentados | C. Granularidade | D. Navegação | E. Cobertura | F. Dados faltantes | G. Esforço | H. Confiança |
|---|---|---|---|---|---|---|---|---|
| `/judiciario` | Qual o tamanho e o ritmo da Justiça brasileira? | documentos por segmento/tribunal, atualização, qualidade | nacional→tribunal | → tribunais, gastos | **nacional** (64 aliases) | denominador oficial de "processos" e fluxo anual | **Médio** (agregações pesadas, limites do serviço) | Alta para volumes de estoque; baixa para fluxo |
| `/judiciario/tribunais` | Como os tribunais se comparam? | volume, distribuição por grau, defasagem, % sistema inválido | tribunal | → [id] | **nacional** | normalização de sistemas; comparabilidade de duração | **Médio** | Média |
| `/judiciario/tribunais/[id]` | Como funciona este tribunal por dentro? | unidades (código, município), classes/assuntos, tempo até marcos, atualização | unidade, município | → processos, gastos, magistrados | **nacional** para DataJud; **STJ** com camada extra; **TJBA** com metas | hierarquia comarca→vara; composição; folha por órgão | **Médio→Alto** | Média |
| `/judiciario/magistrados` | Quem são os magistrados e quanto recebem? | folha nominal mensal (STJ comprovado; 81 órgãos via terceiro) | pessoa (nome) | → [id] | **parcial** | ID, carreira, ativo/inativo (TB), cobertura mensal | **Alto** (conciliação de nomes) | Baixa para escala nacional; Alta só para STJ |
| `/judiciario/magistrados/[id]` | O que este magistrado fez e recebeu? | STJ: relatorias (ata), acórdãos (espelhos), remuneração, diárias; TSE: decisões; demais: remuneração por nome | pessoa | → julgamentos, gastos | **STJ e Justiça Eleitoral**; resto **incerto** | processo→juiz no DataJud; produtividade individual | **Alto** | Média (STJ), Baixa (demais) |
| `/judiciario/processos` | Como anda um processo? | linha do tempo de marcos, unidade, classe, tempo | processo, evento | → tribunal | **nacional** (metadados) | partes, valor, documento, sigilosos | **Médio** (consulta sob demanda; não espelhar) | Alta para metadados |
| `/judiciario/julgamentos` | Quais julgamentos e como votaram? | STJ: pauta, acórdãos, relator, unanimidade/maioria (texto); TSE: decisões | evento | → magistrado | **STJ/TSE**; STF **restrito** | votos nominais estruturados, STF | **Alto** (PLN no texto) | Média (STJ), Baixa (voto individual) |
| `/judiciario/gastos` | Quanto o Judiciário gasta e com o quê? | contratos PNCP, diárias STJ, folha STJ | tribunal, contrato | → fornecedores | **parcial** | pagamentos/empenho; contratos fora do PNCP | **Médio** | Média (cobertura baixa) |
| `/judiciario/fornecedores` | Quem vende ao Judiciário? | `niFornecedor` por contrato PNCP; ligação com fornecedores do Cívica | CNPJ | → contratos, gastos | **parcial** | universo de contratos | **Baixo→Médio** | Alta para o que existe; cobertura incerta |
| `/judiciario/litigantes` | Quem mais aciona/é acionado? | STJ: ranking por CNPJ no período | CNPJ | → processos | **STJ** | nacional (DataJud sem partes) | **Médio** | Média |

Oportunidades não previstas **com evidência**: (1) **"Qualidade dos dados do Judiciário"** (defasagem, sistema inválido, sem movimentos, datas sentinela) — transparência sobre a própria transparência; (2) **Painel de relatoria do STJ** (distribuição vs. redistribuição por ministro, por dia); (3) **Metas por unidade** onde houver API (TJBA).

---

# Parte X — Lacunas e riscos

**Técnicos**
- Serviço compartilhado e instável: 429, 504 e `es_rejected_execution_exception` observados; tempos de 3–50 s; agregações pesadas falham sob paralelismo (E24).
- Chave pública pode mudar "a qualquer momento" (E01).
- Estoque 2020+ e dados sentinela distorcem séries históricas; classe e unidade refletem o **estado atual**.
- Tamanho: ~59 mil documentos/dia só no TJES; espelhamento nacional é inviável sem orçamento de infraestrutura.
- Dashboards Qlik: automação só por simulação de usuário — **não propor** sem autorização formal do CNJ.

**Metodológicos**
- Documento ≠ processo (um processo pode aparecer em dois graus).
- Produtividade por órgão ≠ por pessoa; juiz leigo, assessoria, mutirão, substituição e acervo herdado.
- Sentença/acórdão/baixa/arquivamento exigem **mapa semântico TPU por tribunal**.
- Votos individuais do STJ em texto livre: extração probabilística.

**Jurídicos e de uso**
- Termo de Uso DataJud v1.2: **fins não comerciais**; vedação a "distribuir, vender ou explorar comercialmente" a informação derivada; **comunicar ao CNJ** relatórios públicos; sem garantia de precisão (E01). Requer decisão institucional (o Cívica é publicação de interesse público; confirmar enquadramento).
- LGPD: nomes de magistrados em folha são dado público de agente público; **partes pessoas físicas** (STJ, TSE) **não devem ser ingeridas**; manter só CNPJ e papel.
- STF: `robots.txt` (`Disallow: /processos`) e desafio anti-robô — **não** automatizar acompanhamento processual/votos.
- Qlik/WAF: não contornar bloqueios.

**Confiabilidade**
- Corrupção de codificação em nomes de órgão (STJ, TJRJ).
- Homônimos entre órgãos e mudança de nome (TB).
- Painel CNJ com "nome 0" agregado (TB).

**Mudanças normativas em curso**: Portaria 374/2026 (envio diário), Res. 681/2026 (contracheque único), Portaria 244/2026 (GT remuneração), consulta pública do ONIT. Qualquer collector deve prever **mudança de formato** em 2026–2027.

---

# Parte X-B — Respostas às 24 questões estratégicas

Nível de evidência: **C** = comprovado por inspeção; **P** = parcial; **D** = apenas documentado; **H** = hipótese; **N** = não comprovado/indisponível.

| # | Pergunta | Resposta | Nível |
|---|---|---|---|
| 1 | Base nacional de magistrados? | **Não como cadastro de carreira.** Só como **folha nominal mensal**: painel CNJ (92 órgãos) e DadosJusBr (81 órgãos do Judiciário com dado em 06/2026; 25.669 membros ativos). Sem ID, sem datas de nomeação/promoção. | P |
| 2 | Lotação atual e histórica? | **Texto mensal** (`local_trabalho`/`Lotação`) em 86/86 órgãos do DadosJusBr e no STJ. Atual = última competência; histórico = série mensal. **Sem código de unidade**: junção ao DataJud só por nome. | P |
| 3 | Vincular magistrado às decisões? | **Só STJ (relator na distribuição e no acórdão) e Justiça Eleitoral (autor da decisão).** DataJud: não. Em 2º grau, o gabinete embute o nome só em alguns tribunais (TJES). | P (STJ/TSE) · N (nacional) |
| 4 | Remuneração mensal individualizada em escala nacional? | **Sim, parcialmente**, via painel (Qlik, relato de download por ano) e terceiro; **CSV direto só no STJ**. | P |
| 5 | Produtividade individual? | **Não comprovada.** A divulgação nominal de produtividade de juízes foi retirada do ar em 2015; sem evidência de reabertura. Proxies: relatorias no STJ, decisões por autor no TSE — **volume, não desempenho**, e com viés de delegação. | N |
| 6 | Timeline completa de um processo? | **Marcos sim**, com data/hora e complemento; "completa": **parcial** (18% dos documentos TJES sem movimentos; só baixados desde 2020; semântica TPU por tribunal). | C (marcos) · P (completa) |
| 7 | Profundidade temporal do DataJud? | **Estoque**: em tramitação (qualquer ano) + baixados desde 01/01/2020 (E17). Observado: anos < 2020 só mostram o que ainda tramita. | D + C |
| 8 | Processos paralisados? | **Derivável** por "último movimento antigo" (H); "sem movimentos" ≠ paralisado. | H |
| 9 | Diferenciar sentença, acórdão, baixa e arquivamento? | **Sentença (219/220/221…), trânsito (848), baixa (22) e "Definitivo" (246) aparecem como movimentos**; **acórdão não foi observado como movimento próprio** no DataJud; no STJ o espelho tem `tipoDeDecisao` ACÓRDÃO/DECISÃO. | P |
| 10 | Como cada ministro do STF votou? | **Não comprovado e restrito** (robots, anti-robô, sem dataset aberto localizado). | N/RESTRITO |
| 11 | E cada ministro do STJ? | **Parcial**, por texto do acórdão ("votaram com o Relator", "vencido"); espelhos são subconjunto; íntegras completas existem. | P |
| 12 | Pedidos de vista e divergências estruturados? | **Não**: aparecem em texto livre (11 acórdãos "por maioria/vencido" em 676). | N (estruturado) · P (texto) |
| 13 | Classes judiciais com maior crescimento? | **Viável** por agregação ano×classe sobre `dataAjuizamento`, com a ressalva do estoque 2020+ e das datas sentinela. Coorte semanal TJES mostra o perfil de classes. | H |
| 14 | Comparar tempos de tramitação entre tribunais? | **Viável com cautela** (mesmos códigos TPU, censura à direita, sistemas e normalização distintos); **não** como ranking. | P |
| 15 | Chegar ao nível de vara? | **Sim**: `orgaoJulgador.codigo/nome` (TJES: 409 códigos). Hierarquia comarca→vara: não nacional. | C |
| 16 | Onde o acervo está concentrado? | **Viável por unidade e município** (agregações); tribunal-a-tribunal já medido (TJSP 75,7 mi, TJMG 37,4 mi, TJRJ 24,2 mi). | C (tribunal) · H (unidade) |
| 17 | Grandes litigantes por CNPJ? | **No STJ**, por ata/acervo (88% das distribuições do dia têm parte com CNPJ). Nacional: não (DataJud sem partes). | P |
| 18 | Gastos dos tribunais ↔ fornecedores? | **Contrato→CNPJ sim (PNCP)**; **pagamentos não**; cobertura baixa (TJES: 2/25/9/4 contratos 2023–2026). | P |
| 19 | Indicadores oficiais × derivados? | Ver Parte VIII. | — |
| 20 | Melhor cobertura nacional? | **DataJud (64/64)**, depois painéis CNJ e o DadosJusBr (remuneração). PNCP tem a pior para tribunais. | C |
| 21 | Principais vazios? | Autoria individual de atos; votos do STF; produtividade individual; partes e valor da causa no DataJud; documentos; pagamentos e execução orçamentária estruturados; cadastro de unidades com hierarquia/histórico; ID de magistrado. | C |
| 22 | O que entregar com qualidade sem perfis individuais? | **Panorama nacional/tribunal/unidade**, **qualidade dos dados**, **linha do tempo de processos sob demanda**, **tempo até marcos agregado**, **contratos/fornecedores (com cobertura declarada)**, **metas por unidade onde houver API**. | C/P |
| 23 | O que falta para ir de institucional a individual? | **ID de pessoa** (matrícula/CPF mascarado/ID CNJ), **cadastro de unidades com hierarquia e histórico**, **mapa unidade↔pessoa↔período**, **autoria de ato nos metadados**, **regra de publicação de produtividade individual**. Precedente: Acordo de Cooperação Técnica 079/2021 entre Transparência Brasil e CNJ (E13). | D |
| 24 | Integração Judiciário + Legislativo + Financeiro? | (a) **CNPJ comum** entre fornecedores do Judiciário (PNCP) e do Cívica — campo comprovado, **sobreposição não medida**; (b) litigância por CNPJ (STJ) cruzável com fornecedores/empresas do Cívica — H; (c) **município IBGE** da unidade judiciária ↔ municípios beneficiários das Emendas Pix — H; (d) remuneração de magistrados × teto/subsídio parlamentar — H. | H |

---

# Parte XI — Priorização técnica (fases futuras de investigação, sem implementar)

**Fase 0 — Institucional e jurídico (bloqueante).** Parecer sobre o Termo de Uso DataJud v1.2 (uso não comercial, redistribuição, comunicação ao CNJ); contato formal com o CNJ (DPJ) sobre cota/limite e eventual acordo de cooperação técnica; confirmação de licença/termos do CKAN do STJ/TSE e do DadosJusBr; revisão LGPD (sem partes pessoa física).

**Fase 1 — Piloto de agregação DataJud (3 tribunais: TJES, TJRJ, TRF1).** Medir custo e confiabilidade de agregações por tribunal×grau×unidade×classe×mês; definir o contrato "documento ≠ processo"; levantar o **mapa semântico TPU** de sentença/trânsito/baixa/arquivamento; quantificar sentinelas e documentos sem movimento por tribunal. Saída: nenhum espelho, só tabelas de agregados.

**Fase 2 — Vertical STJ.** Ata diária, acervo, espelhos, pautas, precedentes, diárias e folha; chaves: `numeroUnico` (CNJ), nome do ministro; reconciliar relator (ata) × `ministroRelator` (espelho) × lotação (folha). Avaliar extração de votantes em texto (taxa de sucesso por regex) **antes** de prometer "como votou".

**Fase 3 — Justiça Eleitoral por autor de decisão (TSE Processual).** Auditar quem é `NM_AUTOR_DECISAO` (juiz, assessor, servidor?); medir homônimos; decidir se é publicável por pessoa.

**Fase 4 — Remuneração.** Comparar STJ (CSV oficial) × DadosJusBr × painel CNJ para os mesmos meses; medir meses sem dado por órgão; planejar a transição à taxonomia da Res. CNJ 681/2026.

**Fase 5 — Contratos e fornecedores.** Cobertura do PNCP por tribunal (CNPJ do órgão) versus portais; sobreposição de CNPJ com fornecedores do Cívica.

**Fase 6 — Unidades e metas.** Padrão TJBA (API de unidades/metas com código CNJ) como modelo; levantar quais outros tribunais têm APIs equivalentes; avaliar o cadastro de unidades no CNJ.

**Primeiro recorte sólido para um futuro MVP:**
1. **"Judiciário em estoque"** — volumes e atualização por segmento, tribunal e unidade, mais um painel de **qualidade dos dados**; base: DataJud agregado (Fase 1).
2. **"STJ por dentro"** — ministros (relatorias e redistribuições por dia, acervo, pautas, acórdãos com unanimidade/maioria, remuneração, diárias) e **grandes litigantes por CNPJ**; base: STJ Dados Abertos (Fase 2). É o único recorte com dado individual **aberto, diário e multifacetado**.

**O que descartar ou reformular:** perfil nacional de juízes com produtividade; ranking de magistrados; "como votou cada ministro do STF"; qualquer promessa de cobertura nacional de contratos/pagamentos a partir do PNCP; espelhamento completo do DataJud.

---

# Parte XII — Evidências reproduzíveis

Chave pública do DataJud: publicada na Wiki (`/api-publica/acesso/`), usada no header `Authorization: APIKey <chave pública da Wiki>`; **omitida** aqui. `UA` = user-agent identificável.

**E01 — DataJud Wiki.** `GET https://datajud-wiki.cnj.jus.br/api-publica/{acesso,endpoints,glossario,termo-uso}/` → 200. Termos: v1.2, cláusulas 3.3, 3.6, 3.8, 3.9 (citadas na Parte I). Endpoints: 64 aliases (STJ, TST, TSE, STM; TRF1–6; TRT1–24; 27 TJs; TJMMG, TJMRS, TJMSP). Glossário: campos da Parte IV.1.

**E02 — Capa, agregações e amostra (TJES).** `POST …/api_publica_tjes/_search` `{"size":1,"track_total_hits":true,"query":{"match_all":{}}}` → 200 em 17,8 s; `hits.total.value = 3147022`. Agregação `terms` em `sistema.nome.keyword`: PJe 1.687.195; Pje 547.346; Inválido 452.011; Outros 353.925; Projudi 89.185; Eproc 17.360. `grau.keyword`: G1 1.688.732; JE 1.026.837; G2 278.472; TR 152.981. `cardinality(orgaoJulgador.codigo)` = 409; `cardinality(...codigoMunicipioIBGE)` = 69. `_count` com `range nivelSigilo>0` = 0; documentos sem `movimentos` = 565.275.

**E03 — Contagem nos 64 aliases.** `POST …/api_publica_{alias}/_search` `{"size":0,"track_total_hits":true,"aggs":{"upd":{"max":{"field":"dataHoraUltimaAtualizacao"}},"grau":{"terms":{"field":"grau.keyword"}}}}`. Resultado completo: Parte VI.1. Falhas transitórias na primeira rodada (TJSP, TJTO, TRT6 `es_rejected_execution_exception`; TST resposta truncada) foram resolvidas em reexecução sequencial (TJSP 75.661.482; TJTO 2.840.997; TRT6 1.010.930; TST 4.610.727).

**E04 — Contagens por ano e sentinelas.** `POST …/_count` `{"query":{"range":{"dataAjuizamento":{"gte":"AAAA0101000000","lte":"AAAA1231235959"}}}}` para TJES, TJMG, TRF1, STJ. TJES: ordenação ascendente de `dataAjuizamento` devolveu 1900-01-14 (processo com número de ano 2018) e 1904-03-22; `dataAjuizamento < 1995` = 1.642. STJ `< 1990` = 2.626.882. A agregação `min/max` em `dataAjuizamento` **não é utilizável** (o campo é interpretado como epoch).

**E05 — Coorte e linha do tempo (TJES).** Filtro `dataAjuizamento` 20250101000000–20250107235959 → 2.147 documentos. Agregação `terms movimentos.codigo`: 26=2.050; 51=2.017; 60=2.009; 85=1.919; 246=1.044; 848=910; 36=533; 219=263; 221=229; 220=137; 22=145; 14739=322; 466=124. `_count` com dois `term`: 219&848=129; 219&22=1; 848&22=108. `stats` de movimentos por documento: média 38,25, máx. 329. Documento exemplo: 41 movimentos (Parte III-J2); identificadores omitidos.

**E06 — Amostras de 13 tribunais.** `size:1` com filtro de data (TJMG, TRT2, TRT3, TJBA) ou ordenação por atualização (TJSP, TJRJ, TJTO, TRF1, TRF3, STJ, TST, TSE). Mesmas chaves em todos: `@timestamp, assuntos, classe, dataAjuizamento, dataHoraUltimaAtualizacao, formato, grau, id, movimentos, nivelSigilo, numeroProcesso, orgaoJulgador, sistema, tribunal`. Exemplos de `orgaoJulgador`: TJSP "Juízo Titular I – 4ª Vara Cível da Comarca de Limeira" (cód. 9844, IBGE 3526902); TRF1 "Representação da Turma Recursal da SJMT na TRU" (G=TRU); TRT2 "SDI-8 – Cadeira 3"; TJMG G2 "Gabinete da 1ª Vice-Presidência"; STJ "Superior Tribunal de Justiça" (cód. 12728; texto corrompido); TST "Gabinete da Presidência"; TSE "GABINETE CGE"; TJTO IBGE 0.

**E07 — Incremental.** `_count` com `range dataHoraUltimaAtualizacao` 2026-10-07 → TJES 58.846. `_search` com `sort @timestamp asc` e `search_after` → páginas disjuntas.

**E08 — Gabinetes em 2º grau.** `terms orgaoJulgador.nome.keyword` com `grau=G2` (ago–set/2026): TJES "GAB. DESEMB. <NOME> – VITORIA" (≈480–520 cada); TRF1 "Gabinete NN"; TJMG "NªCâmara …/Gabinete da 3ª Vice-Presidência". Nomes substituídos por `<NOME>`.

**E09 — TJBA.** `GET https://transparencia-service-api.tjba.jus.br/{unidades,comarcas,metas}` → 200 JSON (1.782 / 241 / 1.714 linhas). Junção: DataJud TJBA `term orgaoJulgador.codigo = 77829` → 16 documentos, nome idêntico ao de `metas.unidade`.

**E10 — STJ.** `GET https://dadosabertos.web.stj.jus.br/api/3/action/package_list` → 21 datasets; `package_show` de 8; dicionários (`dicionario-atadedistribuicao.csv`, `dicionario-espelhodoacordao.csv`, `dicionario-de-dados.csv` da folha, `dicionario-tramitando.csv`). Ata `ata20261007.json` (7,3 MB): 3.497 registros; 35 relatores; `descFormaDistribuicao` Registro 1.770 / Redistribuição 1.322 / Distribuição 405; 3.089 processos com parte com CNPJ. Espelho `20260831.json` (1,7 MB): 676 acórdãos, 665 "unânime", 11 "maioria", 11 "vencido". Folha `folhadepagamento.csv`: `Content-Length` 108.588.883; faixas de bytes do início (2020-01), meio (2026-04→06, 10.443 linhas) e fim (2026-07) lidas; ministros presentes com `Cargo = Ministro do Superior Tribunal de Justiça`.

**E11 — TSE.** `GET https://dadosabertos.tse.jus.br/api/3/action/package_list` → 187 datasets (inclui `processual-2020/2022/2024/2026`). `https://cdn.tse.jus.br/estatistica/sead/odsele/processual/processos_eleitorais_decisoes_2024.zip` (40,8 MB; 12 colunas; 40.001 linhas amostradas).

**E12 — DadosJusBr.** `GET https://api.dadosjusbr.org/v2/orgaos` (124) e `/v2/dados/{orgao}/2026/6` (124 chamadas: 86 com dado); pacote `…/tjes/datapackage/tjes-2026-6.zip` (72.886 bytes; 413 contracheques; 10.618 linhas de rubrica).

**E13 — CNJ remuneração.** `https://www.cnj.jus.br/transparencia-cnj/remuneracao-dos-magistrados/` (Portaria 63/2017; Res. 215/2015; "92 órgãos"); `…/gt-portaria-n-244-2026/` (GT de 02/06/2026; relatórios 08/07 e 21/08; debates ago–nov/2026); busca web: Res. CNJ 681/2026 (28/05/2026, contracheque único; 60 dias); PDF "Contribuições para aperfeiçoamento do Painel de Remuneração dos Magistrados" (Transparência Brasil, ago/2026).

**E14 — PNCP.** `GET https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=…&dataFinal=…&cnpjOrgao=27476100000145&pagina=1&tamanhoPagina=10` (≤ 365 dias). Totais TJES: 2023=2; 2024=25; 2025=9; 2026=4. `…/contratacoes/publicacao?…&codigoModalidadeContratacao=6&cnpj=…` 2025 → 94. `GET https://pncp.gov.br/api/search/?tipos_documento=contrato&q=…`.

**E15 — STF.** `GET https://portal.stf.jus.br/robots.txt` → `Disallow: /processos`; `https://jurisprudencia.stf.jus.br/robots.txt` → 202 (desafio); `https://transparencia.stf.jus.br/` → 403 a cliente não-navegador; `https://portal.stf.jus.br/hotsites/corteaberta/` → 200 (Programa Corte Aberta, Res. 774/2022). Resoluções do STF sobre votos no Plenário Virtual: busca web (Res. 675).

**E16 — Painéis CNJ.** `https://www.cnj.jus.br/pesquisas-judiciarias/paineis-cnj/` lista dezenas de painéis Qlik (`paineisanalytics.cnj.jus.br/single/?appid=…`); `https://justica-em-numeros.cnj.jus.br/` é uma SPA (1,7 KB de HTML); `…/datajud/painel-estatistica` e `painel-saude` são iframes. Nenhuma chamada a WebSocket/engine foi feita.

**E17 — Portaria 374/2026.** `https://atos.cnj.jus.br/atos/detalhar/6972` (14/08/2026): envio diário, 180 dias; saneamento contínuo; cargas corretivas com "todos os processos em tramitação e os baixados a partir de 1º de janeiro de 2020".

**E18 — TPU/SGT.** `https://www.cnj.jus.br/sgt/versoes.php` → versão de classes/movimentos/assuntos/documentos de 06/10/2026 por justiça e grau; menus de WebService e consulta pública (não testados).

**E19 — Justiça Aberta e produtividade.** `https://www.cnj.jus.br/corregedoria-nacional-de-justica/justica-aberta/` (escopo: serventias extrajudiciais); matéria da Gazeta do Povo (jul/2015) sobre retirada do ar dos dados de produtividade de juízes; busca web: Provimento CNJ 49/2015 (Módulo de Produtividade Mensal).

**E20 — CSJT.** `https://www.csjt.jus.br/web/csjt/dados-abertos` → lista de exportações CSV/PDF/Excel de painéis.

**E21 — Portais de tribunais.** TJES `/comarca-unidade-magistrado/` (Google Docs embutido), `/institucional/magistrados/`; TJBA `/transparencia/…/situacao-funcional-dos-magistrados-ativos/`, `/portal/api/`; TJMG `/portal-tjmg/transparencia/`; TJRJ `/transparencia/apresentacao`; TJSP `/Transparencia` respondeu 200 com corpo vazio ao cliente utilizado.

**E22 — Cadastro de unidades.** Busca web: códigos de órgão julgador "registrados no Sistema Corporativo do CNJ"; nenhuma publicação nacional encontrada.

**E23 — CKAN TSE/STJ.** Listagens de datasets (E10, E11).

**E24 — Confiabilidade operacional (DataJud).** HTTP 504 (TJMG e TRT3 em consulta com ordenação por atualização), HTTP 429 (TRT6), `es_rejected_execution_exception` (TJSP, TRT6 em 4 agregações paralelas); latências 3–50 s.

---

# Parte XIII — Perguntas ainda abertas

1. **Metodologia do CNJ** (Justiça em Números): fórmulas exatas de taxa de congestionamento, IAD e tempo médio; existe base aberta anual (CSV) além dos painéis?
2. **Módulo de Produtividade Mensal** hoje: existe produtividade por magistrado publicada? Em que granularidade?
3. **Painel de Remuneração**: cobertura por mês e por órgão (aba "Controle de envio"); profundidade histórica por órgão; formato de download real; efeito prático da Res. CNJ 681/2026 e da IN 36/2026 (não verificada).
4. **DataJud**: existe sinalização de **acórdão** como movimento? Como os tribunais registram **juiz leigo, sentença parcial, recurso e retorno** (semântica TPU por tribunal)? Há **duplicidade** G1/G2 relevante?
5. **Limites reais de uso** (cota, volume diário aceitável) e política de **mudança de chave**.
6. **STF**: existe fonte oficial aberta de **pauta/resultado/votos** (além do Plenário Virtual web)? Há dado nas "Corte Aberta" panels acessível sem simulação?
7. **STJ**: qual o recorte exato dos "espelhos" (que fração dos acórdãos)? A extração de votantes por regex atinge que taxa nas 10 turmas/seções?
8. **TSE Processual**: quem são os `NM_AUTOR_DECISAO` (magistrados × servidores)? `partes` e `recursos` têm CNPJ?
9. **Unidades**: existe cadastro nacional público (CNJ "Sistema Corporativo")? TJs além do TJBA têm APIs de unidades/comarcas?
10. **Remuneração**: população de aposentados/pensionistas e como é identificada nos painéis (TB aponta ausência de campo ativo/inativo).
11. **PNCP**: cobertura de contratos por tribunal (TJMG, TJSP, TJRJ, TJBA, TRFs, TRTs) e proporção em relação aos portais próprios.
12. **Grandes litigantes**: painel do CNJ existe e é reproduzível? Cobertura de CNPJ nas partes do TSE e dos demais tribunais.
13. **Aspectos jurídicos**: enquadramento do Cívica no termo de uso do DataJud e na LGPD para nomes de agentes públicos em folha e atos.
14. **TJSP, TJMG e TRTs**: portais próprios de dados abertos/APIs (a página de transparência do TJSP não retornou conteúdo ao cliente usado).
15. **Qualidade**: quantificar, por tribunal, o percentual de documentos sem movimentos, `sistema` inválido e datas sentinela (só TJES, STJ e parcialmente TJMG foram medidos).

---

**Resumo numérico da investigação:** 23 fontes investigadas; ≈123 endpoints/URLs distintos consultados (64 aliases DataJud + ≈59 demais); 13 tribunais com conteúdo de documento amostrado (TJES, TJMG, TJSP, TJRJ, TJBA, TJTO, TRF1, TRF3, TRT2, TRT3, STJ, TST, TSE) e 64 com contagem.
