# P8.0 — Diagnóstico visual e baseline (read-only)

Primeira fase do mandato corretivo P8 ("Reconstrução Editorial Estrutural"), aberto depois que o
usuário avaliou os screenshots reais de P0–P7 e **reprovou o Gate G1 (Excelência Visual)**. Esta fase
não alterou nenhum arquivo de produto — só leu os 15 documentos de fase existentes, montou um build de
produção isolado, mediu a composição real com Playwright e escreveu este documento.

## Metodologia

- Build de produção isolado: `NEXT_DIST_DIR=.next-p80check npm run build` (workspace `@senadotracker/web`).
- Servidor isolado: `next start -p 3170 --hostname 127.0.0.1`, variáveis de `.env` da raiz exportadas só
  para esse processo. Porta 3000 do usuário nunca tocada — confirmada respondendo antes e depois.
- Script Playwright ad hoc (`artifacts/p8_0_diagnostico.mjs`, usa `playwright-core` direto, sem
  `@playwright/test` — não é um teste do repositório, é instrumentação de diagnóstico; será removido ao
  final do programa, mesmo precedente de P3/P6/P7) contra as 8 rotas do mandato × 5 larguras
  (1440/1280/768/390/320): captura viewport + full-page, mede overflow horizontal real
  (`scrollWidth - clientWidth`), largura real do `<main>`, contagem de "card dentro de card" (elementos
  com classe de cartão do design system que têm um ancestral também com classe de cartão), e erros de
  console.
- 80 screenshots reais em `artifacts/p8-0-diagnostico/` (8 rotas × 5 larguras × 2 modos) + `manifest.json`
  com todas as medições.
- Inspeção adicional ad hoc (Node + `playwright-core`, sem salvar screenshot) para confirmar a composição
  exata do hero e localizar a causa raiz da largura de conteúdo, nos dois casos onde a métrica agregada
  por si só não bastava para diagnosticar a causa.

## Achados quantitativos

### 1. Largura de conteúdo — confirmado: um teto único (1200px) para TUDO, em toda largura de tela

Medido diretamente (`<main>.getBoundingClientRect().width`) nas 8 rotas, em 1440/1280/768/320, e também
a 1920px (checagem extra, fora das 5 larguras padrão, para confirmar o pior caso):

| Viewport | Largura real do `<main>` |
|---|---|
| 1920px | **1200px** (720px de margem pura — 360px de cada lado) |
| 1440px | **1200px** (240px de margem pura) |
| 1280px | **1200px** (80px de margem) |
| 768px | 720px (`calc(100% - 48px)`) |
| 390/320px | 362px / 292px (`calc(100% - 28px)`) |

**Causa raiz localizada**: `apps/web/app/globals.css:67` — `.page-shell { width:min(1200px,calc(100% -
48px)); margin-inline:auto; }`. Essa classe é consumida por **`TerritoryFrame`**
(`components/territory/state-frame.tsx`, a casca de TODA página de estado/município) e por **62 outros
arquivos** do produto inteiro (home, Legislativo, Proposições, perfis de parlamentar, etc. — confirmado
por busca em todo `apps/web`). Ou seja: não é um bug de uma página, é uma decisão de largura única e
global, herdada do produto pré-redesign, nunca diferenciada por tipo de conteúdo.

**Isso confirma numericamente o diagnóstico do mandato (§2.1)**, com uma correção de precisão: o teto não
é "~900px em ~1700px" — é **exatamente 1200px, fixo, em qualquer viewport ≥768px**, inclusive 1920px.
Mapas, gráficos e tabelas analíticas sofrem exatamente a mesma restrição que o texto editorial, porque
usam a mesma classe. **Risco real para P8.1**: `.page-shell` não pode ser simplesmente alargada — isso
mudaria a largura de 62 páginas fora do escopo deste mandato (Legislativo, Proposições, perfis). A
direção de arte da P8.1 precisa introduzir larguras **novas e nomeadas** (leitura/exploração/
cartográfica/compacta, como o próprio mandato pede em §2.1) e migrar `TerritoryFrame` para usá-las, sem
tocar `.page-shell` em si nem os 62 outros consumidores.

### 2. Hero — confirmado: banner verde sem geografia nem dado, idêntico em estado e município

Inspeção direta do DOM do hero em `/estados/RJ` e `/municipios/3301009` (ambos 1440px):

| | `/estados/RJ` | `/municipios/3301009` |
|---|---|---|
| Altura real | 426,5px | 429px |
| Classe | `rounded-[1.5rem] bg-primary text-primary-foreground` (gradiente verde sólido) | idêntica |
| Conteúdo real | kicker, `<h1>`, 1 parágrafo, 1 botão, 1 ícone decorativo de 15×15px (pin) | idêntico |
| `<svg>`/`<img>` reais (mapa, foto, gráfico) | **0** | **0** |

O único SVG dentro do hero é o ícone decorativo `lucide-map-pin` de 15×15px ao lado do número de
habitantes — não é um mapa, é um glifo de texto. **Confirma literalmente o mandato (§2.2): "boa parte do
espaço horizontal não tem função visual" e "o mapa deve fazer parte da própria experiência de abertura"**
— hoje não faz, em nenhuma das duas rotas.

