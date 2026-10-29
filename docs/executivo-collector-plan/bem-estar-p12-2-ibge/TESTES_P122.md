# P12.2 — Testes e idempotência

## Executados

- `DATABASE_GUARD`: PASS — `SELECT current_database()` retornou `projetoeleitor_db` antes da publicação.
- Validação de metadados SIDRA: PASS — variáveis, classificações e níveis foram conferidos na API v3 do IBGE.
- Parse dos 14 JSON oficiais: PASS — linhas de cabeçalho removidas, valores numéricos validados e `-` preservado como ausência.
- Resolução territorial: PASS — 5.570/5.570 municípios do Censo 2022 resolvidos por código IBGE7; 27 UFs e Brasil resolvidos por código oficial.
- Unicidade: PASS — nenhuma repetição em `(indicator_id, entity_id, period_start)`.
- Publicação transacional: PASS — 28 fatias definitivas, sem migration nova.
- Reconciliação de moradia: PASS — totais Brasil e soma das UFs coincidem com os arquivos N1/N3.
- Privacidade: PASS — somente agregados; não há pessoa, domicílio identificável ou microdado persistido.
- Limite de armazenamento: PASS — delta de banco 8.798.208 bytes, abaixo de 500.000.000 bytes.
- Read smoke real: PASS — Vitória/ES (`3205309`) retornou renda média 3.351,64, mediana 1.750, água 99,5203%, esgoto 99,6711% e lixo 99,7364%.

## Replay idempotente

O mesmo conjunto foi executado novamente com o mesmo hash de fonte e chave de fatia. As 28 fatias retornaram `NO_CHANGE`; não houve nova revisão, nova linha de indicador ou duplicação. `DUPLICATE_VALUE_INSERTIONS = 0` e `NEW_REVISION_ON_UNCHANGED_REPLAY = 0`.

## Regressão

O script escreve apenas `exec_ind_def` para os IDs 9001–9006, valores desses IDs e o dataset 120. Não altera tabelas de educação, saúde, segurança, finanças, coletores externos, frontend ou migrations. A consulta final confirma 28 publicações do P12.2 e os contratos existentes permanecem intactos.

## Pendências honestas

O Gini municipal não é um caso de teste falho: a tabela oficial 10301 não publica N6. O contrato mantém esse domínio como indisponível municipalmente e pronto para futura fonte oficial compatível, sem fallback inventado.
