# Explorador de Tribunais V1.1 — Auditoria inicial e final

Documentação consolidada (3 arquivos, mesma convenção do programa V1: `AUDITORIA.md` +
`IMPLEMENTACAO.md` + `RELATORIO_FINAL_V11.md`, em vez dos 7 nomeados no mandato — decisão já
endorsada pelo usuário na fase V1 e reaplicada aqui pelo mesmo motivo: menos arquivos fragmentados,
sem perder nenhum conteúdo).

## Diagnóstico confirmado (mandato §0)

O usuário avaliou screenshots reais da V1 e encontrou um problema real de hierarquia de informação,
não do conceito analítico: a página inicial de `/judiciario/tribunais` só mostrava 2 cartões de
entrada ("Encontrar um tribunal" / "Investigar um indicador") e 5 perguntas — nenhuma instituição
real aparecia antes de um clique. Quem queria simplesmente abrir o STF ou o TJSP era obrigado a
clicar, escolher um modo e só então buscar.

## O que já existia (reaproveitado, não reconstruído)

Auditoria do backend e dos componentes confirmou que quase toda a infraestrutura necessária já
existia, sem precisar de nenhuma mudança de schema/collector:

- `getJudiciaryTribunalDirectory`/`loadJudiciaryTribunalDirectory` (`postgres-judiciary-serving.ts`,
  `lib/judiciary.ts`) já suporta `search`, `branchCode`, `uf`, `page`, `pageSize` e devolve `total`
  real do filtro aplicado — exatamente o que o diretório paginado precisa, sem nenhuma query nova.
  Confirmado ao vivo: sem filtro, `total` = 93 (cadastro completo), nunca uma constante hardcoded.
- `DataTable` (`components/data-table.tsx`) já renderiza tabela no desktop e lista de cards no
  mobile automaticamente, com paginação Anterior/Próxima acessível — resolve de graça o requisito
  de "tabela no desktop, linhas compactas no mobile" (mandato §2.4/§6) sem inventar um 2º layout.
- `brlShort`/`fmt` (`lib/security/format.ts`) já é a formatação pt-BR compacta ("R$ 44,6 mi", "R$
  20,5 bi") usada por outros domínios (educação, infraestrutura) — confirmado via
  `Intl.NumberFormat('pt-BR',{notation:'compact'})` que produz exatamente esse formato.
- `AutoSubmitSelect`, `SearchBar`, `ChapterNav`, `MethodologyPanel`, `MesaBar` (da V1): reaproveitados
  sem alteração de contrato.

## 3 achados reais confirmados ao vivo antes de programar

1. **Siglas de "Acesso rápido" validadas contra o catálogo real** — consulta direta (leitura, sem
   escrita) a `civica_jud.jud_tribunal` confirmou que STF, STJ, TJSP, TJES e TJRJ existem com os ids
   canônicos `JUD:TRIBUNAL:<SIGLA>` esperados, nenhum slug inventado. Total do catálogo confirmado
   em 93 na mesma consulta.
2. **A narrativa do painel contextual não formatava valores em R$** — `narrativeFor()`
   (`context-panel.tsx`) usava `min.toFixed(3)`/`max.toFixed(3)`/`median.toFixed(3)` direto no valor
   bruto, ignorando a função `formatValue` já disponível no mesmo escopo. Para indicadores de
   despesa isso produzia frases como "variando de 44600000.000 a 20500000000.000" — reais crus, sem
   separador nem abreviação. Esse é o bug real por trás da reclamação do mandato §7.1.
3. **A distribuição de despesa total é genuinamente assimétrica** — mín. R$ 44,6 mi, máx. R$ 20,5
   bi, 3 ordens de grandeza de distância. Num eixo linear, ~85% dos pontos colapsam visualmente
   perto da base. Confirmado visualmente nas capturas antes da correção.

## Auditoria final (pós-implementação)

- `npm run typecheck`/`build` isolados (packages/db + apps/web): sem erros.
- 42/42 testes E2E (`tests/e2e/p148-judiciario.spec.ts`) — 9 novos cobrindo os critérios de aceite
  do mandato §10, 3 pré-existentes atualizados deliberadamente (ver `RELATORIO_FINAL_V11.md`).
- axe-core real (não estimado): 0 violações em 9 combinações de estado × tela.
- Overflow horizontal medido (`scrollWidth - clientWidth`), nunca estimado: 0 em 320–1920px, em
  diretório, busca, Canvas (linear e log) e Mesa.
- Skip link ("Pular para o conteúdo") verificado via teclado real: após ativado, o topo de `<main>`
  alinha exatamente com a base do cabeçalho fixo (73px = 73px) — sem sobreposição.
- Nenhuma migration, tabela nova ou collector tocado — confirmado via `git status` e leitura de
  todo diff antes de qualquer commit.
