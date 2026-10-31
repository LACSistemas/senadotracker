# P13.2 — Energia elétrica nacional (ANEEL)

## Resultado executivo

`P13_2_STATUS = PASS_WITH_DOCUMENTED_SOURCE_LIMITATION`.

O INDGER foi validado e publicado no banco oficial `projetoeleitor_db` para o ano fechado de 2025 e para a competência estável mais recente disponível (`2026-08`). São 7 indicadores mensais, 458.290 linhas canônicas, 5.086 municípios, 27 UFs e 13 competências. A competência `2026-09` foi observada no arquivo, mas tem somente 7 linhas e não foi publicada por ser uma carga parcial.

DEC/FEC foi validado como fonte real e atualizada, mas permanece no grão nativo conjunto de unidades consumidoras/distribuidora. O arquivo `indqual-municipio.csv` é apenas uma relação conjunto↔município: não traz pesos, consumidores, exposição ou método de alocação. Portanto nenhum DEC/FEC foi convertido artificialmente em indicador municipal.

## Publicação

- dataset `140`, competências `202501`–`202512` e `202608`;
- indicadores `10501`–`10507`, domínio 6, grão mensal, sem ranking e sem agregação municipal automática;
- 0 entidades IBGE não resolvidas em 2025; 1 código não conciliado em 2026-08 (`1403205`), mantido no RAW/staging e não publicado;
- 7.489 valores nulos source-native (flags `notInformed`), sem conversão para zero;
- cada linha publicada leva flag `partialCoverage`, pois municípios atendidos por mais de uma distribuidora foram excluídos quando não havia prova oficial de disjunção.

## Segurança e operação

O crescimento observado foi de `164.372.480` bytes (`33.995.369.619` → `34.159.742.099`), abaixo do saldo de envelope de `214.864.512` bytes. RAW e staging permaneceram exclusivamente em `D:\Civica`.

Replay exato foi executado: as 13 competências retornaram `NO_CHANGE`. Não houve alteração em fatos SINISA de P13.1.

P13.3 não foi iniciado.
