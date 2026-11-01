# P4 — Camada de investigação e comparadores

Base: `P0_AUDITORIA_TERRITORIAL.md`, `P1_DESIGN_SYSTEM.md`, `P2_PILOTO_MUNICIPAL.md`, `P3_ATLAS_VIVO.md`
(todos Gate `PASS_WITH_CAVEATS`). Consome `IndicatorLive`/`ChapterPending`/`StateBadge` de P1, o sistema
de descobertas de P2 e o Atlas Vivo de P3 — não reconstrói nenhum.

## O que foi investigado antes de escrever qualquer código

A hipótese inicial do mandato — "Bem-estar e Infraestrutura são pobres demais para `IndicatorLive`,
precisam de um adaptador que finja igualdade" — **não se confirmou integralmente**. Investigação real do
código (`apps/web/lib/wellbeing/types.ts`, `apps/web/lib/infrastructure/types.ts`,
`apps/web/components/wellbeing/territory-compare.tsx`, `apps/web/components/infrastructure/territory-compare.tsx`)
encontrou:

- Infraestrutura já tem `HeroKpi.compare?: TerritoryCompare` (3 pontos: território/UF/Brasil, cada um com
  `eligible`/`reason` — elegibilidade já calculada ponto a ponto).
- Bem-estar já tem o mesmo `TerritoryCompare`/`ComparePoint`, usado em "Condições de vida"
  (`conditions.incomeCompare`).
- `components/infrastructure/territory-compare.tsx` era uma **cópia byte-idêntica** de
  `components/wellbeing/territory-compare.tsx` (confirmado por `diff`; o próprio comentário do arquivo de
  Infraestrutura já dizia "Espelha `components/wellbeing/territory-compare.tsx`" — o time já sabia da
  duplicação).
- O que Segurança/Educação têm e Bem-estar/Infraestrutura não têm de verdade: `delta`, `sparkline` e
  **distribuição de pares** (`Kpi.ruler`: território vs. p25/p50/p75 de uma coorte).
- O que Bem-estar/Infraestrutura têm e Segurança/Educação não têm: elegibilidade **por ponto** (`own`/
  `state`/`brazil`, cada um com motivo quando inelegível) — mais rico nesse eixo específico que o
  `compare.text` plano de `Kpi`.

Ou seja: nenhum dos dois grupos é "pobre" — são complementares. Forçar os dois a competir pelo mesmo
`Kpi.compare.text` teria sido inventar uma frase que o dado não sustenta. A decisão tomada foi outra:
**consolidar a duplicação real** (ponto 1) e **adicionar a dimensão que faltava a TODOS os domínios**
(distribuição de pares, ponto 2) em vez de forçar uma falsa unificação.

## 1. Consolidação: `TerritoryCompareRow` canônico (`apps/web/components/comparison/territory-comparator.tsx`)

Movido da cópia de Bem-estar (texto idêntico ao de Infraestrutura, confirmado por diff antes de mover).
`apps/web/components/wellbeing/territory-compare.tsx` e `apps/web/components/infrastructure/territory-compare.tsx`
viraram reexports de 3 linhas — **nenhum call site mudou** (`wellbeing-page.tsx`/`infrastructure-page.tsx`
continuam importando de `./territory-compare` normalmente). `ComparePoint`/`TerritoryCompare` também
viraram tipos canônicos em `apps/web/lib/comparison/types.ts`, reexportados pelos dois `types.ts` de
domínio pelo mesmo motivo.

## 2. Contrato de elegibilidade formal (`apps/web/lib/comparison/eligibility.ts`)

```ts
assessComparability(meta: ComparabilityMeta): { eligible: boolean; reason: string | null }
```

Formaliza a Parte VII.13.1 do mandato como função pura: 7 dimensões (definição, unidade, período,
universo, metodologia, abrangência, agregação) — uma falha basta para bloquear, com motivo específico por
dimensão (nunca um texto genérico), mais um `minCohort` opcional para comparações de distribuição.
9 testes reais em `tests/unit/comparison-eligibility.test.ts` (todos passando): 1 caso elegível, 6 casos
bloqueados (um por dimensão + coorte pequena), 1 caso onde a ausência de `minCohort` não bloqueia uma
coorte de 1 (comparação que não depende de distribuição).

## 3. Território × distribuição de pares — nova, real, sem consulta nova (`apps/web/lib/comparison/peer-distribution.ts`)

```ts
buildPeerRuler(ownId, values: ReadonlyMap<number, number>, opts): { ruler: Ruler } | { ruler: null; reason: string }
```

Constrói uma `Ruler` (o mesmo tipo que `BenchRuler`/`Kpi.ruler` já usam em Segurança/Educação — **zero
componente visual novo**) a partir de um mapa de valores **já carregado pela página**. Aplicado no Atlas
Vivo (P3), onde o valor de todos os municípios de uma UF já está em memória para pintar o mapa — a régua
de pares não dispara nenhuma consulta adicional. As 7 dimensões de `assessComparability` vêm fixas em
`true` aqui (são garantidas por construção: é sempre o mesmo indicador, mesma consulta, mesmo momento); só
`minCohort` (padrão 5) pode reprovar de verdade — ex.: uma UF com poucos municípios com dado elegível para
o indicador. 4 testes reais em `tests/unit/comparison-peer-distribution.test.ts`: régua real com coorte
grande, bloqueio por ausência de valor próprio, bloqueio por coorte pequena com motivo explícito, e
`minCohort` customizado sendo respeitado.

