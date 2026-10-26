# Contrato de obras e infraestrutura educacional · G11

Estado: **PARTIAL** · Fase consumidora: P10.7 · Provas: `obrasgov_prova_es.json` (varredura completa do ES), `fnde_obras_probe.json`, `plano_reuso_pncp_educacao.md` (contratos), `contratos_fnde_programas.md` (transferências para infraestrutura).

## 1. Fontes avaliadas
| Fonte | Acesso | Estado |
|---|---|---|
| **Obrasgov (API, `api.obrasgov.gestao.gov.br/obrasgov/api/projeto-investimento`)** | pública, sem chave, filtro `uf` | funciona; **qualidade baixa** (abaixo) |
| Contratos PNCP de obra escolar | RAW local | 9.999 contratos `obra_escolar` (2021–2026), valor contratado, sem INEP |
| Transferências do Portal (ações 20RP, 00SU, 0E53, 00OW) | zip mensal | município/Estado beneficiário; sem obra nem escola |
| Transferegov/SICONV (`exec_fin_transfer`, 26.161 propostas) | já no banco | convênios, não classificados por educação |
| **SIMEC/FNDE (painel de obras)** | `simec.mec.gov.br` responde 200, mas o painel exige login | **não testável sem credencial** (`NOT_EVALUATED`) |

## 2. Obrasgov — medido no ES (varredura até página vazia)
- **1.879 projetos de investimento** no ES (19 páginas de 100). **A paginação da API é enganosa:** `totalElements` cresce por página (100, 200, 300…) e `last` vem sempre `true`; só a **página vazia** encerra a leitura. Respostas 500 intermitentes apareceram numa primeira rodada.
- Projetos com órgão de educação como executor/tomador/repassador: **332** (17,7%). Situação: Concluída 143 · Cadastrada 138 · Em execução 38 · Cancelada 7 · Paralisada 5 · Inativada 1.
- Campos: `idUnico` (ex.: `82919.32-12`), `nome` (ex.: "CMEI Guilherme de Almeida Filho"), `descricao`, `especie` (Obra, Reforma…), `natureza`, `situacao`, `dataInicialPrevista`, `dataFinalPrevista`, `dataInicialEfetiva`, `dataFinalEfetiva`, `executores`, `tomadores`, `repassadores`, `fontesDeRecurso[{origem, valorInvestimentoPrevisto}]`, `tipos/subTipos/eixos`, `endereco`, `cep`, `populacaoBeneficiada`.
- **Defeitos de dado (medidos nos 332):**
  - **`dataFinalEfetiva` preenchida em 0/332**, `dataInicialEfetiva` em 3/332 → **não há data real de entrega** nem de início na fonte.
  - **valor previsto ≤ R$ 0,01 em 138/332** (placeholder, não é valor).
  - **sem endereço e sem CEP em 229/332**.
  - **99 projetos cujo nome é de escola/creche têm `tipos` não educacional** (ex.: CMEI classificado como "Infraestrutura Hídrica, Portos, Hidrovia"): o `tipo` não é confiável para classificar.
  - Sem **código INEP**, sem **percentual de execução física** nos campos lidos, sem **valor desembolsado**.

## 3. Respostas às perguntas do prompt
| Pergunta | Resposta |
|---|---|
| Existe identificador de obra? | sim: `idUnico` (Obrasgov); no PNCP, `numeroControlePNCP` do contrato |
| Existe código INEP da escola? | **não** na Obrasgov nem no PNCP |
| Existe município? | Obrasgov: `uf` sempre; município via endereço/CEP (ausente em 69%); PNCP: `codigoIbge` do órgão |
| Valor previsto? | Obrasgov: `valorInvestimentoPrevisto` (50% placeholder); PNCP: `valorGlobal` |
| Valor desembolsado? | **não** |
| Status? | sim (`situacao`) |
| Data de início? | prevista sim; efetiva quase nunca |
| Previsão de conclusão? | sim (`dataFinalPrevista`) |
| Data real de entrega? | **não** (0/332) |
| Percentual físico de execução? | **não** nos campos lidos (existe endpoint `execucao-fisica` na API, que respondeu 200, mas **não foi analisado**) |

## 4. Regras (vinculantes)
1. **Contrato assinado não é obra concluída**; **pagamento não é entrega**; "Concluída" na Obrasgov é a declaração do cadastrador, sem data real.
2. **Nunca** ligar obra a escola por semelhança de texto do nome. O vínculo só existe quando a fonte trouxer o INEP (hoje nenhuma das duas traz). O nome da escola em `nome` é rótulo, não chave.
3. Não usar `tipos/subTipos` da Obrasgov para decidir "obra educacional" (inconsistência medida); usar o órgão (FNDE/Secretaria de Educação) e o objeto, e marcar "classificação por órgão e texto".
4. Valor ≤ R$ 0,01 vira "valor não informado", nunca R$ 0,01.
5. Não somar valor previsto da obra com contrato PNCP da mesma obra (duplicidade provável: mesma obra, duas fontes).

## 5. O que dá para publicar (P10.7)
- **Por município:** nº de obras cadastradas com órgão de educação por situação, valor previsto (quando válido) e data prevista; contratos PNCP de obra escolar (valor **contratado**) com a ressalva de que não há data de entrega; transferências para infraestrutura (valor transferido ao ente).
- **Por escola:** nada, até haver chave INEP em fonte oficial. Isso é um **`PROVEN_EXTERNAL_BLOCKER` parcial**: prova = os 332 projetos lidos sem campo INEP e o PNCP idem.

## 6. Contrato de coleta (P10.7)
Obrasgov: varrer por UF até página vazia (27 UFs; o ES tem 1.879 projetos em 19 páginas de 100), repetir em 5xx, RAW por UF; publicar por UF com hash; filtro educacional por executor/tomador/repassador; guardar `idUnico`. Execução física: avaliar `execucao-fisica` na P10.7 (não analisado aqui).

## 7. Limitações
Só o ES foi varrido; outros estados podem ter outra qualidade; `execucao-fisica` não analisado; SIMEC/FNDE sem credencial.
