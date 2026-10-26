# Reconciliação (G7_RECONCILIATION): PASS_WITH_CAVEATS

Script: `scripts/exec/edu-reconcile.ts`. Resultado em produção: `evidencias/reconciliacao_producao.json` (isolado: `reconciliacao_isolado.json`).

| Verificação | Resultado |
|---|---|
| RAW × banco por ano | 2021–2026 batem **exatamente** após descontar os rejeitados registrados (431.788 − 3.596 = 428.192) |
| Classe sem contrato / contrato sem classe | 0 / 0 |
| Fornecedor inexistente | 0 |
| (órgão, ano, sequência) com duas chaves | 0 |
| Classes (categoria e confiança) × varredura | 0 divergências |
| Conferência independente (100 contratos relidos do JSON bruto: órgão, valor global/inicial, fornecedor, data, compra, tipo) | 0 divergências |
| Verificação dentro de cada publicação | linhas, Σ valor, classes, órfãos e cópia de valor/ente na classe barram a fatia |
| Dupla contagem com Segurança | 995 contratos / R$ 170,8 mi em comum: deduplicar por `pncp_id` |
| Contrato → empenho → pagamento | 0 relações comprováveis (155.260 registros são do tipo Empenho do PNCP; nenhum pagamento publicado) |
| Obras | 6.637 publicadas; 0 com execução física/empenho (arquivos nacionais não coletados); cobertura declarada |

Replay: contratos 157 fatias NO_CHANGE; contratações 157 NO_CHANGE; termos 122 NO_CHANGE; obras 7 NO_CHANGE e 2 republicadas (o RAW novo avançou). Retificação, rollback e falha injetada foram testados em dados reais no cluster isolado (`evidencias/pilot_checks_es2023.json`: falha sem rastro; retificação gerou 4 linhas de change log; rollback restaurou hash idêntico) e em fixtures (`tests/integration/educacao-p107.test.ts`). Carga inicial não tem rollback por desenho (usa replay).

Bugs achados pela reconciliação/piloto e corrigidos antes da produção: classe sem `year/uf`; `valorAcumulado` negativo na origem violava CHECK; sanitização apagava a palavra "ônibus/veículo"; alias `year` inválido na consulta de termos; arquivo nacional de obras ausente derrubava a leitura.
