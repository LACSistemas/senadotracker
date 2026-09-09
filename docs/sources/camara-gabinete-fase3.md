# Câmara — equipe e verba de gabinete na Fase 3

Verificado em 09/09/2026 nas fontes oficiais da Câmara.

## Snapshot de funcionários

- Fonte: `https://dadosabertos.camara.leg.br/arquivos/funcionarios/csv/funcionarios.csv`.
- O catálogo oficial descreve atualização diária e informa que o arquivo representa os dados do dia anterior, sem histórico de mudanças.
- Resposta auditada: 3.537.410 bytes, UTF-8 com BOM, `;`, 15.506 linhas, 12 colunas e SHA-256 `732e292a054a9a4fe9bf77b26a4a14f742598005ea7b5eac827ff2953a47ba16`.
- Cabeçalho: `ponto`, `codGrupo`, `grupo`, `nome`, `cargo`, `lotacao`, `atoNomeacao`, `dataNomeacao`, `dataInicioHistorico`, `dataPubNomeacao`, `funcao`, `uriLotacao`.
- Grupos: 10.605 secretários parlamentares, 2.659 servidores efetivos, 1.714 cargos de natureza especial e 528 parlamentares.
- Foram observadas 12.272 linhas em lotações iniciadas por `GAB.`, distribuídas por 539 textos de lotação; 10.605 são secretários parlamentares. A categoria funcional e a lotação devem ser filtros independentes.
- `ponto` está preenchido, mas cinco valores aparecem duas vezes. Ele não será chave global sem compreender a duplicidade; a chave de staging inclui lote e linha/atributos oficiais.
- `uriLotacao` existe em 12.251 das 12.272 linhas de gabinete e é a primeira evidência estrutural para resolver a unidade. Nome textual do deputado serve para conciliação, não como chave única.
- `dataInicioHistorico` está preenchida, mas não converte o snapshot em histórico completo. `dataNomeacao` está vazia em 3.359 linhas do arquivo geral.

O CSV bruto usado na auditoria está em `data/` e é ignorado pelo Git. O relatório sem dados nominais está em [`docs/audits/camara-funcionarios-current.json`](../audits/camara-funcionarios-current.json).

## Verba mensal

- Fonte por parlamentar: `https://www.camara.leg.br/deputados/{id}/verba-gabinete?ano={ano}`.
- A página de exemplo `209787`, ano 2026, respondeu HTML renderizado no servidor com tabela `Mês`, `Valor disponível (R$)` e `Valor gasto (R$)`.
- Em 09/09/2026 havia linhas de janeiro a julho. Janeiro e fevereiro tinham disponibilidade proporcional (`133.170,54` e `145.991,64`); de março a julho aparecia `165.806,07`. Portanto, não preencher o limite mensal a partir de uma constante.
- A página informa limite corrente de R$ 165.806,07 e até 25 secretários. O guia oficial associa o valor ao Ato da Mesa 243/2026.
- A página agregada de gastos declara que 13º, férias e auxílio-alimentação são pagos fora da verba. Essas parcelas não podem ser inferidas nem somadas ao parlamentar sem atribuição oficial.
- Um ID de deputado inexistente respondeu HTTP 500; um ano sem série (`1900`) respondeu HTTP 200. Logo, status 200 não comprova presença de dados: o coletor deve validar título e linhas mensais.
- A documentação consultada não anuncia endpoint estruturado específico nem limite de requisições para essa série individual. Até surgir contrato oficial melhor, o HTML é a fonte observada e a coleta deve usar concorrência conservadora, cache e retry limitado.

## Contrato de coleta

O HTML é fonte oficial, mas tem contrato mais frágil que CSV/API. O coletor deve validar título, deputado, ano, cabeçalhos, meses únicos, moeda brasileira e ao menos uma linha para ano iniciado. Alteração de markup, resposta vazia, bloqueio ou ano sem dados gera diagnóstico/indisponibilidade. A publicação guarda URL, instante, hash e HTML bruto. Coleta em escala terá concorrência baixa, cache e retomada.

## Lotes publicados em 09/09/2026

- O snapshot funcional publicou 15.506 registros auditáveis. Foram confirmados 11.477 vínculos de servidores com deputados ativos por `uriLotacao`; 182 apontavam para IDs fora do cadastro ativo, nenhum ficou ambíguo e 3.847 registros de parlamentares ou unidades administrativas, partidárias e institucionais foram ignorados na composição do gabinete.
- A verba de 2026 cobriu os 513 deputados ativos, com 3.543 observações mensais e nenhuma página inválida. A soma disponível foi R$ 561.121.026,09 e a soma gasta foi R$ 506.328.202,52.
- A rechecagem integral reutilizou 513 respostas do cache e produziu as mesmas contagens e somas. O cache não é publicação: em uma nova publicação, cada resposta volta a receber registro bruto pertencente ao novo lote.
- Os relatórios de reconciliação estão em `docs/reconciliation/camara-staff.json`, `camara-budget-2026.json` e `camara-budget-2026-cache-recheck.json`.

## Comandos

```powershell
npm run collector -- collect-camara-staff --file "data\funcionarios-camara-audit.csv" --dry-run --report "docs\reconciliation\camara-staff-dry-run.json"
npm run collector -- collect-camara-staff --file "data\funcionarios-camara-audit.csv" --report "docs\reconciliation\camara-staff.json"
npm run collector -- collect-camara-budget --year 2026 --dry-run --report "docs\reconciliation\camara-budget-2026-cache-recheck.json"
npm run collector -- collect-camara-budget --year 2026 --report "docs\reconciliation\camara-budget-2026.json"
```
