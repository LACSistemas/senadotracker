# Relatório de execução — Segurança Pública P9.8

Escrito para: o responsável pelo produto (decisão de publicar a experiência de Segurança nas páginas de estados e municípios).

## Resumo
A Segurança virou uma narrativa única em `/estados/[uf]/seguranca` e `/municipios/[ibge]/seguranca`, com vitrine nas visões gerais. Herói de 3–4 indicadores → 6 capítulos → modo especialista com os indicadores exploráveis e CSV. Integra P9.1–P9.7. **Nenhum dado foi alterado** (fingerprints idênticos), nenhuma migration, nenhuma recoleta, `.next` e porta 3000 do usuário intactos (build e servidor de validação isolados em `C:\Projetos\build_p98`, porta 3102).

Detalhes: `ARQUITETURA_UX_SEGURANCA.md`, `DATA_STORYTELLING_SEGURANCA.md`, `CONTRATOS_BENCHMARKS.md`, `MAPA_COMPONENTES.md`, `MATRIZ_INDICADORES_UI.csv`, `VALIDACAO_VISUAL.md`, `VALIDACAO_TERRITORIAL.md`, `PERFORMANCE.md`, `ACESSIBILIDADE.md`, `TESTES_E2E.md`, `results.json`.

## Limitações conhecidas (todas exibidas ao usuário onde aplicável)
1. **Detran**: nenhum dado coletado; a página diz isso e não inventa nada.
2. UF × Brasil não implementado (não existe taxa publicada para o Brasil).
3. Faixa de porte com < 5 municípios → comparação cai para municípios ≥ 20 mil da UF (Salvador, BH).
4. Taxa só em anos com população oficial (sem 2022–2023, sem interpolação) e só para ≥ 20 mil hab.
5. 10 UFs sem fonte municipal de crimes; CE só 2026.
6. Alvos < 24 px (8–9/página) são do cabeçalho/rodapé globais.
7. Sem teste com usuários reais, leitor de tela real ou dispositivo móvel real.

## Respostas Q1–Q28
Formato: resposta · onde · indicadores · benchmark · interação · limitação · evidência visual · teste · status. Capturas em `capturas/`; testes: U = `security-p98.test.ts`, I = integração P9.8, E = `seguranca-p98.spec.ts`.

**Q1 — Herói conta a situação?** Sim: cada KPI traz valor + data-base + variação + régua de comparação + porta de entrada; frase de resposta gerada dos dados. · `lib/security/hero.ts`, `security-hero.tsx` · homicídios, roubos (só com fonte municipal), mortes no trânsito, gasto por habitante etc.; rejeita ocupação prisional, apreensões e patrimônio sem fonte · régua (`BenchRuler`) · "Explorar" · limitação: Alto Rio Novo mostra 3 KPIs · `capturas/*_1440.png` (panorama) · E "herói" · **PASS**.

**Q2 — Começa simples, aprofunda ao rolar?** Panorama → capítulos (pergunta → resposta → evidência → "Fontes e limites" recolhido) → Explorar. · `security-page.tsx`, `ChapterShell` · todos · — · navegação por pílulas, `<details>` · limitação: página longa (HTML 364 KB) · `secao_*` · E · **PASS**.

**Q3 — Leigo entende?** Nomes simples (`CRIME_PLAIN`), frases em português, definições "O que este número é", sem siglas no topo, legenda de estados do dado. · `catalog.ts`, `narrative.ts` · — · — · — · limitação: fontes/limites ainda têm termos técnicos (recolhidos) · `taxa_com_faixa_vitoria_roubo` · U (microcopy) · **PASS_WITH_CAVEATS** (não houve teste com leigos).

**Q4 — Especialista explora?** Painel Explorar com índice, busca, série exata, numerador/denominador/marcas e CSV com metadados. · `explorer-panel.tsx`, `/api/seguranca/{indicadores,serie}` · todos os indicadores exploráveis (MATRIZ: 245 deep_dive + os de capítulo) · série exata · busca, CSV · limitação: sem gráfico multi-indicador livre · captura `explorar` · E (CSV) · **PASS**.

