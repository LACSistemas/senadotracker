# Dicionário ENEM e comparabilidade

## Contrato mínimo por edição

| Campo lógico | Campo source esperado | Uso | Situação |
|---|---|---|---|
| edição | NU_ANO/equivalente | chave temporal | validar no arquivo |
| participante anonimizado | identificador mascarado, se existir | somente deduplicação da edição | não persistir em produto |
| município de residência | CO_MUNICIPIO_RESIDENCIA | geografia residencial | NEEDS_VALIDATION |
| UF de residência | SG_UF_RESIDENCIA | agregação UF | NEEDS_VALIDATION |
| município da escola | campo escolar source-native | população escolar | NEEDS_VALIDATION; pode ser suprimido |
| tipo de escola | TP_ESCOLA/equivalente | rede pública/privada | NEEDS_VALIDATION |
| presença CN/CH/LC/MT | TP_PRESENCA_* | denominadores | validar por edição |
| nota CN/CH/LC/MT | NU_NOTA_* | média/quantis | validar por edição |
| nota redação | NU_NOTA_REDACAO | média/quantis | validar por edição |
| situação redação | TP_STATUS_REDACAO | elegibilidade | validar por edição |

## Regras de comparabilidade

1. Comparar apenas mesma edição ou série de edições com dicionário compatível.
2. Não comparar média de residentes com média de escolas ou locais de prova.
3. Não calcular média com ausentes tratados como zero.
4. Não misturar participante, inscrição e prova como se fossem a mesma unidade.
5. Registrar mudanças de questionário, escala, presença e anonimização por edição.
6. Células pequenas recebem supressão, não zero.
7. Toda publicação deve conter source_year, population_definition, denominator e coverage_status.

## Quebras esperadas

Os anos históricos têm layouts distintos. A página de microdados mantém a série, mas o INEP informa reestruturação por LGPD; portanto o dicionário canônico deve ser versionado (enem:vYYYY) e não impor uma coluna ausente.

