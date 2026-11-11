# E7.2 — "Quem cuida de quê no Brasil?"

## De 3 cartões estáticos para uma experiência por área de política pública
Novo componente `apps/web/components/executivo/federative-explorer.tsx` (`'use client'`, mesmo padrão de estado local de `LegislativeHouseToggle`): 5 pílulas (Saúde/Educação/Segurança/Assistência social/Infraestrutura — ícones resolvidos dentro do componente client, nunca passados como prop de Server Component, ver "Achado real" abaixo); escolher uma troca, sem nova consulta, a pergunta e os 3 blocos União/Estados/Municípios + uma faixa de "Competências compartilhadas".

## Conteúdo institucional (mandato §12.2–§12.3)
Não existe tabela de competências federativas estruturada no banco — o mandato autoriza texto validado em vez de inventar uma funcionalidade de dado inexistente. O texto de cada área cita a base legal real (Lei 8.080/1990 para o SUS, art. 211 da Constituição + Fundeb para Educação, Lei 13.675/2018 — SUSP — para Segurança, Lei 8.742/1993 — LOAS — para Assistência social, Lei 14.026/2020 — marco do saneamento — para Infraestrutura) e evita duas armadilhas explicitamente vedadas:
- **Exclusividade falsa**: nenhum texto atribui uma competência a uma única esfera quando há cooperação real (ex.: Saúde é tripartite por desenho, não por acaso).
- **Hierarquia falsa**: a faixa "Competências compartilhadas" de cada área existe exatamente para marcar onde a cooperação é a regra, não a exceção — nenhum organograma de subordinação foi criado.

## Achado real corrigido durante a implementação: ícones como prop de Server→Client
Primeira versão passava o componente de ícone (`lucide-react`) como propriedade de um array definido no Server Component (`page.tsx`) para o Client Component (`FederativeExplorer`) — isso quebrou a página com erro real em runtime ("Functions cannot be passed directly to Client Components... Only plain objects..."), porque componentes React não são serializáveis através da fronteira server→client. Corrigido: `FederativeArea.icon` agora é uma **string-chave** (`'saude' | 'educacao' | ...`), e o mapa chave→componente (`ICONS`) vive dentro do próprio arquivo client, que pode importar `lucide-react` livremente no bundle do cliente. Confirmado por teste real: a página voltava 500 antes da correção, 200 depois.

## Preservação
O link final "Investigar [Área] em profundidade →" aponta para `/estados` (ou `/estados#{âncora}` para as 4 áreas com âncora real na seção "cinco áreas"), mesmas rotas já testadas — nenhuma rota nova foi criada.
