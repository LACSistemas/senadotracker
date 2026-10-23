# P9 — Plano de execução futura (Segurança Pública)

Plano de ondas, **sem execução**. A ordem foi alterada em relação ao exemplo do prompt: a primeira onda usa o SIM já preservado (custo de coleta zero) e o trânsito nacional entra cedo porque suas fontes são nacionais e municipais. Códigos de fonte (S..) e de indicador (IND.SEG...) referem-se a `…_fontes.json` e `…_indicadores.csv`.

Regras comuns a todas as ondas: reutilizar `exec_entity`, `exec_ind_*`, `exec_publication`, `exec_raw_manifest`, `exec_story`, `run-queue.ts`, `assertVolume`/`assertPgHeadroom`; RAW em `D:\Civica\raw`; **agregar em streaming e nunca persistir pessoa, vítima, endereço ou coordenada**; nenhum índice único de segurança; todo indicador de crime com nota “registro ≠ crime provado” e todo indicador de vítima distinguido de ocorrência.

## Ordem recomendada

P9.1 → P9.2 (SIM trânsito + RENAEST + Senatran) → P9.3 (efetivo e GM) → P9.4 (prisional) → P9.5 (finanças) → P9.6 (estados) → P9.7 (crime organizado, somente produtos A/B).

---

## P9.1 — Criminalidade nacional (UF e município nacional)

| Item | Conteúdo |
|---|---|
| Fontes | S04 SIM (RAW local), S01 VDE, S03 Atlas (somente reconciliação) |
| Collectors reutilizados | leitura de DBC do SIM da P1 (sih/sim), crosswalk territorial, publicação por fatia |
| Novos | collector VDE (xlsx anual com GET/Range e User-Agent de navegador; guarda não-zero + marcador de universo); crosswalk UF+nome → IBGE com 33 exceções (27 “NÃO INFORMADO” + 6 grafias) |
| Dependências | população SIDRA 6579 (denominadores; 2007, 2010, 2022, 2023 sem estimativa); contrato de indicadores IND.SEG.A01–A24 |
| Escala | SIM ≈ 0,7 M linhas derivadas; VDE ≈ 1,2 M não-zero em 12 anos (≈ 103 mil/ano) |
| Riscos | resíduo de causa indeterminada (SP, MG, RJ); VDE ≠ SIM; zeros “não reportado”; reescrita anual dos arquivos VDE |
| Gate | contagem VDE por UF/ano e SIM por município reconciliada com o Atlas (ES 2023 = 1.161, ES 2024 = 1.064) |
| Aceite | 27 UFs × 2015–2026 (VDE) e 5.570 municípios × 2013–2025p (SIM); taxa com resíduo ao lado; nota metodológica visível; teste de conciliação automático |
| Produto possível | “Mortes violentas no seu município” (SIM) e “Crimes por estado” (VDE), com série histórica e comparação com UF e Brasil |

## P9.2 — Trânsito e Detran

| Item | Conteúdo |
|---|---|
| Fontes | S04 (V01–V99 + Y85.0), S70 frota, S72 RENAEST, S73 PRF, S71 infrações, S74 Detrans (apenas inventário) |
| Collectors reutilizados | SIM (P9.1), território |
| Novos | Senatran (xlsx mensal; snapshots de dezembro + último mês); RENAEST (ZIP trimestral; leitura em fluxo; agregar município×mês); PRF datatran (Drive, um ZIP/ano) |
| Dependências | crosswalk por nome para Senatran (5.529 de 5.572) e PRF; cobertura de relato do RENAEST como indicador (IND.SEG.F12) |
| Escala | frota ≈ 5.572 × 7 × 14 pontos; RENAEST ≈ 0,84 M linhas agregadas; RAW ≈ 4 GiB |
| Riscos | RENAEST cobre 23 UFs em 2024 (sem AP, MA, PA, RN); RS só reporta fatais; DF = 1 município; sobreposição entre RENAEST, PRF e VDE; infrações por UF de jurisdição do veículo |
| Gate | contagem de UFs reportantes por ano; ES 2023 = 972 (RENAEST) × 819 (SIM) explicado e documentado |
| Aceite | nenhuma soma entre bases; cada gráfico mostra cobertura; veículos por mil habitantes com população do ano |
| Produto possível | “Frota e mortes no trânsito do seu município” |

## P9.3 — Estrutura policial (efetivo e guardas municipais)

| Item | Conteúdo |
|---|---|
| Fontes | S06 Raio-X FBSP, S07 ESTADIC, S08 MUNIC, S09 SIAPE (somente totais) |
| Collectors reutilizados | leitura de xlsx/IBGE da fundação territorial |
| Novos | carga do MUNIC (guardas, delegacias) e ESTADIC; extração assistida das tabelas 2–15 do PDF do FBSP com conferência manual (SP e RS) |
| Dependências | decisão sobre onde guardar efetivo por UF × corporação × data (indicador ou tabela dedicada); dado de data de referência por UF |
| Escala | pequena (< 15 mil linhas) |
| Riscos | previsto × existente × vínculo × lotação; FBSP e ESTADIC com datas e conceitos distintos; PF/PRF sem UF; PISP descontinuada |
| Gate | totais do PDF batem com a tabela 2 (Brasil: 818.521) |
| Aceite | cada valor com data, fonte e conceito; PM/PC/município **não publicados** (sem fonte); PF/PRF apenas nacionais |
| Produto possível | “Efetivo por mil habitantes” por UF e “Guarda municipal” por município |

