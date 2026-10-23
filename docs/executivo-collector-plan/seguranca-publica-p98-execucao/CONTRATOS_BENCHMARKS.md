# Contratos de benchmark (P9.8)

Implementação: `packages/db/src/exec/security-bench.ts` (SQL) + `apps/web/lib/security/bench.ts` (regras e frases). Testes: `tests/integration/security-bench-p98.test.ts`, `tests/unit/security-p98.test.ts`, E2E.

## Regra de ouro
Só há comparação quando **mesma fonte, mesmo indicador, mesma unidade, mesmo ano, denominador oficial do MESMO ano, cobertura suficiente e supressão tratada**. Caso contrário a interface mostra "Sem comparação válida" com o motivo — nunca um número alternativo.

## Ordem de preferência implementada
1. **Evolução do próprio território** — sempre (séries, variação entre períodos equivalentes).
2. **Município × municípios da mesma UF de porte semelhante** — grupo por faixa de população (20–100 mil, 100–500 mil, 500 mil ou mais), mínimo 5 municípios.
3. **Município × municípios da mesma UF com 20 mil habitantes ou mais** — quando a faixa não tem 5 municípios (ex.: Salvador e Belo Horizonte).
4. **UF × mediana das 27 UFs** — só para indicadores nacionais padronizados já publicados como taxa (SIM, VDE, finanças).
5. UF × Brasil: **não implementado** (não há taxa publicada para a entidade Brasil e Σ de UFs de taxa não é taxa do Brasil).
6. Municípios "semelhantes" por outro critério: **rejeitado** (nenhum critério defensável além do porte).

## Taxas
- Indicadores já publicados como taxa (SIM 3006/4021, VDE 3201–3208, finanças 7032): quartis entre municípios com taxa válida (`flags` sem pequeno número, supressão ou sem denominador) — leitura direta, sem recalcular.
- Fonte estadual municipalizada (P9.6): taxa anual = soma do ano ÷ população **do mesmo ano** × 100 mil, calculada na consulta. Exige: 12 meses publicados na UF; população oficial do ano; ≥ 5 municípios no grupo e ≥ 80% do universo do grupo com registro (fonte de eventos: município sem linha é ausência); nenhuma célula suprimida. Estados possíveis: `ok`, `sem_populacao_do_ano`, `ano_incompleto`, `cobertura_insuficiente`, `celulas_suprimidas`, `grupo_pequeno`.
- **2022 e 2023 não têm estimativa oficial**: não há taxa nem benchmark nesses anos; nada é interpolado (faixa cinza no gráfico).
- Município com **menos de 20 mil habitantes**: sem comparação de taxa (instável); mostra quantidade e evolução.
- Entre UFs, fontes estaduais **não** são comparadas (sem equivalência oficial): "sem mediana de UFs" para P9.6.

## Frase padrão (validada)
"Entre N municípios {do Estado} {de 100 a 500 mil habitantes}, a mediana de {indicador} em {ano} foi X por 100 mil; {Município} registrou Y, {abaixo|dentro|acima} da faixa central." — "faixa central" = 1º a 3º quartil. Sem ranking, sem posição ordinal.

## Benchmarks rejeitados (e por quê)
| Benchmark | Motivo |
|---|---|
| Ranking nacional de roubos juntando ISP-RJ, SSP-SP, SESP-ES etc. | sem equivalência oficial entre fontes (P9.6) |
| Mediana de contagens absolutas entre municípios | contagem mede tamanho da população, não risco |
| Taxa em 2022–2023 | sem população oficial; interpolação não aprovada |
| Taxa de município < 20 mil hab. | instabilidade (poucos casos) |
| Município × Brasil em roubos/furtos | fonte nacional sem município; universos diferentes |
| Ocupação prisional municipal como "segurança do morador" | descreve a unidade custodiada, não os moradores |
| Gasto absoluto ranqueado | não mede esforço proporcional nem eficiência |
| Estadual × PF/PRF (VDE) somados | podem registrar o mesmo fato |

## Evidência de reconciliação usada na validação
SDS-PE (P9.6) e Sinesp/VDE (P9.1) coincidem exatamente para Recife (homicídios 582 em 2024 e 537 em 2025 nas duas fontes), o que sustenta usar ambas sem tratá-las como números rivais.
