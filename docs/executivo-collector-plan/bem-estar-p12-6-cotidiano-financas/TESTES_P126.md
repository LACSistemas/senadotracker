# Testes P12.6

| Teste | Resultado |
|---|---|
| database guard (`current_database()`) | PASS — `projetoeleitor_db` |
| RAIS células/totais/fatos | PASS_DOCUMENTARY_CORRECTION |
| MUNIC layout e dicionário | PASS |
| código IBGE exato, sem fuzzy | PASS — 5570/5570 |
| publicação transacional | PASS — 27 fatias |
| unicidade por indicador/município/período | PASS |
| nulo não vira zero | PASS — flag 256 |
| replay do mesmo hash | PASS — 27 `NO_CHANGE` |
| crescimento replay | PASS — 0 bytes |
| regressão P12.2 | PASS — contagens preservadas |
| regressão P12.4-R | PASS — contagens preservadas |
| regressão P12.5 | PASS — contagens preservadas |
| P12.3 unchanged | PASS — sem tabelas/fatos alterados |
| explain MUNIC municipal/UF | PASS — 0,800 ms observado |
| explain Siconfi função 08 | PASS — 1,153 ms observado |
| privacidade | PASS — sem identificação pessoal |
| Anatel structured export | PARTIAL — não comprovado |
| frontend | PASS — não alterado |

## Regressões observadas

- P12.2: 9001=5598, 9002=5598, 9003=28, 9004=5598, 9005=5598, 9006=5598.
- P12.4-R: 9101–9104=5334, 9105=5570, 9106=5333, 9201–9203=2609, 9301=4976.
- P12.5: 9401=16797, 9402=27, 9500–9503=44792 cada.
