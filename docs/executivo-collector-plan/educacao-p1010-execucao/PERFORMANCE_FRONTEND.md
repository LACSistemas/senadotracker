# Performance frontend

## Decisões

- primeira pintura começa pelo serving compacto P10.9.1;
- leituras complementares são paralelas e isoladas;
- lista de escolas é limitada a 12 registros;
- gráficos são SVG local, sem biblioteca pesada ou chamada adicional;
- client component não faz `fetch`, não abre conexão PostgreSQL e não acessa fontes externas.
- medianas municipais são calculadas em consultas agregadas paralelas, não por município individual;

## Evidência de read layer

Benchmarks P10.9.1 registrados no banco oficial: overview Brasil p95 0,65 ms; overview UF p95 0,68 ms; overview município p95 0,37 ms; comparação município p95 1,38 ms. Esses números medem a camada de leitura, não TTFB completo.

Após a extensão de medianas, uma leitura real de comparação municipal em `projetoeleitor_db` respondeu em aproximadamente 558 ms no ambiente local, com amostras de 78 municípios no ES e 5.571 no Brasil. É uma leitura de contexto sob demanda, não a primeira consulta do overview.

O gráfico temporal do Capítulo 3 reutiliza as séries Ideb oficiais já carregadas para município, UF e Brasil em paralelo; não faz consultas por ponto nem cálculo no navegador. Quando uma rede não possui publicação correspondente, a lacuna é preservada no traçado e no tooltip.

Capítulos 1 e 5 seguem o mesmo contrato: oferta estadual/nacional e docentes estadual/nacional são lidos em paralelo no servidor, e o navegador apenas alinha as edições para o gráfico comparado.

## Limitação

Não foi feita medição formal de LCP/TTFB em ambiente de produção nesta fase. O smoke local confirmou renderização e ausência de fan-out no navegador; a instrumentação de produção permanece trabalho operacional futuro.

