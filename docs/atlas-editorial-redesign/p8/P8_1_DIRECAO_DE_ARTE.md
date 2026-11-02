# P8.1 — Direção de arte implementável

Diferente de P0-P7, esta fase não terminou num documento de recomendações: as decisões abaixo foram
implementadas diretamente em `/estados/[uf]` e `/municipios/[ibge]` (as 2 visões gerais — P8.2/P8.3
registram o resultado completo) e verificadas com build isolado + screenshots reais antes de serem aceitas
como direção. Toda decisão aqui parte de uma causa raiz real, localizada em P8.0 — não de uma preferência
estética solta.

## 1. Largura — `.shell-territory` substitui `.page-shell` só em `TerritoryFrame`

P8.0 localizou a causa raiz do teto de 1200px (em qualquer viewport, inclusive 1920px): `.page-shell`
(`globals.css:67`), consumida por **62 arquivos** fora do escopo deste mandato além de `TerritoryFrame`.
Em vez de alargar `.page-shell` (mudaria a largura de Legislativo/Proposições/perfis, fora de escopo),
criei `.shell-territory` (`width:min(1360px,calc(100% - 56px))`, topo da faixa 1280-1360px que o próprio
mandato pede em §2.1) e troquei só a classe do `<main>` de `TerritoryFrame`. Isso alarga de uma vez só as
14 rotas territoriais (2 visões gerais + 5 temas × 2 níveis + Atlas Vivo) sem tocar nenhuma das 62 outras.

## 2. `TerritoryHero` — geografia integrada à abertura, não confinada a um card abaixo

Novo componente (`components/territory/territory-hero.tsx`), substitui `InstitutionHero` só nas 2 visões
gerais via uma nova prop aditiva `heroNode` em `TerritoryFrame` (quando ausente, as ~12 outras rotas que
usam `TerritoryFrame` — os 5 temas × 2 níveis — continuam exatamente como estavam; zero risco para elas).

P8.0 confirmou por inspeção de DOM: o hero antigo tinha 0 `<svg>`/`<img>` reais, só um ícone de 15px. O
novo hero usa a MESMA malha (`UfGeometry`) que a seção de exploração completa já usa, renderizada como
`role="img"` com rótulo descritivo real (não decorativo/`aria-hidden` — é informação, não enfeite):
- **Município**: todos os municípios da UF, o selecionado destacado em `--brand-amber` com traço branco —
  "onde fica", mas dentro da composição de abertura, não depois dela.
- **Estado**: a malha inteira como silhueta, mesma técnica.

Layout: grid de 2 colunas (texto ~64%, mapa ~34%) em telas largas; empilha em 1 coluna no mobile — o mapa
continua visível e real (não vira decoração escondida), conferido em 390px nos 2 municípios/estado testados.

## 3. Descoberta protagonista — integrada ao hero quando elegível

`DiscoveryPanel` ganhou `headlineInHero` (aditivo, default `false` — o único outro consumidor, a visão
municipal, é quem passa `true`). Quando o território tem uma KPI elegível (contrato de P2, nunca por
magnitude), o número vira um cartão real dentro do hero (valor grande, frase de comparação já validada,
link) — a opção mais forte que o mandato permite em §4.1 ("integrada ao hero"). Sem elegibilidade em
nenhum tema, nada aparece no hero e `DiscoveryPanel` mantém o texto neutro de sempre — nunca inventado.

Visão estadual ainda não tem sinal de descoberta elegível (P8.0/§4.2) — fica para P8.3 avaliar se compensa
estender `selectDiscoveries` para UF; não bloqueia esta fase.

## 4. Cards dentro de cards — `editorial-kpi.tsx`, 2 primitivas sem moldura própria

P8.0 quantificou 68-70% de aninhamento nas visões gerais e em Educação/Segurança, com a mesma causa em 4
arquivos quase idênticos (`*-summary.tsx`): uma grade `rounded-2xl border bg-white` 2×2 dentro de um card
maior. Novo módulo `components/territory/editorial-kpi.tsx`:
- `KpiHeadline` — 1 indicador protagonista (número grande, tendência, legenda), sem moldura própria.
- `KpiRow`/`KpiRowList` — lista vertical separada por hairline (`border-t`), não por caixa.
- `KpiStat`/`KpiStatStrip` — faixa horizontal de estatísticas de apoio, separadores verticais.

Mandato §8.1: "remover molduras desnecessárias" antes de "criar outro card" — aplicado literalmente.

## 5. Os 4 teasers de tema deixam de ser o mesmo template 4x (mandato §2.6)

Reescritos com composições genuinamente diferentes, não só cores/ícones diferentes:

