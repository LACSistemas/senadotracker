# Custo real de armazenamento (G8_DATABASE_5GB): PASS

Baseline medido antes da primeira escrita (v16 ainda não aplicada): **31.497.923.731 B** (`projetoeleitor_db`). Limite inegociável de crescimento: 5.000.000.000 B; alerta 4 GB; parada 4,5 GB.

| Etapa | Banco (B) | Crescimento acumulado |
|---|---|---|
| antes da v16 | 31.497.923.731 | 0 |
| após contratos (428.192 + 440.203 classes + fornecedores) | 31.829.167.251 | 331.243.520 |
| final (contratações, termos, obras, auditoria) | 31.833.500.819 | **335.577.088 (0,34 GB = 6,7% do teto)** |

| Tabela | Linhas | Bytes totais |
|---|---|---|
| exec_edu_contract | 428.192 | 231.030.784 (~540 B/linha) |
| exec_edu_contract_class | 440.203 | 92.610.560 |
| exec_edu_work | 6.637 | 2.727.936 |
| exec_edu_procurement | 2.030 | 1.089.536 |
| exec_edu_contract_audit | 1.260 | 327.680 |

- Change log: 16.921.408 → 16.921.549 linhas (+141, só retificação de 2 fatias de obras; cargas iniciais não geram log). Nada anterior foi apagado ou truncado.
- C: livre no fim: 45,7 GB (mínimo exigido 20 GiB). Pilotos isolados em D: (`pgtest_edu7`, `pgtest_t107`).
- Projeção para completar a coleta: compras (~175 mil, ~550 B cada) e termos (~270 mil contratos) somariam < 0,3 GB; obras das 27 UFs < 0,05 GB. O limite não é bytes, é o limite de requisições do PNCP/Obrasgov.
