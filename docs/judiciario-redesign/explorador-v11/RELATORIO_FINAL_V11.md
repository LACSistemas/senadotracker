# Explorador de Tribunais V1.1 — Relatório final

## Gates do mandato

- **Auditoria inicial e final**: `AUDITORIA.md`.
- **Implementação**: `IMPLEMENTACAO.md` — arquitetura, componente novo, 3 achados reais corrigidos.
- **Entrega**: este relatório.

## O que mudou (resumo)

| Antes (V1) | Depois (V1.1) |
|---|---|
| Abertura = 2 cartões de entrada + 5 perguntas, nenhuma instituição visível | Busca + Acesso rápido (5 chips) + tabela paginada de 93 instituições, visível de cara |
| Hero com imagem, `min-h-[360px]` | Hero compacto (~140px), sem imagem decorativa |
| "Investigar um indicador" era metade da tela inicial | Faixa compacta, depois do diretório |
| Narrativa do painel contextual: `.toFixed(3)` no valor bruto (bug real) | Usa `formatValue` — "R$ 44,6 mi", nunca reais crus |
| Distribuição de despesa: só escala linear (pontos colados na base) | Escala logarítmica opcional, explicitamente rotulada |
| Badge "Órgão de controle" só em resultado de busca | Aparece em qualquer linha do diretório, sempre que aplicável |
| Diretório e distribuição podiam duplicar informação (bug conhecido da V1) | Modos mutuamente exclusivos por construção — nunca mais duplicam |

## Verificação técnica

- `NEXT_DIST_DIR=.next-p1445v3 npm run typecheck`/`build` isolados (packages/db + apps/web) — sem
  erros, sem afetar o `.next` do servidor de desenvolvimento do usuário.
- Servidor isolado em `127.0.0.1:3999`, variáveis lidas do `.env` da raiz sem nunca imprimir/gravar
  seu conteúdo.

## Testes automatizados

`tests/e2e/p148-judiciario.spec.ts` — **42/42 passed**:

- 9 testes novos (`describe('V1.1 — Diretório imediato e refinamentos')`): STF/TJSP/TJES
  encontráveis pela busca com perfil real (200), Acesso rápido com os 5 ids reais, filtro de Ramo,
  paginação alcançando a página 2, "Inspecionar" abrindo o Canvas com indicador válido sem mexer na
  Mesa, formatação monetária sem reais crus, escala logarítmica disponível e rotulada.
- 3 testes pré-existentes atualizados deliberadamente (documentado inline em cada um, nunca
  enfraquecido em silêncio): "busca por sigla" agora escopa a ausência de "TJRJ" à tabela de
  resultados (já que o Acesso rápido, fixo, sempre mostra TJRJ — um chip editorial não é um
  resultado de busca); a antiga asserção de "2 entradas" virou uma asserção do diretório imediato
  (busca, acesso rápido, tabela, "Investigar um indicador" visível); 1 comparação de texto virou
  case-insensitive porque o rótulo "Acesso rápido" é `uppercase` via CSS (o `innerText` do
  Playwright reflete o texto transformado, não o literal do JSX).

## Acessibilidade (axe-core real, injetado localmente)

0 violações em 9 combinações de página × largura: diretório (9 larguras de 320 a 1920px), Canvas
com indicador, Canvas com escala logarítmica, Canvas com tribunal inspecionado, busca, filtro de
ramo, Mesa — todas a 320/390/768/1440px.

## Responsividade

Overflow horizontal medido via `document.documentElement.scrollWidth - clientWidth` (nunca
estimado): **0 em todas as combinações testadas**, incluindo as 9 larguras do mandato (320, 375,
390, 430, 768, 1024, 1280, 1440, 1920) na página de abertura.

## Skip link e scroll (mandato §8.1)

Verificado via teclado real (não suposição): após focar e ativar "Pular para o conteúdo", o topo de
`<main>` alinha exatamente com a base do cabeçalho fixo (73px = 73px) — nenhuma sobreposição.
`scroll-mt-20` aplicado ao `<main>` desta rota, escopado só a ela.

## Espaço vazio antes do rodapé (mandato §8.2)

Resolvido como efeito direto do diretório real preencher a tela — não foi necessário nenhum
preenchimento artificial. Confirmado visualmente nas capturas em 1440px e 390px: a sequência
hero → busca/filtros → tabela paginada → faixa de indicador → Mesa compacta → rodapé não deixa
nenhuma região grande sem conteúdo.

## Elementos de desenvolvimento (mandato §8.3)

Nenhum indicador de ambiente de desenvolvimento (overlay do Next.js, badges de HMR) foi tratado como
defeito de produção — o servidor de verificação roda em modo produção (`next build` + `next start`),
que não exibe esses overlays; a distinção do mandato foi respeitada por construção da própria
verificação.

## Integridade e segurança (mandato §9)

Confirmado: nenhuma migration, tabela nova, backfill, collector novo, reprocessamento ou
materialização. Nenhuma mudança em `/judiciario`, `/judiciario/temas`, `/judiciario/comparar`
(continua existindo e funcional), `/executivo`, homepage ou páginas territoriais. O único toque em
`/judiciario/tribunais/[id]` é o já existente da V1 (CTA de comparação), não tocado nesta passada.
Nada foi commitado durante esta implementação.

## Limitações conhecidas (documentadas, não escondidas)

- Nenhuma medição de RUM/LCP/INP/CLS — mesma limitação já registrada nos programas J0-J7 e V1, sem
  instrumentação de campo disponível neste ambiente.
- `seat_uf` ausente para parte dos tribunais no catálogo (coluna "Jurisdição" mostra "—" com
  honestidade) — gap de dado pré-existente, documentado 3× agora, fora do escopo de um redesign de
  frontend.
- A ordenação do diretório é sempre alfabética (nome oficial) — o mandato pede uma ordenação
  "determinística e compreensível, nunca por popularidade sem dados", o que a ordenação alfabética
  já satisfaz; não foi adicionado um seletor de ordenação (o mandato §3.4 pede explicitamente para
  não trazer os filtros estatísticos avançados do Canvas para esta região).
- Não foi implementada busca embutida dentro da Mesa expandida (mesma limitação já documentada na
  V1) — adicionar um 3º tribunal continua reaproveitando o fluxo do diretório.
- Percentis/quartis no gráfico de distribuição foram considerados (mandato §7.2 lista como
  alternativa) e descartados nesta passada: a escala logarítmica já resolve o problema relatado
  (pontos colados na base) sem adicionar uma 2ª camada visual; fica como possível refinamento futuro.

## Status final

**EXPLORADOR_JUDICIARIO_V11_READY_FOR_USER_VISUAL_REVIEW**

A aprovação final de fidelidade visual e experiência pertence ao usuário. Nada foi commitado —
aguardando revisão.
