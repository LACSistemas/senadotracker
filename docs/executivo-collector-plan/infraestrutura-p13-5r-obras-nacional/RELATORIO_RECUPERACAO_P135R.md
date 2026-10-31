# P13.5-R — recuperação nacional Obrasgov

## Resultado

`P13_5R_STATUS=BLOCKED_BUDGET`. A recuperação nacional de staging foi concluída com snapshot estável em `2026-10-30T00:00:00`, mas a publicação PostgreSQL foi bloqueada antes de qualquer escrita adicional. O catálogo nacional contém 155.037 projetos únicos; as relações foram conciliadas por `id_projeto_investimento`.

O bloqueio é quantitativo e verificável: a tabela piloto de projetos ocupa 270.336 bytes para 200 linhas (1.351,68 bytes/linha). Só os 154.837 projetos ainda ausentes projetam aproximadamente 209.290.076 bytes, acima dos 199.557.632 bytes restantes do envelope P13.5-R. Isso exclui geometria, execução, contratos, empenhos, WAL e margem de segurança.

Nenhuma publicação nacional foi ativada; o piloto `run_id=38141` permanece preservado. Todos os arquivos grandes permanecem em D:.
