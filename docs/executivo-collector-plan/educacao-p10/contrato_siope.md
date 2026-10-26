# Contrato SIOPE (FNDE) · G8

Estado: **PASS_WITH_CAVEATS** · Fase consumidora: P10.5 · Provas: `siope_prova.json`, `siope_cobertura_nacional_dados_gerais.json`, `siope_cobertura_es_por_ano.json`, `reproducibilidade/siope_probe.py` (todas as chamadas reais, somente leitura).

## 1. Acesso
- Serviço **Olinda/OData** do FNDE: `https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata/` (`$metadata` HTTP 200, 15 KB). **Sem chave.** (O catálogo `dados.gov.br` exige chave: HTTP 401; `dadosabertos.fnde.gov.br` não resolve DNS: `fnde_obras_probe.json`.)
- Funções parametrizadas por `Ano_Consulta`, `Num_Peri` (6 = exercício anual; 1–5 = bimestres) e `Sig_UF`: `Dados_Gerais_Siope`, `Despesas_Funcao_Educacao_Siope`, `Indicadores_Siope`, `Informacoes_Complementares_Siope`, `Receita_Siope`, `Despesas_Siope`, `Dados_Gerais_Siope_Dados_Responsaveis`, `Remuneracao_Siope` (esta com `Ano_Declaracao`, `Mes_Exercicio`).
- `$format=json`; **sem paginação automática** (`@odata.nextLink` ausente; resposta inteira); `$filter` (ex.: `COD_MUNI eq 320530`) e `$top/$skip` funcionam.
- Latência medida: ~1 s para Dados Gerais/Função/Indicadores de uma UF; **47 s e 69 MB** para `Despesas_Siope` do ES (155.037 linhas); 15 s e 11,7 MB para `Receita_Siope` do ES.

## 2. Cobertura testada
| Teste | Resultado |
|---|---|
| ES, `Dados_Gerais`, exercício 2008–2016 (período 6) | **0 linhas** (sem dados) |
| 27 UFs, exercício 2016 | **0 entes** em todas |
| 27 UFs, exercício 2017 | **5.592 entes** (5.566 municípios), 7,1 MB, 34 s |
| 27 UFs, exercício 2024 | 5.591 entes (5.564 municípios), 7,2 MB |
| 27 UFs, exercício 2025 | 5.559 entes, **DF sem dados** (declaração ainda incompleta) |
| ES, 2026 bimestres 1 e 2 | 75 entes (parcial) |
→ **Série: 2017 em diante.** O SIOPE **não** cobre 2014–2016. Anos correntes são parciais.
- Estado/município: `TIPO` = `Municipal` (COD_MUNI = **IBGE de 6 dígitos**, ex.: 320530) ou `Estadual` (COD_UF, COD_MUNI nulo). Mapear com `exec_entity.ibge6` (índice único).
- **Retificação**: `IDN_DECL_RETI` marca declaração retificadora: 15 de 79 entes do ES em 2024 são `S`; `DAT_DECL` traz a data. A publicação deve incluir `DAT_DECL`/`IDN_DECL_RETI` na identidade do hash (nova declaração = nova revisão).

## 3. O que cada função traz (campos reais)
| Função | Granularidade | Campos principais |
|---|---|---|
| `Dados_Gerais_Siope` | ente × exercício | `NUM_POPU`, receitas e **despesa total do ente** (`VAL_DESP_EMPE/LIQU/PAGA`), FPM, ICMS…, PIB, `DAT_DECL`, flags de metodologia |
| `Despesas_Funcao_Educacao_Siope` | ente × subfunção | `DES_SUBF` (122, 306, 361, 365, 366, 367…), `VAL_DESP_EMPE/LIQU/PAGA` (**linhas de subtotal incluídas**) |
| `Indicadores_Siope` | ente × indicador | `COD_INDI`, `NOM_INDI`, `VAL_INDI` (ex.: 24 = % aplicado em MDE; 28–30 = % Fundeb por etapa) |
| `Receita_Siope` | ente × item de receita | árvore de receitas (`NUM_NIVE`), `VAL_DECL` |
| `Despesas_Siope` | ente × item/fonte (árvore) | 21 campos, muito volumoso |
| `Informacoes_Complementares_Siope` | ente × item | itens declarados |
| `Remuneracao_Siope` | **profissional individual** | `NO_PROFISSIONAL`, `CO_ESCOLA`, salário → **PROIBIDO** (G14) |
| `Dados_Gerais_Siope_Dados_Responsaveis` | responsável pela declaração | nome, e-mail, telefone, CNPJ → **PROIBIDO** (dados pessoais de agente) |

