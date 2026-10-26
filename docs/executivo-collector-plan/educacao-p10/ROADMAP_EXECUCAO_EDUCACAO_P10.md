# Roadmap de execução da Educação (P10.1–P10.10) · G18

Estado: **PASS_WITH_CAVEATS**. Cada fase abaixo tem pré-requisitos, fontes, contratos, migrations previstas, ordem, volume, testes, gates, entregáveis, critério de conclusão e dependências. **Nenhuma fase foi iniciada.** Volumes vêm de `estimativa_armazenamento_educacao.csv` (cenário provável, banco + change log).

Regras que valem para todas as fases: leitura em fluxo de ZIPs; RAW só em `D:\Civica\raw` com `assertVolume`; verificar `C:` ≥ estimativa + 20 GiB antes da carga; cargas em lotes por (ano, UF); cada onda termina com `pg_dump -Fc` em D: e restauração num cluster de teste isolado; publicação só por `publishSlice` (com `rollbackRun`/`replayFrom`); sem aluno/professor individual; sem inferir fechamento de escola por ausência numa edição.

## Ordem e dependências

```
P10.1 identidade ──┬─> P10.2 matrículas ──┬─> P10.4 aprendizagem ──> P10.9 benchmarks ──> P10.10 frontend
                   └─> P10.3 infra/docentes┘                              ^
P10.5 finanças (independe de P10.1, só do RAW Siconfi) ───────────────────┤
P10.6 programas (PDDE depende de P10.1) ──────────────────────────────────┤
P10.7 contratos/obras (obras e contratos não ligam a escola sem chave) ───┤
P10.8 superior (independente) ────────────────────────────────────────────┘
```
P10.5 e P10.8 podem rodar antes de P10.1. P10.9 exige P10.2–P10.5. P10.10 exige P10.9 (e pode publicar por aba à medida que as ondas fecham).

## P10.1 · Identidade de escolas e Censo Escolar (cadastro)
- **Pré-requisitos:** G2, G3, G15 aprovados; migration v9 revisada.
- **Fontes/contratos:** Censo Escolar 2007–2025 (`contrato_censo_escolar.md`, `contrato_identidade_escolas.md`); Sinopse 2025 abas 3.x (reconciliação de contagem de estabelecimentos: 3.2 Brasil = 178.766 estabelecimentos *com matrícula*, não é o total de linhas do cadastro, ver nota 1 da própria aba).
- **Migration:** v9 — `exec_edu_school`, `exec_edu_school_snapshot`, `exec_edu_school_name`, `exec_edu_school_identity`, `exec_edu_cov`; `exec_ref_code` para dependência, localização, situação.
- **Ordem:** (1) migration em cluster de teste; (2) collector `inep-censo.ts` (listagem por página, HEAD, Range, fetchRaw em D:); (3) snapshots 2021–2025; (4) backfill 2007–2020 respeitando a quebra de 2019; (5) reconciliação; (6) publicação.
- **Volume:** ~1,2 GB banco+log; RAW 1,0 GB (2007–2025); staging ≤ 0,6 GB.
- **Testes:** unicidade `CO_ENTIDADE` por edição (esperado 0 duplicados); Σ linhas por edição = linhas do arquivo; município da escola existe em `exec_entity`; mudanças de município/dependência registradas como identidade, nunca sobrescritas; ausência intermitente marcada como `NOT_IN_EDITION`, nunca "fechada"; contagem por UF × Sinopse 3.x (diferença explicada pela regra "em atividade e com matrícula").
- **Gates:** G2, G3, G15 (parte), G17 (parcial).
- **Entregáveis:** migration, collector, testes, relatório de reconciliação, dump de teste restaurado.
- **Conclusão:** 2021–2025 reconciliados com zero divergência não explicada; 2007–2020 carregados ou marcados com cobertura; sem nome de gestor armazenado.
- **Bloqueios:** nenhum externo. Decisão do dono: guardar nome da escola (público) sim, e-mail/telefone/gestor não (ver `contrato_privacidade_educacao.md`).

## P10.2 · Matrículas, turmas e oferta
- **Pré-requisitos:** P10.1 publicada.
- **Fontes:** tabelas de matrícula/turma do Censo (2025 em 6 tabelas; 2007–2024 CSV único); Sinopse 1.x para reconciliação.
- **Migration:** v9b — `exec_edu_school_offer_year`; indicadores territoriais em `exec_ind_def` (faixa de ids livre ≥ 9001, domínio 2).
- **Ordem:** oferta por escola → agregação município/UF/Brasil por SQL (nunca média de médias) → reconciliar.
- **Volume:** ~2,0 GB.
- **Testes:** Σ escolas = município = UF = Brasil = Sinopse (2025: 46.018.380 já provado); matrícula ≠ aluno único (rótulo); etapas aditivas separadas das não aditivas; rede municipal ≠ escolas localizadas no município.
- **Gates:** G4. **Conclusão:** reconciliação 2021–2025 exata; demais anos com diferença documentada. **Bloqueios:** nenhum.

## P10.3 · Infraestrutura e docentes
- **Pré-requisitos:** P10.1.
- **Fontes:** flags de infraestrutura do Censo; docentes do Censo; INEP Indicadores (AFD, IED, IRD, DSU, ICG, ATU, HAD, TDI, rendimento).
- **Migration:** v9c — `exec_edu_school_infra_year`.
- **Regras:** infraestrutura é declaração da escola; vazio ≠ não; quebra de 2019 exibida; docentes **não somam** entre escolas (superconta ≈ 22%): total oficial só do nível de agregação oficial.
- **Volume:** ~2,3 GB; RAW 3,4 GB (2019+). **Testes:** docentes únicos × Sinopse 2.1; vazio de 2022 (4.259 escolas) tratado como não informado. **Gates:** G5. **Bloqueios:** nenhum.

