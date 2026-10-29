# Fontes Anatel validadas

## Evidência oficial

- Dados abertos: https://www.gov.br/anatel/pt-br/dados/dados-abertos
- FAQ de cobertura móvel: https://www.gov.br/anatel/pt-br/dados/qualidade/qualidade-dos-servicos/duvidas-frequentes/cobertura-da-telefonia-movel
- Painéis de dados: https://www.gov.br/anatel/pt-br/dados/infraestrutura/antenas-nos-municipios/paineis-de-dados
- Mapa Mosaico: https://sistemas.anatel.gov.br/se/public/cmap.php

O FAQ documenta percentuais estimados de área, moradores e domicílios por município/tecnologia e ressalta que se trata de estimativa teórica. O painel documenta navegação por município, UF e Brasil. O Mosaico disponibiliza cálculos teóricos e camadas SHP.

## Limitação programática

Nesta fase não foi comprovado um CSV/JSON/API pública documentada que entregue, em lote, os percentuais municipais 4G/5G com edição, denominador e histórico. A existência do painel não foi tratada como prova de exportação. Endpoints internos e chamadas não documentadas não foram utilizados.

`ANATEL_STATUS=PARTIAL_NO_DOCUMENTED_STRUCTURED_EXPORT`.

Nenhum indicador Anatel foi gravado. Não se confundiu presença de rede, cobertura teórica, acessos, disponibilidade ou qualidade experimentada.
