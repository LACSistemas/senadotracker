# Publicação e revisões P13.1

## Estado final

Foram publicadas cinco revisões independentes `(dataset, competência 202412, escopo nacional)`, usando `exec_ingestion_run`, `exec_raw_manifest` e `exec_publication`: datasets 130–134, runs 38069–38073. Cada revisão contém os valores em `exec_ind_value` e os ponteiros em `exec_ind_latest`; somente a revisão validada ficou ativa. Falha de refresh preserva last-known-good; retificação cria nova revisão com hash distinto; replay idêntico retornou `NO_CHANGE` para as cinco famílias.

Foram criadas 20 definições SINISA (domínio 5), 98.636 linhas de indicadores e cinco manifests de proveniência. Não foi criada migration nova nem tabela paralela. RAW e staging permanecem no D:.

O desenho aprovado foi executado: uma publicação por `(dataset, competência, família)` usando `exec_ingestion_run`, `exec_raw_manifest` e `exec_publication`; somente a revisão validada ficou ativa. Falha de refresh preserva last-known-good; retificação cria nova revisão com hash distinto; replay idêntico retorna `NO_CHANGE`.

As 20 definições SINISA estão em `exec_ind_def`, com 98.636 linhas em `exec_ind_value`/`exec_ind_latest` e cinco manifests de proveniência. Não foi criada migration nova nem tabela paralela. RAW e staging permanecem no D:.
