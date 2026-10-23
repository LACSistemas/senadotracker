# Reprodutibilidade — P9.7

1. Backup consistente antes de qualquer mudança: `pg_dump -n civica_exec -Fc -Z 3 -f D:\Civica\backups\pre-crime-organizado-p97-20261023.dump` (521 MB) + `.sha256`.
2. Restauração em cluster isolado (`D:\Civica\pgtest_p97`, porta 55437): `pg_restore --no-owner --no-privileges -j 2` → banco `p97_restore` (exit 0).
3. Fingerprints (`scripts/exec/fingerprints-all.ts`): `fingerprints_antes.json` (produção, após o PNCP) × `fingerprints_restore_teste.json` (restaurado): **todas as chaves de `civica_exec` idênticas** (valores por onda, definições, tabelas, cobertura, entidades, publicações, contratos compartilhados, migrations). O esquema `civica` (legislativo, 59 tabelas) não está no dump porque o dump é só do `civica_exec` (por desenho); sua contagem foi conferida em produção.
4. Fingerprints depois: `fingerprints_depois.json` (gerado ao final) comparado com `fingerprints_antes.json` em `results.json`.
5. Relatórios: `scripts/exec/organized-crime-report.ts <pasta>` (catálogo, cobertura, desempenho) e `scripts/exec/security-matrix.ts <pasta>` (matriz e prontidão). Testes: `tests/integration/organized-crime-p97.test.ts`.
6. Antes dos fingerprints desta etapa, a lacuna da P9.3 (não conferida na P9.6) foi fechada: hash de `5001..5399` = `49025be73b2314a0830e6c4d73ff20c3`, n = 152.944, **igual** ao baseline persistido em `g0_antes.json` da P9.6.
