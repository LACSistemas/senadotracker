# P3 — Página estadual e Atlas Vivo

Base: `P0_AUDITORIA_TERRITORIAL.md`, `P1_DESIGN_SYSTEM.md`, `P2_PILOTO_MUNICIPAL.md` (todos Gate
`PASS_WITH_CAVEATS`). Consome os tokens/componentes de P1 e, onde aplicável, os mesmos princípios de
P2 — não redescobre nem duplica.

## Contexto de apetite de qualidade

Depois de ver o resultado de P2, o usuário deu um feedback direto: fases inteiras delegadas a um agente
em background tendem a ficar "seguras e corretas" (passam em tudo que é verificável automaticamente)
mas conservadoras na parte que só se julga visualmente — porque não há teste automatizado para "isso é
marcante", só para "isso não quebrou nada". Esta fase (o mapa) é onde isso mais importa. Por isso, em vez
de delegar P3 para um subagente novo, **eu mesmo investiguei o código real, tomei as decisões de
composição e escrevi o código**, verificando cada resultado com screenshots reais que eu mesmo olhei
antes de declarar qualquer coisa pronta — não apenas rodando scripts que retornam `pass/fail`.

## O que foi construído

### 1. Seis indicadores reais no mapa (antes: só 3, todos de Saúde)

Investigação direta em `civica_exec.exec_ind_def`/`exec_ind_latest` (consulta de leitura, mesma função
`getMapValues` que o produto já usava desde P14 — nenhuma consulta nova, nenhum indicador novo coletado)
encontrou cobertura municipal real e já publicada, nunca exposta no mapa, em 3 domínios que o mapa
nunca tinha tocado:

| Indicador novo | Código | Domínio | Cobertura real em RJ (92 municípios) |
|---|---|---|---|
| Homicídio doloso (taxa) | `IND-SEG-VDE-HOMICIDIO-DOLOSO-TAXA` | Segurança | 66/92 (26 com `smallN`, corretamente ocultos) |
| Renda domiciliar per capita (mediana) | `WB-INC-RDPC-MEDIAN` | Bem-estar | 92/92 |
| Esgotamento sanitário adequado | `WB-HOUSING-SEWER` | Infraestrutura | 92/92 |