| Tema | Composição | Por quê |
|---|---|---|
| Educação | `KpiHeadline` (1º indicador) + `KpiRowList` vertical | "jornada", leitura sequencial (mandato §5.2) |
| Segurança | `KpiHeadline` com o indicador de série mais longa (maior sparkline) + `KpiStatStrip` horizontal | "gráfico temporal protagonista", não 4 KPIs iguais (mandato §5.3, exemplo literal do próprio texto) |
| Bem-estar | grade de 2 colunas sem caixa, sem indicador dominante | fatos paralelos de fontes/períodos distintos, sem delta/série no read model — não force um gráfico onde não há dado para sustentar um (mandato §8.5) |
| Infraestrutura | `KpiHeadline` (serviço já priorizado por `HERO_KPI_PRIORITY`, P5) + `KpiRowList` | "o que existe", inventário físico, não comparação |

## 6. IDHM — marcos de década, não um gráfico genérico de série longa forçado em 3 pontos

`MultiLineChart` (dimensionado para séries longas) forçava uma largura mínima e scrollbar horizontal
dentro do card com só 3 pontos — achado nomeado literalmente pelo mandato. Substituído por uma visualização
própria, pequena, só para este caso: 2 traços horizontais (território × Brasil), 3 pontos reais cada,
nunca insinuando valor entre décadas — mesmo texto de ressalva de antes, agora sem o bug de layout.

## 7. Representação legislativa — não finge ser exclusiva do município

`TerritoryLegislativeSummary` ganhou `municipioName` (aditivo — a visão estadual não passa, nada muda lá).
Em município: título deixa de ser "Quem representa {município}" (o dado é da UF inteira) e passa a
"Representação estadual e federal ligada a {UF}"; o hemiciclo completo (que já existia, grande) fica atrás
de um `<details>` ("Ver composição partidária completa") para não dominar a visão geral municipal — acesso
integral preservado, só não aberto por padrão. Resolve o achado literal do mandato: "não crie a impressão
de que os 119 parlamentares do RJ são uma representação legislativa exclusiva de Campos dos Goytacazes."

## O que NÃO mudou nesta fase (decisão deliberada, não lacuna escondida)

- `HealthPanel` (compacto, usado nas 2 visões gerais) manteve a composição em grade de P5 — é a seção mais
  visivelmente "antiga" que sobra nas 2 páginas agora. P5 já havia decidido preservar a composição interna
  de Saúde (estruturalmente mais madura que os outros 4 temas); mantenho a mesma decisão aqui. Registrado
  para P8.4 (redesenho temático de Saúde) resolver, não escondido.
- `ExecutiveSummary` (foto+nome+partido+PIB) não foi tocado — já não tinha o problema de aninhamento (P8.0)
  e já segue um padrão editorial razoável (retrato + fato, sem grade de caixas).
- O explorador de mapa estadual completo (métrica/busca/ranking) ganhou mais espaço automaticamente com o
  shell mais largo, mas sua composição interna não foi redesenhada nesta fase — avaliado como "porta de
  entrada" que já funciona, risco/benefício de reconstruir agora não compensava frente ao ganho do hero.

## Verificação

- `NEXT_DIST_DIR` isolado, build de produção limpo, typecheck raiz limpo (2 erros reais encontrados e
  corrigidos no próprio ciclo — `exactOptionalPropertyTypes` em `editorial-kpi.tsx`, union literal em
  `idhm-summary.tsx` — nenhum chegou a ficar no código).
- Servidor isolado porta 3171, porta 3000 do usuário confirmada intacta antes/depois.
- 53 testes e2e existentes (`p14-territorio-executivo`, `infraestrutura-p137`, `seguranca-p98`) rodados
  contra o build isolado: **52/53 passaram**; o 1 que falhou (São Paulo, timeout sob paralelismo de 3
  workers) passou isolado em 6,5s — mesmo padrão de flakiness sob carga já documentado em P7, não uma
  regressão real.
- Screenshots reais (`artifacts/p8-1-direcao-arte/`) em 1440px e 390px para `/municipios/3301009` e
  `/estados/RJ`: **0px de overflow horizontal, 0 erros de console** nas 4 combinações, depois de encontrar
  e corrigir 1 bug real introduzido no próprio ciclo (ver P8.2).
- axe-core **não executado** (ferramenta externa em `D:\Civica\tools\a11y` inacessível nesta sessão, mesma
  limitação que P6.2 registrou) — `NOT_EVALUATED`, não inflado. Fica para P8.6 (auditoria final) retomar.

## Status

Fundação implementada e verificada nas 2 páginas-piloto (resultado completo em `P8_2_VISAO_MUNICIPAL.md` e
`P8_3_VISAO_ESTADUAL.md`). `READY_FOR_VISUAL_REVIEW` — decisão de G1 pertence ao usuário (mandato §11.8),
não a esta fase.
