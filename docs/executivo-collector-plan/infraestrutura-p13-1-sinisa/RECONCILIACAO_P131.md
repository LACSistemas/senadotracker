# Reconciliação P13.1

## Resultado real

| Família | Linhas source | Linhas canônicas | Municípios | UF | Brasil | Chaves não resolvidas | Duplicidades |
|---|---:|---:|---:|---:|---:|---:|---:|
| Água | 5.144 + 28 agregadas | 20.688 | 5.144 | 27 | 1 | 0 | 0 |
| Esgoto | 2.749 + 28 agregadas | 11.108 | 2.749 | 27 | 1 | 0 | 0 |
| Resíduos | 5.570 | 22.280 | 5.570 | 0 | 0 | 0 | 0 |
| Drenagem | 5.570 | 22.280 | 5.570 | 0 | 0 | 0 | 0 |
| Gestão municipal | 5.570 | 22.280 | 5.570 | 0 | 0 | 0 | 0 |

`SOURCE_ROWS = PARSED_ROWS` em todas as famílias. A ligação município–entidade usa o código IBGE de sete dígitos; não houve fuzzy matching. Valores nulos representam explicitamente “não calculado”, “não informado” ou ausência source-native e não foram convertidos em zero. Água e esgoto foram reconciliados também contra as planilhas oficiais UF/MR/BR. Resíduos, drenagem e gestão municipal não possuem agregado oficial equivalente nos recursos coletados; por isso o gate nacional desses três recortes é documentado como limitação de fonte, não como zero.

Os totais acima foram calculados a partir das linhas efetivamente lidas dos XLSX oficiais. `VALID_ROWS` corresponde a valores numéricos ou booleanos source-native; nulos continuam explícitos.

O gate de reconciliação passou para as cinco famílias. A limitação remanescente é somente a ausência de agregados oficiais para resíduos, drenagem e gestão municipal nesta edição.
