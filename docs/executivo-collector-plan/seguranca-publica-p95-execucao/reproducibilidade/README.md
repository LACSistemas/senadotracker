# P9.5 — Reprodutibilidade

Da raiz do repositório. `EXEC_DATABASE_URL` redireciona qualquer comando para um banco de teste; sem ela o alvo é o banco do Cívica. Requer `D:\Civica` com o GUID de `CIVICA_EXEC_VOLUME_ID`, Python 3 (stdlib apenas) e `curl.exe`.

## G0 e backup

```
node --import tsx scripts/exec/prisional-g0.ts > g0_antes.json        # G0 + fingerprints (Saúde, P9.1–P9.4, entidades, contratos compartilhados)
pg_dump -n civica_exec -Fc -f D:\Civica\backups\pre-financas-p95-AAAAMMDD.dump
# restauração em cluster isolado (valida o backup): initdb em D:\Civica\pgtest_p95, porta 55436, lc_messages='C'
pg_restore --no-owner --exit-on-error -j 2 -d projetoeleitor_db <dump>
EXEC_DATABASE_URL=postgresql://postgres@localhost:55436/projetoeleitor_db node --import tsx scripts/exec/prisional-g0.ts > g0_restore_teste.json   # todos os fingerprints idênticos
```

## Coleta RAW (retomável; nada é publicado)

```
node --import tsx scripts/exec/financas-fetch.ts dca-ie 2014-2025 all 6    # Siconfi DCA Anexo I-E: 1 chamada por ente, pacote JSONL.gz por UF × exercício
node --import tsx scripts/exec/financas-fetch.ts rreo02 2014-2026 all 3    # RREO Anexo 02 (estados, União e municípios ≥ 45 mil hab.), último bimestre vencido
node --import tsx scripts/exec/financas-fetch.ts dca-ig 2014-2025 all 3    # DCA Anexo I-G (restos a pagar): estados, União e municípios ≥ 100 mil hab.
node --import tsx scripts/exec/financas-fed.ts fetch 2014 2026             # Portal da Transparência: despesas-execucao (mensal) e orcamento-despesa (anual)
node --import tsx scripts/exec/pncp-fetch.ts 2021 2026 2                   # PNCP: contratos por mês de publicação
node --import tsx scripts/exec/financas-rs.ts fetch 2013 2026              # TCE-RS: empenhos municipais (CSV anual)
```

O Siconfi limita a taxa (HTTP 429) e o Portal da Transparência bloqueia o IP por alguns minutos com HTTP 405 após dezenas de downloads: os coletores usam limitador global adaptativo, pausa coletiva e espera longa com retomada (`.part`). Escritas concorrentes em JSONL são serializadas (`appendSerial`).

## Migrations, definições e publicação

```
node --import tsx scripts/exec/financas-pilot.ts migrate                   # v5 (cobertura + tabelas federais) e v6 (contratos, fornecedores, transferências)
node --import tsx scripts/exec/financas-pilot.ts seed                      # 39 indicadores 7001–7074 (+ dicionários em exec_ref_code, domínios 30–33)
node --import tsx scripts/exec/financas-pilot.ts publish dca 2014-2025 all
node --import tsx scripts/exec/financas-pilot.ts publish rreo 2014-2026 all
node --import tsx scripts/exec/financas-pilot.ts publish dcarp 2014-2025 all
node --import tsx scripts/exec/financas-fed.ts publish 2014 2026
node --import tsx scripts/exec/contratos-pilot.ts pncp 2021 2026
node --import tsx scripts/exec/contratos-pilot.ts transfers
node --import tsx scripts/exec/financas-rs.ts publish 2013 2026
node --import tsx scripts/exec/financas-report.ts docs/executivo-collector-plan/seguranca-publica-p95-execucao   # CSV, reconciliação, desempenho
```

Reexecutar é seguro: mesmo pacote RAW + mesma população → `NO_CHANGE`. Novo exercício/bimestre: basta coletar e publicar o ano; o RREO e o ano corrente do PNCP/Portal são preliminares e se atualizam por hash.

## Testes (cluster descartável, `lc_messages=C`)

```
EXEC_TEST_ADMIN_URL=postgresql://postgres@localhost:55436/postgres node --import tsx --test tests/unit/financas-p95.test.ts tests/unit/pncp-p95.test.ts tests/integration/financas-p95.test.ts tests/integration/financas-p95-ondas.test.ts
```

## Conteúdo

`g0_antes.json`, `g0_restore_teste.json`, `g0_depois.json`, logs de coleta/publicação, saída da suíte completa e do build isolado. Sem dados pessoais: nenhum CPF, nome de pessoa física, endereço, conta bancária ou texto de objeto de contrato é persistido.
