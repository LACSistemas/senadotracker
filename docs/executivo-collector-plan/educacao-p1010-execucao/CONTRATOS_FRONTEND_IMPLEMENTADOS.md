# Contratos frontend implementados

## Entrada

As páginas recebem um `ScopeInfo` de UF ou município. O loader resolve o código IBGE7 municipal pela entidade interna do escopo e usa `projetoeleitor_db`; não há query direta do browser.

## Read layer

- `getEducationOverview(pool, key, year)` para a primeira pintura;
- `getEducationSection(pool, key, section, year)` para `finance`, `programs` e `contracts`;
- `getEducationSeries(pool, key, indicator, limit)` para séries;
- `getEducationComparison(pool, ibge7, year)` para município/UF/Brasil;
- `getEducationList(pool, key, year, limit)` para exploração paginável.

Para municípios, `getEducationComparison` também devolve medianas descritivas dos municípios da mesma UF e do Brasil para escolas, matrículas, internet, Ideb e docentes distintos, sempre com o ano, universo e tamanho de amostra. O frontend não transforma essas medianas em ranking. O Capítulo 3 cruza a série publicada do município com as séries oficiais da UF e do Brasil, sem interpolar lacunas, e exibe os três valores no hover/foco de cada edição.

Os Capítulos 1 e 5 usam o mesmo componente de comparação temporal para matrículas e docentes distintos. As séries estadual e nacional são carregadas pelo backend/read model; o cliente apenas alinha anos e apresenta os valores.
Para evitar que o total nacional achate visualmente o município, matrículas e docentes são desenhados como índice base 100 da primeira edição válida; o dado exibido no tooltip continua absoluto.

As séries SVG têm pontos focáveis e tooltip explícito com período, valor e unidade; valores ausentes não recebem ponto nem interpolação.

As leituras profundas de oferta, infraestrutura, aprendizagem, fluxo e docentes são opcionais e falham isoladamente. Valores ausentes são renderizados como indisponíveis ou como lacunas, nunca como zero inventado.

## Limites editoriais

O frontend não calcula ranking, comparabilidade, canonicalização partidária ou fallback financeiro. Também não acessa sites de Estados/municípios diretamente.

