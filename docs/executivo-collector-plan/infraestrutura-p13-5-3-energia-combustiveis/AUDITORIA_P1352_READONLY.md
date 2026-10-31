# Auditoria read-only P13.5.2 — Gate Zero

**Data:** 2026-10-31  
**Banco:** `projetoeleitor_db`  
**RAW:** `D:\Civica\raw\infraestrutura\energia_expandida`  

A auditoria foi somente leitura antes da primeira escrita desta fase. Banco confirmado como `projetoeleitor_db`; tamanho antes da P13.5.3: 34.417.773.715 bytes.

- SNISB: 28.835 instalações persistidas; 23 sem `ibge7`, listadas por exceção e sem remapeamento.
- ANM: 909 instalações.
- Atlas Águas: 5.572 códigos; `4300001` Lagoa Mirim e `4300002` Lagoa dos Patos são unidades hídricas especiais, não municípios IBGE; não foram convertidos.
- Candidatos de chave entre SNISB e ANM: 628; nenhuma fusão cross-source foi publicada.
- Publicações ativas 150/151/152 (runs 38370/38374/38375) têm `row_count=0` e `specIds=[]` porque os fatos derivados foram publicados fora de TableSpec; isso não representa tabelas vazias.
- Run 38368 falhou por duplicidade e não deixou publicação ativa parcial.

Gate Zero: PASS_WITH_DOCUMENTED_SOURCE_LIMITATION.
