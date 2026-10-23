# Comparabilidade (P9.7)

| Par | Comparável? | Regra |
|---|---|---|
| Estadual × PF/PRF no VDE (mesma UF, mesmo mês) | **Não somar** | podem registrar o mesmo fato; séries ficam separadas (`abrangencia`) |
| UF × UF no VDE, mesma abrangência | **Dentro da fonte, com cautela** | mesma definição do Sinesp, mas práticas de registro/reporte diferem; zero pode ser ausência de relato |
| VDE × ISP-RJ × SSP-RS × SSP-SP | **Não** | unidades (ocorrência, caso, B.O., autor) e critérios próprios; sem equivalência oficial comprovada |
| Registros de tráfico × massa apreendida | **Não** | medidas diferentes |
| Cocaína × maconha (massa) | **Não somar** | substâncias distintas; unidade do peso não declarada |
| Registros de apreensão (eventos) × armas apreendidas | **Não** | universos diferentes |
| Posse/porte × tráfico (qualquer fonte) | **Não somar** | o ISP-RJ chega a aglutinar títulos em `apreensao_drogas`; não somar com posse/tráfico do RJ |
| Mandado de prisão do VDE × `cmp` do ISP-RJ | **Não** | VDE conta mandados; ISP conta autores |
| Séries de SP | cautela | tráfico desde 2022-01; posse/apreensão/porte de arma só desde 2023-01 (rótulos ausentes em 2022): ausência ≠ zero, não há queda "de 2022 para 2023" |
| Brasil (Σ das 27 UFs) | só mesmo indicador do VDE | `complete` exige 27 UFs × 12 meses; o ano corrente é parcial e vem marcado |

## Massa apreendida: unidade
O arquivo do VDE traz `total_peso` sem unidade. Conferência externa (não oficial): maconha estadual de PR em 2024 = 482.868 no banco × 483,7 mil kg noticiados — **consistente com kg**. Por isso o texto de unidade é "peso informado (compatível com kg em conferência por imprensa, não declarada pela fonte)" e **não há conversão** para toneladas nem soma com contagens.

## Taxas
Nenhuma taxa por habitante foi criada: não há população oficial do mesmo ano para 2022–2023 e não se interpola. A densidade policial/apreensão não mede crime nem eficiência.
