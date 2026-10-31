# Testes P13.1

## Executados (registro histórico antes da conexão do D:)

- Identidade do banco: `SELECT current_database()` → `projetoeleitor_db`.
- Tamanho: `pg_database_size(current_database())` → 33.960.234.131 bytes.
- Headers dos cinco recursos: HTTP 206, MIME esperado e tamanho total.
- Prefixo dos cinco arquivos: `504B0304`.
- Verificação de segurança: somente C: montado; nenhum RAW/staging gravado; nenhuma escrita no PostgreSQL.
- Não regressão: contagens dos domínios existentes não foram alteradas por esta execução.

## Resultado após conexão do D:

- Leitura integral em staging no D:, com SHA-256 conferido nos cinco arquivos RAW.
- Layouts e dicionários conferidos: água 4 códigos municipais + UF/BR; esgoto 4 + UF/BR; resíduos 4; drenagem 4; gestão 4.
- `SOURCE_ROWS = PARSED_ROWS`, 0 entidades não resolvidas e 0 chaves duplicadas.
- Publicação transacional: runs 38069–38073, estado ativo, 98.636 linhas de indicadores.
- Replay completo: cinco retornos `NO_CHANGE`; nenhuma inserção duplicada e nenhuma nova revisão para hash inalterado.
- Nulos source-native preservados; zeros observados permanecem zeros válidos.
- Regressão read-only dos domínios existentes e dos collectors PNCP: PASS; frontend não tocado.
- Benchmark de persistência: crescimento do banco de 35.135.488 bytes, abaixo do envelope de 250.000.000 bytes.

## Limitações documentadas

Resíduos, drenagem e gestão municipal não têm agregados UF/Brasil equivalentes nos recursos oficiais coletados; os valores publicados nesses recortes permanecem municipais. Comparabilidade histórica com SNIS não foi inferida nesta edição SINISA 2024.
