Plano de reconstrução — /proposicoes, /proposicoes/[id], /proposicoes/explorar
Contexto técnico (o executor precisa saber disto antes de tocar em qualquer coisa)
Stack: Next.js (fork interno — ler apps/web/AGENTS.md e os docs em node_modules/next/dist/docs/ antes de escrever código; APIs podem divergir do treino), React Server Components, Tailwind v4 (@theme inline em apps/web/app/globals.css), sem biblioteca de charts — todos os gráficos são SVG/HTML desenhados à mão (apps/web/components/charts.tsx).
Tokens de marca (globals.css): fundo quente #f3f1eb, primário verde #115b45, série --chart-1..4 (verde, teal #2d7f93, ouro #d39a3c, roxo #8b6aa8), rampa sequencial --map-1..5, escala de avaliação --eval-*. Cartão: --radius-card:1rem, --shadow-card. Serif de display: Georgia via .display-title.
Interatividade existe via client components com useState + SVG manual: ver components/supplier-market-scatter.tsx (scatter com toggle — este é o molde do scatter que você quer) e components/proposition-timeline.tsx.
Dados de proposições vêm de apps/web/lib/data.ts → packages/db/src/proposition-analytics.ts, propositions.ts, panorama.ts. Cache por revisão de publicação já implementado.
0. Diagnóstico honesto — por que hoje está "bland/feia" (não é opinião, é o código)

O executor deve tratar isto como bugs, não estética:

apps/web/app/legislativo/proposicoes/page.tsx está com o encoding corrompido (mojibake). Os eyebrows e labels estão como AÃƒÆ'Ã†â€™... e acentos viraram ? (Proposi??es, composi??o). Isso está renderizando lixo na tela — é a causa nº1 do "feio". O arquivo inteiro precisa ser reescrito em UTF-8 limpo.
CTAs quebradas: os href dessa página apontam para "/legislativo/proposi??es/camara/2610975" e "/legislativo/proposi??es/explorar" — com o mojibake, esses links dão 404. A rota real é proposicoes (ASCII).
Typo de classe: em ThemeBars, className="abs?lute inset-0..." (deveria ser absolute) — o label percentual não posiciona.
Fonte do corpo é --font-sans: Arial. A página flagship usa font-black (Arial bold) no <h1>, ignorando o .display-title serif (Georgia) que dá identidade ao resto do site. Hero em Arial preto = genérico. Trocar a fonte é o maior ganho de "wow" por menos esforço.
Tudo é <div> com width:% — barras chapadas, zero profundidade, zero SVG, zero movimento, zero interatividade (é Server Component puro). Nenhum switch, nenhum reveal, nenhum hover. Estático como um PDF.
Página é uma única linha minificada — impossível de manter/evoluir. Reescrever legível.

Regra de ouro pra esta reforma: nada de dado inventado. Toda função nova segue o padrão da base — retorna cobertura/updatedThrough, e a UI mostra "sem dado publicado" em vez de zero fabricado. Manter a disciplina de "descritivo, não ranking de produtividade".

1. Sistema visual — o "wow factor" (fazer primeiro; vale para as 3 páginas)

Criar apps/web/components/proposicoes/ como namespace dos componentes novos. Antes de desenhar qualquer gráfico, o executor deve reler o skill dataviz (a cor codifica significado, não enfeite).

1.1 Tipografia editorial. Adotar uma fonte de display real via next/font (Google Fonts self-hosted). Recomendo Fraunces (serif com opsz, ar de "revista de dados") para títulos e Inter para corpo/números tabulares — substituindo Arial. Definir novos tokens --font-display e --font-sans em globals.css. Escala de título maior e com text-wrap:balance. Isto sozinho tira 60% do "bland".

1.2 Camada de textura e profundidade. Já existe .surface-grid. Adicionar:

gradientes sutis verde-escuro→verde nos headers de seção (não flat);
--shadow-card já pronto — usar consistente;
um "hairline" superior colorido por tipo de seção (a página já flerta com border-t-4).

