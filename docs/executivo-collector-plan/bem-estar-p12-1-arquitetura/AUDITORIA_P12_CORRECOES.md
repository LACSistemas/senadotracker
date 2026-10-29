# Auditoria e correções documentais da P12

## Contagens canônicas

| Objeto | Observado | Interpretação correta |
|---|---:|---|
| Linhas do catálogo | 40 | candidatos de indicador, não fatos publicados |
| Município=`sim` | 32 | possibilidade/cobertura declarada no catálogo |
| Município=`parcial` | 5 | cobertura municipal condicionada, não universal |
| Município=`não universal` | 2 | recorte municipal não universal |
| Fontes CSV | 18 | entradas de organizações, sistemas e recursos misturados |
| Famílias territoriais | 15 | famílias editoriais, não número de collectors |
| MVP P12 | 10 grupos | grupos a decompor; não dez linhas de banco |

O relatório P12 contém uma menção a “39 indicadores”. A contagem reproduzível do CSV é 40; a arquitetura usa 40 candidatos e não altera o arquivo histórico. A coluna `Município` contém caracteres corrompidos no encoding legado, por isso a validação deve usar UTF-8 normalizado e o valor literal auditado no CSV, não uma busca cega por texto mojibake.

## Taxonomia de fontes

P12 misturava no mesmo contador: IBGE (organização), Censo/SIDRA (sistemas), tabela (dataset/recurso), edição e família de coleta. A contagem canônica desta fase é:

- **15 famílias territoriais** na matriz;
- **18 entradas de catálogo** no CSV de fontes;
- **9 famílias reutilizáveis** já representadas por código ou fatos no repositório (IBGE/território, Siconfi, PNCP, CNES/SIH, educação/infraestrutura e publicação genérica);
- **6 famílias de novos collectors** estimadas em P12, ainda não equivalentes a seis tabelas ou seis fontes únicas.

Cada novo recurso deve registrar `organization`, `system`, `dataset`, `resource`, `edition`, `collector_family` e `reused_component` separadamente.

## Identidade territorial

Consulta real em `projetoeleitor_db` confirmou:

- kind 1: Brasil (ibge7 76);
- kind 2: cinco regiões, parent_id Brasil;
- kind 3: 27 UFs;
- kind 4: 5.571 municípios/recortes, incluindo `3200359` Alto Rio Novo, `5101837` Boa Esperança do Norte e `5300108` Brasília;
- kind 5: 27 agregados de UF.

O relatório P12 dizia 1+27+5.571+27=5.626 e omitia cinco registros. Eles são exatamente os cinco kind 2. Não se deve chamar kind 5 de município: no DDL ele é “município ignorado da UF”, uma entidade de agregação para residentes sem município estadual válido.

O código `3200506` usado na investigação não corresponde a Alto Rio Novo. A correção é documental; nenhum registro foi criado ou atualizado.

## O que é corrigido na arquitetura

1. “Comprovado” passa a significar camada específica: documentação, acesso ao recurso, layout, semântica, cobertura territorial, prontidão para collector e prontidão para publicação.
2. “32 municipais” passa a significar candidatos/matriz; publicação municipal exige contagem de linhas, chaves e ausências observadas.
3. A soma Brasil/UF/município agora inclui regiões e agregados especiais explicitamente.
4. Gini municipal é tratado como candidato Censo 2022 com tabela oficial e cobertura a provar por recurso, não como fato universal já ingerido.
5. Renda domiciliar per capita não usa “domicílios” como denominador genérico: o denominador depende da tabela, da população elegível e da unidade (moradores, domicílios ou distribuição ponderada).

## Impacto

Nenhuma correção altera dados P12. O impacto é contratual: P12.2 deve publicar somente recursos cuja camada de validação esteja concluída; métricas não prontas aparecem como ausência contextual, nunca como zero.

