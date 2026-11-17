# Explorador Analítico de Tribunais V1 — Relatório final (X7–X8)

## Gates

- **X0 — Auditoria e contratos**: concluído (`AUDITORIA_E_CONTRATOS.md`). 4 achados reais de
  integridade corrigidos; taxonomia de 4 abas/19 indicadores validada ao vivo contra o catálogo.
- **X1–X6 — Construção**: concluído (`IMPLEMENTACAO.md`). Rota única reescrita, 5 componentes
  novos, arquitetura 100% `<Link>` (exceto o `TribunalMultiSelect` já existente), estado em 2
  camadas via querystring, narrativas determinísticas, perguntas de abertura/relacionadas.
- **X7 — Verificação**: concluído, detalhado abaixo.
- **X8 — Entrega**: este relatório; status final na última linha.

## Verificação técnica

- `NEXT_DIST_DIR=.next-p1445 npm run typecheck` e `npm run build` isolados (packages/db +
  apps/web) — sem erros, sem afetar o `.next` do servidor de desenvolvimento do usuário.
- Servidor isolado em `127.0.0.1:3999` (variáveis de ambiente lidas do `.env` da raiz do repo sem
  nunca imprimir/gravar seu conteúdo).

## Jornadas percorridas (Playwright, capturas reais inspecionadas)

Abertura (entrada dupla + perguntas) · busca por tribunal · busca por "CNJ" (selo de órgão de
controle) · inspeção de tribunal com dado (Estado B) · inspeção de tribunal sem dado no recorte
(Estado C, ausência declarada, nunca zero) · adicionar à Mesa · Mesa com 2 tribunais, 4 abas ·
Mesa com 1 tribunal (nunca tenta comparar) · indicador não comparável dentro da Mesa (tratamento
honesto, nunca um gráfico fabricado) · remover da Mesa · voltar à Distribuição · abrir perfil do
tribunal e voltar pela nova navegação · compartilhar URL (reabrir o link reproduz o estado exato)
· alternar indicador dentro de uma aba · limite de 3 na Mesa (4º tribunal recusado com explicação).

Nenhum erro de console/`pageerror` em nenhuma das jornadas.

## Acessibilidade (axe-core real, injetado localmente, 4 estados × 2 larguras)

4 violações reais encontradas e corrigidas (detalhe em `IMPLEMENTACAO.md` item 6):
`nested-interactive` (grave), `heading-order` (moderado, ×2), `page-has-heading-one` (moderado),
`scrollable-region-focusable` (grave, mobile). **Resultado final: 0 violações** nas 4 execuções
seguintes à correção.

## Responsividade

Overflow horizontal medido (não estimado, via `document.documentElement.scrollWidth -
clientWidth`) em 320/375/390/430/768/1024/1280/1440/1920px, nos 4 estados centrais (abertura,
distribuição com painel, Mesa de 2 abas, busca). **0 overflow em todas as 36 combinações.**

## Testes automatizados

