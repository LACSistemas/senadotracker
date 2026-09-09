# TSE — bens e prestação de contas eleitoral

O conjunto de 2022 separa bens declarados, receitas e despesas. Todos se ligam à candidatura por `SQ_CANDIDATO`; cada versão/retificação é mantida, em vez de sobrescrever silenciosamente a anterior.

- Bens: identificação, tipo, descrição e valor declarado. Valor é convertido para centavos; o total exibido soma a versão ativa por candidatura e deve coincidir com o arquivo original.
- Receitas: doador/contraparte, documento quando publicado, espécie/categoria, descrição, data e valor.
- Despesas: fornecedor/contraparte, documento quando publicado, categoria, descrição, data e valor.
- Contas são fluxos de campanha e bens são estoque declarado; não devem ser somados entre si.
- Retificações ficam em `version`; reconciliação registra contagem e soma por candidatura, tipo e versão.

Como os arquivos oficiais estavam bloqueados para este ambiente em 08/09/2026, bens, receitas e despesas aparecem como indisponíveis até uma execução obter e conciliar os arquivos. Zero não é exibido como se fosse valor declarado.
