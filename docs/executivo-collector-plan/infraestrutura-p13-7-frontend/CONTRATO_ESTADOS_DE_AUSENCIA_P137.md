# P13.7 — Contrato de estados de ausência

## Enum real (`Availability`, `packages/db/src/exec/infrastructure-read.ts`)

`AVAILABLE | PARTIAL_COVERAGE | NOT_REPORTED | NOT_COLLECTED | SOURCE_BLOCKED | NOT_APPLICABLE | NOT_PUBLISHED | OUTSIDE_REFERENCE_GEOGRAPHY | UNDER_REVIEW | STALE | UNVERIFIED_RELATION` — 11 estados, idênticos ao que o brief pede.

Na prática, `valueStatus()` (backend) só emite `AVAILABLE`, `NOT_REPORTED` ou `SOURCE_BLOCKED` hoje — os outros 8 são contrato de tipo, não observados em runtime pelos indicadores desta base. O frontend trata os 11 (via `AVAILABILITY_LABEL` em `lib/infrastructure/catalog.ts`, usado em `IndicatorDetails` e no explorador) mesmo sem nunca ter visto os 8 "adormecidos" aparecerem — para não quebrar se/quando aparecerem.

Fora do enum: `getInfrastructureWorkDetail().availability.completion`/`.operation` usam a string `'NOT_EVALUATED'`, que não pertence a `Availability`. Não alterado no backend (seria mudar contrato por uma necessidade só de display); o frontend não usa esses dois campos na UI atual (não há seção de "status de conclusão avaliado" no detalhe de obra desta fase) — registrado aqui para não ser esquecido se um módulo futuro precisar deles.

## Mapeamento para casos concretos do brief (seção 18)

| Caso do brief | Tratamento real implementado |
|---|---|
| FJP municipal indisponível | `limits` do capítulo Habitação sempre inclui a frase (independente de haver dado), diferenciando por escopo: "só é publicado para UF e Brasil" (visão município) vs "é um indicador de UF/Brasil; não compare diretamente entre municípios" (visão UF) |
| PEMOB parcial | Nota fixa no grupo "Transporte sob gestão municipal (PEMOB)": "apenas 96 municípios respondentes no Brasil — não é uma média universal" |
| GLP parcial | Nota fixa no grupo "Combustíveis (ANP)": "cadastro de revendedores de GLP é parcial na fonte coletada; preços não são publicados nesta base" |
| ANP preços bloqueados | Mesma nota acima cobre a ausência de preços — não há indicador de preço no catálogo auditado desta base, então não há seção vazia para ele |
| ANTT/ANTAQ bloqueadas | `limits` do capítulo Mobilidade: "não estão disponíveis nesta base — não aparece como zero, simplesmente não é mostrado" |
| Atlas com códigos especiais | `limits` do capítulo Segurança Hídrica cita explicitamente Lagoa Mirim/Lagoa dos Patos como unidades especiais, não municípios (ver G0.5) |
| MMGD sem titulares individuais | Nota fixa no grupo "Geração distribuída (MMGD)" |
| Barragens CRI ≠ DPA | `limits` do capítulo: "classificação de risco (CRI) e dano potencial associado (DPA) altos não são previsão de rompimento" |
| Obras em vários municípios | Ver `CONTRATO_OBRAS_PUBLICAS_P137.md` — "não ratado", nunca um valor por município |
| Percentual físico 100 ≠ entregue | `limits` do capítulo Obras e texto fixo no detalhe de obra |
| Valor contratado ≠ pago | 5 estágios financeiros sempre separados, nunca somados (ver `CONTRATO_OBRAS_PUBLICAS_P137.md`) |
| PNCP sem crosswalk verificado | Frase fixa na seção "Evidências externas" do detalhe de obra |
| Censo 2022 com geografia histórica | G0.3: Boa Esperança do Norte (MT) tratado via ausência real (zero linha em `exec_ind_value` para a família ENTORNO_IBGE) — não há lógica especial no código, a ausência já é honesta por construção |
| Dados com período correto | Ver helper `temporalNote()` — famílias com competência codificada (G0.4) recebem nota explícita |
| Ausência ≠ zero | Regra geral: todo capítulo usa `available: boolean` + `emptyReason` + componente `<Pending>` com a frase "Nenhum valor é estimado nem preenchido com zero"; todo grupo (`group()` em `build.ts`) descarta indicadores com `value == null` em vez de mostrá-los como 0 |

## Componente de ausência por capítulo

`Pending` (em `infrastructure-page.tsx`): usado quando `chapter.available === false`. Mostra número do capítulo, título, `emptyReason` específico (uma frase por capítulo, não genérica) e a garantia fixa de que nenhum valor foi estimado. Verificado em produção real no caso de Boa Esperança do Norte (10 seções em estado `Pending` simultaneamente, cada uma com sua própria frase).
