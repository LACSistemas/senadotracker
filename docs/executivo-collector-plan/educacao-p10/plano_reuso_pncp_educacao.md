# Plano de reuso do PNCP para a Educação · G10

Estado: **REUSE_WITH_ADAPTATION** · Fase consumidora: P10.7 · Provas: `pncp_educacao_raw_scan.json` (regras v1), `pncp_educacao_refinado.json` + `pncp_educacao_amostras_refinado.json` (regras v2), `reproducibilidade/pncp_educacao_raw_scan{,_v2}.py`. Varredura **somente leitura** do RAW já preservado; nenhum download do PNCP, nenhuma escrita no banco.

## 1. Resposta direta
**Não é preciso baixar o PNCP de novo.** O RAW em `D:\Civica\raw\pncp\contratos\2021…2026\MM.jsonl.gz` (70 arquivos, 948 MB) contém **todos** os contratos da API de consulta, não só os de Segurança: **5.111.306 contratos em 5.111.306 linhas** (nenhuma repetição de `numeroControlePNCP`), com 8 páginas não-200 (pacotes completos). O banco guarda 165.150 contratos (os classificados como Segurança); Educação sai do RAW.

## 2. O RAW (integridade)
| Item | Medido |
|---|---|
| Formato | uma página da API por linha `{p, s, b}` (JSONL gz), `s` = status HTTP, `b` = corpo JSON (`data[]`, `totalRegistros`, `totalPaginas`) |
| Contratos por ano (linhas brutas) | 2021: 5.308 · 2022: 40.643 · 2023: 242.956 · 2024: 1.087.184 · 2025: 2.023.034 · 2026 (jan–out): 1.712.181 |
| Duplicados | 0 (a chave é única no conjunto; versões novas já vêm como o registro mais recente da janela) |
| Páginas com erro | 8 (de ~dezenas de milhares) |
| Campos úteis | `orgaoEntidade{cnpj, razaoSocial, esferaId}`, `unidadeOrgao{nomeUnidade, codigoIbge, ufSigla}`, `objetoContrato`, `niFornecedor`, `nomeRazaoSocialFornecedor`, `valorInicial/valorGlobal/valorAcumulado`, `dataAssinatura`, `dataVigencia*`, `categoriaProcesso`, `tipoContrato`, `numeroContratoEmpenho`, `numeroRetificacao`, `anoContrato` |
| **Não há** | código INEP, código da escola, nem "valor pago" |
- Outliers: `valorGlobal` acima de R$ 10 bi existe (2021–2026: 118 contratos) e é excluído das somas (mesma regra da P9.5, `PNCP_VALUE_OUTLIER_CENTS`).
- Anos fora de 2021–2026 em `anoContrato` (133 contratos com ano digitado errado, ex. 2202) ficam em quarentena de qualidade, não somam.

## 3. Classificação (duas dimensões, nunca misturadas)
### Institucional (quem contrata): nome do órgão/unidade
`secretaria_educacao`, `fundo_educacao`, `departamento_educacao`, `fnde` (MEC/FNDE), `unidade_escolar` (escola, colégio, CMEI, creche; com exclusões), `universidade_if` (universidade, instituto federal, CEFET) — este último tratado como **ensino superior/rede federal**, separado do núcleo.
### Temático (o que compra): objeto
`alimentacao_escolar`, `transporte_escolar`, `material_didatico`, `mobiliario_equip_escolar`, `tecnologia_educacional`, `obra_escolar`, `manutencao_escolar`; `servico_educacional` (**descartado como tema**, ver §5).
### Relação com escola e com a contabilidade
- **Vínculo com escola confirmado: 0.** O PNCP não traz código INEP; o nome da escola no objeto não basta (regra: nunca inferir INEP por semelhança de texto). Contratos de escola individual só se ligam com **chave oficial** (código INEP em fonte que o traga: PDDE, obras).
- **Vínculo contábil confirmado:** só quando houver `numeroContratoEmpenho` casando com empenho da mesma UG no Portal/TCE (não testado nesta fase).

## 4. Resultado da varredura refinada (2021–2026, RAW completo)
| Conjunto | Contratos | % de 5,11 mi | Valor global (R$ bi, sem outliers) |
|---|---:|---:|---:|
| **Núcleo Educação** (institucional-núcleo ∪ temático-núcleo) | **286.736** | 5,6% | **179,9** |
| · institucional-núcleo (secretaria, fundo, departamento, MEC/FNDE, unidade escolar filtrada) | 184.241 | 3,6% | 114,3 |
| · temático-núcleo (alimentação, transporte, material didático, mobiliário/equipamento, tecnologia, obra, manutenção) | 160.872 | 3,1% | 98,7 |
| · interseção (ambos) | ≈ 58.377 | | |
| Ensino superior (universidade/IF como órgão) | 326.461 | 6,4% | 80,5 |
| · dos quais com objeto hospitalar/medicamentos (por regex) | 31.892 | | |
| `servico_educacional` (descartado) | 22.720 só-amplo + 35.857 totais | | |
| Núcleo que também está no conjunto de Segurança do banco | **692** | 0,24% do núcleo | — |
Por ano (núcleo): 2022: 807 · 2023: 5.792 · 2024: 61.131 · 2025: 119.521 · 2026 (jan–out): 99.310.
Por regra (contratos distintos, 2021–2026): `secretaria_educacao` 101.835 · `fundo_educacao` 62.452 · `unidade_escolar` 10.868 · `departamento_educacao` 11.834 · `fnde` 1.461 · `alimentacao_escolar` 103.095 · `transporte_escolar` 26.719 · `mobiliario_equip_escolar` 10.760 · `obra_escolar` 9.999 · `manutencao_escolar` 7.359 · `material_didatico` 3.598 · `tecnologia_educacional` 232.

