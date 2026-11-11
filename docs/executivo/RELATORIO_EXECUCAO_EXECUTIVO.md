# Relatório de execução — Portal nacional `/executivo`

**Status: implementado e verificado (E0–E4 do mandato); pendente aprovação visual do usuário (E5/G1).**

## Resumo executivo

`/executivo` não existia no repositório. Foi construído do zero sobre o mock aprovado, reaproveitando a infraestrutura territorial já madura do produto (mapa real do Brasil, `InstitutionHero`, catálogo de 27 UFs/5.571 municípios) e os cinco domínios temáticos já existentes (Saúde, Educação, Segurança, Bem-estar, Infraestrutura), que até então só existiam em grão estadual/municipal, nunca nacional.

A auditoria (E0) encontrou, para cada um dos 8 números do painel nacional do mock e dos 5 indicadores temáticos, uma fonte real — mas em 3 casos o valor exato do mock não correspondia ao dado real (IDHM 2021→não existe nesta base, só até 2010; "mediana" de renda→a fonte só publica média; "homicídios"→não há indicador nacional validado com esse nome, existe crime organizado e efetivo policial). Em nenhum caso um número foi copiado do mock sem verificação.

## O que foi construído

**Backend** (3 funções de leitura novas, nenhuma tabela/migration):
- `getNationalHealthSummary` (`packages/db/src/exec/read.ts`): soma nacional de leitos/hospitais CNES, mesma regra de exclusão (`tp_leito≠7`) já usada por `getFacilities` — consistência com o resto do produto, não um novo critério.
- `getHdiForAllStates` (`packages/db/src/exec/idhm-read.ts`): IDHM 2010 das 27 UFs numa única consulta (antes só existia por UF individual ou ranking municipal).
- Reaproveitadas sem nenhuma alteração: `getHdiSeries({level:'BRASIL'})`, `getWellbeingOverview({entityId:76})`, `getInfrastructureIndicators({level:'BRASIL'})`, `getOrganizedCrimeNational`, `getIdebTerritory({stage:1})` (resolve Brasil quando nenhum território é passado) — todas já suportavam grão nacional, só não tinham sido usadas para isso ainda.

**Frontend**:
- `apps/web/app/executivo/page.tsx` — hero (mapa contextual neutro + busca + atalhos + painel de 4 KPIs reais), "Explore o Brasil por indicador" (mapa analítico real com legenda, seletor População/IDHM, painel de UF selecionada, tabela alternativa das 27 UFs), "Quem cuida de quê" (3 cards institucionais), "As cinco áreas da gestão pública" (indicador nacional real por tema), "Recursos e execução" (honesto sobre a ausência de um total nacional único), "Perguntas para explorar", "Fontes e transparência".
- `apps/web/app/executivo/buscar/route.ts` — resolvedor de busca território (estado por sigla/nome → `/estados/{uf}`; senão → `/municipios?q=`), sem duplicar nenhum índice de busca.
- `['/executivo','Executivo']` adicionado à navegação principal (`app-header.tsx`).

## Achado real e corrigido durante a implementação

Um bug real de JavaScript — "dangling else": `if (indicador==='populacao') for(...) if(...) set(); else for(...) ...` fazia o `else` se ligar ao `if` mais interno, não ao externo. Resultado: o indicador IDHM nunca populava o mapa (mapa ficava uniforme, painel de UF sempre "—"). Encontrado com uma marca de depuração temporária comparando o tamanho real dos mapas intermediários (ambos com 27 entradas) contra o resultado final (0) — confirmando que o bug estava na lógica de mesclagem, não na leitura de dados. Corrigido com chaves explícitas; verificado depois com captura real mostrando Espírito Santo = 0,740 (IDHM 2010) e o mapa com gradiente real.

## Achado real, não corrigido (pré-existente)

`axe-core` aponta `label-content-name-mismatch` (54 ocorrências) e `nested-interactive` (2) nos mapas desta página — confirmado, por auditoria comparativa, que a página `/estados` já tinha exatamente os mesmos avisos (27 e 1, a metade porque `/executivo` renderiza o mapa duas vezes). O defeito está nos componentes compartilhados `brazil-map-markup.ts`/`state-map-paint.ts`, usados por outras páginas — corrigir ali está fora do escopo deste mandato (mudança em componente global usado por múltiplos consumidores) e não foi feito.

## Verificação

- Typecheck limpo em `@senadotracker/db` e `@senadotracker/web`.
- **11/11 testes e2e novos** (`tests/e2e/executivo-portal.spec.ts`) passando — painel nacional, as 5 áreas, indicador População, indicador IDHM com valor real, tabela de 27 UFs, busca por sigla/nome/município, navegação, regressão em `/estados`/`/legislativo`/`/judiciario`.
- **10/10 testes e2e pré-existentes** (`p14-territorio-executivo.spec.ts`) continuam passando — nenhuma regressão nos domínios territoriais tocados (saúde, IDHM).
- Overflow horizontal: 0 em 320/390/768/1440px.
- axe-core: 0 violações novas (as 2 encontradas são pré-existentes, confirmadas também em `/estados`).
- Console: 0 erros novos (o único aviso de SVG `height="auto"` também é pré-existente, replicado de `/estados`).

## O que não foi feito (fora de escopo ou adiado)

- Seção de finanças nacionais: deliberadamente SEM um total único de despesas (o mock mostra R$ 5,96 tri, não verificável com os contratos atuais sem somar competências/esferas de forma inválida) — mantida honesta, com links para explorações financeiras reais já existentes.
- Apenas 2 indicadores no mapa analítico (População, IDHM) — os outros 3 temas (Saúde/Segurança/Bem-estar/Infraestrutura) têm indicador nacional real nos cards das "5 áreas", mas não têis uma versão por-UF verificada e integrada ao seletor do mapa ainda; ficaria para uma iteração futura se o usuário quiser mais indicadores no explorador.
- Correção do `label-content-name-mismatch`/`nested-interactive` pré-existente nos componentes de mapa compartilhados.
- Nada comitado — aguardando revisão, como o resto do produto.
