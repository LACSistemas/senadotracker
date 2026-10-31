# P13.7 — Regressões em outros domínios

## Arquivos compartilhados tocados (e por quê)

| Arquivo | Mudança | Risco |
|---|---|---|
| `components/territory/territory-ui.tsx` | `THEMES`: `infraestrutura.ready` de `false`→`true`; removida a entrada `infraestrutura` de `THEME_PLAN` | Baixo — `ready` só controla o rótulo "em preparação" na aba (`ThemeTabs`) e qual página o catch-all `[tema]` usa quando a pasta dedicada não existe. Como a pasta dedicada de infraestrutura já existe, o roteamento do Next nem chega a consultar essa flag para infraestrutura. Saúde/Educação/Segurança/Bem-estar não leem a entrada removida (cada um tem sua própria pasta dedicada havia tempo). |
| `packages/db/src/exec/infrastructure-read.ts` | Encoding corrigido, filtros/`getInfrastructureWorksBySituation` adicionados, `getInfrastructureWorkDetail` enriquecido | Nenhum — arquivo exclusivo do domínio de infraestrutura; nenhuma função de outro domínio importa deste arquivo. |

Nenhum outro arquivo compartilhado (`app-header`, `app-footer`, `section-navigation`, `legislative-subnav`, `lib/security/*`, `lib/exec-territory.ts`, `components/security/*`) foi modificado — só **importado/reaproveitado** (`ChapterShell`, `EmptyNote`, `ChapterNav`, `TrendChart`, tipos de `lib/security/types.ts`, `scopeOf`/`instrument`/`memo` de `lib/security/load.ts`, `isUf` de `lib/exec-territory.ts`).

## Verificação real (Playwright, servidor isolado, dados reais)

| Rota | Status |
|---|---|
| `/municipios/3205309/saude` | 200, sem erro de console |
| `/municipios/3205309/educacao` | 200, sem erro de console |
| `/municipios/3205309/seguranca` | 200, sem erro de console |
| `/municipios/3205309/bem-estar` | 200, sem erro de console |
| `/estados/ES/representacao` ("Quem me representa") | 200, sem erro de console |
| `/estados/ES` (visão geral) | 200, sem erro de console |

## O que NÃO foi alterado (confirmado por não ter sido tocado)

- Nenhuma migration executada.
- Nenhum collector executado ou interrompido (P9.5/P9.6/P9.7/PNCP intocados).
- Nenhuma escrita no PostgreSQL (`infrastructure-read.ts` contém só `SELECT`; `getInfrastructureWorksBySituation` e os filtros novos de `getInfrastructureWorksList` também são só leitura).
- Nenhum checkpoint de produção modificado.
- `packages/db/src/exec/index.ts` não foi editado (já fazia `export * from './infrastructure-read.ts'` antes desta fase).
