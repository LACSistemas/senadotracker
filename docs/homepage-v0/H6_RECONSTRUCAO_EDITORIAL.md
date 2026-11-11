# H6 — Reconstrução editorial da homepage

Mandato corretivo: a arquitetura conceitual da Homepage V0 (H0-H5) foi aprovada; a tradução visual foi reprovada. Este documento registra o diagnóstico e a reconstrução da composição, não dos dados (que permanecem os mesmos, já auditados em `H0_AUDITORIA.md`).

## 1. Estado inicial (antes de H6)

Capturas em `artifacts/h6-homepage-v0/before/`. O hero era três elementos visualmente desconectados em sequência: (1) um banner verde-escuro com título, busca e chips; (2) imediatamente abaixo, **fora** do banner, um `<figure>` de borda própria e fundo claro (`bg-card`) contendo o mapa; (3) ao lado do mapa, 4 `KpiCard` brancos independentes (um por indicador). Logo abaixo, uma quarta fileira de 3 cartões brancos ("Legislativo/Executivo/Judiciário") repetia o mesmo padrão visual de card. No mobile, essas 4 peças apareciam empilhadas com bordas e sombras próprias — exatamente o "banner → mapa separado → cartões" descrito no mandato como a falha central.

As 3 "histórias de dados" já existiam com dado real, mas dois dos três gráficos eram pequenos (mapa de Ideb a 220px, mini-gráfico de Justiça a 80px de altura) e o terceiro (Gastos públicos) não tinha nenhuma visualização — apenas uma lista de 2 linhas.

Os 3 módulos de "Três poderes" já tinham identidade textual própria, mas Executivo e Judiciário usavam a mesma estrutura de "2 caixas de KPI empilhadas", sem elemento gráfico que os diferenciasse visualmente entre si ou do Legislativo (que já tinha um gráfico de composição partidária).

## 2. Reconstrução

### 2.1. Hero — de 3 blocos para 1 composição
O hero inteiro (texto, busca, atalhos, mapa, legenda e os 4 indicadores) passou a viver dentro de **uma única superfície** (`rounded-[1.75rem] bg-gradient...`), com uma grade de duas zonas (`lg:grid-cols-[0.92fr_1.08fr]`): a zona esquerda carrega eyebrow/título/subtítulo/busca/atalhos; a zona direita é um painel translúcido (`bg-white/[0.05] ring-1 ring-white/10`) que contém o mapa, a legenda e os 4 indicadores **dentro do mesmo painel**, como elementos de uma composição cartográfica única, não como cartões separados. A faixa "três poderes" deixou de ser uma fileira de cards brancos e virou uma tira anexada à base da própria superfície escura do hero (mesmo container, `overflow-hidden` compartilhado), com links inline (ícone + título + descrição), sem bordas de card — lida como o rodapé do próprio hero, não como uma 4ª seção.

No mobile (abaixo de `lg`, 1024px), a grade colapsa para uma coluna: texto, busca, atalhos, depois o mesmo painel do mapa, tudo dentro da mesma superfície contínua — nenhum salto visual de cor ou borda entre "banner" e "mapa" como antes.

### 2.2. Histórias de dados — gráficos substanciais
- Educação: mapa de 220px → 300px, com legenda de faixas abaixo.
- Justiça: gráfico de 80px → 176px de altura, mais legível.
- Gastos públicos: a lista de 2 linhas foi substituída por um tratamento de **número editorial grande** (R$ 34,5 bi em destaque, tipografia serifada display, seguido do número secundário de magistrados atuantes). Não é um gráfico de comparação porque os dois valores (despesa em R$ e headcount) não são comparáveis na mesma escala — inventar essa comparação seria uma violação do mandato (§13); o "stat tile" grande é a forma honesta de dar peso visual a um número real sem fabricar uma relação que não existe.

### 2.3. Três poderes — diferenciação visual real
- **Legislativo**: mantido o gráfico de composição partidária (`ConcentrationCurve`).
- **Executivo**: ganhou um mapa coroplético próprio, por **população residente por UF** (IBGE, dado já carregado, nenhuma consulta nova) — métrica diferente da do hero (IDHM) e da história de Educação (Ideb), para não repetir o mesmo mapa três vezes na página.
- **Judiciário**: ganhou um gráfico de barras "Balanço de 2025" (entradas × baixas, só do ano mais recente) — diferente da série 2016-2025 já usada na história de Justiça (H2), para não duplicar o mesmo gráfico duas vezes na mesma página.

## 3. Achado corrigido durante H6: colisão de texto em 1024-1279px
Ao reconstruir, o hero muda para 2 colunas em `lg` (1024px) exatamente na mesma largura em que a grade de indicadores também mudava para 4 colunas (`sm:grid-cols-4`, 640px, já ativa bem antes) — o painel direito, agora ocupando ~54% de uma viewport de 1024px, não tinha largura suficiente para 4 colunas e "214.211.951" colidia visualmente com "5.571" ao lado. Corrigido: a grade de indicadores só vai a 4 colunas em `xl` (1280px), fica em 2 colunas entre 1024-1279px, e o valor usa `clamp()` (como o `KpiCard` já fazia) em vez de um tamanho fixo. Reverificado em 1024px e 1280px — sem colisão.

## 4. O que não foi alterado
- Nenhum dado, contrato de leitura, rota ou regra estatística mudou — mesmas fontes e números de H0-H5.
- `GlobalSearch`, `searchAll`, `paintStateMap`/`brazil-map-markup.ts`, `ConcentrationCurve`, `app-footer.tsx` não foram tocados nesta fase (já corrigidos/estendidos em H1-H5).
- Território, Perguntas e Transparência mantidos estruturalmente — o foco do mandato corretivo estava no hero e nas histórias/três-poderes, que concentravam o problema descrito.

## 5. Segurança arquitetural
Mudança 100% de apresentação (JSX/CSS) dentro de `apps/web/app/page.tsx`. As únicas adições de dado são leituras em memória sobre arrays já carregados (`states.population` para o mapa de população do Executivo; `byId.get('JN_CASES_NEW_G1'/'G2')` já presente em `judOverview` para o balanço de 2025 do Judiciário) — nenhuma consulta nova ao banco, nenhuma migração, nenhum coletor tocado.
