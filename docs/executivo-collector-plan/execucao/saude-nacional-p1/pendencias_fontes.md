# Pendências de fontes e metodologia (Saúde Fase 1 — expansão nacional P1)

Data: 2026-10-21.

## APS (e-Gestor) — `NEEDS_VALIDATION` (não é bloqueio externo)

- O G5 registrou HTTP 500 porque os parâmetros testados estavam errados. A rota funciona: `https://relatorioaps-prd.saude.gov.br/cobertura/aps` (também `/ab`, `/sb/v1`, `/sb/v2`) com `unidadeGeografica` ∈ {REGIAO, UF, MUNICIPIO, REGIAO_SAUDE}, `coUf`, `coMunicipio`, `nuCompInicio`, `nuCompFim` (formato `AAAAMM`). Contrato extraído do código do front-end oficial (`relatorioaps.saude.gov.br`, Angular), sem raspagem.
- Série disponível: 01/2021 a 08/2026 (68 competências). Resposta JSON em lista; campos `qtPopulacao`, `qtEsf`, `qtEap*`, `qtCapacidadeEquipe`, `qtCobertura`, `tpOrigemBasePopulacao` (DOU) e `nuAnoReferencia`.
- Piloto ES: 78/78 municípios, 5.304 linhas município-mês, soma municipal = linha da UF, `qtCobertura = qtCapacidadeEquipe / qtPopulacao × 100` recalculado sem divergência. RAW preservado (`raw/egestor-aps/ES/`, SHA-256 no manifesto).
- **Motivo de não publicar:** 84,1 % das linhas município-mês passam de 100 %. É cobertura *potencial* (capacidade das equipes ÷ população do DOU), não cobertura efetiva; a regra de exibição (limite, rótulo) e a ruptura AB→APS de 2021 precisam de decisão metodológica antes de qualquer indicador.
- Expansão prevista: 27 UFs × 1 chamada MUNICIPIO por faixa (≈ 3 MB por UF), ou seja, algumas dezenas de chamadas — baixo custo quando a metodologia for aprovada.

## DEMAS (enriquecimento de nomes e coordenadas) — `PARTIAL`

- Paginação comprovada: `limit` efetivo máximo 20 por página, `offset`, filtro `codigo_tipo_unidade` e `status=1` funcionam; ~0,3 s por página.
- Executado para estabelecimentos **institucionais**: hospital geral (5), hospital especializado (7) e centro de saúde/UBS (2): 50.461 estabelecimentos nomeados, 50.455 com coordenadas válidas (limites do Brasil conferidos), 2 erros HTTP absorvidos por retentativa. RAW em `raw/referencias/demas/`.
- **Não executado de propósito:** consultórios isolados, clínicas e demais tipos (ficam sem nome/coordenada): nomes são frequentemente de pessoas físicas, o que a regra de não persistir dados pessoais individualizados proíbe. Telefone e e-mail nunca são coletados.
- Varredura completa (≈ 25 mil páginas) é tecnicamente viável, mas depende de decisão sobre privacidade.

## Siconfi — `NEEDS_VALIDATION`

- API acessível (entes, RREO, RGF, DCA). Piloto de 5 chamadas (Vitória, ES, Alto Rio Novo), 0,3–1,8 s e 0,5–840 KB cada, sem paginação pendente.
- Reconciliado: Vitória 2024, despesa empenhada na função Saúde até o 6.º bimestre = R$ 503.003.429,15 (≈ R$ 503,0 mi, igual ao P8). ES (estado): R$ 5,157 bi. Município simplificado (Alto Rio Novo): R$ 10,6 mi; o RREO Simplificado traz só os anexos 01, 02, 03, 06, 07, 09 e 14.
- **Anexo 12 (ASPS) retorna vazio** (0 itens) para Vitória e para o estado do ES nesta API (`RREO-Anexo 12`, 2024, bimestre 6). Sem ASPS validado, o indicador de aplicação mínima constitucional segue indisponível. Despesa por função **não é** ASPS e não foi rotulada como tal.
- Nada foi persistido em `exec_fin_fact`: falta o dicionário de contas aprovado e a decisão sobre quais indicadores financeiros (16, 17, 19, 20) são elegíveis. Estimativa para o backfill completo: 170–280 mil chamadas (P8); precisa de orçamento de requisições e checkpoint por ente × exercício.

## Indicadores sem metodologia aprovada (não publicados)

Ocupação de leitos, resolutividade, satisfação, mortalidade materna, cobertura APS efetiva, aplicação mínima em saúde (ASPS), indicadores financeiros 16/17/19/20.

## Fontes e lacunas temporais

- **SIH 202608:** AC e RR não tinham o arquivo `RD*2608` no FTP em 2026-10-20 (25 de 27 UFs). Por regra de não misturar competências incompletas, a série publicada vai até **202607**. Retomar quando os 27 arquivos existirem.
- **População (denominadores):** sem estimativa oficial em 2007, 2010, 2022 e 2023; mantido `noDenominator`, sem interpolação.
- **SIM/SINASC 2025:** preliminar (`stage = 1`); 2026 ainda não existe na fonte.
- **PNI:** arquivo único `Cobertura_Residencia.parquet`; o ano da carga é parcial (flag `partialCoverage`); coberturas acima de 100 % mantidas com o flag `above100`.
- **Códigos de município do DF:** os arquivos do DATASUS trazem códigos de região administrativa (53xxxx, p. ex. 530130). O DF tem um único município; esses registros são atribuídos a Brasília (530010). Registro técnico: `resolveMunicipality` em `apps/collector/src/exec/cnes.ts`.
