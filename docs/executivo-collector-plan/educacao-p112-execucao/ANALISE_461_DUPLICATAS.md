# Análise das duplicatas de cursos/ofertas

A chave inicialmente proposta (`CO_IES + CO_CURSO + CO_MUNICIPIO + TP_MODALIDADE_ENSINO`) colide em 396 linhas extras em 2022, 461 em 2023 e 452 em 2024. Em 2023, as 461 colisões são grupos distintos: as linhas diferem em `TP_DIMENSAO` e não são duplicatas exatas. O mesmo padrão foi confirmado na auditoria de 2022/2024.

Exemplo estrutural: mesma IES, curso, município vazio e modalidade EAD aparecem uma vez com `TP_DIMENSAO=2` (EAD ofertado no Brasil) e outra com `TP_DIMENSAO=3` (dimensão somente Brasil), com métricas próprias. `DISTINCT` perderia semântica e não foi usado.

Chave final implementada:

`(year, co_ies, co_curso, co_municipio, tp_modalidade, tp_dimensao)`

Prova operacional: 2022 = 573.019 chaves finais para 573.019 linhas; 2023 = 671.610/671.610; 2024 = 720.349/720.349. A carga aborta se o staging encontrar colisão na chave final.
