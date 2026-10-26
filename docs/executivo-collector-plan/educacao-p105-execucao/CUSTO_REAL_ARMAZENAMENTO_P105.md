# Custo real de armazenamento P10.5

O tamanho do banco é medido antes/depois com `pg_database_size`; o limite da fase é crescimento inferior a 5 GB. O baseline foi 28.664.106.131 bytes e o fechamento 30.908.124.307 bytes (delta 2.244.018.176 bytes, aproximadamente 2,09 GiB), portanto o gate de headroom passou. O RAW SIOPE é comprimido por recurso em `D:\Civica\raw\siope`: 972 arquivos, 52.725.446 bytes no disco, correspondentes a 1.207.315.452 bytes recebidos. O backup pré-publicação é dump custom-format em `artifacts/`, pois o ACL de `D:\Civica\backups` recusou escrita.
