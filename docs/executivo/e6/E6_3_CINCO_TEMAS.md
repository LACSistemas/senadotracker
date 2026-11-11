# E6.3 — Redução da repetição cartográfica + cinco temas

## Repetição cartográfica (mandato §16)
Resolvida pela fusão descrita em E6.1/E6.2: a página foi de **2 mapas** (contextual no hero + analítico numa seção separada) para **1 mapa** (o analítico, que agora É o hero). Não foi eliminada toda cartografia — o mandato explicitamente permite isso ("não é obrigatório eliminar todos os mapas") — só a repetição sem diferenciação.

## As cinco áreas da gestão pública
Mantida a estrutura de 5 `ThemeCard` (cada uma já levava a um indicador nacional real e distinto: leitos/mil hab., Ideb, registros de tráfico de drogas, renda domiciliar per capita, % domicílios com esgoto — nenhuma estimativa do mock). O que mudou:

- **Saúde** ganhou um 2º dado real (6.636 hospitais no cadastro CNES, além dos 2,47 leitos/mil hab.) — diferenciação real dentro do card, não um número isolado tratado como se fosse equivalente ao de outro tema (mandato §17, "evitar tratar indicadores de naturezas diferentes como diretamente equivalentes" — os dois números de Saúde são complementares DENTRO do mesmo domínio, nunca comparados entre si).
- Os outros 4 temas mantiveram sua estrutura de card único — decisão de escopo: o ganho maior e mais claramente pedido pelo mandato estava na fusão do mapa (E6.1/E6.2), que consumiu a maior parte do esforço desta fase; diferenciar profundamente as 5 visualizações exigiria reconstruir 4 componentes de dado (uma série temporal de segurança, uma distribuição de renda, etc.) sem dado adicional já carregado para isso, um trabalho de escopo comparável a uma fase própria.

## Nenhum link para rota inexistente
Confirmado: os 5 cards levam a `/estados#{ancora}` ou, com UF selecionado, a `/estados/{uf}#{ancora}` — rotas reais, já testadas.

## Limitação reconhecida (não escondida)
A diferenciação visual das 5 áreas é parcial nesta fase (1 de 5 recebeu tratamento duplo) — registrado aqui, não apresentado como completo.