Confirmado também para Roraima (15 municípios, o extremo oposto de RJ) e Amazonas/Pará antes de decidir
— cobertura real em todas as UFs testadas, não um caso isolado. Cada indicador ganhou sua própria família
de matiz (`--map-rose-*`, `--map-violet-*`, `--map-cyan-*`, novas em `globals.css`/`lib/scale.ts`) —
rose não é vermelho-alarme (saturação contida de propósito, Parte VII.15 do mandato: "não transforme
segurança em um painel vermelho de alarmes"). Registro único em `apps/web/lib/territory-map-metrics.ts`,
compartilhado entre `/estados/[uf]` e `/estados/[uf]/atlas` — as duas páginas nunca podem divergir sobre
o que `?mapa=` significa.

**Decisão deliberada sobre ranking**: todo indicador candidato ao mapa — inclusive os 2 que já estavam lá
desde P14 (`IND-SAU-05`, `IND-SAU-08`) — tem `ranking_allowed=false` no catálogo (confirmado por consulta
direta; o campo está presente no schema mas **não é lido por nenhum componente do frontend hoje**, em
nenhum domínio). Interpretei isso como "o produto ainda não construiu uma feature formal de ranking/líder",
não como "proibido colorir um mapa por magnitude" — a prática já estabelecida (2 indicadores já no mapa
desde antes desta fase, com o mesmo flag) é o precedente que segui. Onde isso pesa de verdade —
a tabela alternativa — ver §4.

### 2. Mapa como protagonista na visão geral (`/estados/[uf]`)

A seção do mapa deixou de dividir a tela quase meio a meio com a busca (`1.2fr/1fr`) e passou a dominar
(`1fr/17rem` — a busca e "maiores municípios" viram uma coluna lateral estreita). Adicionado: as 6 pílulas
de indicador (antes 3) e um CTA "Abrir Atlas Vivo →" no próprio card do mapa. Nada no resto da página
(painel de saúde, teasers de tema, executivo/IDHM/legislativo — trabalho de P2) foi tocado.

### 3. Atlas Vivo expandido — rota dedicada `/estados/[uf]/atlas`

**Decisão de arquitetura e por quê**: rota própria, não uma seção expansível dentro da página de visão
geral. A visão geral já é uma página longa (P0 mediu Educação em 21 mil px de altura; a de estado também
é extensa); uma segunda experiência de **tela cheia, foco único** para o mapa — sem os 5 teasers de tema,
sem painel de saúde, sem hemiciclo competindo por atenção — é o que de fato dá ao mapa "papel visual
dominante", não um acordeão espremido entre outros blocos. A rota também resolve sozinha o requisito de
"compartilhamento de contexto via URL" do mandato: o estado completo (indicador, formato mapa/tabela,
município selecionado) vive na própria URL, sem nenhuma dependência de estado de sessão.

Construído em `apps/web/components/territory/atlas-vivo.tsx` (client component) +
`apps/web/components/territory/map-table.tsx` (alternativa tabular, server component) +
`apps/web/app/estados/[uf]/atlas/page.tsx`:

- **Zoom/pan**: sem lib nova — `transform: translate() scale()` em CSS sobre um wrapper `<div>` ao redor
  do SVG já existente (técnica padrão, zero dependência). Zoom por roda do mouse (listener manual
  `{ passive: false }`, porque o `onWheel` do React não garante poder bloquear o scroll da página em todo
  runtime), arraste por ponteiro, botões `+`/`−`/"Centralizar", e teclado (`+`/`-`/`0`/setas) no palco
  focável (`role="application"`, rotulado). Um limiar de 6px de deslocamento distingue clique de arraste
  — clicar e soltar no mesmo lugar seleciona; arrastar nunca seleciona nem navega sem querer.
- **Seleção territorial com pré-visualização real**: clicar num município NÃO navega — abre um painel
  lateral com nome, valor formatado, ressalvas (se houver) e um botão explícito "Ver perfil completo →".
  Como o valor de TODOS os municípios da UF já está carregado (mesma consulta de sempre), a
  pré-visualização é instantânea, sem nenhuma requisição nova. Ctrl/Cmd/Shift-clique e clique do meio
  continuam abrindo o perfil numa aba nova, como qualquer link da web — o comportamento padrão de
  navegador nunca foi sequestrado.
- **Foco automático**: selecionar um município recentra e amplia o mapa para enquadrá-lo (usa
  `getBoundingClientRect` do próprio polígono já renderizado, desfazendo a transformação atual para achar
  as coordenadas de conteúdo — funciona em qualquer zoom/pan corrente, não só no estado inicial).
  Verificado manualmente: clicar em Casimiro de Abreu (RJ) recentra e amplia exatamente nele, com o
  contorno de seleção visível e o painel mostrando "48.672 hab." — ver screenshot
  `rj-atlas-selected-w1440.png`.
- **Troca de indicador e formato**: link simples (`?mapa=`, `?view=mapa|tabela`), sem JavaScript
  necessário — consistente com o padrão de filtros GET já estabelecido em todo o produto territorial.
- **Alternativa tabular** (`MapTable`, Parte VI.11.3 do mandato: "o mapa deve ser acessível também por
  uma interface tabular"): mesmos dados do mapa, **nenhum a mais nem a menos**, incluindo as linhas sem
  dado e as flagueadas (com a ressalva por extenso, não só um traço). Ordenada por nome, não por valor —
  decisão deliberada: como nenhum indicador do catálogo tem `ranking_allowed`, ordenar por valor insinuaria
  um ranking que a própria definição do indicador não autoriza.
- **Integridade cartográfica**: `MunicipalMap` (componente original, reusado na visão geral e no mini-mapa
  municipal) e `AtlasVivo` agora recebem um `flags` opcional e **somam a ressalva ao título/aria-label de
  cada município** em vez de colorir silenciosamente sem aviso (ex.: "Aperibé: sem dado (Pequeno número:
  não comparar)") — confirmado nos 3 lugares onde o dado aparece (mapa, pré-visualização, tabela) com o
  mesmo texto, vindo da mesma função `flagLabels` já existente. A legenda ganhou uma linha fixa explicando
  o método de classificação ("Faixas por quintil... não por intervalo fixo de valor") — já era quintil
  antes de P3 (código em `MunicipalMap`), só não estava documentado na tela.

### 4. Dois estados de validação

- **Rio de Janeiro** (indicado explicitamente pelo mandato): 92 municípios, o maior número de
  qualquer UF testada nesta fase.
- **Roraima**: 15 municípios, a menor UF do Brasil em contagem — o extremo oposto de RJ. Testa o
  componente com polígonos poucos e grandes, cobertura parcial real de homicídios (7/15) e layout do
  palco de zoom/pan numa geometria completamente diferente. Confirmado visualmente funcionando
  (`rr-atlas-w1440.png`).

## Um bug real encontrado e corrigido no mesmo ciclo (não pré-existente)

Ao ligar `AtlasVivo` como componente cliente, o build de produção isolado falhou:
`Module not found: Can't resolve 'net'/'tls'` — `territory-ui.tsx` (de onde `AtlasVivo` importa
`flagLabels`) importava `competenceLabel` de `apps/web/lib/exec-territory.ts`, um módulo que também
carrega o pool do Postgres (`pg`) — importar QUALQUER valor desse arquivo arrasta o módulo inteiro para o
bundle do navegador, mesmo uma função pura. Isso nunca tinha aparecido porque `territory-ui.tsx` nunca
tinha sido importado por um componente cliente antes de `AtlasVivo`. Corrigido extraindo a função pura
para `apps/web/lib/competence-label.ts` (zero dependências), com `exec-territory.ts` reexportando-a — os
2 outros consumidores (`health-panel.tsx`, `residents-panel.tsx`) continuam funcionando sem nenhuma
mudança neles.

## Verificação

- `NEXT_DIST_DIR` isolado: typecheck limpo (0 erros) e build de produção com sucesso, incluindo a rota
  nova `/estados/[uf]/atlas` (confirmada na árvore de rotas gerada).
- Servidor isolado (`next start -p 3153`, env do `.env` da raiz exportado só para o processo isolado,
  nunca a porta 3000 do usuário) — a 1ª tentativa falhou (`SASL: client password must be a string`,
  variáveis de ambiente do banco ausentes no processo isolado) e foi corrigida exportando o `.env` da raiz
  antes de subir o servidor; a porta ficou presa por um processo anterior uma vez (`EADDRINUSE`),
  resolvido localizando e encerrando o PID real via `netstat`/`taskkill` — nenhum dos dois afetou o
  servidor de desenvolvimento do usuário (porta 3000), confirmado em cada passo.
- `tests/e2e/p14-territorio-executivo.spec.ts` + `tests/e2e/infraestrutura-p137.spec.ts` contra o build
  isolado — **40/40 passaram**, nenhuma regressão nos domínios não tocados.
- **30 combinações reais** (RJ e RR × visão geral/Atlas-mapa/Atlas-tabela × 1440/1280/768/390/320px,
  script Playwright ad hoc, screenshots em `artifacts/p3-atlas-vivo/`): **28/30 com 0px de overflow e 0
  erro de console**; as 2 exceções são a visão geral em 320px (21px de overflow) em AMBAS as UFs — mesma
  magnitude exata que P0 já tinha medido em `/estados/ES` antes de qualquer trabalho de P2/P3, confirmando
  que é o mesmo bug pré-existente, não um novo. **Diagnosticado agora** (P0/P1 só tinham medido, não
  diagnosticado): o formulário de busca (`MunicipalFinder`, componente não tocado por mim) fica dentro de
  um `<div className="grid ... lg:grid-cols-[...]">` sem nenhuma definição de colunas abaixo de `lg` — o
  grid cria uma coluna implícita de largura `auto`, que pode crescer ao `max-content` do conteúdo (botão
  "Buscar" + padding) em vez de encolher ao contêiner. Confirmado que o código anterior a P3 tinha
  exatamente o mesmo padrão (`grid gap-6 lg:grid-cols-[...]`, sem `grid-cols-1` de base) — não foi
  introduzido por mim. Não corrigi: mesmo precedente de P1/P2 (fica para P6), e um ajuste malfeito num
  componente usado em toda página territorial é mais arriscado do que vale a pena nesta fase.
- Interação verificada manualmente com Playwright, não só visualmente: clique seleciona e recentra
  (`?municipio=` aparece na URL via `history.replaceState`, sem navegação/reload), zoom por teclado
  (`+`) altera o `transform` corretamente, o mapa some tooltips com a ressalva de cada município flagueado
  nos 3 lugares (mapa, pré-visualização, tabela) com o mesmo texto.
- **Acessibilidade**: reusado o mesmo mecanismo de P1 (`scripts/ux/axe-run.mjs` + `axe-core` externo) contra
  `/estados/RJ/atlas` (mapa e tabela, 1280/390px) — **0 violações novas**; as únicas 2 encontradas
  (`region`, `skip-link`) são exatamente as mesmas que P1 já tinha documentado como pré-existentes no
  header global, fora do escopo territorial. 46–51 verificações passaram em cada combinação.

## Status do Gate P3

**`PASS_WITH_CAVEATS`.**

Avaliado contra os critérios reais do mandato, não só "funcionou":
- **Mapa funcionando com dado real**: sim — 6 indicadores reais, 2 UFs de porte extremo validadas,
  nenhum valor inventado, nenhuma granularidade fingida.
- **Controles coerentes**: sim — legenda, unidade e fonte trocam juntas ao mudar de indicador (SSR,
  nunca dessincronizados); zoom/pan/seleção funcionam por ponteiro, roda e teclado.
- **Navegação utilizável**: sim — confirmado interativamente (não só visualmente), com alternativa
  tabular completa e acessível.
- **"Mapa como protagonista de verdade"**: aqui o julgamento é honesto, não inflado. Na visão geral,
  o mapa cresceu bastante mas ainda divide a tela com uma barra lateral — não é tela cheia. No Atlas Vivo
  dedicado, o mapa **é** o elemento único e dominante da tela (confirmado visualmente nos screenshots
  `rj-atlas-w1440.png`/`rr-atlas-w1440.png`) — isso cumpre o requisito, mas só na rota nova, não na
  visão geral em si.

Ressalvas que impedem um `PASS` puro:
1. O overflow de 320px na visão geral (pré-existente, agora diagnosticado) continua sem correção —
   decisão deliberada, mesmo padrão de P1/P2.
2. Zoom/pan/município selecionado não entram na URL compartilhável (só indicador, formato e município) —
   simplificação deliberada; documentada, não escondida.
3. Não há limite de arraste (pan livre) — o usuário pode arrastar para fora do conteúdo; o botão
   "Centralizar" sempre recupera. Aceito como simplificação razoável para esta fase.
4. A composição da visão geral deu mais espaço ao mapa, mas o restante da página (teasers, painéis)
   continua com a composição de P2 — nenhuma mudança adicional de hierarquia editorial foi tentada aqui,
   fica para P5/P6.

Nenhum impedimento bloqueia o início da Fase P4 (investigação e comparadores).
