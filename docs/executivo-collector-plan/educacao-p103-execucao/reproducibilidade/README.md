# Reprodutibilidade · P10.3

Pré-requisitos: RAW do Censo em `D:\Civica\raw\inep\censo_escolar\AAAA\` (hashes no manifesto), `EXEC_DATABASE_URL` apontando para o banco alvo (use cópia restaurada de backup para ensaios), Python com `openpyxl`, `xlrd`, `pyreaddbc` não é necessário. Python sempre com `-I -X utf8`.

Ordem:
1. Distribuição de valores por ZIP e matriz de vigência: `scripts/exec/censo_infra_extract.py` (um ano por vez, saída em `evidencias/_infra_dist_AAAA.json`) e `reproducibilidade/infra_disponibilidade.py` (gera `MATRIZ_VARIAVEIS_INFRAESTRUTURA_2007_2025.csv`).
2. Indicadores oficiais: URLs em `evidencias/indicadores_urls_selecionadas.txt` (306 arquivos, inventário da P10); download com `curl -C -`; registro e CRC: `scripts/exec/educacao-pilot.ts ind-register`; extração e validação de layouts: `scripts/exec/censo_ind_extract.py`.
3. Docentes oficiais: `reproducibilidade/sinopse_docentes_batch.sh <anos>` (Sinopse 2.1/2.2, planilha apagada depois), `scripts/exec/sinopse_docentes_tsv.py` e `educacao-pilot.ts doc-prepare`.
4. Publicação completa em produção: `reproducibilidade/p103_producao.sh` (migrate, registro, infra, indicadores, docentes e replay). Ensaios: mesmo roteiro com `EXEC_DATABASE_URL` no cluster isolado.
5. Verificação: `scripts/exec/educacao-p103-reconcilia.ts`, `educacao-p103-bench.ts`, `educacao-p103-numeros.ts`, `educacao-p103-g16.ts` (este recusa rodar sem `EXEC_DATABASE_URL`).
6. Testes: `npm test` (inclui `tests/unit/educacao-infra-p103.test.ts` e `tests/integration/educacao-p103.test.ts`).

Reexecutar a publicação é idempotente (`NO_CHANGE`). Sem commit e sem push.
