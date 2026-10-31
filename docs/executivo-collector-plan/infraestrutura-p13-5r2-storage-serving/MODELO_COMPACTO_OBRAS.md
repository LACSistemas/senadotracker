# Modelo compacto

Migration v28 (`civica_exec_ddl_v28_obrasgov_compact_serving`) adicionou tabelas `exec_work_c_*` sem alterar as tabelas v27. O catálogo guarda identidade source-native, nome, situação/tipos via dicionários, UF, órgão, datas, população/empregos e valor previsto. Relações usam `project_id` inteiro.

Localização guarda pares oficiais projeto–IBGE e `geometry_id`, sem repetir município, endereço ou payload geoespacial. Contratos, execução física, empenhos e histórico preservam seus identificadores e distinções sem copiar fatos do PNCP/Siconfi. Descrições e detalhes raros permanecem no staging auditável em D:.
