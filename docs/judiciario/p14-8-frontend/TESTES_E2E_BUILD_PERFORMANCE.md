# Testes, build e performance — P14.8

## E2E

`tests/e2e/p148-judiciario.spec.ts`, convenção `tests/e2e/<domínio>-<fase>.spec.ts` já usada no projeto (`p14-territorio-executivo.spec.ts`, `seguranca-p98.spec.ts`...). **23/23 passando**, contra dado real (sem mocks), servidor isolado (`E2E_BASE_URL=http://127.0.0.1:3181`).

Cobertura real:
- **Rotas**: as 8 válidas, mais tribunal inexistente (404), tema inexistente (404), precedente inexistente (404).
- **Conteúdo real**: KPIs nacionais com números reais (27.687.646 casos novos, 45.180.208 baixados, 75.532.531 pendentes), nunca `NaN`/`[object Object]`.
- **Semântica estatística**: taxa de congestionamento nunca aparece como KPI nacional agregado; execução geral/penal aparecem separadas (não misturadas); ausência real preservada (violência doméstica 2009–2015 = "Indisponível", testado via `textContent` para pegar o conteúdo da tabela mesmo com o `<details>` fechado).
- **Comparador**: sem seleção → orientação; 1 tribunal só → mesma orientação (guarda de mínimo); 2 tribunais válidos → valores reais de ambos, mais "Sem nota geral" (nunca nota de melhor/pior).
- **STJ**: explorador com paginação real (2.369 precedentes, "Página 1 de 119"); detalhe com estrutura questão→tese→histórico→processos, tese ausente mostrando ausência real (não resumo gerado).
- **Navegação**: entrada "Judiciário" no header; 390px sem overflow nas 4 rotas principais.
- **Regressão**: `/legislativo`, `/estados/ES`, `/comparar` (Legislativo) continuam 200 — nenhum domínio existente foi quebrado.

Um teste foi corrigido durante a execução por engano de digitação da própria asserção (texto esperado não batia com a cópia real da página) — não era bug de produto; corrigido para o texto real renderizado.

## Build

`NEXT_DIST_DIR=.next-p148-build npx next build` (build de produção isolado, nunca sem essa variável — evita corromper o `.next` do servidor de desenvolvimento ativo, armadilha já documentada no projeto). Resultado: **build limpo, sem erros**, manifesto de rotas confirma as 8 rotas `/judiciario/*` como `ƒ` (Dynamic, server-rendered on demand) — consistente com `export const dynamic = 'force-dynamic'` em todas.

## Typecheck

`apps/web` e `packages/db`, ambos limpos, repetidos a cada mudança relevante durante a implementação (não só no fim) — incluindo depois da adição de `getJudiciaryNationalSeries`, depois da correção de revisão, depois da troca `LineChart`→`MultiLineChart`, depois da correção de acessibilidade.

## Performance (o que foi e não foi medido)

Os números de P14.7/P14.7-R citados no mandato (overview nacional p95 ≈ 31,69ms, perfil STJ p95 ≈ 76,74ms, detalhe de precedente p95 ≈ 3,97ms, p95 temático ≈ 8,14ms) são benchmarks de **serviço**, não de página renderizada — o próprio mandato já avisa disso. Nesta fase:
- **Medido**: tempo de resposta qualitativo durante a navegação manual e os testes E2E (23 testes, 8 rotas, ~35-55s de execução total incluindo overhead do Playwright) — nenhuma página travou ou teve timeout perceptível.
- **Não medido nesta fase**: p95 de página real (Lighthouse/Web Vitals) não foi rodado especificamente contra as rotas do Judiciário. Dado o padrão do resto do produto (Server Components, cache de 5min, consultas paralelas, paginação real), não há motivo estrutural para esperar regressão, mas isso é inferência de arquitetura, não medição — reportado como tal, não maquiado como "testado".

## Segurança

Nenhuma consulta PostgreSQL direta do navegador (todo acesso via `@senadotracker/db`, Server Components). Zero chamada a DataJud. Zero consulta CKAN STJ no cliente. Zero exposição de folha nominal individual (o frontend só consome `getJudiciaryFinancialProfile`/`getJudiciaryFinancialHistory`, que já devolvem folha **agregada**, nunca por pessoa). A pendência de ACL da folha STJ (achado de fase anterior, grupo Windows `Users` com acesso excessivo ao RAW) permanece registrada como gate operacional — o frontend nunca lê esse RAW diretamente, só o agregado publicado.

## Não regressão

PNCP: nenhum arquivo relacionado a PNCP foi tocado nesta fase. Outros domínios (`/legislativo`, `/estados/[uf]`, `/comparar`) verificados respondendo 200 nos testes de regressão do próprio `p148-judiciario.spec.ts`.
