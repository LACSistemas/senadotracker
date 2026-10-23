# Comparabilidade entre estados (P9.6)

**Contrato:** comparar duas UFs exige equivalência oficial comprovada de definição, unidade, escopo e data-base. Não existe nenhuma provada nesta entrega: o catálogo marca `OFFICIAL_EQUIVALENCE_PROVEN` em zero indicadores.

| Dimensão | RJ ISP | MG SEJUSP | ES SESP | RS SSP | PE SDS | CE SSPDS | SP SSP |
|---|---|---|---|---|---|---|---|
| Unidade dominante | vítima/caso | ocorrência (homicídio: vítima ou registro) | ocorrência (derivada) | ocorrência e vítima separadas | vítima (CVLI/estupro), ocorrência (CVP) | vítima (CVLI), ocorrência (CVP) | B.O. |
| Data-base | registro/fato conforme dicionário | fato (mês/ano) | data do fato (microdado) | mês da planilha (consumado) | fato | fato | mês estatístico do B.O. |
| Zero | declarado (grade completa) | declarado | ausência | declarado | ausência | ausência | ausência |
| Escopo | 54 indicadores | 18 naturezas | 10 tipos | 15 | CVLI, CVP, estupro | CVLI, CVP | 24 naturezas |
| Série | 2014–2026 | 2012/2019–2026 | 2018–2026 | 2012–2026 | 2004/2012/2014–2026 | só 2026 | 2022–2026 |

Consequências:
- A leitura (`getStateCrimeState`, `getStateCrimeMunicipality`) devolve **uma fonte por UF** e inclui `comparability` em cada série; a futura página não deve alinhar UFs lado a lado sem aviso.
- "Homicídio" de MG (vítimas, consumado), de PE (natureza HOMICIDIO do CVLI, vítimas), de SP (B.O. de homicídio doloso) e do RS (ocorrência) são medidas diferentes.
- Taxas por 100 mil só podem usar população do **mesmo ano**; não há população IBGE para 2022–2023 neste banco e não se interpola. Nenhuma taxa derivada foi publicada nesta etapa (G12: indicadores derivados = contagens brutas por fonte).