1.3 Motion (com respeito a prefers-reduced-motion, que já está no CSS). Criar components/proposicoes/reveal.tsx (client) com IntersectionObserver: barras/números fazem count-up e as faixas "crescem" ao entrar na viewport. Nada de bibliotecas — useEffect + requestAnimationFrame. Isso transforma as faixas estáticas atuais em algo vivo.

1.4 Componentes-base novos (reutilizáveis nas 3 páginas):

AnimatedBarStrip — a faixa horizontal empilhada (substitui ShareStrip/ThemeBars), com hover que destaca segmento + tooltip acessível, e count-up.
FunctionalGroupLegend — legenda clicável (o "revelar siglas").
StatFigure — número editorial grande com count-up e nota de cobertura (padroniza os "KPIs" que hoje são texto solto).
CalendarHeatmap (SVG) e StageScatter (adaptar do supplier-market-scatter), detalhados na §3.

1.5 Switch global Congresso | Câmara | Senado + período. Client component HouseScopeToggle (components/proposicoes/scope-toggle.tsx) estilo segmented-control. Decisão de arquitetura: o server busca o bundle das três visões de uma vez (Congresso = agregado só quando comparável; senão mostra Casas lado a lado) e um client shell alterna a visão sem reload — mais fluido que searchParams. Período (ano) vem de publishedPropositionDashboard que já aceita year.

2. Backend — funções de dados novas (em packages/db/src/proposition-analytics.ts, expostas via apps/web/lib/data.ts)

As seções que você pediu precisam de dados que hoje não existem agregados. Adicionar (com testes em tests/unit/, seguindo propositions.test.ts):

Função nova	Alimenta a seção	Fonte
proposalFunctionalOverview(db, scope) — grupos funcionais com contagem/share + topTypes, para Congresso/Câmara/Senado num só retorno + flag comparable	§3.1 "O Congresso está fazendo o quê?"	proposalGroupSummary (já existe) agregado nas duas Casas
principalStageFlow(db, source, year) — contagem de matérias principais por macroestágio (Apresentação→Rito→Instrução→Pauta→Deliberação→Pós-deliberação→Desfecho)	§3.2 "rio de tramitação"	publishedHouseOperations.stages (já existe: presented/rapporteur/agenda/voted/decision/norm) — só reprojetar rótulos
principalStalenessBuckets(db, source) + principalStalenessPoints(db, source) — por matéria principal: daysSinceLastObservedEvent = hoje − max(occurred_at) em legislative_complements, e o macroestágio corrente; buckets <7/7–30/30–90/90–180/180+ e pontos p/ scatter	§3.2 "há quanto tempo sem movimentação" + scatter	legislative_complements (tem proposal_id, occurred_at, kind)
`activityDnaByAuthor(db, {scope, dimension:'party'	'member'})` — distribuição normalizada de cada parlamentar/partido pelos grupos funcionais; distinguir **proposições distintas / autoria principal / coautoria / vínculos**	§3.3 "DNA da atividade"	proposal_authors ⋈ proposals.payload.functionalGroup
`activityRhythm(db, {scope, mode:'presented'	'events'})` — série mensal empilhada por grupo funcional	§3.4 "O ritmo do Legislativo"	proposals.payload.presentedAt (mês) e legislative_complements.occurred_at
activityCalendar(db, scope, year) — contagem diária de eventos (estilo GitHub)	§3.4 heatmap	legislative_complements.occurred_at
recentLegislativeEvents(db, scope, days=7) — eventos tipados (nova matéria / mudança de estágio / substitutivo / decisão / nova norma / resposta institucional), não "últimos cadastrados"	§3.5 "O que acabou de mudar?"	estender proposalRecentActivity categorizando kind
editorialFacts(db, scope) — frases determinísticas derivadas dos números (§6)	camada editorial	reaproveita os agregados acima

