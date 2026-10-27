# P10.10 — Frontend de Educação dos Estados e Municípios

## Resumo executivo

Implementamos a experiência de Educação dentro do mesmo shell territorial do Cívica, sem criar um segundo produto visual. As rotas reais são `/estados/[uf]/educacao` e `/municipios/[ibge]/educacao`; ambas usam o read layer do Cívica e dados do `projetoeleitor_db`.

O resultado é **PASS_WITH_CAVEATS**. A experiência está navegável, responsiva e coberta por smoke browser, typecheck, build e testes direcionados. Permanecem as limitações já documentadas em P10.9.1 (validação jurídica de alguns domínios, cobertura de fontes e ausência de uma medição formal de LCP/TTFB em produção).

## O que foi entregue

- panorama com matrículas, escolas, aprendizagem e conectividade;
- capítulos editoriais para tamanho da rede, infraestrutura, aprendizagem, trajetória, professores, recursos e exploração;
- filtros de rede e etapa sem chamadas ao navegador para fonte externa;
- comparação município/UF/Brasil quando o contrato oferece o recorte;
- medianas dos municípios da UF e do Brasil para escolas, matrículas, internet, Ideb e docentes distintos, com `n` do universo;
- no município, Capítulo 3 com evolução temporal do Ideb em três linhas: território, UF e Brasil, com seleção de etapa/rede e tooltip dos três valores por edição;
- nos Capítulos 1 e 5, a mesma leitura comparada foi aplicada às séries de matrículas e docentes distintos, com tooltip por edição e preservação de lacunas;
- tooltip de valor exato nos gráficos por mouse e teclado, preservando lacunas;
- estados de ausência, cobertura parcial e lacuna temporal sem converter `NULL` em zero;
- lista de escolas limitada na primeira pintura;
- páginas reais para Espírito Santo, São Paulo, Vitória, Serra, São Paulo capital, município pequeno e UF com cobertura parcial;
- screenshots desktop e mobile em `screenshots/`.

## Validação executada

| Verificação | Resultado |
|---|---|
| `npm.cmd run typecheck --workspace=@senadotracker/web` | PASS |
| `npm.cmd run build --workspace=@senadotracker/web` | PASS |
| testes direcionados P10.10 + P10.9.1 | 6/6 PASS |
| smoke HTTP das duas rotas | 200 |
| smoke browser desktop 1440 px | PASS |
| smoke browser mobile 390 px | PASS |
| overflow horizontal nas páginas de educação | 0 px |
| regressão `/estados/ES/seguranca` a 390 px | 200 / 0 px |
| chamadas externas no client | 0 |
| benchmark municipal com medianas e amostra | PASS |
| tooltip de série por hover/foco | PASS |

## Caveats

O smoke browser foi executado contra o servidor local de desenvolvimento, não substitui uma suíte E2E de CI nem um ensaio de produção. A página preserva a separação semântica entre matrícula, escola, Ideb, fluxo, Siconfi/SIOPE, programas e contratos; contrato observado não é tratado como entrega realizada. Dados condicionais a validação jurídica continuam fora da publicação.

Não foram alterados collectors, contratos de fonte, migrations novas, banco de produção, rotas federais ou rotinas de scheduler. Nenhum commit ou push foi feito. P10.11 não foi iniciado.

## Gates

| Gate | Estado |
|---|---|
| G0 repository discovery | PASS |
| G1 data contracts | PASS |
| G2 states education | PASS |
| G3 municipalities education | PASS |
| G4 editorial storytelling | PASS |
| G5 interactivity | PASS_WITH_CAVEATS |
| G6 comparability | PASS_WITH_CAVEATS |
| G7 data coverage | PASS_WITH_CAVEATS |
| G8 privacy | PASS_WITH_CAVEATS |
| G9 performance | PASS_WITH_CAVEATS |
| G10 accessibility | PASS_WITH_CAVEATS |
| G11 responsive visual QA | PASS |
| G12 tests/regression | PASS_WITH_CAVEATS |
| G13 final product review | PASS_WITH_CAVEATS |

O status global permanece `PASS_WITH_CAVEATS` porque os caveats são reais e não foram ocultados.

