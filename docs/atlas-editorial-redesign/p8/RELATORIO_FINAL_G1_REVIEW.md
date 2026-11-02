# Relatório final — P8.7: Release Candidate para aprovação do Gate G1

## 1. Resumo executivo

P8.7 é o ciclo final de refinamento depois que o usuário confirmou a direção visual de P8 (P8.0–P8.6) como
"substancialmente superior". Não houve reconstrução: 4 correções reais de P0 (acessibilidade e qualidade),
2 melhorias estruturais de P1 (navegação mobile por capítulo; usabilidade do Atlas Vivo no mobile), um
refinamento editorial de identidade visual nos 5 temas (ícone por capítulo, com Bem-estar priorizado como
o mandato pediu), e uma investigação real (não suposição) de desempenho. Tudo verificado com build
isolado, e2e real (68/68 repetidos a cada bloco) e, pela primeira vez no programa inteiro, axe-core
executado de verdade.

## 2. Status inicial

Branch `post-migration`, 4 commits de P8 confirmados antes de iniciar (`83bfd62`, `e2e3f11`, `6639f64`,
`301f204`), working tree limpa exceto os arquivos de scratch de outras frentes já identificados em sessões
anteriores (não tocados). Nenhuma suposição feita sobre o estado — verificado por `git log`/`git status`
antes do primeiro código escrito.

## 3. Problemas confirmados (reais, com evidência)

1. Skip-link sem alvo em todas as 14 rotas territoriais (`id="conteudo"` nunca existia em `TerritoryFrame`).
2. Aviso real de "key" do React no Atlas Vivo sem seleção (prop nomeada em vez de `children` na fronteira
   Server→Client) — reproduzido de forma determinística em servidor de desenvolvimento frio.
3. 2 violações reais de contraste (`color-contrast`, axe-core): `opacity-70` somada a texto mudo no
   `ChapterNav` sidebar; nota em opacidade dupla no `StatRows` de Infraestrutura.
4. Navegação mobile por capítulo exigia rolagem lateral com muitos itens (Educação, 13).
5. Seleção no Atlas Vivo mobile não dava retorno visível dentro da tela (aside ~700px abaixo do mapa).
6. `loadMunicipalityDiscoveries` bloqueia o `<main>` inteiro carregando 4 páginas de domínio completas só
   para extrair 1-2 KPIs — achado estrutural real de desempenho, confirmado por leitura de código.

## 4. Problemas investigados e descartados

1. **Overflow de 320px em Infraestrutura** (documentado desde P0): reproduzido com medição direta em 2
   territórios × 5 larguras — **não existe mais**, 0px em todos os casos. Provavelmente resolvido como
   efeito colateral de P8.4.
2. **O mapa como causa do LCP alto**: descartado por medição real — o elemento de LCP é sempre um
   parágrafo de texto do hero, nunca o mapa, em todas as medições.
3. **Justificativa anterior do numeral decorativo** ("é `aria-hidden`, logo está isento"): corrigida por uma
   justificativa WCAG mais precisa (texto incidental, SC 1.4.3) — a conclusão de não corrigir se mantém,
   mas agora com o motivo certo.

## 5. Alterações feitas

Ver `P8_7_FECHAMENTO_EXCELENCIA.md` para o detalhe completo de cada uma. Resumo: `id`/`scroll-mt-28` em
`TerritoryFrame`; `searchSlot`→`children` no Atlas Vivo; remoção de `opacity-70` no `ChapterNav`; remoção
de `/80` no `StatRows`; novo `MobileChapterSelect` (substitui a faixa de pílulas abaixo de 1024px); nova
barra fixa de seleção no Atlas Vivo mobile; prop `icon` em `ChapterShell` + 26 ícones aplicados em 4 temas
(6 Bem-estar + 11 Educação + 6 Segurança + 7 Infraestrutura — Saúde preservada sem mudança).

## 6. Arquivos alterados

