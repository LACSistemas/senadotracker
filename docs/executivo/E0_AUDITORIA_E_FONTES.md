# E0 — Auditoria e viabilidade de dados (`/executivo`)

Auditoria read-only antes de qualquer código. Nenhuma migration, nenhuma tabela nova, nenhuma escrita no banco nesta fase — só leitura, via scripts descartáveis (`scripts/exec/_tmp_e0_*.ts`, todos apagados ao final).

## 1. Estado real do repositório

- **Não existe `/executivo`** hoje. A home (`/`) trata o produto como "Poder Legislativo" + "Judiciário (em breve)" — nem menciona um terceiro poder "Executivo". Essa página está desatualizada em relação ao que o Judiciário já publica (P14.x), mas **isso é fora de escopo** deste mandato — não vou tocar `/` (mandato §15: só mudanças mínimas e justificadas fora de `/executivo`).
- Rotas territoriais reais confirmadas: `/estados`, `/estados/[uf]`, `/municipios`, `/municipios/[ibge]`. Não existe `/estados/[uf]/atlas` como rota própria — o Atlas Vivo é `components/territory/atlas-vivo.tsx`, embutido na página do estado.
- Os "cinco temas" (Saúde, Educação, Segurança, Bem-estar, Infraestrutura) já têm implementação madura, territorial (UF/município), nunca nacional: `components/{education,security,wellbeing,infrastructure}/` + `components/territory/health-*`. Cada um tem seu próprio `lib/<tema>/load.ts` com funções `territory-scoped`.

## 2. Componentes reutilizáveis confirmados

| Componente | Caminho | Uso para `/executivo` |
|---|---|---|
| `InstitutionHero` | `components/heroes.tsx` | Hero (já suporta `imageUrl`, `actions`, `location` — usado pela home e pelo Judiciário) |
| `MunicipalFinder` | `components/territory/territory-ui.tsx` | Base da busca territorial — só busca município; precisa de resolução de estado por nome (ver §5) |
| `THEMES` | `components/territory/territory-ui.tsx` | Já é exatamente a lista de 5 temas (`saude`, `educacao`, `seguranca`, `bem-estar`, `infraestrutura`) — reaproveitar em vez de recriar |
| `paintStateMap` + `mapMarkup` (`brazil-map-markup.tsx`, `state-map-paint.tsx`) | — | Mapa real do Brasil por UF, já usado em `/estados` com ramp sequencial — é o mapa a reaproveitar nas seções 5 e 6 do mock, não uma imagem decorativa |
| `sequentialRamp`/`emptyFill` (`lib/scale.ts`) | — | Legenda e cores do mapa analítico |
| `loadStates()` | `lib/exec-territory.ts` | População por UF (ano mais recente por UF), base da soma nacional |
| `GovernorCard`-style Suspense pattern | `components/territory/governor-card.tsx` | Padrão para carregar painéis pesados sem bloquear o hero |

Não existe ainda um "Atlas nacional por indicador" (mapa do Brasil colorido por valor de indicador, com seletor) — isso é novo, mas construído sobre o mesmo mapa/ramp já usados em `/estados` (coloridos por população), só trocando o valor pintado.

## 3. Matriz de viabilidade — os 5 números do painel "Brasil em números" do mock

| Dado do mock | Real? | Valor real verificado | Fonte/competência |
|---|---|---|---|
| 212.583.750 habitantes | Próximo, mas não exato | **214.211.951** (soma das 27 UFs, ano mais recente por UF) | `civica_exec.exec_territory_population`, 2026 |
| 5.570 municípios | Quase — falta Fernando de Noronha | **5.571** (5.570 municípios + distrito estadual de Fernando de Noronha, já contado como entidade própria no catálogo) | `civica_exec.exec_entity kind=4`; mesma contagem que `/municipios` já anuncia ("Busque qualquer um dos 5.571 municípios brasileiros") |
| 27 UFs | Sim, exato | 27 | trivial |
| 6.835 hospitais (CNES, 2025) | Próximo, não exato | **6.636 hospitais** (tipo 5/7), 501.726 estabelecimentos no total, competência mais recente **2026-09** | `civica_exec.exec_sau_cnes_estab_v` |

**Decisão:** usar os valores REAIS acima (não os do mock), com a competência real de cada um — nunca copiar os números do mock como se fossem publicados.

## 4. Matriz de viabilidade — os 5 cards temáticos

