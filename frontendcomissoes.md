Plano de redesign — Comissões (/comissoes, /comissoes/[id], /comissoes/agenda)
0. Contexto e diagnóstico (leia antes de tocar em código)

A narrativa dessas páginas é boa; o problema é puramente de execução visual. Elas foram escritas "por fora" do design system Cívica e por isso parecem de outro produto:

Não usam nenhum ícone (lucide-react), enquanto home/perfis usam fartamente (Landmark, Users, Calendar, Clock, MapPin, Gavel, FileText…).
Não usam a fonte serif de display (.display-title) nem a classe .eyebrow — reescrevem o eyebrow na mão com text-xs uppercase tracking. Resultado: títulos em font-black sans, destoando da home e dos perfis.
Não têm herói. A home tem InstitutionHero, os perfis têm ProfileHero. Comissões abre com um <header> cru. É o maior motivo do "bland".
Sem profundidade nem hierarquia: cards flat bg-card/40/bg-muted/20, sem .card-elevated/--shadow-card, sem hover-lift (hover:-translate-y-0.5) que a home já usa.
Números não são tratados como storytelling: as contagens estão espremidas em grids divide-x sem respiro. Um site de dados vive dos números — eles precisam de palco.
Sem diferenciação de Casa: Senado, Câmara e Congresso são visualmente idênticos. Oportunidade óbvia de cor + ícone + textura.
A "timeline" da agenda não lê como timeline — é um grid 100px_1fr sem espinha nem marcadores.
Textura não usada: existe .surface-grid (grade pontilhada) em globals.css, ninguém usa. Serve perfeitamente para faixas de herói.
Formatação do arquivo agenda/page.tsx está com linhas duplas em branco e tudo numa linha só — reescrever com carinho.

Princípio-guia: não inventar uma nova identidade. Puxar o wow que já existe na home/perfis para dentro de Comissões, usando exclusivamente os tokens de apps/web/app/globals.css e os primitivos de apps/web/components/. Nada de novas cores fora da paleta da marca. O wow vem de hierarquia, profundidade, ícones, ritmo e tratamento dos números — não de enfeite.

Regra inviolável (é um produto de dados públicos): preservar toda a linguagem honesta de cobertura ("na cobertura atual", "não representa produtividade", "estar em pauta não prova votação", coverage states). Redesign é de forma, não de afirmações. Nenhum número novo, nenhuma métrica derivada que insinue mérito.

1. Fundação compartilhada (fazer primeiro — as 3 páginas dependem)
1a. Sistema de tema por Casa

Criar apps/web/lib/house.ts (ou apps/web/components/commissions/house.ts) com um mapa único, fonte de verdade para ícone + rótulo + classes de cor, usado nas 3 páginas:

