# Checkpoints e retomada

Há um checkpoint JSON por recurso em `D:\Civica\staging\infraestrutura\obras\checkpoints`, com endpoint, versão OpenAPI, snapshot, parâmetros, total, páginas, contadores e estado. Estados finais observados: `RESOURCE_COMPLETE`.

Uma interrupção anterior preservou páginas válidas e foi retomada sem rebaixar o lote. Os arquivos são gravados em temporário e renomeados atomicamente. A publicação foi deliberadamente separada do download.
