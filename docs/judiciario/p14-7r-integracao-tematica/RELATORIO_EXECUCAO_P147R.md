# P14.7-R — auditoria corretiva e integração temática

**Status final:** PASS_WITH_DOCUMENTED_SOURCE_LIMITATION  
**Banco:** projetoeleitor_db · **schema:** civica_jud

A auditoria direta encontrou 33 definições P14.6, todas com variável JN oficial, fatos e valores não nulos. Foram reconciliados 48576 fatos (30116 observados e 18460 nulos), sem órfãos nem chaves duplicadas. A divergência anterior estava no catálogo editorial: oito registros de temas documentados foram tratados como se fossem indicadores; no banco, os 33 indicadores eram operacionais.

A correção foi somente de metadados e serving. Nenhuma observação foi recapturada, duplicada ou apagada. A revisão ativa p147r-theme-metadata-20261105-v2 aponta explicitamente para os fatos da revisão p146-jn-themes-20261105, preservando o last-known-good.

Foram corrigidos sete enquadramentos: cinco variáveis de execução geral, uma variável de execução penal e o rótulo de sentença criminal de feminicídio. O dicionário oficial mantém tbaixex1 como execução penal e sentjudcrimfem como sentença judicial criminal. Conciliação e justiça criminal possuem fatos persistidos e foram reconciliadas.

A camada temática agora separa execução fiscal, execução geral e execução penal; temas apenas documentados ou juridicamente bloqueados permanecem no catálogo com zero indicadores operacionais. P14.8 pode consumir os serviços server-side, sem acesso direto ao banco ou a fontes externas.