# Resiliencia e idempotencia

A chave de fonte inclui programa, edicao, semestre, etapa, SHA e parser. Reexecucao do mesmo arquivo nao duplica fatos. Falha grava `blocked` e nao apaga snapshot anterior.
