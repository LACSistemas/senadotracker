# Reprodutibilidade da P10.4

Tudo o que a P10.4 executou, na ordem. Os arquivos desta pasta são cópias dos scripts de `scripts/exec/` no momento da entrega (a fonte da verdade continua sendo `scripts/exec/`).

| Passo | Comando | Observação |
|---|---|---|
| 0. Baseline | `educacao-pilot measure p104-baseline` | 27.292.101.779 B, registrado em `../evidencias/baseline_pg_database_size.txt`; backup `D:\Civica\backups\pre-educacao-p104-20261025.dump` (sha256 conferido) |
| 1. Download do RAW | `p104_download.sh` com `p104_urls.txt` (159 arquivos de Indicadores, 9 do Ideb, 8 do Saeb) | Retomável (`curl -C -`); grava só em `D:\Civica\raw\inep\` |
| 2. Cluster de teste | `p104_cluster_teste.sh` (initdb + `pg_restore -j 4` do backup em `D:\Civica\pgtest_edu4`, porta 55441) | `EXEC_DATABASE_URL`/`EXEC_TEST_ADMIN_URL` apontam para ele; removido no fim |
| 3. Migration | `educacao-pilot migrate` | v13 (`packages/db/src/exec/ddl-v13.ts`) |
| 4. Registro de RAW | `learn-register`, `flow-register` | CRC dos ZIPs + SHA-256 no manifesto |
| 5. Publicação | `ideb-publish all`, `saeb-publish all`, `inse-publish all`, `trn-publish all`, `flow-publish all` | Fatia = edição × UF; extratores: `ideb_extract.py`, `saeb_extract.py`, `flow_extract.py`, `inse_extract.py`; TSVs com cache em `staging/educacao/` por SHA-256 + versão do parser |
| 6. Reconciliação | `educacao-p104-reconcilia.ts`, `educacao-p104-spot.py`, `educacao-p104-numeros.ts` | Somente leitura |
| 7. G16 | `educacao-p104-g16.ts 2023 32 <saida> [familias]` | Somente em banco de teste |
| 8. Benchmark | `educacao-p104-bench.ts <saida> 30` | Somente leitura |
| 9. Catálogo | `educacao-p104-catalog.ts <saida.csv>` | Gera `../CATALOGO_INDICADORES_APRENDIZAGEM.csv` |
| 10. Produção | `p104_producao.sh` | Mede a cada etapa e para sozinho acima de 4,5 GB de crescimento ou abaixo de 20 GiB livres no C: |

Notas de execução: `runPython` roda `python -I` (stdout ASCII); 7-Zip em `C:/Program Files/7-Zip/7z.exe` descompacta o RAR do Saeb 2023 e o ZIP de 2017 em `staging/educacao/saeb_unpack`; republicar o mesmo conteúdo reativa o run antigo (use SHA novo para ensaiar retificação).
