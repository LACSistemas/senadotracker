# P12.8 — Regressões

## Banco de dados

`select pg_database_size(current_database())` antes e depois desta fase: **33.960.234.131 bytes nos dois momentos** — crescimento zero, byte a byte. Nenhuma migration, nenhuma tabela, nenhuma coluna nova. Detalhe em `ARMAZENAMENTO_P128.json`.

## Coletores (PNCP e demais)

`git status --short apps/collector/` não mostra nenhuma alteração: nenhum arquivo de coletor foi tocado nesta fase. Os coletores de P9.5 (finanças/PNCP), P9.6 (criminalidade estadual) e P9.7 (crime organizado) não foram reiniciados, pausados nem modificados — esta fase é só leitura de dados já publicados.

## Outras abas territoriais

Checado por `curl` contra o servidor real, para Vitória (ES) e Espírito Santo (UF):

| Rota | HTTP | Título |
|---|---|---|
| `/municipios/3205309/saude` | 200 | Saúde em Vitória (ES) |
| `/municipios/3205309/educacao` | 200 | Educação em Vitória (ES) |
| `/municipios/3205309/seguranca` | 200 | Segurança Pública em Vitória (ES) |
| `/estados/ES/educacao` | 200 | Educação em Espírito Santo |

Nenhuma regressão visível nas abas de Saúde, Educação e Segurança — o único arquivo compartilhado alterado por esta fase (`territory-ui.tsx`) teve só uma troca de `ready: false` → `true` e a remoção de uma entrada de texto já morta (`THEME_PLAN['bem-estar']`), sem tocar nas entradas dos outros temas.

## Suíte de testes unitários

`npm test` (lista explícita de arquivos, convenção já existente neste repositório): **494 passando, 44 falhando, 70 skipped**, de um total de 608. As 44 falhas são 100% dos domínios de Segurança (`crime-p96`), Educação (migrações P10.1–P10.4) e Finanças (DCA/RREO) — todas com o mesmo erro de causa raiz (`Cannot read properties of undefined (reading 'connect'/'query')`, originado em `applyExecMigrations`/`loadEntityDir`), indicando que esses testes de integração exigem um cluster Postgres de teste dedicado que não está rodando nesta sessão — não uma regressão introduzida por esta fase. Confirmado que nenhuma delas toca `wellbeing-read.ts` ou qualquer arquivo desta fase (stack traces apontam só para `apps/collector/src/exec/seguranca.ts`, `apps/collector/src/exec/crime.ts` e os publishers de Educação/Finanças).

O teste novo desta fase (`tests/unit/wellbeing-page-build.test.ts`, 16 casos — lógica pura de `build.ts`/`narrative.ts`, sem banco) passa integralmente e foi adicionado à lista do script `test` em `package.json`.

## E2E (Playwright)

`tests/e2e/wellbeing-p128.spec.ts`, 15 testes, **15 passando** na execução final (após a correção do id de Boa Esperança do Norte — ver `VALIDACAO_ESTADOS_MUNICIPIOS.md`), contra o servidor de desenvolvimento real. Zero erros de console, zero `pageerror`, zero overflow horizontal em qualquer largura testada (320/390/768/1360/1920px).

## Bugs reais encontrados e corrigidos nesta fase (não eram regressão de outro domínio — eram desta própria feature, pegos só ao renderizar de verdade)

1. **Overflow horizontal em 320px** (`components/wellbeing/wellbeing-ui.tsx`, `StatGrid`): valor longo sem ponto de quebra forçava a grade a exceder a viewport. Corrigido com `break-all` e unidade em linha própria.
2. **Heading de município e UF idênticos** (`components/wellbeing/wellbeing-page.tsx`): os dois ramos do ternário do título "Como se vive..." eram textualmente iguais, então a distinção município×UF exigida pela missão não aparecia na tela (só nos crumbs/kicker). Corrigido para `no estado de ${where}` no ramo de UF.
3. **Id errado para "Boa Esperança do Norte, MT"** carregado de uma nota anterior a este trecho da sessão: `entity_id=5102504` é na verdade Cáceres, MT. Detectado só ao inspecionar visualmente o screenshot (o título da página dizia "Cáceres"), corrigido para o id real (`5101837`, confirmado contra `exec_entity`) no spec de teste e na documentação, e re-testado.

## Risco identificado, não corrigido (fora do escopo desta fase)

`components/education/education-ui.tsx` tem o mesmo padrão de `StatGrid` que causou o bug #1 acima e provavelmente está exposto ao mesmo risco de overflow em 320px. Não foi alterado: esta fase é sobre Bem-estar, e a missão veda redesenhar outra área temática sem necessidade direta. Fica registrado para decisão própria.
