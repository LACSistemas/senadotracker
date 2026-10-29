# Equipamentos e regionalização

Os relatórios municipais permitem contar CRAS por faixas de capacidade de referenciamento e exibem níveis sintéticos de IDCRAS/IDCREAS. Eles não identificam cada unidade. Portanto:

* `equipment_rows_validated = 0`;
* não há `source_equipment_id` para deduplicação;
* não há distinção observável entre respondente, existente e ativo;
* não há relação confiável entre CREAS sede e municípios atendidos;
* nenhum CREAS regional foi multiplicado por municípios abrangidos.

A futura carga deverá manter duas relações: `municipality_sede` e `municipality_served`. Um equipamento físico só contará uma vez no total municipal; municípios atendidos serão uma relação de cobertura, não unidades adicionais.

Os números nacionais observados no relatório são 4.336 CRAS até 2.500 famílias, 1.435 até 3.500 e 2.775 até 5.000 (total 8.546). Esses números são reportados como tabela agregada do relatório, não como prova de cadastro completo ou cobertura de resposta.