**Achado adicional, relevante para P8.1 (§4.1 do mandato)**: em `/municipios/3301009`, o mini-mapa
localizador (`MunicipalMap`) existe, mas vive **fora do hero**, como uma seção própria mais abaixo
(`<section aria-labelledby="localizacao">`, título "Onde fica Campos dos Goytacazes") — confirmado lendo
`apps/web/app/municipios/[ibge]/page.tsx:35-40`. Isso é exatamente o padrão que o mandato nomeia e proíbe:
"a geografia deve ocupar parte relevante do hero, **não ficar confinada a um card genérico mais abaixo**."

### 3. Cards dentro de cards — confirmado e quantificado

Contagem real de elementos com classe de cartão do design system (`.rounded-2xl`/`.rounded-xl`/
`.rounded-lg`/`bg-card`) que têm um ancestral também com classe de cartão, na árvore inteira da página
(mesma contagem em todas as 5 larguras — é uma métrica de DOM, não de layout responsivo):

| Rota | Cards totais | Cards aninhados (dentro de outro card) | % aninhado |
|---|---|---|---|
| `/municipios/3301009` (visão geral) | 106 | 74 | 70% |
| `/estados/RJ` (visão geral) | 103 | 70 | 68% |
| `/estados/RJ/atlas` | 30 | 9 | 30% |
| `/municipios/3302403/saude` | 53 | 29 | 55% |
| `/municipios/3302403/educacao` | 137 | 95 | 69% |
| `/municipios/3302403/seguranca` | 137 | 96 | 70% |
| `/municipios/3302403/bem-estar` | 61 | 27 | 44% |
| `/municipios/3302403/infraestrutura` | 128 | 77 | 60% |

O Atlas Vivo (rota dedicada, construída em P3 especificamente para dar protagonismo ao mapa) tem a
proporção mais baixa de aninhamento (30%) — evidência indireta de que, quando uma página NÃO segue o
padrão "card de resumo contendo vários cards de KPI", o aninhamento cai bastante. As duas visões gerais e
os temas Educação/Segurança (69-70% de aninhamento) são os piores casos — confirma o mandato §2.4 com
números reais, não só impressão visual.

### 4. Overflow horizontal

**0px em 39 das 40 combinações.** A única exceção: `/municipios/3302403/infraestrutura` em 320px — 7px.
Mesma magnitude exata (7px) que P0/P6.1/P7 já haviam diagnosticado exaustivamente para
`/estados/ES/infraestrutura`, sem causa única localizável (acúmulo de arredondamento sub-pixel entre
múltiplas grades). **Achado novo desta fase**: o mesmo resíduo agora confirmado também em nível
municipal (Macaé), não só estadual — mesma causa sistêmica do tema Infraestrutura, não um bug isolado de
uma rota. Não investigado mais a fundo aqui (fora do escopo read-only de P8.0); registrado para P8.4
(redesenho de Infraestrutura) decidir se vale a pena perseguir a causa de novo ou aceitar como residual
documentado.

### 5. Erros de console

Zero em todas as 40 combinações.

## Diagnóstico estrutural por rota (mandato §2, com evidência real desta rota)

- **`/municipios/3301009` (visão geral)**: hero vazio (§2.2, confirmado acima) + mapa confinado a um card
  genérico abaixo do hero (achado adicional) + 70% de cards aninhados (§2.4) + largura de conteúdo travada
  em 1200px mesmo em telas largas (§2.1). A descoberta (`DiscoveryPanel`) já existe e já é editorial
  (P2), mas está posicionada DEPOIS do card de mapa, não integrada à abertura — ritmo ainda é
  "hero → mapa isolado → descoberta → 3 pares de teaser → governo/IDHM → legislativo", uma sequência,
  não uma composição (§2.5).
- **`/estados/RJ` (visão geral)**: mesmo hero vazio, mesma largura travada. O mapa estadual (P3) já ganhou
  mais espaço que no início do programa, mas 68% de cards continuam aninhados no resto da página — a
  composição "hero → mapa+busca → painel saúde → 3 pares de teaser → governo/IDHM → legislativo" é, na
  prática, a mesma estrutura sequencial do município, com números estaduais (§2.5, §2.6 — os 2 níveis
  territoriais ainda parecem a mesma página com dado diferente).
- **`/estados/RJ/atlas`**: a rota com MENOR aninhamento de card (30%) e único lugar onde o mapa já é,
  de fato, protagonista de tela cheia (confirmado visualmente em P3/P6.2) — evidência de que o padrão
  "página de foco único" funciona melhor que o padrão "visão geral com N seções empilhadas". É o ponto de
  partida mais forte para a composição de P8.3/P8.5, não para reconstrução.