**Q5 — Interações úteis?** Seletor de crime, quantidade×taxa, janela 3/5/10/tudo, anual×mensal, tooltip/teclado, comparação entre municípios, estágios financeiros, CSV, paginação de contratos. · `trend-chart.tsx`, `crime-explorer.tsx` · — · — · todas citadas · limitação: sem zoom livre · `comparar_vitoria_serra` · E · **PASS**.

**Q6 — Benchmarks válidos? Rejeitados?** Ver `CONTRATOS_BENCHMARKS.md`: própria evolução; mesma UF por porte (≥ 5 municípios); ≥ 20 mil da UF; mediana de UFs só para taxas padronizadas. Rejeitados: ranking nacional entre fontes estaduais, contagens absolutas, taxa 2022–23, < 20 mil hab., município × Brasil, ocupação prisional como segurança, gasto absoluto ranqueado, soma estadual+PF/PRF. · `security-bench.ts`, `bench.ts` · — · I (3) + U · **PASS**.

**Q7 — Estrutura PM/PC/guardas/Bombeiros/Perícia clara?** Capítulo Estrutura separa cidade × estado; guarda (MUNIC), delegacia, efetivo estadual com aviso "não é o efetivo lotado no município". · `structure-chapter.tsx`, `build-structure.ts` · MUNIC, efetivos P9.4 · — · — · limitação: efetivo é estadual; Bombeiros/Perícia só onde publicados · captura estrutura · E · **PASS_WITH_CAVEATS**.

**Q8 — Previsto × existente?** Gráfico/cartões "Efetivo existente × quadro previsto — estado de X", diferença em número absoluto e %. · `structure-chapter.tsx` · efetivos previstos/existentes · — · — · só onde a fonte tem os dois · captura estrutura · E · **PASS_WITH_CAVEATS**.

**Q9 — Distinção estadual × municipal?** Rótulos de abrangência em todo bloco; dado só-estadual é "contexto estadual", nunca atribuído à cidade. · `EXCLUSIVE/STATE` em `build-crime.ts` · — · — · — · — · `estado_*`, Salvador · E (Salvador) · **PASS**.

**Q10 — Detran?** Bloco "E o Detran?": informa o que existe (frota e infrações por UF, RENAEST, PRF) e declara que não há dado coletado de Detran (habilitações, multas municipais, fiscalização). Nada inventado. · `structure-chapter.tsx`, `traffic-chapter.tsx` · — · — · — · limitação: lacuna de coleta · captura trânsito/estrutura · E (Detran) · **PASS_WITH_CAVEATS**.

**Q11 — Homicídios, roubos, furtos?** Seletor agrupado (violência letal; contra a pessoa; roubos, furtos e fraudes), 25 tipos em Vitória, séries mensais/anuais, distribuição, definição por crime. · `crime-explorer.tsx`, `build-crime.ts` · VDE, SIM, P9.6 · mediana de porte · seletor · limitação: definições variam por secretaria (aviso "Não comparar com outros estados") · `taxa_com_faixa_vitoria_roubo` · E · **PASS**.

**Q12 — Evolução compreensível/comparável?** Variação entre períodos equivalentes (ex.: jan–set × jan–set), faixa de comparação, lacuna sem interpolar. · `trend-chart.tsx` · — · faixa 1º–3º quartil · janela, mensal · limitação: quedas por cobertura (RENAEST) avisadas só em texto · captura acima · E · **PASS_WITH_CAVEATS**.

**Q13 — Atuação policial sem insinuar?** Capítulo "Apreensões e atuação policial": gráficos separados por abrangência/medida; variação neutra; "o que não existe"; nunca "crime organizado". · `police-chapter.tsx` · P9.7 · sem benchmark (medidas não somam) · — · limitação: alta pode ser mais ação ou mais ocorrência (dito) · captura polícia · U (sem causalidade) · **PASS**.