10 arquivos, todos sob `apps/web/` — `app/layout.tsx` (o skip-link em si) não precisou de mudança, a
correção foi inteiramente no consumidor que não definia o alvo: `components/territory/state-frame.tsx`,
`components/territory/atlas-vivo.tsx`, `app/estados/[uf]/atlas/page.tsx`,
`components/security/chapter-nav.tsx`, `components/infrastructure/infrastructure-ui.tsx`,
`components/security/security-ui.tsx`, `components/wellbeing/wellbeing-page.tsx`,
`components/education/education-page.tsx`, `components/security/security-page.tsx`,
`components/infrastructure/infrastructure-page.tsx`.

## 7. Testes executados

68 e2e (suíte territorial completa: `p14-territorio-executivo`, `infraestrutura-p137`, `seguranca-p98`,
`wellbeing-p128`) repetidos depois de cada bloco de mudança (A, B, C) — 4 rodadas completas, nenhuma
regressão real em nenhuma (1 flake de contenção de paralelismo já documentado desde P7, confirmado por
reexecução isolada em todas as ocorrências). axe-core: 9 rotas mínimas do mandato × 2 larguras = 18
combinações na rodada inicial, mais reverificações pontuais depois de cada correção. Teste de interação
real do skip-link, da busca do Atlas Vivo e do seletor mobile de capítulo (Playwright, não só leitura de
código). Medição de overflow em 2 territórios × 5 larguras. Lighthouse (performance + acessibilidade) em 2
rotas, 3 execuções na visão municipal para checar variância.

## 8. Testes não executados

- Varredura completa de axe-core nas 5 páginas de estado além de RJ (ES/RR foram cobertos em P8.6 para
  overflow, não para axe-core nesta fase).
- Teste de leitor de tela real (NVDA/VoiceOver) — fora do alcance desta sessão; a verificação de
  acessibilidade foi automatizada (axe-core) + manual de teclado, não com tecnologia assistiva real.
- RUM/Core Web Vitals de campo — não existe no produto, registrado como `NOT_EVALUATED` desde P7/P8.6,
  mantido assim aqui.
- Teste de toque real em dispositivo físico — toda a verificação mobile foi feita por viewport emulado
  (Playwright), não por um aparelho real.

## 9. Screenshots comparativos

`artifacts/p8-7-mobile-nav/` (seletor de capítulo, 320/390/768px, fechado e aberto), `artifacts/
p8-7-atlas-mobile/` (barra fixa de seleção, antes/depois), `artifacts/p8-7-bemestar/` e `artifacts/
p8-7-icons/` (ícones de capítulo nos 4 temas). Revisados diretamente por mim antes de cada commit, não só
por execução de script.

## 10. Resultados de acessibilidade

Ver `P8_7_FECHAMENTO_EXCELENCIA.md` §P8.7-A.2. axe-core real pela primeira vez no programa: 0 violações em
5 das 9 rotas auditadas; 2 violações reais corrigidas (confirmadas eliminadas por reexecução); 1 violação
remanescente em 4 temas, investigada e deliberadamente não corrigida com justificativa WCAG precisa
(texto incidental, SC 1.4.3). Lighthouse (lab) como sinal complementar: 98/100 em 2 rotas, único item
("skip-link") confirmado pré-existente a P8, fora do escopo territorial.

## 11. Resultados de desempenho

Ver `P8_7_FECHAMENTO_EXCELENCIA.md` §P8.7-D. Lab apenas (`simulate` throttling, mobile). LCP ~2,8-2,9s
(3 medições na visão municipal), elemento de LCP sempre texto do hero (nunca o mapa — descartado por
medição real). CLS 0, TBT dentro da referência. Causa estrutural real localizada (não corrigida: risco
desproporcional ao escopo desta fase). Campo: `NOT_EVALUATED` (sem RUM no produto).

## 12. Integridade dos dados

Nenhuma mudança de lógica de cálculo, agregação, elegibilidade de comparação ou formatação de valor em
toda a fase — confirmado por leitura: toda alteração foi de prop/composição/estilo/navegação, nunca de
dado. Os 68 e2e que verificam valores exatos, comparações válidas, ausência honesta e supressão por
pequeno número continuam passando sem alteração de asserção.

