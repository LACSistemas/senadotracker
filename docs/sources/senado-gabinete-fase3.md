# Senado — equipe e remuneração de gabinete na Fase 3

Verificado e publicado em 09/09/2026 a partir das páginas individuais, da API administrativa de servidores ativos e do CSV mensal de remuneração do Senado.

## Equipe

- A URL histórica `https://www.senado.leg.br/transparencia/LAI/secrh/todos.csv` agora devolve somente um aviso que aponta a nova API `https://adm.senado.gov.br/adm-dadosabertos/api/v1/servidores?formato=pdf`. O coletor usa a variante oficial `formato=csv` como base consolidada.
- A base consolidada trouxe 6.663 registros: 4.243 comissionados, 2.365 efetivos e 55 requisitados. Sua hierarquia foi classificada sem misturar gabinete, escritório de apoio, liderança, comissão e unidade administrativa.
- As páginas `https://www6g.senado.leg.br/transparencia/sen/{id}/pessoal/?ano=2026&local=gabinete&vinculo=TODOS` forneceram o snapshot publicável porque vinculam diretamente a equipe ao código do senador e expõem `fcodigo` para efetivos/comissionados.
- O lote ativo cobre 81 de 81 senadores e 2.026 pessoas: 139 efetivos, 1.584 comissionados, 298 terceirizados e 5 estagiários. Estagiários preservam área, curso/universidade e datas do contrato; terceirizados preservam o contrato quando disponível.
- A reconciliação encontrou 1.718 nomes comuns, 308 apenas nas páginas individuais e 1.583 apenas na base consolidada dentro das unidades resolvidas. As diferenças são mantidas no relatório porque a base inclui escritórios de apoio e não fornece `fcodigo`. Uma unidade continua sem resolução por erro literal na fonte: “Jader Babalho”.

Relatório: `docs/reconciliation/senate-staff-2026.json`.

## Remuneração

- A competência 2026-08 veio de `https://www.senado.leg.br/transparencia/LAI/secrh/SF_ConsultaRemuneracaoServidoresParlamentares_202608.csv`.
- O arquivo contém 7.201 linhas: 6.620 de folha normal e 581 de folha suplementar. Foram identificadas 1.880 linhas de lotações de gabinete e 5.321 de outras unidades.
- O lote publicou 400 registros agregados para 80 gabinetes, mantendo separadamente proventos brutos, auxílios, diárias, vantagens indenizatórias e quantidade de linhas de folha normal.
- Assinaturas repetidas são diagnosticadas (333 grupos), mas não eliminadas: o arquivo não tem identificador de pessoa e valores idênticos podem pertencer a pessoas diferentes.
- Três lotações permaneceram sem vínculo ao cadastro parlamentar ativo: Ana Paula Lobato, Eduardo Girão e Hermes Klann.
- O CSV não contém nome, matrícula nem `fcodigo`. Portanto, ele permite agregar remuneração por lotação, mas não atribuir valores a uma pessoa da equipe. Nome, cargo e função continuam consultáveis no snapshot de equipe, sem associação individual inventada à folha.

Relatórios: `docs/reconciliation/senate-payroll-2026-08-dry-run.json` e `docs/reconciliation/senate-payroll-2026-08.json`.

## Execução

```bash
npm run collector -- collect-senate-staff --year 2026 --consolidated data/senado-servidores-ativos.csv --dry-run --report docs/reconciliation/senate-staff-2026-dry-run.json
npm run collector -- collect-senate-staff --year 2026 --consolidated data/senado-servidores-ativos.csv --report docs/reconciliation/senate-staff-2026.json
npm run collector -- import-cabinet --source senado --competence 2026-08 --file data/senado-remuneracao-2026-08.csv --dry-run --report docs/reconciliation/senate-payroll-2026-08-dry-run.json
npm run collector -- import-cabinet --source senado --competence 2026-08 --file data/senado-remuneracao-2026-08.csv --report docs/reconciliation/senate-payroll-2026-08.json
```

Equipe é snapshot e remuneração é competência mensal. Ausência de terceirizado ou estagiário na folha de servidores não significa custo zero. Subsídio de senador permanece fora da folha de servidores.
