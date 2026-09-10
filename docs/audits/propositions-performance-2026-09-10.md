# Auditoria de desempenho das proposições — 10/09/2026

O tempo de 6–20 segundos vinha do código de aplicação: a consulta anterior carregava todas as proposições dos lotes ativos, todos os autores dos lotes e todos os complementos, filtrava e ordenava em JavaScript e somente depois separava as 20 linhas da página.

A implementação corrigida executa contagem, filtros, ordenação e `LIMIT/OFFSET` no SQLite. Autores e temas são hidratados em lote apenas para as proposições da página corrente. A conexão de leitura continua compartilhada pelo processo e vinculada ao caminho do banco publicado.

Medição local em `data/senadotracker.sqlite`, com 44.809 proposições e dez execuções por cenário:

| Cenário | Total elegível | Mediana | p95 observado |
| --- | ---: | ---: | ---: |
| Todas as Casas, sem filtro | 44.809 | 275,5 ms | 405,5 ms |
| Senado, PEC | 71 | 8,3 ms | 20,7 ms |
| Câmara, sem filtro | 44.356 | 248,1 ms | 268,9 ms |

O comando `npm run benchmark:propositions` repete a medição e imprime também `EXPLAIN QUERY PLAN`. O orçamento local é mediana inferior a 500 ms e p95 inferior a 1 s. Tempos HTTP ainda incluem compilação do Next.js no primeiro acesso em desenvolvimento; a métrica acima isola o código de consulta e hidratação.
