# P14.13 — Custo real de armazenamento

Medido via `pg_database_size(current_database())`, não estimado.

| Momento | Bytes | Tamanho |
|---|---|---|
| Antes (baseline, antes de qualquer escrita do P14.13) | 35.835.645.075 | 33 GB |
| Depois do coletor de presidente + 4 fotos espelhadas | 35.835.702.419 | 33 GB |
| Depois dos coletores de HDI Global + PISA | 35.835.767.955 | 33 GB |
| **Crescimento total real** | **122.880** | **~120 KB** |

## Por tabela

| Tabela | Tamanho (`pg_total_relation_size`) | Linhas |
|---|---|---|
| `civica_exec.exec_hdi_global` (nova) | 64 KB | 102 |
| `civica_exec.exec_pisa_score` (nova) | 32 KB | 63 |
| `civica_exec.exec_executive_mandate` (ampliada, não nova) | +4 linhas | 4 (uf='BR') |
| `civica_media.portraits` (já existente) | +4 linhas (~200 bytes/linha) | 4 |

## Fora do banco (D:, nunca commitado, nunca no Postgres)
- `D:\Civica\tse-raw\2022\consulta_cand_2022_BRASIL.csv` — já existia em cache de uma coleta anterior (P14.1).
- `D:\Civica\tse-raw\2026\consulta_cand_2026.zip` (3,3 MB) + `consulta_cand_2026_BR.csv` (18 KB) — baixados nesta fase.
- `D:\Civica\raw\federal\tse-photos\foto_cand2022_BR_div.zip` (932 KB) e `foto_cand2026_BR_div.zip` — baixados só pra inspeção/confirmação de conteúdo antes de construir o coletor definitivo (que usa extração via HTTP Range, nunca baixa o ZIP inteiro em produção).
- CSVs da Our World in Data (HDI ~0,2 MB, PISA ~12 KB cada × 3) — buscados ao vivo pelo coletor, nunca persistidos em disco nem no banco (só os ~100 pontos filtrados vão pra `exec_hdi_global`/`exec_pisa_score`).

## Fotos: onde ficam de verdade
As 4 fotos do presidente/vice (2022 + 2026) ficam em `data/portraits/` (raiz do repositório, git-ignored) — mesmo diretório de todos os outros retratos oficiais do produto (deputados, senadores, governadores). O Postgres só guarda a linha de metadado (hash, dimensões, status) por foto, nunca os bytes da imagem. Uma primeira tentativa desta fase apontou o diretório pro D:, mas isso quebrava a rota `/api/portrait` (que resolve pelo diretório padrão sem uma variável de ambiente configurada) — corrigido usando o padrão, que já era git-ignored e nunca contava pro orçamento de 1 GB do usuário (esse orçamento é sobre o Postgres, não sobre arquivos locais já excluídos do versionamento).

## Conclusão
Orçamento do usuário: ≤ 1 GB (1.073.741.824 bytes). Crescimento real: 122.880 bytes — **0,011% do orçamento**. Gate `G9_STORAGE_BUDGET: PASS` com folga muito ampla.