## 4. Armadilhas comprovadas
1. **`Dados_Gerais.VAL_DESP_*` é a despesa total do ente, não de Educação.** Vitória 2024: pago R$ 3,05 bi (total municipal). Educação está em `Despesas_Funcao_Educacao_Siope`.
2. **Subtotais dentro da função de educação**: para a subfunção 365 há 3 linhas (11, 12, 13) e `13 = 11 + 12`. Somar todas as linhas **dobra** a educação infantil (Vitória: soma ingênua = EMP R$ 1.136,6 mi; soma sem subtotal = **R$ 873,1 mi**, que é o valor oficial). O conector deve descartar os subtotais pela hierarquia (`NUM_ORDE`/`NUM_NIVE`) e testar `linha_subtotal = Σ filhas`.
3. Os rótulos de grupo de indicador não são confiáveis (o indicador 24 aparece sob "Indicadores de Dispêndio com Pessoal").
4. `Despesas_Siope` não foi necessária para o objetivo do produto (total por função/subfunção): evitar na P10.5 (custo: ~70 MB por UF pequena; estimativa nacional ≈ 5 GB/ano JSON).

## 5. Reconciliação com o Siconfi (função 12): são universos diferentes
Vitória/ES, exercício 2024 (R$ mi):
| | Siconfi DCA I-E (função 12) | SIOPE (despesa por função educação, sem subtotal) | Diferença |
|---|---:|---:|---:|
| Empenhada | 805,77 | 873,11 | +67,34 (+8,4%) |
| Paga | 740,59 | 808,10 | +67,51 (+9,1%) |
| Subfunção 361 (fundamental) EMP | 417,36 | 468,02 | classificação distinta |
| Subfunção 365 (infantil) EMP | 330,34 | 263,54 | classificação distinta |
| Subfunção 366 (EJA) EMP | 1,16 | 19,08 | classificação distinta |
| Subfunção 367 (especial) EMP | 5,71 | 58,43 | classificação distinta |
| Subfunção 306 (alimentação) EMP | — | 6,43 | só no SIOPE |
**Regra:** SIOPE e Siconfi **nunca** se somam nem se substituem. Comparação só no total (com a diferença rotulada), jamais por subfunção. O SIOPE é "gasto declarado em educação (MDE/Fundeb) pelo gestor"; o Siconfi é contábil por função orçamentária. O percentual de aplicação em MDE (25%) vem do próprio SIOPE (indicador 24) e não pode ser recalculado a partir do Siconfi.

## 6. Contrato do coletor (P10.5)
- Funções a coletar: `Dados_Gerais`, `Despesas_Funcao_Educacao`, `Indicadores`, `Informacoes_Complementares` (e opcionalmente `Receita`); **não** coletar `Remuneracao` nem `Dados_Responsaveis`.
- Chamadas: 27 UFs × exercício (2017→); RAW verbatim (JSONL gz) em `D:\Civica\raw\siope\`; checkpoint por (função, ano, UF, período); `HttpGate` com espaçamento ≥ 0,5 s; repetição em 5xx.
- Volume por exercício (extrapolado das provas): Dados Gerais 7,2 MB; Função Educação ≈ 11 MB; Indicadores ≈ 75 MB; Informações Complementares ≈ 62 MB; (Receita ≈ 0,8 GB). Sem Receita: ≈ 155 MB/exercício → ≈ 1,6 GB JSON para 2017–2026 (≈ 160 MB em gzip).
- Atualização: exercício corrente por bimestre (período 1–6) e re-coleta do anterior até a data final de retificação.
- Reconciliação: Σ subfunções sem subtotal = total por ente; subtotal = Σ filhas; comparação com Siconfi só em total com a diferença exposta; contagem de entes = universo SIOPE (≈ 5.5–5.6 mil).

## 7. Limitações
- Série 2017+: sem 2014–2016.
- Não foi testada a estabilidade para varredura completa (27 UFs × 10 anos × 4 funções ≈ 1.080 chamadas) nem limite de taxa.
- Hierarquia exata de `NUM_ORDE` para identificar subtotais em todos os entes precisa de validação na P10.5 (só Vitória foi decomposta).