## 13. Segurança arquitetural

`git diff --stat` de todos os commits de P8.7 contra `packages/db`, `scripts/collect`, `scripts/exec`:
diff vazio. Nenhuma migration, backfill, mudança de schema, reinício de collector ou interrupção de
processo em execução. Toda verificação usou build/servidor isolados (`NEXT_DIST_DIR`, portas 3175-3179);
a porta 3000 do usuário foi confirmada intacta antes e depois de cada bloco de trabalho.

## 14. Resíduos conhecidos

1. Numeral decorativo de capítulo com contraste insuficiente — deliberadamente não corrigido (texto
   incidental, WCAG SC 1.4.3), ver §10.
2. Causa estrutural do LCP alto na visão municipal localizada, não corrigida (risco desproporcional).
3. Hit-area de municípios pequenos no Atlas Vivo — mitigada (busca/teclado/foco já existentes), não
   resolvida com nova engenharia geométrica.
4. Refinamentos mais profundos de §7.2/7.3/7.5 do mandato (ritmo editorial de Educação, Segurança,
   Infraestrutura) não implementados nesta fase — recomendação futura, não lacuna escondida.
5. Itens herdados de P0-P8.6: resíduo de 7px de overflow (reverificado nesta fase — **resolvido**, não é
   mais um resíduo); composição assimétrica "Objetivo 2" de P6.2 nunca tentada.

## 15. Status dos Gates

| Gate | Status | Evidência |
|---|---|---|
| A — Qualidade funcional | `PASS` | 68/68 e2e em 4 rodadas completas |
| B — Integridade estatística | `PASS` | Nenhuma lógica de dado tocada; e2e de valor exato sem alteração |
| C — Acessibilidade | `PASS_WITH_CAVEATS` | axe-core real executado; 2 violações corrigidas; 1 investigada e justificadamente não corrigida; sem leitor de tela real |
| D — Responsividade | `PASS` | 320/390/768/1280/1440px testados; 0px overflow em toda a verificação desta fase |
| E — Desempenho | `PASS_WITH_CAVEATS` | Lab medido com rigor (3 execuções, elemento de LCP identificado); causa estrutural real localizada, não corrigida; campo `NOT_EVALUATED` |
| F — Excelência visual | `READY_FOR_G1_USER_APPROVAL` | Evidência completa entregue; aprovação final pertence ao usuário, nunca autodeclarada |

## 16. Recomendações futuras não bloqueantes

1. Construir carregadores leves dedicados para `loadMunicipalityDiscoveries` (em vez de reaproveitar 4
   páginas de domínio inteiras) — resolveria a causa raiz do LCP alto na visão municipal.
2. Revisitar §7.2/7.3/7.5 do mandato (ritmo editorial mais profundo em Educação/Segurança/Infraestrutura)
   como uma sub-fase própria, não um ajuste de fechamento.
3. Testar com leitor de tela real (NVDA/VoiceOver) antes de uma eventual certificação formal de
   acessibilidade.
4. Avaliar RUM (Real User Monitoring) se desempenho de campo real se tornar uma prioridade do produto.

## 17. Confirmação: banco e coletores não modificados

Confirmado por `git diff --stat` vazio contra `packages/db`, `scripts/collect` e `scripts/exec` em todos
os commits de P8.7 (`64d78a8`, `2a093d1`, `5eade55`, `4dd2e09`, `a63ee69`). Nenhuma migration, backfill,
reprocessamento, criação de materialização, reinício de collector ou alteração de pipeline. A coleta PNCP
2025-2026 de P9.5, se estava em execução, não foi tocada por nenhum momento desta fase — nenhum comando
desta sessão interagiu com processos Python ou com o pipeline de coleta.

---

**Status final**: `READY_FOR_G1_USER_APPROVAL`. Esta fase não declara G1 aprovado — essa decisão, como o
próprio mandato exige, pertence ao usuário, com a evidência completa (screenshots, testes, auditoria de
acessibilidade real, investigação honesta de desempenho) entregue para essa revisão.
