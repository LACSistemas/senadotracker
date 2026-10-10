# SQLite baseline archive

O runtime não usa mais SQLite e `data/senadotracker.sqlite` foi removido do
working tree em 2026-10-02. O arquivo histórico permanece fora do repositório:

```ini
ARCHIVE = C:\Projetos\civicadocs\backups\senadotracker-2026-10-01.sqlite
FROZEN_AT = 2026-10-02T00:48:14.7972038Z
BYTES = 5500735488
SHA256 = ABA5552A6727E0E3388D62AAF4C724BB82FD61AD187038DA2BFF5234B2E97ADE
```

Comparators históricos que ainda usam o wrapper legado precisam ser executados
explicitamente com:

```powershell
$env:CIVICA_SQLITE_BASELINE_PATH = 'C:\Projetos\civicadocs\backups\senadotracker-2026-10-01.sqlite'
```

O wrapper recusa ausência dessa variável e recusa um caminho
`data\senadotracker.sqlite` dentro do repositório. Não existe fallback para um
arquivo SQLite local.

O backup final do PostgreSQL está no mesmo diretório:

```ini
DATABASE = projetoeleitor_db
DUMP = C:\Projetos\civicadocs\backups\projetoeleitor_db-final-2026-10-01.dump
DUMP_FORMAT = custom
DUMP_BYTES = 249756673
DUMP_SHA256 = CB0E115B14354FCE341F056B0DC3DCDDD8E988A07BC77127FF1654F73BCF8177
PG_RESTORE_CATALOG = PASS
```

O manifesto completo é `cutover-final-backup-manifest.json` no diretório de
backup externo. Os comparators são baseline read-only; não fazem parte do
runtime público e não autorizam fallback de PostgreSQL para SQLite.
