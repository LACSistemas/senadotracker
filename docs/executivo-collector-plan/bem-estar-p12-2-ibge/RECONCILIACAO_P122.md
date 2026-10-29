# P12.2 — Reconciliação do recorte IBGE

## Resultado

O recorte de referência 2022 foi carregado integralmente para os cinco indicadores com geografia municipal e para o Gini em Brasil/UF. Foram ativadas 28 fatias (Brasil + 27 UFs), competência `202212`, publicação definitiva (`status = 2`).

| Indicador | Brasil | UFs | Municípios | Nulos | Regra |
|---|---:|---:|---:|---:|---|
| Renda média | 1 | 27 | 5.570 | 0 | valor SIDRA 13431 |
| Renda mediana | 1 | 27 | 5.570 | 0 | valor SIDRA 13534 |
| Gini | 1 | 27 | 0 | 0 | SIDRA 10301 só N1/N3 |
| Água adequada | 1 | 27 | 5.570 | 8 | 72144 / 72129 × 100 |
| Esgoto adequado | 1 | 27 | 5.570 | 25 | 46290 / 46292 × 100 |
| Lixo coletado | 1 | 27 | 5.570 | 0 | 2520 / 10972 × 100 |

As linhas nulas de água e esgoto correspondem a `-` publicado pelo IBGE na categoria numeradora. Elas permanecem `NULL` com flag de indisponibilidade; não foram convertidas em 0%.

## Paridade com os arquivos oficiais

As somas das categorias de moradia no nível Brasil, comparadas aos JSON N1, foram:

| Tabela | Denominador | Numerador | Percentual publicado no read layer |
|---|---:|---:|---:|
| 6803 | 72.456.368 | 60.775.085 | 83,8781830743 |
| 6805 | 72.456.368 | 46.875.340 | 64,6945759136 |
| 6892 | 72.456.368 | 66.449.487 | 91,7096575970 |

Os mesmos totais nacionais foram obtidos pela soma das 27 linhas N3, confirmando a reconciliação territorial. A fonte municipal contém 5.570 códigos distintos; todos foram resolvidos deterministicamente para `exec_entity.kind = 4`. A entidade adicional atual (Boa Esperança do Norte) não pertence ao recorte 2022.

Para renda, a paridade foi feita por chave (nível, território, variável, ano): 11.140 linhas de renda municipais (5.570 × média/mediana), 54 linhas estaduais e 2 linhas nacionais. Para Gini: 27 linhas estaduais e 1 nacional.

## Identidade e não duplicação

- Chave de valor: `(indicator_id, entity_id, period_start)`.
- Chave de publicação: `(dataset_id = 120, uf, competence = 202212)`.
- Não houve duplicidade de chave no conjunto de 28.018 valores.
- O número de linhas de uma fatia é contado sem multiplicar os totais por categoria: execução de moradia fica em uma linha derivada por indicador/território.
- A publicação usa a revisão transacional existente; nenhum schema novo ou migration foi criado.

## Limitação declarada

Não existe Gini municipal na tabela 10301 validada. A comparação municipal de desigualdade fica indisponível neste recorte, enquanto renda média/mediana e moradia têm cobertura municipal completa da fonte.
