# Contratos prisionais (P9.4) — dicionário

Fonte: SISDEPEN/SENAPPEN, 19 ciclos semestrais (2016/2 a 2025/2), um CSV oficial por ciclo. **Todas** as regras abaixo foram verificadas nos 19 arquivos (ver `reconciliacao_prisional.md`).

## 1. Unidade de observação e ciclo

- Uma linha do arquivo = um **estabelecimento** respondendo a um formulário semestral. O arquivo só traz linhas **validadas** (`Situação de Preenchimento = Validado`) e `Ativo` em todos os ciclos; o universo esperado **não** consta da fonte.
- **Ciclo = semestre** (estoque na data de referência, 30/06 ou 31/12), nunca mês. Ciclo → competência do Cívica: fim do semestre (`AAAA06` / `AAAA12`); janela dos indicadores = o semestre.
- `Tipo do Estabelecimento` (no 16º e 18º ciclos a coluna se chama "Tipo de Recolhimento"): **Cela física** | Domiciliar **sem** monitoramento eletrônico | Domiciliar **com** monitoramento eletrônico. A categoria domiciliar sem monitoramento só existe a partir do 9º ciclo (2020/2).
- `Âmbito`: Estadual | Federal. Os 5 estabelecimentos federais (4 nos primeiros ciclos) ficam em RO, RN, PR, MS e DF e são publicados **à parte** do sistema estadual da UF onde estão.

## 2. Capacidade (item 1.3) — 27 medidas, margens do mesmo universo

| Medida | Significado | Regra |
|---|---|---|
| `cap.<regime>.M/F/T` (provisórios, fechado, semiaberto, aberto, RDD, medida de segurança, outros) | vagas do regime por sexo e total | Total do regime = M + F (conferido em todas as linhas preenchidas dos 19 ciclos: 0 violações) |
| `cap.total.M`, `cap.total.F` | capacidade total masculina / feminina (todos os regimes) | = Σ regimes (conferido: 0 violações). **Capacidade da unidade = M + F**, nunca "M + F + total" |
| `cap.dis.*` | celas interditadas e vagas desativadas | informação à parte; **não** é subtraída nem somada (a fonte não diz se já está fora do total) |

- **Não se soma** capacidade total com capacidade por regime nem por sexo. Os indicadores por regime (6030–6036) e por sexo (6020–6021) são margens publicadas separadamente.
- **Célula vazia ≠ zero.** Zero declarado é linha com valor 0 em `exec_pri_fact`; célula vazia não tem linha. Em unidade de **um só sexo** a coluna do outro sexo vazia é *não aplicável* (ex.: 41 unidades masculinas com feminino vazio no 19º ciclo). Unidade **mista** com um sexo vazio é *capacidade incompleta*.
- Capacidade publicada (`IND-PRI-*-CAP`) = **soma do que foi declarado** (M + F, componente vazio não conta), que é a soma usada nos relatórios da SENAPPEN (reconciliado). A unidade incompleta leva `partialCoverage` e fica **fora** da taxa de ocupação.

## 3. População (item 4.1) — 44 medidas

- Margens por **grupo** (provisórios sem condenação; sentenciados regime fechado, semiaberto, aberto; medida de segurança internação; medida de segurança tratamento ambulatorial) × **jurisdição do processo** (estadual, federal, outros) × **sexo**, mais o total do grupo.
- Total do grupo = Σ das seis margens e **Total geral = Σ dos seis totais** (conferido: 0 violações). `Justiça Federal` é a justiça que **processa** a pessoa, não o âmbito do estabelecimento.
- **Medida principal**: população em **celas físicas** = `4.1 Total` dos estabelecimentos com Tipo = Cela física. Pessoas em prisão domiciliar (com e sem monitoramento) = `4.1 Total` dos estabelecimentos domiciliares, em **indicadores próprios** (6040–6043); nunca entram na ocupação nem em "presos nas unidades".
- Margens por sexo (6022–6023) e por regime (6024–6029) descrevem o **mesmo** universo da população total: não se somam entre si nem com o total.
- `pop.rdd` (pessoas em RDD) é subconjunto já contido na população; fica nos fatos por unidade e não é somado.
- Pessoas em carceragens de delegacias e outras prisões (citadas nos relatórios) **não** estão neste arquivo e **não** foram publicadas.

## 4. Ocupação e excedente