- **`/municipios/3302403/{saude,educacao,seguranca,bem-estar,infraestrutura}`**: todas as 5 têm `ChapterNav`
  em sidebar (P5) e hero com narrativa real (P5) — não são mais "genéricas" no texto, mas a composição
  interna de cada capítulo continua, nos 4 temas que usam `ChapterShell` (Educação/Segurança/Bem-estar/
  Infraestrutura), o mesmo molde "cartão com cabeçalho + corpo" — confirmado pela contagem de aninhamento
  mais alta do conjunto em Educação e Segurança (69-70%, mesmo nível das visões gerais). Saúde (55%) e
  Bem-estar (44%) têm aninhamento visivelmente menor — consistente com a decisão já documentada em
  P5.1/P5.4 de não reescrever a composição interna desses dois temas, e com a autoavaliação de P6.2 de
  que a "identidade por tema" ainda é cor+numeral, não composição distinta (§2.6).

## O que já funciona e deve ser preservado (mandato §1.1 — não destruir)

Confirmado ainda presente e funcional nesta inspeção, sobre o build atual:

- Atlas Vivo (`/estados/[uf]/atlas`): zoom/pan, seleção com pré-visualização, 6 indicadores reais
  alternáveis, tabela acessível alternativa, estado compartilhável por URL (zoom/pan/indicador/município).
- Navegação por capítulo (`ChapterNav`, sidebar ≥1024px) nos 5 temas.
- `IndicatorLive` (Descobrir→Explorar→Verificar) onde há `Kpi`/`HeroKpi` real.
- `DiscoveryPanel` (descoberta municipal determinística, nunca por magnitude).
- `TerritoryComparator`/`assessComparability`/`buildPeerRuler` (comparação com contrato de elegibilidade).
- Contrato de cobertura/ausência honesta (`DataCoverage`, badges de estado, "nenhum valor estimado").
- Acessibilidade: baseline de 8 bugs corrigidos em P7 continua — nenhuma regressão nova encontrada nesta
  inspeção (0 erros de console; axe-core não foi re-executado nesta fase, só leitura/medição DOM — não é
  o escopo de P8.0).
- Todos os filtros GET, exploradores client-side, exportação CSV, paginação de obras — não tocados, não
  re-testados nesta fase (P8.0 é diagnóstico visual, não regressão funcional; a regressão é P8.6).

## Conclusão — o que precisa de reconstrução estrutural (insumo direto para P8.1)

1. **Sistema de largura**: criar larguras nomeadas novas (leitura ~68ch, exploração, cartográfica, hero)
   e migrar `TerritoryFrame` para elas — sem tocar `.page-shell` (usado por 62 arquivos fora do mandato).
   Prioridade mais alta: é a causa raiz que afeta as 8 rotas igualmente.
2. **Hero territorial** (estado e município): precisa parar de ser um banner de cor sólida com 1 ícone
   decorativo — precisa integrar geografia real (o mini-mapa que já existe, hoje confinado a um card
   abaixo) e, quando elegível, a descoberta, na própria composição de abertura.
3. **Redução de aninhamento de card** nas visões gerais e em Educação/Segurança — maior ganho potencial
   de "parece menos dashboard administrativo" de todo o diagnóstico (são as 3 rotas com 69-70%).
4. **Ritmo editorial**: as visões gerais de estado e município continuam estruturalmente idênticas entre
   si (mesma sequência de seções, números diferentes) — precisam de composições genuinamente diferentes
   (mapa+diferenças entre municípios no estado; geografia+descoberta no município), não só dado trocado.
5. **Atlas Vivo é o modelo a seguir, não a reconstruir**: menor aninhamento, mapa já protagonista — P8.5
   deve refinar (orientação, legendas, seleção em polígonos pequenos — já listados pelo mandato §7), não
   reconstruir a fundação.
6. Infraestrutura carrega o único overflow residual real (320px, agora confirmado também em município) —
   decisão a tomar em P8.4: perseguir a causa de novo ou manter documentado.

## Preservação da working tree (mandato §9.1)

Confirmado por `git status` antes de iniciar: a única mudança desde o commit `83bfd62` (checkpoint P6.2,
já empurrado para `origin/post-migration`) são os arquivos de scratch de outras frentes já identificados
em sessões anteriores (`$out/`, `.p23_*`, `.tmp_p1352.sql`, `pe_*`, `p127/p136_*_out.*`,
`scripts/exec/inspect_fin.ts`/`p112-read-smoke.ts`, `tests/unit/educacao-p113/p114.test.ts`) — nenhum
tocado por esta fase, nenhum arquivo de produto modificado (P8.0 é 100% leitura + instrumentação de
diagnóstico fora de `apps/`).

## Status do Gate P8.0

Diagnóstico concluído com evidência quantitativa real (não só screenshots): causa raiz da restrição de
largura localizada e rastreada a um único arquivo/classe com blast radius conhecido (62 arquivos); hero
vazio confirmado por inspeção de DOM nas duas rotas-chave; aninhamento de card contado (não estimado) em
8 rotas; overflow residual confirmado como o mesmo bug sistêmico já conhecido, agora também em município.
Identificação clara de mudanças ESTRUTURAIS necessárias (largura, hero, aninhamento, ritmo), não apenas
cosméticas — critério de saída exigido pelo mandato para esta fase.

Nenhum impedimento para iniciar a P8.1 (direção de arte implementável).
