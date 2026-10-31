# Publicação e revisões

Nenhum `exec_ingestion_run` nacional novo foi criado, pois o gate de orçamento falhou antes da escrita. A publicação piloto dataset 143/run 38141 continua ativa e preservada.

Uma futura publicação deverá usar novo dataset/revisão, deduplicar chaves source-native, medir WAL e ativar somente após aprovação de orçamento adicional. Não é correto converter o piloto em publicação nacional por `UPDATE`.
