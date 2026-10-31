# Auditoria P13.5.0 e baseline

O gate zero corrigiu `infraestrutura-p13-5-expansao/MATRIZ_FONTES_GRANULARIDADE.csv`: a descrição SIGBM com vírgulas passou a estar entre aspas. Validação reproduzida: `CATALOGO_NOVOS_INDICADORES.csv` = 18 linhas × 9 colunas; `MATRIZ_FONTES_GRANULARIDADE.csv` = 19 linhas × 14 colunas; sem linhas vazias.

Baseline documentado após P13.4/P13.5.0: `34,178,059,411` bytes. Após DDL v27 e piloto: `34,178,501,779` bytes (crescimento P13.5 medido: `442,368` bytes; inclui estruturas e publicação). O crescimento está dentro do envelope de 200.000.000 bytes. Nenhuma tabela P13 anterior foi removida.