Todas retornam { ...dados, coverage, updatedThrough, comparable? }. Adicionar um único propositionOperationalBundle() em lib/data.ts (com cachedRead) que compõe tudo para a home, no espírito do propositionFlagship atual.

3. /proposicoes — nova arquitetura seção a seção

Reescrever apps/web/app/legislativo/proposicoes/page.tsx do zero (legível, UTF-8), como uma casca fina que monta seções client/server. Manter LegislativeSubnav. Ordem narrativa nova:

Hero editorial (substitui o header atual). Uma frase-tese grande em serif (não 4 KPIs), gerada da base via editorialFacts, ex.: "Em 2026, a maior parte da atividade registrada não foi a apresentação de novas leis." Sublinha com uma micro-faixa animada. Logo abaixo, o HouseScopeToggle (Congresso/Câmara/Senado + ano) que passa a reger a página inteira.

§3.1 — "O Congresso está fazendo o quê?" (§ nova, prioridade máxima do usuário)

Frase editorial + grande faixa horizontal (AnimatedBarStrip) dividida nos 10 grupos funcionais em linguagem humana primeiro, sem siglas. Mapa verbo→grupo:
Criar ou alterar normas → proposicoes_legislativas_principais
Fazer requerimentos → requerimentos
Modificar textos → emendas_substitutivos
Analisar matérias → pareceres_relatorios
Intervir na votação/tramitação → instrumentos_votacao_tramitacao
Recomendar providências → indicacoes_sugestoes
Comunicar institucionalmente → mensagens_comunicacoes_institucionais
Documentar / oficiar → oficios_documentos
Contestar e peticionar → recursos_representacoes_peticoes
Atos especiais → atos_documentos_especiais
Clicar no segmento revela as siglas (topTypes já vem de proposalGroupSummary) — FunctionalGroupLegend com expand.
Congresso agregado só quando comparable; senão, Câmara e Senado lado a lado.

§3.2 — "Onde estão as matérias legislativas principais?" (só aqui entra "andamento", só para o grupo principal)

Rio de tramitação (não funil): principalStageFlow renderizado como fluxo horizontal com espessura proporcional (SVG), macroestágios Apresentação → Rito → Instrução → Pauta → Deliberação → Pós-deliberação → Desfecho. Números no estilo "1.420 em instrução · 380 prontas para pauta · 170 com deliberação observada · 42 com desfecho terminal".
"Há quanto tempo sem movimentação observada": barras dos buckets <7 / 7–30 / 30–90 / 90–180 / 180+ (principalStalenessBuckets). Terminologia exata: "Sem movimentação observada há mais de 90 dias" — nunca "emperrada".
Scatter StageScatter (adaptar supplier-market-scatter.tsx): X = dias desde o último evento observado, Y = macroestágio, cada ponto = matéria principal (link pro detalhe). Hover com tooltip acessível.

§3.3 — "Quem está fazendo o quê?" (DNA da atividade legislativa) — distribuições, não ranking

Toggle Partido | Parlamentar. Para cada um, uma barra de composição pelos grupos funcionais (activityDnaByAuthor), ex.: Principais 22% · Requerimentos 34% · Emendas 12% · Pareceres 18% · Procedural 8%.
Visão geral em medianas/distribuições ("Deputados, em mediana, distribuem sua atividade assim; senadores assim") ou matriz partido × tipo normalizada por nº de parlamentares (reaproveitar ReachMatrix de charts.tsx).
Rótulos sempre distinguindo proposições distintas / autoria principal / coautoria / vínculos. Nada de "score".

§3.4 — "O ritmo do Legislativo" (o "quando")

Série temporal mensal empilhada por grupo funcional (activityRhythm; adaptar StackedBarChart/AreaTrend). Toggle Novas proposições | Eventos de tramitação.
Secundário: calendário anual estilo GitHub (CalendarHeatmap novo, SVG) — clicar num pico revela o que aconteceu no dia.

