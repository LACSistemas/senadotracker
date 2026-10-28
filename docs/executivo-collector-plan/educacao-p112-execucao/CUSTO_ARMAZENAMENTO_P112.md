# Custo de armazenamento

Após a publicação v2:

- banco total: 33.560.718.483 bytes;
- schema `civica_exec`: 17.350.230.016 bytes;
- tabelas P11.2: aproximadamente 1,0 GB (ofertas 666 MB + índices 90 MB + dimensões/rollups);
- RAW ZIPs Censo Superior: 528.380.445 bytes;
- staging CSV/dicionários P11.2: 1.180.772.639 bytes;
- livre C: 36.004.356.096 bytes;
- livre D: 407.576.797.184 bytes.

Não foi criado cluster, dump ou arquivo volumoso no C:. O orçamento de crescimento desta fase permaneceu abaixo de 3 GB no banco e abaixo de 2 GB no D:. O C: continua com margem menor que o D:; novos históricos devem ser planejados no volume externo.