| Módulo | Fonte existente | Granularidade nativa | Nacional já existe? | Valor real verificado | Comparável? | Implementação |
|---|---|---|---|---|---|---|
| **IDHM** (cruza os 5 temas) | `exec_idhm_territory` | Decenal (1991/2000/2010) | **Sim** — linha `territory_level='BRASIL'` já publicada | **0,727 (2010)** — não 0,760/2021 do mock (não temos 2021; é uma estimativa do Atlas PNUD que nossa fonte não cobre) | Sim, mesma série | Usar `getHdiSeries(pool, {level:'BRASIL'})`, já existente, zero código novo |
| **Bem-estar** (renda) | `civica_exec` wellbeing (indicador `WB-INC-RDPC-MEAN`) | UF/município, mas **entidade Brasil (entity_id=76) já tem observação própria** | **Sim** | **R$ 1.638,06/mês** — renda domiciliar per capita **média** (IBGE, 2022–2023) — não "mediana R$1.100" do mock (mediana nacional não é recalculável a partir de medianas estaduais; usamos a média real, que é o que a fonte publica nesse grão) | Sim | `getWellbeingOverview(pool, {entityId:76})`, já existente, zero código novo |
| **Infraestrutura** (saneamento) | `civica_exec` infraestrutura (indicador `IES0001`, SNIS) | `InfrastructureTerritory.level` já aceita `'BRASIL'` como valor de primeira classe | **Sim** | **62,3%** de atendimento com rede coletora de esgoto (SNIS, 2024) — o mock mostrava 62,0%/2022, perto mas não exato | Sim | `getInfrastructureIndicators(pool, {level:'BRASIL'})`, já existente, zero código novo |
| **Educação** (Ideb) | `educacao-analytics-read.ts` | Função de comparador já calcula `{municipality, state, brazil}` para Ideb — confirma que existe um Ideb-Brasil oficial na base | A confirmar o valor exato na implementação (E3) | A buscar em E3 | Provavelmente sim (é o Ideb nacional oficial do INEP) | Reaproveitar o mesmo padrão comparador; sem tabela nova |
| **Segurança** | `organized-crime.ts` (`getOrganizedCrimeNational`), `efetivos-read.ts` (`getSecurityStaffingNational`) | Nacional **já existe e já é validado** — soma por UF com regra explícita de não dupla-contagem | Sim, mas cobre **crime organizado** (ex. registros de tráfico) e **efetivo policial**, não "homicídios por 100 mil hab" como o mock assumia | Série 2015–2025 real, ex. 184.328 registros de tráfico em 2024 | Sim (já validado internamente) | Reaproveitar `getOrganizedCrimeNational`/`getSecurityStaffingNational`; **trocar o indicador do card de "homicídios" para o que realmente existe em grão nacional validado**, com nome real |
| **Saúde** (leitos) | `exec_sau_cnes_leito_v` (CNES) | Por UF/município nativamente; nacional não tem função pronta, mas é SUM válido (registro censitário) | Não havia função pronta — ** 1 query nova de leitura** (sem tabela nova) | **543.524 leitos totais** → **2,54 leitos por mil habitantes** (bate com o mock, que rotulava errado como "por 10 mil hab.") | Sim | Nova função de leitura simples, sem persistência — permitida pelo mandato §15.1 |

## 5. Busca territorial (estado OU município)

`MunicipalFinder` só busca município (`findMunicipalities`), sem reconhecer nome de estado. Não existe hoje um resolvedor único "nome → rota territorial". **Decisão para E1:** uma rota de resolução nova e pequena (`app/executivo/buscar/route.ts`, redirect HTTP puro, sem JS de cliente) que: (1) tenta casar o termo com uma UF (sigla ou nome, via `loadStates()`, já carregado) → redireciona para `/estados/{uf}`; (2) senão, redireciona para `/municipios?q={termo}` (página de busca já existente e madura). Não duplica índice de município nenhum.

## 6. Limites confirmados (nada será violado)

- Nenhuma migration, nenhuma tabela nova — as únicas adições de leitura são (a) a soma nacional de leitos/hospitais CNES (consulta nova, sem persistência) e (b) reaproveitamento de funções que já existem e já passam por `entity_id=76`/`level='BRASIL'`.
- A coleta PNCP 2025-2026 (P9.5) e qualquer processo independente não foram tocados nem verificados como rodando — não há necessidade de interagir com eles nesta fase (seção de finanças usa dados já publicados, não dispara nova coleta).
- Porta 3000 do usuário não foi derrubada — todo teste roda contra o servidor de dev já ativo.

## Gate E0

Todos os 8 números do painel nacional do mock têm uma fonte real verificada (4 com valor igual ou muito próximo ao mock; 1 corrigido de forma relevante — IDHM 2021→2010). Os 5 cards temáticos têm indicador nacional real identificado para 4 deles (IDHM, bem-estar, infraestrutura, segurança — este último com indicador trocado por um que realmente existe); Educação e Saúde ficam para confirmação final de valor exato durante a implementação (E3), não há bloqueio de viabilidade. **Pronto para iniciar E1.**