§3.5 — "O que acabou de mudar?" (seção viva, substitui "últimos cadastrados")

Cards horizontais de eventos tipados dos últimos 7 dias (recentLegislativeEvents): Nova matéria principal · Mudança de estágio · Alteração de texto (substitutivo) · Decisão · Nova norma · Resposta institucional. Cada card linka ao detalhe.

Reaproveitar o caso MPV 1343/2026 (proposalRelationSummary) como seção "caso excepcional/didático" — mas redesenhada com os componentes novos (hoje é a ShareStrip chapada). E manter o CTA final para /explorar com o href correto.

Camada editorial entre visualizações (§6): intercalar frases determinísticas de editorialFacts (nunca interpretação política de IA), ex.: "Requerimentos representam X% da atividade registrada no período." / "Saúde aparece principalmente por projetos de lei e requerimentos de informação." / "Entre matérias principais com histórico, Y% tiveram movimentação nos últimos 30 dias."

4. /proposicoes/explorar (apps/web/app/legislativo/proposicoes/explorar/page.tsx)

Já é funcional e mais limpa que a home; o trabalho é elevar à mesma linguagem visual, não reescrever a lógica:

Aplicar tipografia/tokens novos; cards de resultado com hover e hierarquia melhor (o pill de grupo funcional pode usar cor por grupo).
Filtro de grupo: mostrar os nomes humanos (mesma taxonomia da §3.1), com sigla como sublabel.
Cabeçalho de resultados com uma micro-faixa de composição dos resultados atuais (reusa AnimatedBarStrip), dando "storytelling" mesmo na busca.
Manter SSR + searchParams (bom para link/compartilhamento e SEO). Não quebrar paginação.
5. /proposicoes/[source]/[id] (detalhe)

page.tsx + components/proposition-story.tsx já têm ótima narrativa por grupo funcional (modelos timeline/procedural_effect/document_flow/etc.). Elevar sem descaracterizar:

Header com serif de display e um chip de macroestágio atual + "dias desde o último evento observado" (mesmo dado da §3.2) — dá contexto imediato.
PropositionTimeline (client) ganha o tratamento visual novo (a linha do tempo hoje é competente mas plana): marcos com ícone por kind, densidade responsiva.
ActivityAround (emendas/documentos/normas) vira faixa de composição em vez de <details> cru.
Preservar toda a lógica de deliberação/decisão e as fontes oficiais.
6. Guardrails inegociáveis (o executor não pode violar)
Ler apps/web/AGENTS.md e os docs do Next fork antes de codar; não confiar na memória de Next.
Sem dado inventado. Toda métrica nova carrega cobertura; ausência → "sem dado publicado", nunca zero cosmético. Manter o tom descritivo (nada de "produtividade"/"ranking dos melhores"/"emperrada").
Acessibilidade: toda faixa/scatter/heatmap com aria-label, tabela Ver dados do gráfico (padrão do Frame em charts.tsx), foco visível (.focus-ring), respeitar prefers-reduced-motion (já no CSS).
Client/server: só marcar 'use client' o que tem estado (toggles, scatter, heatmap, reveal); seções de dados continuam server.
Testes: cada função nova em packages/db ganha teste em tests/unit/ (modelo propositions.test.ts/panorama.test.ts); rodar npm run typecheck && npm test && npm run build antes de commitar.
Encoding: salvar tudo em UTF-8; a home reescrita não pode reintroduzir mojibake.
7. Ordem de execução sugerida
Fundação visual (§1): tokens de fonte, Reveal, AnimatedBarStrip, StatFigure, FunctionalGroupLegend, HouseScopeToggle. + corrigir os bugs do §0 (mojibake, hrefs 404, abs?lute) já reescrevendo page.tsx legível.
Backend (§2): as funções analíticas + bundle + testes.
Home seção a seção (§3), na ordem 3.1 → 3.5, com camada editorial (§6).
Explorar (§4) e detalhe (§5).
typecheck + test + build; revisão visual em npm run dev.