# ADR 002 — SQLite, lotes e respostas brutas

Data: 08/09/2026. Estado: adotado para desenvolvimento local.

Usar o módulo `node:sqlite` de Node 22.15 para evitar uma dependência nativa adicional. A API está marcada como experimental nessa versão; o runtime fica fixado e toda atualização exige executar migrações, testes de transação e coleta offline. A migração futura para PostgreSQL permanece no bloco I.

O banco usa tabelas `STRICT`, foreign keys, WAL e `busy_timeout`. Migrações têm versão e hash: alterar SQL já aplicado encerra a inicialização. O coletor usa prepared statements para valores e transações `BEGIN IMMEDIATE` para migração/publicação.

Cada fonte possui uma lease. Uma segunda execução ativa é recusada; lease expirada marca a anterior como falha. O worker renova a lease antes/depois de requisições e ao gravar staging. O lote só se torna ativo após lista inicial, históricos, lista final e validações. A troca do lote ativo e todas as linhas publicadas ocorre na mesma transação; rollback preserva a versão anterior.

Respostas HTTP, inclusive falhas, são guardadas antes da interpretação com URL, status, tipo, instante, tamanho e SHA-256. Conteúdo idêntico reutiliza o mesmo arquivo imutável, mas cada requisição conserva sua linha de auditoria. Arquivo existente com hash divergente bloqueia a coleta.

Dados locais e brutos ficam em `data/`, fora do Git. Fixtures pequenas e suas proveniências ficam versionadas. O frontend futuro deve abrir o banco em modo de leitura; a CLI é a única responsável por escrita nesta arquitetura local.