import { Landmark, Building2, Gavel } from 'lucide-react';
export const HOUSE = {
  SENADO:    { label: 'Senado Federal',      short: 'Senado',    icon: Landmark,  accent: 'chart-2' }, // azul-petróleo
  CAMARA:    { label: 'Câmara dos Deputados', short: 'Câmara',    icon: Building2, accent: 'primary' }, // verde marca
  CONGRESSO: { label: 'Congresso Nacional',   short: 'Congresso', icon: Gavel,     accent: 'chart-3' }, // âmbar
} as const;
export const houseOf = (h: string) => HOUSE[String(h).toUpperCase() as keyof typeof HOUSE] ?? HOUSE.SENADO;
Usar --chart-2 (#2d7f93) e --chart-3 (#d39a3c) como acentos de Casa — já são da paleta, apenas re-significados (o próprio CSS já faz isso com --eval-*). Isso resolve a "não-diferenciação" sem sair da marca.
Substituir as funções institution()/house()/houseLabel() espalhadas nas 3 páginas por esse mapa (hoje há 3 implementações divergentes — unificar já melhora consistência).
1b. Componentes reutilizáveis novos (pequenos, em apps/web/components/commissions/)
StatTile — um número com palco: valor grande .display-title tabular-nums, rótulo text-xs text-muted-foreground, ícone opcional em chip bg-secondary text-primary (padrão idêntico ao HighlightCard). Reaproveitar em /comissoes (contagem por Casa) e em /comissoes/[id] (atividade no ano).
HouseBadge — pill com ícone + rótulo da Casa, cor vinda do mapa 1a. Substitui os <span className="rounded-full bg-secondary"> soltos.
MeetingCard — card de reunião consistente (data/hora com ícone Clock, título, local com MapPin, contagem de itens, AgendaItems). Hoje há 3 marcações diferentes para "reunião" (list, detail, agenda) — consolidar em 1.
CoverageNote — bloco padronizado para estados de cobertura/vazio (ícone Info/CircleOff, texto em text-muted-foreground, fundo bg-muted/40 rounded-2xl border-dashed). Hoje são <p> cinza soltos — dar-lhes forma sem alarmar.

Reusar sempre Card, Badge, Button/buttonVariants, cn, .card-elevated, .eyebrow, .display-title. Não recriar o que já existe.

2. /comissoes (índice) — apps/web/app/comissoes/page.tsx

Meta: virar uma porta de entrada com pegada editorial, não uma lista.

Herói. Trocar o <header> cru por uma faixa no padrão da home: fundo bg-card com .surface-grid por cima (textura sutil), .eyebrow "Comissões", título em .display-title ("Onde o trabalho legislativo ganha forma"), subtítulo text-muted-foreground. Full-bleed (border-y, conteúdo em page-shell) como as seções bg-card da home. Opcional: reaproveitar InstitutionHero com imageUrl="/congresso.svg" para consistência total com a home — recomendo esta opção pelo impacto.
Contagem por Casa como storytelling. Substituir o grid divide-x por 2–3 StatTile (um por Casa presente), cada um com ícone da Casa, número grande em serif/tabular, rótulo e link "Explorar {Casa} →". Dá o "peso de dados" que hoje falta. Manter o total "N colegiados" como linha de contexto acima.
"Próximas reuniões". Trocar os cards bg-muted/20 por MeetingCard compactos com .card-elevated e hover-lift; data em destaque com ícone Clock, HouseBadge, contagem de itens. Manter o link "Ver agenda completa →" mas como Button variant="ghost"/link com ícone ArrowRight.
Explorar comissões.
Busca: usar o primitivo Input (components/ui/input.tsx) com ícone Search embutido à esquerda (padrão do header). Hoje é <input> cru.
Filtros de Casa: manter os pills, mas com ícone da Casa dentro e o count num Badge. Estado ativo já usa bg-primary — manter.
CommissionCard: adicionar profundidade (.card-elevated, hover:-translate-y-0.5 hover:border-primary/40), trocar a seta textual ↗ por ArrowUpRight (lucide), pôr o ícone da Casa no topo em vez do texto solto, sigla como Badge. Manter line-clamp-2 no nome. Manter o agrupamento por Casa quando dir.grouped.
Rodapé pedagógico ("O que acontece dentro de uma comissão?"): manter o texto (é ótimo), mas dar ícones aos 3 conceitos (Relatoria=Gavel/UserCheck, Pauta=ListChecks, Reunião=CalendarDays) em chips bg-secondary, no padrão AreaDetails da home.
3. /comissoes/[id] (detalhe) — apps/web/app/comissoes/[id]/page.tsx

Meta: é onde a página está mais feia (JSX numa linha só, sem herói). Elevar ao nível dos perfis de parlamentar.

Antes de tudo: reformatar o arquivo (hoje é uma linha gigante) e extrair sub-blocos. Manter dynamic='force-dynamic' e a lógica de dados intacta.

Herói de comissão. Criar um herói no espírito do ProfileHero: faixa bg-primary text-primary-foreground com gradiente e .surface-grid/InstitutionalImage sutil ao fundo. Dentro: pill de papel (HouseBadge em versão clara sobre verde), nome em .display-title, subtítulo sigla · Casa, e as ações como pills brancas: "Ver agenda completa" (primária) + link secundário. Isso sozinho já entrega a maior parte do wow.
Barra de "Atividade em {ano}". Promover para logo abaixo do herói, como faixa de 3 StatTile (Reuniões, Itens de pauta, Matérias distintas) com ícones (CalendarDays, ListChecks, FileText). Manter integralmente a nota "não representam produtividade ou eficiência" logo abaixo. Hoje está no meio da página em grid cru — vira o "resumo de dados" do topo.
Próxima reunião. Manter como card de destaque, mas com .card-elevated, ícone CalendarClock, HouseBadge, e usar MeetingCard. Se não houver, usar CoverageNote em vez do <p> cinza.
Ritmo das seções. O space-y-14 cru vira seções com cabeçalho consistente: .eyebrow + .display-title menor (text-2xl), e cada seção "cartão" (Card) ou separada por regra fina — não tudo empilhado igual. Ordem sugerida: Próxima reunião → Últimas reuniões → Atividade (topo) → Composição → Relatorias → Matérias pautadas.
Composição (commission-composition.tsx).
PartyBars: as barras estão ok conceitualmente, mas dar polimento — altura consistente, tabular-nums na contagem, cor bg-primary/70 sobre trilho bg-secondary, e um rótulo de eixo/legenda mínima. Considerar destacar as 3 maiores bancadas. (Seguir a skill dataviz para cor/legenda/acessibilidade das barras — ver §6.)
People: as listas divide-y rounded-xl border estão aceitáveis; melhorar com avatar/ícone User, e Presidente/Vice em destaque visual (chip de papel). Manter o "Ver todos".
Relatorias e Matérias. Trocar border-b pb-5 cru por itens com leve estrutura (ícone FileText, proposalLabel em Badge monospace/tabular, hover). Manter todos os disclaimers ("não significa que a relatoria permaneça vigente" etc.) e o <details> de histórico.
Coverage/vazios. Todos os agendaCoverage/mattersCoverage === 'unavailable' passam a usar CoverageNote (mesma forma, tom calmo), nunca só <p> cinza.
4. /comissoes/agenda — apps/web/app/comissoes/agenda/page.tsx

Meta: transformar num timeline legível e vivo. É a página com maior potencial de "stunning".

Reescrever o arquivo com formatação normal (hoje tem linhas em branco duplicadas e um mega-return).

Herói curto no padrão §2 (eyebrow "Agenda legislativa" + .display-title "Agenda das comissões" + subtítulo). .surface-grid ao fundo.
Controles. Os presets de período (Hoje/Amanhã/Esta semana/30 dias) viram Button size="sm" (pills) com estado ativo real (comparar from/to atuais e marcar aria-current). O formulário de filtro usa NativeSelect (components/ui/native-select.tsx) e Input type="date" estilizados, dentro de um Card com ícones (Filter, Calendar). Botão "Aplicar" já é Button — manter.
Resumo do período. Linha "N reuniões entre X · Câmara n · Senado n" vira uma faixa com mini-StatTile/Badge por Casa (com cor do mapa), em vez de texto corrido. Storytelling: deixar claro o "pulso" da semana.
Timeline de verdade. Para cada dia (grupos já existem em grouped):
Cabeçalho de dia "sticky" (sticky top-[header]), com data em .display-title (fmtDay), e um Badge com a contagem de reuniões do dia.
Cada reunião num item com espinha vertical + marcador (dot colorido pela Casa): coluna esquerda com a hora (Clock, tabular-nums, cor do acento da Casa) e um ponto na linha; coluna direita = MeetingCard. Usar border-l na coluna do horário + ::before/span absoluto para o dot. Isso é o coração do wow aqui.
HouseBadge no lugar do bg-secondary pill.
Manter o <details> "Pauta atualizada · N alterações" — mas dar-lhe um ícone History/GitCompare e cor de atenção sutil (text-warning) quando houver alterações, porque é o dado mais jornalístico da página (mudança de pauta). Isso é storytelling político: mostrar que a pauta mudou.
Estado vazio. "Nenhuma reunião oficial encontrada" vira CoverageNote com ícone CalendarOff e um atalho para "Próximos 30 dias".
5. Acessibilidade e performance (guardrails — não negociáveis)
Contraste: ao usar --chart-2/--chart-3 como acento, usar sempre em texto ≥14px bold ou como fill de ícone/dot, nunca como texto pequeno cinza sobre creme. Verificar AA.
Semântica: manter um único <h1> por rota (o herói emite; demais seções h2/h3). Manter aria-current, aria-label, sr-only já presentes. Ícones decorativos com aria-hidden.
Focus: usar .focus-ring/focus-visible existentes em todos os novos interativos.
prefers-reduced-motion: já tratado no CSS global; qualquer hover-lift/transição deve respeitar (usar transition curtas, sem parallax).
Sticky headers: calcular offset do AppHeader (min-h-18) pra não sobrepor.
RSC: as páginas são Server Components (force-dynamic); manter herói/StatTile/MeetingCard como Server Components. Só AgendaItems e CommissionComposition são 'use client' — não transformar o resto em client à toa.
CLS: imagens de herói via os componentes existentes (InstitutionalImage) que já fixam dimensões.
6. Skill obrigatória para as barras/qualquer viz

Antes de mexer em PartyBars (distribuição partidária) ou criar qualquer barra/medidor, carregar a skill dataviz e seguir a paleta/legenda/rotulagem dela. É a única parte com "gráfico" de fato; o resto é layout.

7. Ordem de execução e fatiamento de commits
Fundação: lib/house.ts + components/commissions/{StatTile,HouseBadge,MeetingCard,CoverageNote}.tsx. (1 commit)
/comissoes refeita sobre a fundação. (1 commit)
/comissoes/[id] — reformatar + herói + StatTiles + seções; ajustes finos em commission-composition/commission-rapporteurships. (1–2 commits)
/comissoes/agenda — reescrever + timeline. (1 commit)
Passada final de A11y/contraste + revisão visual nas 3 rotas em light mode.
8. O que não fazer
Não introduzir cores fora dos tokens de globals.css.
Não remover/alterar disclaimers de cobertura, notas metodológicas ou a semântica dos números.
Não converter Server Components em Client sem necessidade.
Não criar dependências novas (tudo com lucide-react + primitivos já instalados).
Não “inventar” métricas de mérito/ranking de comissões.

Definição de pronto: as três rotas abrem com herói serif consistente com a home, números com palco, cards com profundidade e hover, Casas diferenciadas por ícone+cor, agenda como timeline com marcadores, todos os disclaimers preservados, AA de contraste ok, build e lint verdes.