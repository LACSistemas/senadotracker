# Duplicidades source-native

- Projetos: 155.037 IDs únicos, zero duplicidade.
- Geometrias: 241.018 linhas; 240.004 relações válidas publicadas, com pares/triplas deduplicados pela chave `(project_id, ibge7, geometry_id)`.
- Execução física: 292 repetições da chave `(projeto, execução)`; 74.050 fatos únicos publicados. A origem não foi alterada.
- Empenhos: 275 repetições da chave composta usada; 89.502 fatos únicos publicados.
- Contratos e histórico: sem duplicidade na chave source-native usada.

As duplicidades são contabilizadas, não apagadas do staging. A publicação não usa nome, valor ou posição de página como identidade.