## 4. Adaptadores honestos (`apps/web/lib/comparison/kpi-adapters.ts`)

- `heroKpiToKpi(h: HeroKpi)` — Infraestrutura. Nível 1 (Descobrir) apenas: `delta`/`spark`/`ruler` ficam
  `null`/`[]`, nunca inventados. `h.compare` (a `TerritoryCompare` de 3 pontos) **não é absorvido** em
  `Kpi.compare.text` — continua renderizado à parte por `TerritoryComparator`, como o produto já faz.
- `portraitFactToKpi(p: PortraitFact)` — Bem-estar. Mesmo limite: só Nível 1, sem Nível 2 (não há
  `ChartView` nessa fonte).
- `mapMetricToKpi(...)` — adapta um indicador do Atlas Vivo (`MapMetricDef`, sem texto de fonte detalhado
  por indicador no registro) + o resultado de `buildPeerRuler` para um `Kpi` completo, incluindo o motivo
  de bloqueio no `caveat` quando a régua não pôde ser construída (nunca desaparece silenciosamente).
  `source` é o domínio do indicador (ex. "Segurança Pública"), não uma agência específica — citar a fonte
  exata por indicador não está nesse registro, e inventar seria pior do que apontar para a aba do tema.

**Limite honesto não escondido**: `chapter` fica `''` nestes 3 adaptadores quando não há âncora de
capítulo válida na página onde o `Kpi` adaptado é renderizado — o link "Explorar →" embutido em `KpiCard`
(fixo no componente, roda em qualquer domínio) aponta então para `#` (topo da página atual) em vez de um
capítulo real. Confirmado nos screenshots: aparece, é clicável, não quebra nada, só não leva a lugar
nenhum — uma fricção cosmética menor, documentada em vez de mascarada.

## 5. Onde foi aplicado — Atlas Vivo (P3), painel de pré-visualização