**Q14 — Prisional?** Unidades, vagas × pessoas, ocupação, regimes, domiciliar, contexto estadual; semestres "1º semestre de AAAA". · `prison-chapter.tsx` · P9.3 · — · gráficos · limitação: descreve a unidade custodiada, não os moradores; município sem unidade ≠ prova de ausência · captura prisional · E · **PASS_WITH_CAVEATS**.

**Q15 — Segurança viária?** Mortes por residência/local, usuários da via, frota, índice frota × mortes, PRF, RENAEST, infrações (UF). · `traffic-chapter.tsx` · SIM, frota, PRF, RENAEST · taxa por 100 mil · alternâncias · limitação: sinistros municipais só onde PRF/RENAEST cobre; ruptura PRF marcada · captura trânsito · E · **PASS_WITH_CAVEATS**.

**Q16 — Orçado/empenhado/liquidado/pago?** Seletor de etapa e modo (R$, por habitante, % da despesa), subfunções, valores correntes sem correção. · `finance-chapter.tsx` · SICONFI/finanças · mediana por habitante · estágios · limitação: gasto não mede eficiência · captura finanças · E · **PASS**.

**Q17 — Contratos/fornecedores?** Tabela paginada de contratos do PNCP (só PJ, sem objeto) com API própria. · `/api/seguranca/contratos` · PNCP · — · paginação · limitação: PNCP parcial (2014–16 DCA e PNCP 25–26 pendentes na P9.5); sem investigação de fornecedor individual · captura finanças · E (tabela) · **PASS_WITH_CAVEATS**.

**Q18 — Criminologista explora minutos?** 462 catalogados; ≈ 250 exploráveis com série exata, comparação entre municípios, CSV, mensal/anual. · Explorar + crime-explorer · ver matriz · — · sim · limitação: sem importar para planilha além do CSV · — · E · **PASS_WITH_CAVEATS** (não validado com especialista).

**Q19 — Casal avaliando mudança?** Panorama em quatro números, frase de resposta, comparação com cidades de porte semelhante, mortes no trânsito, estrutura. · hero + narrativa · — · porte · — · limitação: nada diz "segura/insegura" (por desenho) · capturas de panorama · E · **PASS_WITH_CAVEATS**.

**Q20 — Faltas, supressão, sem benchmark?** Estados distintos: zero explícito, ausente (lacuna), suprimido (× + nota), preliminar (círculo vazado), sem comparação (motivo), só-estadual; legenda `DataStatesLegend`. · `series.ts`, `security-ui.tsx` · — · `status` do benchmark · — · — · `estado_*` · U + I · **PASS**.

**Q21 — Superior a dashboard genérico?** Concretamente: (1) herói com régua válida em vez de KPI solto; (2) benchmark só quando metodologicamente válido, com a razão quando não; (3) lacuna ≠ zero ≠ suprimido; (4) abrangência cidade × estado em cada bloco; (5) frases geradas dos dados sem causalidade; (6) detalhe sob demanda (lazy) com CSV; (7) o que NÃO existe declarado (Detran, objeto de contrato, etc.). · — · **PASS** (afirmação comparativa é de projeto, não medida).

**Q22 — SQLs, tempo, payload?** 39–62 SQLs/página; p95 de dados 71–311 ms; JSON inicial 80–180 KB; HTML 364 KB (56 KB gzip). `PERFORMANCE.md`, `desempenho_camada_de_dados.json` · **PASS**.

**Q23 — Rápida em desktop e mobile?** Desktop: 0,9–1,4 s até rede ociosa, TTFB ≈ 460 ms. Mobile: layout validado em 390/360; sem medição em dispositivo/throttling. · **PASS_WITH_CAVEATS**.

**Q24 — Identidade Cívica?** Reusa tokens, fontes (serif de título), `TerritoryFrame`, `ThemeTabs` e padrão da Saúde; nenhuma biblioteca nova. `MAPA_COMPONENTES.md` · captura · **PASS**.

