# Fontes Anatel validadas

| Família | Fonte oficial | Resultado operacional |
|---|---|---|
| SCM | [Dados abertos Anatel](https://www.gov.br/anatel/pt-br/dados/dados-abertos), [coleta de acessos](https://www.gov.br/anatel/pt-br/regulado/universalizacao/coletas-de-dados-de-acessos) | Documentada; CSV municipal mensal não entregue pelo endpoint testado (página de bloqueio Anatel) |
| IQS/Selos | [Qualidade dos serviços](https://www.gov.br/anatel/pt-br/dados/qualidade/qualidade-dos-servicos/resultados/copy_of_qualidade-dos-servicos) | Documentada; painéis e promessa de planilhas oficiais, sem download estruturado comprovado no ambiente |
| IBC | [IBC Anatel](https://www.gov.br/anatel/pt-br/regulado/universalizacao/indice-brasileiro-conectiviadade-ibc) | Relatório/metodologia/painel documentados; exportação estruturada não comprovada |
| Cobertura móvel | [Mosaico](https://sistemas.anatel.gov.br/se/public/cmap.php) | Piloto SHP 4G Claro obtido e inspecionado; não é fato municipal/populacional |

Catálogo `dados.gov.br` foi localizado, mas as APIs públicas de recurso testadas retornaram HTTP 401. Nenhuma autenticação foi contornada.
