# Tabelas Processuais Unificadas e dicionários

Fontes: [https://www.cnj.jus.br/tabela-processuais-unificadas/](https://www.cnj.jus.br/tabela-processuais-unificadas/) e [WebService SGT](https://www.cnj.jus.br/sgt/infWebService.php). O CNJ mantém classes, assuntos, movimentos e documentos unificados; o WebService documenta consultas públicas de item, detalhes e filhos.

## Contrato canônico

Preservar `codigo`, `nome`, `descricao`, `codigo_pai`, aplicabilidade por ramo/grau, vigência, ativo/inativo, versão e fonte. A versão atual observada em páginas públicas varia por tabela (classes 12/09/2026; documentos 05/05/2026 em P1/P2); a Portaria Conjunta 2/2026 adiciona dicionário de movimentos, complementos e situações.

## Regra semântica

Classe atual não é necessariamente classe original; movimento de sentença, trânsito, baixa, arquivamento ou acórdão só pode ser classificado com regra oficial/versionada. Não agrupar por similaridade textual. Relatórios devem guardar a versão TPU usada para cada métrica.

## Operacionalização futura

Fazer uma chamada controlada ao WebService para validar esquema e versão, armazenar dicionários pequenos em RAW no D:, criar tabelas de referência versionadas e expor nomes humanos no serving. Sem carga nesta fase.
