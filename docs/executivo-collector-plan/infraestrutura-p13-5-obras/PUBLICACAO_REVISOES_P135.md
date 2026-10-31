# Publicação e revisões

Foi criada uma revisão nacional de piloto no contrato padrão `exec_ingestion_run`/`exec_publication`: dataset 143, UF 0, competência 202610, `run_id=38141`, status 9/PUBLISHED, parser `p13.5-obrasgov-pilot-v1`. A publicação é transacional e a chave `(dataset_id, uf, competence)` é única.

O replay com o mesmo hash reutilizou o run, não inseriu projetos filhos ou novos, e manteve crescimento de banco em zero. Last-known-good anterior permaneceu intacto.
