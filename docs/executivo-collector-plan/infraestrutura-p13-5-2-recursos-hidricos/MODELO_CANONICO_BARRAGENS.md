# Modelo canônico de barragens

`civica_exec.exec_dam_facility` armazena uma linha por instalação e fonte (SNISB ou ANM), com chave única `source_system + source_key`, atributos físicos, territoriais, risco, DPA, PNSB/PAE e proveniência.\n`exec_dam_atlas_municipality` armazena o retrato municipal do Atlas por CDMUN. Indicadores são derivados separadamente em `exec_ind_def/exec_ind_value`; nenhuma contagem de execução é multiplicada por junções.