## P9.4 — Sistema prisional

| Item | Conteúdo |
|---|---|
| Fontes | S50 SISDEPEN (ciclos 11º–19º), S51 Anuário |
| Novos | cadastro de estabelecimentos (1.532 no 19º ciclo) com Código IBGE; carga das colunas de capacidade e população por regime e gênero |
| Dependências | contrato de colunas: quais das 1.737 definem vagas e população (somas ingênuas dobram sub-colunas); 3 estabelecimentos sem código IBGE exigem tratamento |
| Escala | ≈ 29 mil linhas largas (1.532 × 19 ciclos) |
| Riscos | mudança de formulário entre ciclos; ocupação superior a 100 % é possível e legítima; ausência de unidade em ciclos antigos |
| Gate | contagem de estabelecimentos por UF bate com `sisdepen_uf.json` (ex.: ES 56) |
| Aceite | nenhuma unidade sem fonte; população nunca por pessoa; taxa de ocupação só após contrato |
| Produto possível | “Presídios do seu município” com vagas, população e presos provisórios |

## P9.5 — Finanças de Segurança

| Item | Conteúdo |
|---|---|
| Fontes | S80 Siconfi função 06, S81 Portal da Transparência (União), S82 Anuário (fundos), S83 contratos (P3/P4) |
| Collectors reutilizados | collector financeiro único (`exec_fin_fact`), RAW do Siconfi já preservado (ES e Vitória 2024) |
| Novos | filtro função 06 para todos os entes; leitura de `despesas-execucao` (zip mensal) para PF, PRF e DEPEN |
| Dependências | distinguir dotação, empenho, liquidação e pagamento; população anual para per capita |
| Escala | ≈ 0,67 M linhas em `exec_fin_fact` (5.600 entes × 4 subfunções × 3 colunas × 10 exercícios) |
| Riscos | 403 em `/despesas/2025`; entes que não entregam RREO; função 06 inclui Defesa Civil |
| Gate | ES 2024 = R$ 2.542.606.519,59 empenhados; Vitória 2024 = R$ 76.842.715,85 |
| Aceite | cada valor rotulado com a fase da despesa; per capita só com denominador oficial |
| Produto possível | “Quanto o seu estado e município gastam em Segurança” |

## P9.6 — Criminalidade municipal por estado

Integrações por UF, em ordem de maturidade: **RJ** (S20/S21, IBGE nativo, 62 colunas, CISP), **MG** (S22, truncar zeros futuros), **ES** (S24), **RS** (S23), **CE/PE/AL** (CVLI), **DF** (por RA), **SP** (S25, somente agregação em streaming, 200 MB/ano). BA, GO, PR, PA, PI, MT, MS, TO, AM e MA precisam de validação prévia; SC, SE, AC, AP, RN, PB, RO e RR não têm fonte localizada (retestar antes de decidir).

| Item | Conteúdo |
|---|---|
| Collectors reutilizados | padrão da P9.1 (arquivo → agregado → publicação) |
| Novos | um adaptador por UF com contrato próprio e dicionário de naturezas |
| Dependências | P9.1; decisão de privacidade para RAW de SP, RS, ES, CE, PE, AL |
| Escala | RJ ≈ 14 mil × 50 medidas; MG ≈ 133 mil linhas/ano; ES ≈ 65 mil agregadas; SP agregado ≈ 0,6 M (cenário C) |
| Riscos | definições diferentes por UF; comparabilidade ruim; arquivos grandes; dados pessoais nos microdados; dependência de portais instáveis (MS, SC, RN) |
| Gate | por UF: total estadual = total publicado pela própria SSP |
| Aceite | cada UF publicada com taxonomia própria; **nenhum ranking entre UFs** com naturezas diferentes |
| Produto possível | “Crimes no seu município” por UF, com nota de fonte e definição |

## P9.7 — Crime organizado (somente o que é sustentável)

| Item | Conteúdo |
|---|---|
| Fontes | S60 (relatório resumido SENAPPEN), S61 (Fogo Cruzado, referência não oficial) |
| Produtos permitidos | **A:** catálogo de relatórios oficiais (título, data, órgão, link). **B:** indicadores gerais de violência (P9.1, P9.4, P9.6) **sem** atribuição a organizações |
| Produtos não permitidos | **C:** mapa de presença ou controle territorial; nomes de integrantes; localização de pavilhões por organização |
| Riscos | inferência indevida; exposição de pessoas; fonte não oficial; informação sigilosa |
| Gate | revisão metodológica e jurídica antes de qualquer página pública |
| Aceite | texto explícito de que o catálogo não mede presença territorial |
| Produto possível | “O que as fontes oficiais dizem sobre organizações criminosas” (catálogo) |

---

## Dependências entre ondas

```
P9.1 ──► P9.2 ──► P9.6
   │         ▲
   └─► P9.3 ─┘ (denominadores e territorio)
P9.4 independente (apenas território)
P9.5 depende do collector financeiro da Saúde
P9.7 depende de P9.1, P9.4 e P9.6 e de revisão metodológica
```

## Capacidade necessária

PostgreSQL ≈ 1,0 GiB (cenário A) a 2,9 GiB (cenário C) sem histórico de mudanças, e até 6,3 GiB com `exec_change_log` completo (aplicar a retenção de 12 meses antes de iniciar). SSD ≈ 13,4 GiB iniciais + ≈ 7,5 GiB/ano. Detalhe em `…_armazenamento.csv`.
