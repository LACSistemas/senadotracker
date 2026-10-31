# P13.6 â€” relatÃ³rio de execuÃ§Ã£o

**P13_6_STATUS=PASS_WITH_CAVEATS**  
**DATABASE=projetoeleitor_db**  
**P1355_AUDIT=PASS_WITH_CAVEATS**

A fase consolidou serving tipado sobre as publicaÃ§Ãµes reais da P13. NÃ£o houve nova coleta, backfill nem alteraÃ§Ã£o do frontend. O serving estÃ¡ em `packages/db/src/exec/infrastructure-read.ts`, exportado por `packages/db/src/exec/index.ts`. As migrations v36â€“v39 criam catÃ¡logo editorial, snapshot compacto de cobertura e rollup territorial.

## Resultado auditado

- 108 definiÃ§Ãµes efetivas no recorte de infraestrutura (91 no domÃ­nio 5 e 17 nos domÃ­nios 6/13); 108 com observaÃ§Ãµes no snapshot de cobertura.
- Obrasgov: 155.037 projetos canÃ´nicos; 154.449 com municÃ­pio vÃ¡lido; 5.569 municÃ­pios servidos.
- Fatos fÃ­sicos: 74.050 linhas; 74.050 projetos com algum fato; 71.008 projetos com percentual nÃ£o nulo; 35.392 com percentual 100. Percentual 100 nÃ£o Ã© rotulado como entrega.
- Pagamento source-native Obrasgov: 4.582 projetos. Links PNCP externos comprovados: 0. Ativos fÃ­sicos externos comprovados: 0.
- Os oito cÃ³digos ausentes do benchmark 5.561 sÃ£o associaÃ§Ãµes secundÃ¡rias omitidas pela antiga escolha de um Ãºnico `min(ibge7)` por projeto; o rollup atual Ã© projetoÃ—municÃ­pio e serve os 5.569 cÃ³digos.
- Siconfi permanece contextual e nÃ£o territorial: funÃ§Ã£o 25 tem 2 linhas/1 entidade (2023) e funÃ§Ã£o 26 tem 192 linhas/1 entidade (2014â€“2026). Nenhum vÃ­nculo obra?ente pagador foi inferido.

## Gates

| Gate | Estado | EvidÃªncia |
|---|---|---|
| G0 auditoria P13.5.5 | PASS_WITH_CAVEATS | `AUDITORIA_P1355_READONLY.md` |
| G1 banco correto | PASS | `current_database()=projetoeleitor_db` |
| G2â€“G6 indicadores, ownership, cobertura e revisÃ£o | PASS_WITH_CAVEATS | snapshot 108 linhas e catÃ¡logo editorial |
| G7â€“G9 estoque, desempenho e investimento | PASS_WITH_CAVEATS | serviÃ§os e rollups reais |
| G10â€“G11 comparadores e ausÃªncia | PASS_WITH_CAVEATS | estados tipados, sem zero sintÃ©tico |
| G12â€“G14 fatos, oito municÃ­pios e Siconfi | PASS | auditorias dedicadas |
| G15â€“G18 contratos, duplicaÃ§Ã£o e catÃ¡logo | PASS | serviÃ§os tipados e catÃ¡logo |
| G19â€“G24 proveniÃªncia, performance, privacidade e orÃ§amento | PASS_WITH_CAVEATS | artefatos 17â€“20 |
| G25â€“G28 regressÃµes, PNCP e readiness | PASS_WITH_CAVEATS | `TESTES_P136.md` |

P95 do overview municipal ficou entre 5,15 e 169,34 ms nos cenÃ¡rios medidos; detalhe de obra entre 5,25 e 13,29 ms. A listagem nacional ficou em 108,94 ms apÃ³s trocar a view pesada por consulta set-based sobre localizaÃ§Ã£o/projeto.

`P13_7_READY=YES`; `P13_7_STARTED=NO`. As Ãºnicas ressalvas sÃ£o limitaÃ§Ãµes de fonte (PNCP externo, Siconfi municipal e famÃ­lias parciais).

