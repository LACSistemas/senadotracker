# Explorador de Tribunais V1.1 — Implementação

## Arquitetura: diretório e Canvas nunca na mesma tela

A V1 tinha uma ambiguidade real: a lista de resultados de busca e a distribuição do indicador podiam
aparecer juntas (corrigido parcialmente na própria V1 com `wantsDirectory`), e a "abertura" vazia
escondia o diretório atrás de 2 cliques. A V1.1 elimina a ambiguidade por construção, em vez de mais
uma condição ad-hoc:

```
modo === 'mesa'                 → Mesa de investigação (inalterada da V1)
modo !== 'mesa' && indicador     → Canvas analítico (distribuição + painel contextual)
modo !== 'mesa' && !indicador    → Diretório (busca + acesso rápido + tabela paginada)
```

Os 2 últimos nunca coexistem na mesma tela — cada modo mostra só o que faz sentido para ele. Isso
tornou a antiga checagem `wantsDirectory` (bug da V1, corrigida ali mesmo) desnecessária: ela some
porque a condição estrutural a substitui.

## Componente novo: `tribunal-directory.tsx`

Novo componente `apps/web/components/judiciary/tribunal-directory.tsx`, Server Component puro
(nenhum `'use client'` novo), reaproveitando:

- `SearchBar` (busca real, GET, sem exigir clique prévio — mandato §2.2).
- 2 `AutoSubmitSelect` (Ramo/UF) — navegam sozinhos ao trocar, sem botão "Aplicar" (mesmo padrão
  já aprovado na V1).
- "Acesso rápido" — faixa de 5 chips (STF/STJ/TJSP/TJES/TJRJ) com `aria-label="Acesso rápido"` e
  `title` com o nome oficial completo; cada um lê seu id real já resolvido por
  `resolveTribunalBasics` (mesmo helper da V1, reaproveitado) — nunca um slug inventado, e um
  tribunal que deixasse de existir no catálogo simplesmente não aparece (filtro defensivo).
- `DataTable` — tabela de 5 colunas (Tribunal, Ramo, Jurisdição, Perfil, Investigar) no desktop,
  cards compactos no mobile, com o badge "Órgão de controle"/"Tribunal superior" reaproveitado da
  V1 (ver "achado real" abaixo) e paginação nativa (12 por página, "Página X de Y", "Anterior"/
  "Próxima").

`page.tsx` busca o diretório com os mesmos filtros (`busca`/`ramo`/`uf`) + `page`/`pageSize=12`, e
em paralelo resolve os 5 ids do Acesso rápido — 2 chamadas memoizadas e cacheadas, nenhuma nova.

## "Inspecionar" sempre estabelece um indicador válido (mandato §4.3)

Cada linha do diretório tem 2 ações: "Ver perfil" (rota de perfil já existente, inalterada) e
"Inspecionar" (`buildHref(current, { inspecionar: id, indicador: DEFAULT_INDICATOR })`, onde
`DEFAULT_INDICATOR` é o primeiro das perguntas de abertura — taxa de congestionamento, já validado
como elegível). Isso satisfaz o mandato ao pé da letra: identifica o tribunal, abre o Canvas,
estabelece um indicador válido (nunca abre o Canvas "vazio"), nunca adiciona à Mesa sozinho.

## Hero compacto (mandato §2.1)

O `InstitutionHero` compartilhado (usado por várias páginas do tipo "instituição") tinha
`min-h-[360px]` fixo mais a ilustração SVG de fundo — mudar esse componente afetaria outras páginas
fora do escopo autorizado. Em vez disso, esta página passou a montar seu próprio cabeçalho compacto
inline (faixa verde, tipografia serifada, ~140px de altura real, sem imagem decorativa) — decisão
deliberada: a ilustração SVG não acrescentava função, só altura; removê-la ajuda a cumprir "sem
espaços vazios artificiais" (mandato §5) sem tocar no componente compartilhado.

