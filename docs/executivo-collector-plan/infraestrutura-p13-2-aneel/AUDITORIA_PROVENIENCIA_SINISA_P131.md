# Auditoria de proveniência P13.1 (pré-condição P13.2)

Auditoria somente leitura em `projetoeleitor_db` antes da escrita ANEEL:

- banco confirmado: `projetoeleitor_db`;
- datasets ativos P13.1: 130–134;
- runs: 38069–38073;
- 20 definições, 98.636 observações e 12.301 valores nulos;
- cinco replays com `NO_CHANGE`;
- manifests com URLs, hashes e caminhos RAW em `D:\Civica\raw\infraestrutura\sinisa`.

## Diagnóstico do `preHash`

Os cinco runs apresentam `preHash=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` e `specIds=[]`. Esse é o SHA-256 da lista vazia de `TableSpec`, porque P13.1 publicou derivados diretamente (`tables: []`). Não é evidência de perda de dados nem de ausência de proveniência: `exec_ind_value.run_id`, `inputs`, `quality` e `exec_raw_manifest` preservam o vínculo com os arquivos e hashes reais.

A anomalia é registrada como limitação diagnóstica do publisher P13.1 e não foi corrigida em P13.2, para não reabrir nem alterar SINISA.