- `ocupação (%) = Σ população das celas físicas elegíveis ÷ Σ capacidade das celas físicas elegíveis × 100`. **Elegível** = cela física com capacidade **completa e > 0** no ciclo. Agregação por soma (município, UF, Brasil), **nunca** média das taxas das unidades. Pode passar de 100 %.
- `excedente líquido = Σ população − Σ capacidade` (elegíveis; negativo = vagas ociosas) e `excedente bruto = Σ max(0, população − capacidade)` por unidade: **indicadores diferentes**, ambos publicados com a fórmula.
- Capacidade zero ou ausente: nunca se divide; a unidade conta em "estabelecimentos com população e sem capacidade utilizável" (6007/6107). Território sem unidade elegível: taxa nula com `noDenominator`.
- Mesmo ciclo, mesmo território, mesmo âmbito: nenhum indicador cruza ciclos nem mistura estadual com federal.
- O **déficit de vagas** dos relatórios oficiais (população − vagas, todas as unidades) reconcilia com `popE − capE` (ver reconciliação), mas é distinto do excedente líquido (que usa só as elegíveis).

## 5. Estados de ausência

| Situação na fonte | Estado no Cívica |
|---|---|
| célula numérica com valor 0 | linha em `exec_pri_fact` com 0 (zero declarado) |
| célula vazia | sem linha de fato (`item_not_reported` ou *não aplicável* conforme o sexo de destinação; nunca zero) |
| estabelecimento ausente de um ciclo | sem observação; **não** é encerramento (`absent_vs_prev` em `exec_pri_cov`) |
| linha não validada / não ativa / tipo ou âmbito desconhecido | excluída e contada (`quality.excluded`); nunca presumida |
| município sem código IBGE no arquivo | `entity_id` nulo; entra na UF e no "resto não conciliado" |
| território sem estabelecimento no ciclo | sem linha: não distingue "sem unidade" de "sem resposta" |
| capacidade incompleta | `partialCoverage` + contagem `cap_incomplete` |
| identidade com revisão pendente | `review = 1` em `exec_pri_xwalk` |

## 6. Identidade e crosswalk

O SISDEPEN **não** publica identificador estável. `unit_id` é chave **interna** do Cívica (`key_kind = 1`); cada ciclo preserva nome e linha originais. Regras determinísticas, sem fuzzy: (1) UF + município IBGE + nome normalizado + grupo de tipo (cela × domiciliar), confiança 100; (2) mesmo CEP e município com nome diferente = renomeação provável, 70, **revisão**; (3) mesmo CEP e nome com município diferente = mudança de município provável, 60, **revisão**; (0) unidade nova; (9) candidatos ambíguos → permanece **separada** (0, revisão). CEP é usado só na comparação, **não** é gravado.

## 7. Perfil agregado (G7) — matriz de campos

Só capacidade e população por regime/sexo foram persistidas. Os demais blocos do formulário existem nos arquivos, mas **não** foram persistidos nesta onda:

| Campo (bloco) | Definição | Universo | Granularidade | Ciclos | Cobertura | Fórmula/uso | Risco | Decisão |
|---|---|---|---|---|---|---|---|---|
| 5.1 faixa etária | pessoas por faixa de idade | pop. do estabelecimento | unidade | 1–19 | não medida | margem independente | pequenas contagens identificam | não persistido; só agregado ≥ UF em onda futura |
| 5.2 cor/raça | idem por cor/raça/etnia | idem | unidade | 1–19 | idem | margem independente | idem; estigma territorial | idem |
| 5.4 estado civil, 5.5 deficiência, 5.10 filhos | margens | idem | unidade | 1–19 | idem | margem independente | pequenas contagens | idem |
| 5.6 grau de instrução | margem | idem | unidade | 1–19 | idem | margem independente | — | idem |
| 5.8 nacionalidade | 636 colunas (233 até o 13º) | idem | unidade | layout muda no 14º | — | — | layout instável | idem |
| 5.12–5.13 tempo de pena | margens | condenados | unidade | 1–19 | — | — | — | idem |
| 5.14 incidências por tipo penal | contagem de incidências (não de pessoas) | — | unidade | 1–19 | — | não somar a pessoas | dupla contagem | idem |
| 6.x trabalho, educação, saúde, mortalidade | produção do período | — | unidade | 1–19 | — | — | saúde individual agregada | idem |
| 3.1 servidores | quadro de pessoal por categoria | — | unidade | 1–19 | — | — | dados de agentes públicos | idem |

**Proibido e não feito:** cruzar margens independentes (raça × idade × escolaridade), inferir filiação a facções, perfis de pessoas, mapas operacionais, plantas, escalas ou rotinas de segurança. Endereço, bairro, CEP e telefone **não** foram persistidos.
