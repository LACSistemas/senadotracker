# Contrato territorial e compatibilidade histórica

## Chave canônica

`exec_entity` é a identidade de serving. Para município, `ibge7` é o código IBGE de sete dígitos; `ibge6` é derivado pelo schema. `exec_entity_external_id` mantém códigos source-native (inclusive SIAFI) com intervalo de validade. Nome não é chave.

## Tipos observados

| kind | Uso | Exemplo |
|---:|---|---|
| 1 | Brasil | ibge7 76 |
| 2 | região não administrativa | Norte, Nordeste, Sudeste, Sul, Centro-Oeste |
| 3 | UF | 27 UFs, parent região |
| 4 | município/recorte municipal | Alto Rio Novo 3200359 |
| 5 | agregado “município ignorado da UF” | 27 agregados, não município jurídico |

## Casos obrigatórios

- **Boa Esperança do Norte/MT:** código IBGE `5101837`, município instalado em 2025. Censo 2022 não pode receber automaticamente uma observação municipal desse código; a edição deve retornar `NOT_APPLICABLE` ou `MISSING` conforme o universo da fonte.
- **Alto Rio Novo/ES:** código correto `3200359` está em `exec_entity`; o relato de ausência foi causado pelo teste com `3200506`.
- **Brasília/DF:** é entidade territorial especial; a UI deve dizer Distrito Federal e não tratá-la como município comum em comparações administrativas.
- **Fernando de Noronha:** distrito estadual; não inventar uma UF ou município jurídico. Deve ser uma entidade especial, ou ausência explícita, conforme a fonte.

## Versão geográfica

Cada fato deve carregar `geography_version` e a data da malha source-native. Série de 2022 só pode ser comparada a 2026 se a fonte fornecer crosswalk ou a comparação for apenas descritiva. Município criado/desmembrado não herda números históricos do município de origem. Agregação UF/Brasil exclui kind 5 quando o fato já inclui o território válido; inclusão deve ser documentada para não duplicar.

## Estados de resolução

`RESOLVED_OFFICIAL`, `RESOLVED_EXTERNAL_ID`, `UNRESOLVED`, `AMBIGUOUS`, `NOT_APPLICABLE`, `MISSING_SOURCE`.  
`NOT_APPLICABLE` significa que o território não pertence ao universo da edição; `MISSING_SOURCE` significa que pertenceria, mas não há linha publicada/coletada. A interface futura não pode convertê-los em zero.

## Regras

1. Validar código IBGE7 contra catálogo oficial da edição.
2. Usar crosswalk SIAFI→IBGE somente com fonte oficial e validade.
3. Rejeitar fuzzy matching de nomes.
4. Reconciliar Brasil↔UF↔municípios apenas se a medida for aditiva e a malha/universo coincidirem.
5. Contar cobertura em linhas e entidades distintas; uma linha source não equivale automaticamente a um município.