Escolhido porque já tinha exatamente o problema que esta fase resolve: ao selecionar um município, o
painel mostrava só nome + valor cru + lista de ressalvas, sem nenhuma comparação. Agora
(`apps/web/components/territory/atlas-vivo.tsx`): o valor selecionado vira um `Kpi` completo via
`mapMetricToKpi` + `buildPeerRuler`, renderizado através de `IndicatorLive` — Nível 1 (`KpiCard` com
régua de pares embutida), Nível 3 (`verify`: fonte = domínio do indicador, definição, cobertura = "N
municípios de {UF} com dado elegível", notas apontando para a aba do tema). Nenhum componente visual novo
foi criado para isso — é composição do que já existia em P1/P3.

Exemplo real capturado (`artifacts/p4-comparadores/rj-homicidios-nf-w1440.png`): selecionar Nova Friburgo
com o indicador "Homicídios (taxa)" mostra "10,3 por 100 mil hab." e, embaixo, "Nova Friburgo em 2025:
10,3 por 100 mil hab. — abaixo da faixa central. Mediana 21,0 · faixa central 15,0–30,6. Grupo: 66
municípios de Rio de Janeiro." — tudo calculado no servidor a partir do mesmo mapa de valores que já
pinta o coroplético, nenhuma consulta nova.

**Exemplo real do caminho de bloqueio** (não capturado em screenshot — Roraima, a UF mais extrema testada
em P3, ainda tem 7 municípios com homicídio elegível, acima do `minCohort` padrão de 5, então a régua
aparece normalmente lá também; o bloqueio está provado pelos testes unitários com coortes sintéticas
menores, não por um caso real encontrado nas 2 UFs testadas nesta fase — honesto registrar que não achei
um caso real de bloqueio nos dados testados, em vez de forçar um cenário artificial só para o screenshot).

**Coordenação de interações**: trocar de indicador (`?mapa=`) já recarrega a página (SSR, filtro GET) —
legenda, unidade, régua e fonte trocam juntas por construção, nunca ficam dessincronizadas. Selecionar um
novo município atualiza o `Kpi` inteiro (valor, régua, caveat) porque é recomputado a cada seleção a
partir do mesmo `values` já carregado. Confirmado nos testes e2e e nos 2 casos reais capturados.

**Estado compartilhável por URL**: já era verdade desde P3 (`?mapa=`, `?view=`, `?municipio=`) — esta fase
não mudou isso, só o que é renderizado dentro do painel que já tinha esse estado.

## O que NÃO foi feito nesta fase (limite deliberado, não esquecido)

- **Comparador território×série-histórica**: não construído. O Atlas Vivo só carrega um período por
  indicador (o mais recente); construir uma série própria exigiria uma consulta nova, fora do escopo
  autorizado ("só os contratos `*PageData` já existentes").
- **Comparador território×Brasil dentro do Atlas Vivo**: não construído pelo mesmo motivo — não há valor
  nacional agregado já carregado para os 6 indicadores do mapa sem uma consulta nova.
- **`selectDiscoveries` (P2) não foi tocado**: Bem-estar continua sem competir por manchete nas
  descobertas municipais, mesmo tendo `TerritoryCompare` real em "Condições de vida" — plumar isso exigiria
  mexer no sistema de descobertas já testado de P2, com seu próprio e2e. Registrado aqui como o próximo
  passo mais natural para fechar essa lacuna, deliberadamente fora desta fase por risco/tempo.
- Nenhum dos 5 temas internos foi redesenhado (correto — isso é P5).

## Verificação

- `NEXT_DIST_DIR=.next-p4check npm run typecheck` (isolado) — limpo, 0 erros, após corrigir 2 erros reais
  de tipo encontrados no próprio ciclo: `export type {...} from` não cria binding local (quebrava o uso de
  `TerritoryCompare` dentro dos próprios `types.ts` de domínio — corrigido com `import type` + `export
  type` separados) e um conflito com `exactOptionalPropertyTypes: true` (`coverage: undefined` explícito
  não é aceito onde a prop é opcional — corrigido com spread condicional).
- Build de produção isolado + servidor isolado (`next start -p 3155`, nunca a porta 3000 do usuário,
  confirmada respondendo 200 ao final, intocada).
- `node --import tsx --test tests/unit/comparison-eligibility.test.ts tests/unit/comparison-peer-distribution.test.ts`
  — **13/13 passando**, incluindo os 2 casos exigidos pela diretiva desta fase (1 comparação bloqueada
  corretamente, 1 mostrada corretamente) e mais 11 casos de borda reais. Ambos os arquivos adicionados ao
  script `test` da raiz (`package.json`), mesmo padrão manual já usado neste repo.
- `npx playwright test tests/e2e/p14-territorio-executivo.spec.ts tests/e2e/infraestrutura-p137.spec.ts tests/e2e/wellbeing-p128.spec.ts`
  contra o build isolado — **55/55 passando**, incluindo os testes que exercitam `TerritoryCompareRow` em
  Bem-estar e Infraestrutura (prova de que a consolidação do componente não mudou o comportamento real).
- 10 screenshots reais (`artifacts/p4-comparadores/`: RJ/Nova Friburgo e RR/Boa Vista × 5 larguras do
  mandato) — **0px de overflow e 0 erros de console em todas as 10 combinações**.
- axe-core (mesmo mecanismo de P1/P3) contra `/estados/RJ/atlas?mapa=homicidios&municipio=3303401` em
  1280/390px — **as mesmas 2 violações pré-existentes já documentadas em P1/P3** (`region`, `skip-link`,
  fora do escopo territorial), **0 violações novas**.

## Status do Gate P4

**`PASS_WITH_CAVEATS`.**

Avaliado contra o critério literal do mandato — "nenhuma visualização mostra texto/legenda incompatível
com os filtros selecionados; nenhuma comparação inválida aparece como válida":

- Confirmado com exemplo real: ao selecionar um município sem valor elegível para o indicador corrente,
  `buildPeerRuler` retorna `{ruler: null, reason: 'Território sem valor elegível...'}` e `mapMetricToKpi`
  leva esse motivo para `caveat` — o `KpiCard` nunca renderiza uma régua vazia nem um valor zerado.
- Confirmado com exemplo real: trocar o indicador no Atlas Vivo é uma troca de rota GET — não existe
  nenhum estado client-side que possa "ficar preso" no indicador anterior (classe inteira de bug eliminada
  pela arquitetura, não só testada).
- Confirmado por teste: 1 caso bloqueado (coorte pequena, motivo explícito) e 1 caso mostrado (coorte
  grande, régua real) — ambos exigidos pela diretiva desta fase.

Ressalvas que impedem um `PASS` puro:
1. Território×série-histórica e território×Brasil não foram construídos para o Atlas Vivo (exigiriam
   consulta nova, fora do escopo autorizado) — só território×UF(pares) e território×ponto-direto
   (Bem-estar/Infraestrutura, via `TerritoryComparator` já existente) estão cobertos.
2. `IndicatorLive` aplicado em 1 local real (Atlas Vivo) — não nos 5 temas internos, que é escopo de P5.
3. `selectDiscoveries` (P2) não foi atualizado para deixar Bem-estar competir por manchete, apesar de agora
   ter o dado real para isso — próximo passo natural, não feito aqui por risco/tempo.
4. Não encontrei, nos dados reais de RJ/RR testados, um caso de bloqueio por coorte pequena para
   screenshot — o caminho está provado por teste automatizado, não por evidência visual real.

Nenhum impedimento bloqueia o início da Fase P5 (redesenho temático completo — a maior fase do programa).
`IndicatorLive`, `TerritoryComparator` e `buildPeerRuler` ficam disponíveis para os 5 temas adotarem.
