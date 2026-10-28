# Resiliência e idempotência

O coletor calcula SHA-256 dos ZIPs antes de abrir uma revisão. Se o último run publicado tem os mesmos hashes e o mesmo parser, a segunda execução retorna `no_change` e não cria revisão nem insere linhas. Isso foi observado nos runs 2 e 3. Após a correção da rede 2022 (TP_REDE source-native no arquivo de cursos), o parser foi versionado para v3 e a revisão coerente final é `run_id=4`.

Cada ano é carregado em transação, com tabela temporária, `COPY`, verificação de colisões e upsert. Falha de um ano faz rollback do ano; o run é marcado `failed` e não remove a publicação anterior.
