# Estimativa de armazenamento

**Medição:** `projetoeleitor_db` ~32 GB em 28/10/2026. `exec_fin_fact` 6.811.397 linhas; `exec_fin_exec` 127.736; `exec_territory_population` 123.073; `exec_entity` 5.631. Esses valores já existentes não são custo P12.

| Camada P12 | Estimativa | Base |
|---|---:|---|
| fatos agregados municipais/UF | 0,1–0,4 GB | 10–40 indicadores × 5.600 entidades |
| índices/read models | 0,1–0,3 GB | dimensões/comparadores |
| metadados/revisões | <0,1 GB | manifests/cobertura |
| RAW planilhas/API | 1–5 GB | Censo/MDS/SINISA |
| RAW RAIS/Novo Caged | 7–30 GB/ano | TXT não identificado |

Estimativas; validar por amostra em D: antes do collector.
