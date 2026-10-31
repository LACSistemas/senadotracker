# Identidade

O identificador observado em todos os recursos é `id_projeto_investimento` (texto, por exemplo `151020.43-16`). Ele é a chave determinística de `exec_work_project` e de todas as relações filhas. Não foi feita concatenação por nome, município ou valor.

O endpoint oficial expõe projetos de investimento/obras; não há um endpoint independente de “intervenção” no contrato validado. Por isso o resultado usa `project_rows` e não infere uma entidade adicional.