`tests/e2e/p148-judiciario.spec.ts` — 9 testes novos adicionados (abertura; selo de órgão de
controle; min/mediana/máx da distribuição; inspeção sem adição automática à Mesa; ausência honesta
no Estado C; Mesa de 2 tribunais e 4 abas; Mesa de 1 tribunal nunca compara; indicador não
comparável tratado com honestidade; CTA atualizado no perfil; overflow em 390px nos 4 estados) +
1 teste pré-existente dividido em 2 (abertura do Explorador substituiu a extinta busca de "Órgão de
controle" na listagem antiga) + 2 asserções pré-existentes (não desta fase) corrigidas por terem
ficado desatualizadas em trabalho anterior já commitado (escopo de regex e texto reescrito — ver
`IMPLEMENTACAO.md` item 7). **Resultado final: 33/33 passed.**

## Integridade estatística e metodológica (checklist do mandato)

- Nenhum agregado nacional inventado: toda estatística de conjunto (mín./mediana/máx./contagem)
  é calculada a partir dos próprios pontos já carregados, nunca de uma média de razões já oficiais.
- Nenhuma instituição descartada silenciosamente: a correção do `LEFT JOIN` em
  `getJudiciaryComparison` garante que um tribunal selecionado sem dado aparece como ausência
  explícita (Estado C / `null` na tabela da Mesa), nunca desaparece nem é tratado como zero.
- `comparison_eligible`/`aggregation_allowed` respeitados em toda a taxonomia — nenhum indicador
  `!comparison_eligible` é oferecido como opção na Mesa.
- Revisão de publicação (`jud_publication_revision`, scope `JN_STATISTICS`) agora filtrada em
  TODAS as leituras usadas pelo Explorador (as 2 que não filtravam, corrigidas — achado do X0).

## Zero mudança de schema/collector

Confirmado: nenhuma migration, nenhuma tabela nova, nenhum collector tocado. Todas as mudanças de
backend (`postgres-judiciary-serving.ts`) são extensão de leitura (filtro de revisão, `LEFT JOIN`)
sobre tabelas e colunas já existentes.

## Limitações conhecidas (documentadas, não escondidas)

- Sem medição de performance de campo (RUM/LCP/INP/CLS) — mesma limitação já registrada no
  programa de redesign anterior (J0-J7), sem instrumentação de campo disponível neste ambiente.
- Nenhuma fotografia nova — mantida a mesma ilustração SVG já existente, decisão herdada do
  programa anterior (evita risco de licenciamento sem necessidade real).
- `seat_uf` ausente para parte dos tribunais no catálogo: gap de dado pré-existente, já documentado
  2× no programa anterior, fora do escopo de um redesign de frontend.
- Adicionar um 3º tribunal à Mesa reaproveita o fluxo de busca da Distribuição — não há (ainda) uma
  busca embutida dentro da própria Mesa expandida nesta versão.
- Nenhuma comparação pixel a pixel contra os mocks do mandato foi possível: as imagens não estavam
  acessíveis neste contexto de execução; a implementação seguiu a especificação textual à risca,
  com verificação visual real (capturas inspecionadas, não só geradas) em cada estado.

## Escopo de rota (confirmado, nada fora do autorizado)

`/judiciario`, `/judiciario/temas`, `/judiciario/comparar`: intocados. `/judiciario/tribunais/[id]`:
só 1 link de CTA atualizado. Toda a reconstrução viveu em `/judiciario/tribunais`.

## Revisão visual (pós-entrega inicial)

Na 1ª entrega, nenhum mock estava disponível neste ambiente — a construção seguiu só a
especificação textual do mandato (gate X0-X7 acima). O usuário então reprovou o layout e anexou 4
mocks reais (3 telas desktop + 1 sequência mobile de 4 estados). A partir deles, uma 2ª passada
reconstruiu o visual dos 5 componentes do Explorador (mantendo toda a lógica/contratos de dado já
auditados e corrigidos em X0-X7 — nenhuma mudança de backend nesta passada):

- Distribuição: trocado o empilhamento sem eixo (bins) por um gráfico de dispersão de verdade —
  valor no eixo Y (ticks "nice", grade), ranking no eixo X, linha tracejada de mediana, rótulo
  fixado no ponto inspecionado, anotação explicando a leitura do gráfico. Achado real corrigido
  nesta própria passada: o rótulo da mediana (ancorado à direita) caía em cima dos próprios pontos
  perto da mediana — corrigido reservando uma faixa própria, sem nenhum ponto, só para esse rótulo.
- Painel contextual: reconstruído nos 3 estados (conjunto/inspecionado-com-dado/inspecionado-sem-
  dado) com o padrão visual dos mocks (selo do tribunal, barra de posição, callout "O que
  significa?") e reaproveitando o `MethodologyPanel` já existente (progressive disclosure) em vez
  de inventar um texto de metodologia novo.
- Mesa de investigação: abas viraram pílulas com ícone, gráfico de valor atual e evolução lado a
  lado, "Principais leituras" determinísticas (3 frases geradas só por aritmética sobre os dados já
  carregados — maior/menor, diferença %, variação histórica), reaproveitamento do `MethodologyPanel`
  também aqui, exportação CSV, botão "Compartilhar" (copia a URL — a investigação já É a URL, não
  precisa de um "salvar" novo) e "+ Adicionar tribunal" pra completar a Mesa sem sair da tela.
- Barra compacta da Mesa: passou a ficar sempre visível (inclusive vazia, como convite), em vez de
  só aparecer depois da 1ª seleção.
- 2 achados reais de UX corrigidos nesta passada: (1) o filtro "Ramo"/"UF" disparava a MESMA busca
  de diretório que a tela de distribuição já mostra, duplicando a lista de tribunais entre a Mesa e
  o gráfico — corrigido: a lista de resultados só aparece no fluxo "encontrar um tribunal" ou com
  termo de busca real; (2) o cabeçalho da Mesa (`shrink-0` no grupo de botões) não encolhia a tempo
  de caber em 320px — corrigido.
- Testes E2E atualizados para a nova UI (rótulos renomeados: "Perguntas em destaque", "Tribunal
  inspecionado", "Adicionar à Mesa", barra sempre visível) — **33/33 passam**; axe-core **0
  violações** (8 recombinações, 2 larguras); overflow horizontal **0 em 36 combinações** (4
  estados × 9 larguras) após o achado do item (2).

## Status final

**EXPLORADOR_JUDICIARIO_V1_READY_FOR_USER_VISUAL_REVIEW**

A aprovação final de fidelidade visual e experiência pertence ao usuário, conforme o próprio
mandato e a convenção já estabelecida no projeto. Nada foi commitado — aguardando revisão.
