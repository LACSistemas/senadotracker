# Taxonomia da criminalidade estadual (P9.6)

Princípio: **cada fonte mantém seus próprios indicadores** (faixa de ids `8000 + slot×100 + 1..99`, tabela `exec_crime_indicator`). A taxonomia só agrupa e nomeia; ela não funde fontes.

## Grupos
| Grupo | Conteúdo |
|---|---|
| LETAL | homicídio doloso, feminicídio, latrocínio, lesão corporal seguida de morte, CVLI, letalidade violenta |
| SEXUAL | estupro, estupro de vulnerável (e variantes por fonte) |
| PATRIMONIAL | roubos, furtos, CVP |
| PESSOA | tentativas, lesão corporal, sequestro |
| POLICIAL | tráfico/porte/apreensão de entorpecentes, porte de arma |
| TRANSITO | homicídio/lesão culposa de trânsito |
| OUTROS | extorsão, outros registros |

## Unidades (nunca somadas entre si)
`vitima`, `caso`, `ocorrencia` (B.O./registro), `autor`, `adolescente`, `evento`.

## Categoria canônica (campo `canonical`)
Serve só para localizar candidatos a comparação. Toda ligação por canônico nasce como `SIMILAR_LABEL_NOT_PROVEN`. Compostos (ex.: RJ `cvli`, `letalidade_violenta`, `total_roubos`) são `NOT_COMPARABLE` e **nunca somam com seus componentes**.

## Regras de leitura
- Registro policial ≠ óbito SIM ≠ VDE do Sinesp (P9.1 permanece intacto e não é substituído).
- Ocorrência ≠ vítima (ex.: RS `HOMICIDIO_DOLOSO` × `VITIMAS_HOMICIDIO_DOLOSO`; MG `…_REGISTROS` × `…_VITIMAS`; SP conta B.O.).
- Ausência ≠ zero; zero só quando a fonte declara grade completa (RJ, MG, RS).
- Categorias sensíveis derivadas de microdado: células municipais de 1–2 casos suprimidas (valor NULL + flag `suppressed`); a UF mantém o total.
