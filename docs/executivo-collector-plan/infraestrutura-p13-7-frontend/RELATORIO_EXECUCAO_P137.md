# P13.7 — Relatório de execução

Frontend de Infraestrutura do Cívica, construído sobre os serviços tipados reais da P13.6, sem nenhuma migration, collector ou escrita no PostgreSQL. Ver `P137_RESULTS.json` para o status estruturado final.

## Gate Zero (G0.1–G0.7)

Investigação própria, somente leitura, resolveu três lacunas que a documentação do P13.6 deixava abertas:

- **G0.1**: CSV de cobertura corrigido (estrutura, não dado — soma de indicadores bate 108).
- **G0.2**: divergência MMGD 5.567×5.548 — causa raiz encontrada (19 municípios com dado real na fonte, zero linha publicada; defeito de serving documentado, não mascarado).
- **G0.3**: município novo pós-Censo identificado (Boa Esperança do Norte, MT, ibge7 5101837).
- **G0.4**: padrão de "competência técnica codificada" generalizado para 7 famílias (não só PEMOB).
- **G0.5**: códigos especiais do Atlas Águas confirmados (4300001/4300002), hoje moot para o frontend (só publica em nível Brasil).
- **G0.7**: smoke tests reais + duas correções mínimas no backend (encoding, filtros de obras) — ver `CORRECOES_G0_P137.md`.

## O que foi construído

### Rotas
`/estados/[uf]/infraestrutura`, `/municipios/[ibge]/infraestrutura` (overview), `/estados/[uf]/infraestrutura/obras`, `/municipios/[ibge]/infraestrutura/obras` (lista filtrável), `/obras/[projectId]` (detalhe, rota global por ser potencialmente multimunicipal).

### Módulos (camada 2)
Água e saneamento, Ruas e ambiente urbano (com alternador FACES/DOMICÍLIOS/MORADORES), Habitação, Energia e conectividade, Mobilidade e logística, Segurança hídrica e barragens, Obras públicas — todos com narrativa própria, limites explícitos e disclosure por indicador.

### Camada 3/4
Explorador completo de indicadores (busca, filtro por família, exportação CSV), lista de obras com 8 filtros reais e paginação no servidor, detalhe de obra com 5 estágios financeiros separados/empenhos paginados/multimunicipalidade, comparadores UF/Brasil (só município, até 3 por página), cobertura nacional por família de fonte.

### Backend (read-only, mesma fase)
Encoding corrigido, filtros de obras implementados (antes eram no-op), função nova `getInfrastructureWorksBySituation`, enriquecimento de rótulos (situação/categoria/natureza/órgão/fonte) em `getInfrastructureWorkDetail`/`getInfrastructureWorksList`.

## Arquivos (ver `ARQUITETURA_FRONTEND_INFRAESTRUTURA.md` para a árvore completa)

- `packages/db/src/exec/infrastructure-read.ts` (editado)
- `apps/web/lib/infrastructure/{types,catalog,format,build,narrative,load,works}.ts` (novos)
- `apps/web/components/infrastructure/{infrastructure-page,infrastructure-ui,urban-environment,indicator-disclosure,territory-compare,explorer,works-list,work-detail}.tsx` (novos)
- `apps/web/app/estados/[uf]/infraestrutura/{page.tsx,obras/page.tsx}`, `apps/web/app/municipios/[ibge]/infraestrutura/{page.tsx,obras/page.tsx}`, `apps/web/app/obras/[projectId]/page.tsx` (novos)
- `apps/web/components/territory/territory-ui.tsx` (editado: `THEMES.infraestrutura.ready → true`, placeholder removido)
- `tests/e2e/infraestrutura-p137.spec.ts` (novo, 30 testes)
- `scripts/exec/p137_smoke.ts` (evidência de smoke test, mesmo padrão de `p136_smoke.ts`)
- `docs/executivo-collector-plan/infraestrutura-p13-6-serving/MATRIZ_FONTES_COBERTURA_PERIODOS.csv` (corrigido)

## Testes

Typecheck limpo (`apps/web` e `packages/db`). Build de produção isolado (`NEXT_DIST_DIR`, porta 3103) três vezes ao longo da fase, sempre limpo. 30/30 testes E2E reais (Playwright/Chromium) — ver `TESTES_E2E_P137.md`. 11 screenshots reais inspecionados — ver `MANIFESTO_SCREENSHOTS_P137.json`. Regressão em 6 rotas de outros domínios confirmada verde — ver `REGRESSOES_OUTROS_DOMINIOS_P137.md`.

## Incidente registrado

Durante a fase, `npm run typecheck` (sem `NEXT_DIST_DIR`) corrompeu um arquivo de cache de tipos do servidor de desenvolvimento ativo do usuário (`.next/dev/types/routes.d.ts`). Sem impacto no runtime (servidor continuou respondendo 200); resolve com restart do `npm run dev`. Documentado em memória do projeto (`next-dist-dir-nao-isola-typegen.md`) para não repetir em fases futuras.

## Pendências conhecidas (não bloqueiam, mas não foram resolvidas)

Ver `KNOWN_PENDING_ITEMS` em `P137_RESULTS.json`: rota nacional, lista de instalações por município (gap de `ibge7` em `exec_log_facility`), paginação de contratos muito numerosos, módulo dedicado para `MUNIC_URBANA`, variedade visual dos grids de KPI, medição real de Core Web Vitals, teste com leitor de tela real.

## Status final

`P13_7_STATUS=PASS_WITH_CAVEATS`, `P13_7_READY_FOR_APPROVAL=YES_WITH_PENDING_ITEMS`. Nenhuma fase futura foi iniciada. Nada foi commitado — como em todas as fases anteriores desta série, o commit é decisão do usuário.