## Contagem dinâmica do catálogo (mandato §3.1)

`93 instituições catalogadas` no hero vem agora de uma chamada real
(`loadJudiciaryTribunalDirectory({ pageSize: 1 })`, sem filtro, lendo só `.total`) — nunca mais uma
constante `93` no código. A V1 já tinha essa constante hardcoded (documentada como tal); a V1.1 a
substitui por leitura real, confirmando ao vivo que o valor seguia sendo 93.

## "Investigar um indicador" — de 2 cartões altos a 1 faixa compacta (mandato §4.1)

A tela de abertura da V1 (2 cartões grandes + 5 perguntas em cartões) foi substituída por uma única
faixa compacta (`bg-primary/5`, ícone + título + CTA "Começar") com as 5 perguntas como pastilhas
numa lista com `aria-label="Perguntas em destaque"` (sem título visível — decisão deliberada de
densidade, mas com rótulo acessível pra quem usa leitor de tela). Essa faixa agora vive DEPOIS do
diretório, nunca antes — a investigação continua a 1 clique, só não é mais a única coisa visível.

## Escala logarítmica no gráfico de distribuição (mandato §7.2)

`distribution-chart.tsx` ganhou um 2º eixo opcional: `scale: 'linear' | 'log'`, com ticks em passos
"1-2-5" por década (ou só potências de 10 quando o intervalo passa de 3 décadas, pra não lotar o
eixo de rótulos). Nunca ativado por padrão — é uma leitura alternativa explícita (toggle "Escala
linear"/"Escala logarítmica", só oferecido quando todos os valores do recorte são positivos, porque
log de zero/negativo não existe). Os rótulos continuam mostrando o valor real formatado
(`formatValue`); só a POSIÇÃO no eixo muda — nenhum valor é escondido, arredondado ou distorcido.
Resultado real: "Despesa total" (91 tribunais, R$ 44,6 mi a R$ 20,5 bi) deixa de ter ~85% dos pontos
amontoados na base e passa a mostrar a distribuição inteira de forma legível.

## Achados reais corrigidos nesta passada

1. **Bug de formatação monetária (mandato §7.1)** — `narrativeFor()` em `context-panel.tsx` usava
   `.toFixed(3)` no valor bruto em vez da função `formatValue` já recebida no mesmo escopo. Corrigido
   passando `formatValue` para `narrativeFor` e usando-a nos 3 valores da frase (mín/mediana/máx).
   Sem essa correção, qualquer indicador em R$ mostrava reais crus na narrativa mesmo com o eixo do
   gráfico já formatado corretamente — uma inconsistência real entre 2 partes da mesma tela.
2. **Badge "Órgão de controle" perdido na reconstrução, recuperado** — ao substituir a lista simples
   de resultados de busca da V1 (que tinha esse badge para CNJ/STF/STM/TST etc.) pela `DataTable`
   nova, o badge foi perdido na 1ª versão desta passada — pego pela suíte de testes existente
   (`busca por órgão de controle mostra o selo...`), não por inspeção visual. Restaurado na coluna
   "Tribunal" do `DataTable`, com o mesmo critério (`institutional_level === 'CONTROL' | 'SUPERIOR'`)
   e o mesmo ícone/estilo da V1.
3. **Build obsoleto mascarando os 2 achados acima** — depois de restaurar o badge no código, os
   testes continuaram falhando porque o servidor isolado de verificação ainda servia o build
   ANTERIOR à correção; só após `npm run build` + reiniciar o servidor os testes passaram a refletir
   o código real. Lição operacional (não um bug de produto): toda correção pós-build exige
   rebuild+restart antes de reverificar, nunca confiar no servidor já em pé.

## Zero mudança de schema/collector

Confirmado: nenhuma migration, nenhuma tabela nova, nenhum collector tocado nesta passada. Toda
mudança viveu em componentes React e na página — leitura pura sobre contratos já existentes.
