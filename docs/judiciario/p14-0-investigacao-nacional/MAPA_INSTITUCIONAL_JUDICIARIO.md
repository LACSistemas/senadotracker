# Mapa institucional do Judiciário

## Modelo hierárquico

`ramo → tribunal/órgão constitucional → grau → órgão julgador → unidade/gabinete → território de competência (quando publicado)`.

### Ramos e órgãos

| Família | Estruturas principais | Identidade pública útil | Observação |
|---|---|---|---|
| Estadual | 26 TJs + TJDFT; juizados e turmas | sigla/código CNJ/DataJud; unidade | competências estaduais distintas |
| Federal | 6 TRFs, seções/subseções, JEFs | sigla, região, código unidade | sede não é território processual |
| Trabalho | 24 TRTs + TST | TRT, vara, turma | ramo especializado |
| Eleitoral | TSE, TREs, zonas | tribunal/zona; DataJud atual pode listar TREs | mandato eleitoral não é unidade estadual |
| Militar | STM e TJs militares estaduais | tribunal/grau | cobertura DataJud específica |
| Superiores | STJ, TST, TSE, STM, STF | órgão, turma/seção; STJ CKAN | contratos heterogêneos |
| Controle | CNJ | órgão administrativo/controle | não é tribunal jurisdicional comum |

## Identidade

Chave preferida: `(ramo, tribunal_codigo, grau, unidade_codigo, validade_inicio)`. Nome nunca é chave. Códigos DataJud podem coincidir com códigos CNJ de unidade (TJBA comprovado em P1), mas essa equivalência deve ser validada por tribunal. Manter aliases, renomeações, extinções e vigência.

## O que não está comprovado

Não foi encontrado no banco ou em fonte nacional um cadastro público completo de unidades com hierarquia, competência e histórico. O MPM/CNJ tem cadastro administrativo interno; portais de tribunais e APIs como TJBA/TJRJ cobrem apenas recortes. A futura dimensão institucional deve aceitar `UNKNOWN` e proveniência por campo.

## Indicadores de identidade

`tribunal_sigla`, `ramo`, `codigo_cnj`, `alias_datajud`, `grau`, `orgao_julgador_codigo`, `nome_source`, `municipio_ibge_fisico`, `jurisdicao_source`, `valid_from`, `valid_to`, `source_id`, `provenance`. Magistrado só entra quando a fonte atribuir pessoa explicitamente (STJ ata/espelho, TSE autor de decisão, fonte tribunal-específica).
