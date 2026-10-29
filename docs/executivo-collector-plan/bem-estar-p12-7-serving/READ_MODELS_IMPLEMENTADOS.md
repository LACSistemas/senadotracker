# Read models implementados

## Código

- `packages/db/src/exec/wellbeing-read.ts`: contratos, capítulos, observações, comparadores, cobertura, metodologia e financeiro.
- `apps/web/lib/wellbeing.ts`: wrappers server-side com pool e `cache`.
- `packages/db/src/exec/index.ts`: export público do módulo.

## Padrão de consulta

O overview faz uma leitura set-based dos 27 indicadores por entidade, uma leitura de cobertura local e uma leitura financeira. Não há consulta por card, por indicador ou por município em loop. A série e os comparadores usam consultas set-based e índices existentes (`exec_ind_latest_entity_id_indicator_id_idx`, `exec_entity_uf_code_kind_idx`, chaves de valores/publicações).

## Publicação e proveniência

Cada observação carrega `dataset`, `release`, `sourceUrl`, `sourcePublishedAt`, `ingestedAt`, `publicationId` e `revision`. O read layer não grava fatos e não substitui snapshots. Raw/staging permanecem em `D:\Civica`.

## Limite de escopo

Não foram criadas tabelas, migrations, collectors ou componentes de frontend em P12.7.
