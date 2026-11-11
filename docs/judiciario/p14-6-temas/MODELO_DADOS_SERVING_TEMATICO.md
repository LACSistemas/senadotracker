# Modelo e serving temático

A extensão é aditiva: indicadores e observações usam as tabelas existentes `jud_jn_indicator` e `jud_jn_observation`, com IDs `P146_*` e revisão `p146-jn-themes-20261105`. Nenhuma observação P14.2 foi alterada.

Serviços em `packages/db/src/postgres-judiciary-themes.ts`: catálogo, overview, indicadores paginados, série histórica, por tribunal, comparadores, fontes e precedentes STJ. Filtros são server-side; taxas retornam `METHOD_INCOMPATIBLE` para soma; nenhum serviço chama fonte externa durante SSR.
