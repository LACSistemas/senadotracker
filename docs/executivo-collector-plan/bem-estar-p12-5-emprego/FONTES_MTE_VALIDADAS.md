# P12.5 — Fontes MTE validadas

## Recursos utilizados

| Família | Recurso oficial | Acesso/layout | Semântica validada | Pronto |
|---|---|---|---|---|
| RAIS | [RAIS 2025 — MTE](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/rais/rais-2025) | XLSX agregado, 2.732.765 bytes, SHA-256 `b53279b80448e4b5545eee3192130215727d066c62dcce7e77337921ea14efff` | Tabela 4: estoque municipal por setor/total em 2023–2025; Tabela 2: Brasil/UF; Tabela 6: remuneração média real de dezembro | SIM |
| Novo Caged | [Novo Caged — agosto/2026 — MTE](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/novo-caged/2026/agosto/pagina-inicial/) | XLSX oficial no Drive MTE, 44.543.000 bytes, SHA-256 `d36c8ebe54e3e10ea877f5ea4dd6798a0a276c4fcff262c73102f4b9c8459e7d` | Tabela 3: competência corrente; Tabela 8.1: série municipal ajustada; Tabela 7.1: Brasil/UF ajustada, janeiro–agosto/2026 | SIM |

### URLs efetivas

- RAIS XLSX: `https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/rais/rais-2025/rais-2025-tabelas.xlsx/@@download/file`
- Novo Caged workbook: arquivo `3-tabelas_Agosto de 2026.xlsx`, Drive ID `1LFiRd5cYqCLbBv7udPWtus6h4cF3GaA0`, baixado por `drive.usercontent.google.com` a partir do link oficial do MTE.

## Alternativas avaliadas

As páginas oficiais de microdados RAIS/Caged, ISPER, Perfil do Município e Acesso Online foram documentadas como alternativas. Nenhum login foi automatizado, nenhum desafio foi contornado e nenhum microdado volumoso foi baixado, pois os agregados abertos responderam ao recorte inicial.

## Proveniência e retenção

Os arquivos íntegros permanecem somente em `D:\Civica\raw\bem-estar\trabalho`; o staging permanece em `D:\Civica\staging\bem-estar\trabalho`. O PostgreSQL guarda apenas valores agregados, revisões, publicações e manifesto SHA-256.