## P10.4 · Aprendizagem (Ideb, Saeb, rendimento)
- **Pré-requisitos:** P10.1, P10.2.
- **Fontes:** Ideb 2025 (Brasil, UFs, municípios, escolas), Saeb 2025 resultados, INEP Indicadores.
- **Migration:** v10 — `exec_edu_school_indicator` (estreito, com flags).
- **Regras:** Ideb de rede **não** é média de escolas; "–" = ausente, não zero; nota e participação separadas; só publicar o que o INEP divulga.
- **Volume:** **~5,8 GB, a maior onda.** Decisão do dono antes: escopo mínimo (só Ideb por escola, 5,5 M linhas) vs provável (18 M) vs pessimista (80 M, não cabe no C:).
- **Testes:** valor da rede = valor do arquivo do INEP; cobertura municipal por UF (mínimo RR = 15). **Gates:** G6. **Bloqueios:** microdados do Saeb inadequados (`NOT_SUITABLE`).

## P10.5 · Finanças (Siconfi função 12 e SIOPE)
- **Pré-requisitos:** nenhum de P10.1. Reuso total do RAW.
- **Fontes:** DCA Anexo I-E (RAW existente, 2014–2025), RREO, SIOPE Olinda (2017+).
- **Migration:** v10b — `exec_fin_cov` generalizado por função; tabelas SIOPE.
- **Ordem:** (1) `financas-build.ts` retém subfunções `12.*` e ref codes; (2) `financas-pilot.ts publish dca 2014-2025 all` com replay; (3) SIOPE como fonte separada (nunca somada à do Siconfi); (4) invariantes.
- **Volume:** ~2,0 GB; RAW novo 0,2 GB (só SIOPE).
- **Testes:** soma RAW = banco (36/36 já provado); Σ subfunções = função 12 (99,98%, 39 divergências em 13 entes de 2017 com rótulo); SIOPE sem linhas de subtotal; função 12 ≠ MDE ≠ Fundeb.
- **Gates:** G7, G8. **Bloqueios:** DF sem SIOPE municipal; funções de remuneração/responsáveis proibidas (PII).

## P10.6 · Programas do FNDE e transferências
- **Pré-requisitos:** P10.1 (PDDE por escola).
- **Fontes:** Portal da Transparência transferências (153 meses), PDDE Info, execução federal (RAW existente).
- **Migration:** v10c — `exec_edu_transfer`, `exec_edu_pdde`, `exec_edu_uex`.
- **Regras:** transferência ≠ gasto final; não somar; PNAE e Fundeb ficam `NEEDS_VALIDATION` até teste; respeitar o limite do Portal (HTTP 405 após ~170 requisições): coleta serial lenta, `HttpGate`.
- **Volume:** ~1,7 GB. **Gates:** G9. **Bloqueios externos provados:** dados.gov.br (401), `dadosabertos.fnde.gov.br` (DNS), `dadosabertos.mec.gov.br` (403). PDDE UF 2025 retorna HTTP 500 (usar município).

## P10.7 · Contratos e obras
- **Pré-requisitos:** nenhum de P10.1. Reuso do RAW do PNCP (5,11 M de contratos, sem novo download).
- **Migration:** v11 — `exec_fin_contract_class` (multitema) e `exec_edu_work`.
- **Regras:** valor contratado ≠ pago; sem vínculo de contrato/obra a escola por similaridade de texto; obras só do Obrasgov (SIMEC exige login); datas finais ausentes (0/332 no ES) mantidas como ausentes; paginação do Obrasgov até página vazia.
- **Volume:** ~0,2 GB. **Gates:** G10, G11. **Conclusão:** auditoria de precisão por amostra ≥ meta definida antes da carga (a v2 do classificador subiu de 3/12 para o núcleo sem `servico_educacional`).

## P10.8 · Educação superior
- **Fontes:** Censo da Educação Superior (30 ZIPs, 750 MB). **Migration:** v11b — IES e oferta de cursos. **Regras:** chave de curso com 461 duplicatas em 2023 exige chave composta; agregados por IES, nunca por aluno. **Volume:** ~1,5 GB. **Gates:** G12. Independente das demais.

## P10.9 · Benchmarks e comparabilidade
- **Pré-requisitos:** P10.2–P10.5. **Fonte de código:** extrair o núcleo de `security-bench.ts` (porte × grupo × cobertura). **Regras:** população do mesmo ano; supressão de célula pequena; sem ranking de escola individual. **Volume:** 0,2 GB. **Gates:** G13, G14. Inclui população por faixa etária (SIDRA 9514, testada com HTTP 200).

## P10.10 · Frontend
- **Pré-requisitos:** P10.9 (ou por aba publicada). **Trabalho:** trocar `THEMES.educacao.ready`, rotas por UF/município, textos em linguagem simples, glossário, estados vazios, acessibilidade (axe). **Testes:** E2E, axe, Lighthouse, verificação de números contra as fontes.
- **Gates:** G15 (completo), G17 (backfill pronto e verificado).

## Riscos transversais
1. Espaço do `C:` (pessimista de 65,8 GB inviável): decidir escopo na P10.3/P10.4.
2. `exec_change_log` sem retenção (decisão do dono, fora da P10).
3. Rede: INEP derruba conexões (retry com espera); Portal bloqueia por taxa.
4. Memória livre baixa: não rodar ETL e testes de integração juntos.
