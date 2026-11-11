# Modelo de dados e serving

Tabelas novas em `civica_jud`: `jud_stj_orgao`, `jud_stj_person`, `jud_stj_precedent`, `jud_stj_precedent_process`, `jud_stj_acordao_mirror`, `jud_stj_decision` e `jud_stj_document_relation`. Todas as entidades carregam revisao, snapshot, hash bruto e proveniencia.

Servicos exportados: overview, listagem/paginacao e detalhe de precedentes, listagem filtravel de decisoes e cobertura de fontes. Filtros usam parametros SQL e o frontend nao acessa o CKAN.