**Q25 — 462 indicadores avaliados?** `MATRIZ_INDICADORES_UI.csv`: hero 24, capítulo 185, contexto 8, deep dive 245; os demais condicionados/ocultos por restrição estão marcados na própria matriz com motivo. · **PASS** (conferência da contagem: 24+185+8+245 = 462).

**Q26 — Narrativa contínua?** Mesma pergunta→resposta→evidência em todos os capítulos, mesmas regras de estado e comparação, navegação por pílulas e frase de abertura que liga os capítulos; vitrine nas visões gerais leva ao herói. · **PASS_WITH_CAVEATS** (avaliação editorial própria).

**Q27 — Dados reais, sem mocks?** Todas as páginas leem `civica_exec` via read models; `security-page-real-p98.test.ts` e as 17 páginas validadas usam o banco real; mocks só em testes unitários/cluster de teste. · **PASS**.

**Q28 — Testes passaram?** Unit 14/14, integração 7/7, E2E 13/13, `npm test` 463 pass/0 fail/30 skipped, `tsc` limpo, validação de 17 territórios sem erro, a11y sem falha de contraste. · **PASS_WITH_CAVEATS** (30 skipped pré-existentes; alvos < 24 px globais).

## Gates
| Gate | Estado | Evidência |
|---|---|---|
| G_EDITORIAL_STORYTELLING | PASS | `DATA_STORYTELLING_SEGURANCA.md`, capturas |
| G_HERO_SELECTION | PASS | `hero.ts`, matriz (24 hero) |
| G_PROGRESSIVE_DISCLOSURE | PASS | Q2 |
| G_CITIZEN_COMPREHENSION | PASS_WITH_CAVEATS | sem teste com leigos |
| G_EXPERT_EXPLORATION | PASS | Q4, Q18 |
| G_INTERACTION_QUALITY | PASS | E2E |
| G_BENCHMARK_METHODOLOGY | PASS | `CONTRATOS_BENCHMARKS.md`, I |
| G_CRIME_STORYTELLING | PASS | Q11–12 |
| G_STRUCTURE_STORYTELLING | PASS_WITH_CAVEATS | Q7–10 |
| G_TRAFFIC_STORYTELLING | PASS_WITH_CAVEATS | Q15 |
| G_PRISON_STORYTELLING | PASS_WITH_CAVEATS | Q14 |
| G_FINANCE_STORYTELLING | PASS | Q16 |
| G_POLICE_ACTIVITY_STORYTELLING | PASS | Q13 |
| G_DATA_STATES | PASS | Q20 |
| G_VISUAL_QUALITY | PASS_WITH_CAVEATS | 14 passes de correção; avaliação própria |
| G_CHART_USABILITY | PASS | tooltip/teclado/tabela alternativa/lacunas |
| G_ROUTING_INTEGRATION | PASS | 17 territórios 200; Saúde, Legislativo e visões gerais seguem 200 |
| G_PERFORMANCE | PASS_WITH_CAVEATS | p95 dados ≤ 311 ms; sem mobile real |
| G_RESPONSIVE_ACCESSIBILITY | PASS_WITH_CAVEATS | `ACESSIBILIDADE.md` |
| G_TERRITORIAL_CASES | PASS | `VALIDACAO_TERRITORIAL.md` |
| G_TESTS | PASS_WITH_CAVEATS | `TESTES_E2E.md` |
| G_ENVIRONMENT_SAFETY | PASS | porta 3000 e `.next` intocados; sem migration; fingerprints iguais |
| G_USER_QUESTIONS | PASS_WITH_CAVEATS | Q1–Q28 acima |

## Regressão
`npm test`: 493 testes, 463 pass, 0 fail, 30 skipped. Fingerprints de dados P9.7-final × P9.8-final idênticos. `/`, `/estados/ES`, `/municipios/3205309`, Saúde (estado e município) e `/legislativo` respondem 200 no build final.