**Base amostral e precisão (auditoria manual, amostra estratificada com semente fixa, n = 4 a 12 por faixa):**
| Faixa | Amostra | Avaliação |
|---|---|---|
| núcleo institucional (v2) | 12 | 12/12 órgão de educação (objetos variados, de merenda a manutenção) |
| núcleo temático (alimentação, transporte, mobiliário) | 12 | 12/12 |
| `obra_escolar` | 12 | 12/12 (reforma/construção de escola/creche) |
| `material_didatico` | 12 | ~10/12 (falsos: fragmentadora de papel da Marinha; licença do TSE) |
| `manutencao_escolar` | 12 | ~11/12 |
| `unidade_escolar` **antes** das exclusões (v1) | 12 | **3/12** (hospital-escola, Escola de Governo, Marinha, Fazenda) → por isso a v2 exclui hospital/Escola de Governo/Saúde/Defensoria/Forças/Tribunais |
| `servico_educacional` (tema amplo) | 12+12 | **~3/12**: luminárias, combustível, botijões, ovos de Páscoa → **descartar** |
| ensino superior (`universidade_if`) | 12 | institucionalmente correto, mas inclui compras hospitalares (ventilador pulmonar, medicamentos) e administrativas: **não é gasto "em educação" sem filtro de objeto** |
Conclusão: o **núcleo** tem precisão alta nas amostras (≥ 90%), mas **amostra pequena** — a faixa de erro verdadeira não está medida. A P10.7 deve auditar n ≥ 400 por faixa antes de publicar totais.

## 5. Regras de produto
1. Não classificar qualquer compra de computador/obra como Educação (só com órgão de educação **ou** objeto com marcador escolar explícito).
2. `valorGlobal` é **valor contratado**: nunca "gasto", "pago", "investido".
3. Contrato nunca vira "escola X" sem código oficial.
4. Universidade/IF não entra no núcleo "Educação Básica"; entra no recorte Superior (P10.8) com filtro de objeto (excluir hospitalar).
5. `servico_educacional` e `tema_amplo` **não** são publicados.
6. Contratos de órgãos de educação que são puramente administrativos (limpeza, combustível) são "institucional sem tema": contam como contratos **do órgão**, não "da área-fim".

## 6. Arquitetura: classificação multitemática sem duplicar valor
Hoje `exec_fin_contract` tem um `theme smallint` único e `org_kind` de segurança (`ORG_KINDS`, `SEC_THEMES`). Proposta (a menor extensão):
- **Manter `exec_fin_contract` como a única cópia do contrato** (valor, órgão, fornecedor, data) e inserir nele também os contratos do núcleo/superior de Educação (≈ 613 mil linhas ≈ +145 MB a 235 B/linha com índices).
- Nova tabela `exec_fin_contract_class (pncp_id, domain smallint, class smallint, via smallint /*1 institucional,2 temático,3 ambos*/, rule smallint, PRIMARY KEY (pncp_id, domain, class))` com FK para `exec_fin_contract`.
- Domínios: 1 Segurança (migrada do `theme/org_kind` atuais por view), 2 Educação, 3 Saúde (futuro). **Somas por domínio contam cada contrato uma vez no domínio; somas entre domínios devem deduplicar por `pncp_id`** (692 contratos aparecem em Segurança e Educação). A UI mostra "também aparece em Segurança" em vez de somar.
- `org_kind`/`theme` existentes ficam como estão (sem renumerar); novos códigos de Educação em faixa própria (≥ 200).
- Índices: `(domain, class)`, `(entity_id, year)` (já existe), `supplier` (existe).

## 7. Operação
- **Reprocessamento:** ler o RAW, classificar, publicar por (ano, UF) com hash e log; comando análogo a `pncp-finish.ts` (idempotente). A varredura completa (5,1 mi contratos, regex, Python) rodou em minutos, em segundo plano (não cronometrada nesta fase); por mês é bem menor.
- **Competências novas:** o RAW termina em **2026-10** (mês corrente reescrito a cada rodada). Necessárias na P10.7: nov/2026 em diante (≈ 31 MB de RAW/mês em 2025). Coleta incremental **não iniciada** (fora do escopo); usar `fetchPncpMonth` e o limitador existente.
- **Espaço:** RAW novo ≈ 0,4 GB/ano; banco +145 MB (primeira carga) e ≈ +25 MB/ano.

## 8. Limitações
- Regras por expressão regular em português (sem lematização); falsos negativos não medidos.
- Precisão por amostra pequena; falsos positivos conhecidos em `universidade_if` e `manutencao_escolar`.
- Nenhum cruzamento com Portal/TCE nesta fase; `numeroContratoEmpenho` não testado.
- `servico_educacional` inflou a v1 (113 mil só-temáticos) e foi descartado na v2.
