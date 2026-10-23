# Republicação, histórico e periodicidade proposta (G17) — sem scheduler

Nenhum agendamento foi configurado. Os comandos abaixo são **idempotentes** (mesma fonte + mesma versão de parser → `NO_CHANGE`) e podem ser chamados manualmente ou por um scheduler futuro.

## Comandos

```
node --import tsx scripts/exec/efetivos-pilot.ts fetch                 # baixa/valida as 5 fontes para o RAW (SSD) sem publicar
node --import tsx scripts/exec/efetivos-pilot.ts fbsp                  # Raio-X FBSP (fatia nacional; competência = ano dos dados)
node --import tsx scripts/exec/efetivos-pilot.ts estadic [2019|2023]   # uma fatia nacional por edição
node --import tsx scripts/exec/efetivos-pilot.ts munic [UF,…] [2019|2023]   # 27 fatias por edição
node --import tsx scripts/exec/efetivos-pilot.ts siape AAAAMM[,…]      # agrega e descarta o original
node --import tsx scripts/exec/efetivos-pilot.ts all                   # FBSP + ESTADIC + MUNIC
```

## Fatias, versões e hash

| Fonte | Fatia (dataset × uf × competência) | Hash da fatia | Muda quando |
|---|---|---|---|
| FBSP | 24 × 0 × AAAA01 | SHA-256 do PDF + versão do publicador + versão do extrator | PDF republicado com outro conteúdo, parser novo |
| ESTADIC | 25 × 0 × AAAA01 (edição) | SHA-256 da planilha + versões | idem |
| MUNIC | 26 × UF × AAAA01 (edição) | SHA-256 da planilha + versões | idem |
| SIAPE | 27 × 0 × AAAAMM | SHA-256 do zip original (guardado no agregado) + versões | arquivo do mês reprocessado pela CGU |

- **Fonte republicada com conteúdo diferente** → nova versão (pasta com a data no RAW, nunca sobrescreve) → hash novo → a fatia é substituída **com change log** (`I/U/D`), linhas que somem do arquivo são removidas, `exec_ind_latest` é refeito só nos pares tocados.
- **Rollback exato** de qualquer publicação por `rollbackRun` (inverso do change log), com verificação do hash pós-rollback; testado para FBSP, ESTADIC, MUNIC e SIAPE.
- **Edições diferentes não se tocam**: janelas de período disjuntas (2018-12-31, 2019-01-01, 2022-12-31, 2023-01-01) e fatias distintas; republicar a 2023 não altera a 2019 (teste de integração).
- **Checkpoint** = a própria publicação (`exec_publication`, `exec_ingestion_run`); falha injetada em qualquer ponto deixa o estado anterior intacto.
- **Reconciliador**: cada publicação roda `verify` na mesma transação (FBSP: Σ UFs = Brasil; ESTADIC: soma no banco = soma do arquivo; MUNIC: Σ municípios = agregado da UF = arquivo). Divergência aborta tudo.
- **Histórico**: duas edições (ESTADIC, MUNIC) não formam série anual; nenhum valor foi gerado para anos sem edição.

## Periodicidade proposta (a decidir; não implementada)

| Fonte | Frequência real | Proposta de verificação | Observação |
|---|---|---|---|
| FBSP Raio-X | edições bienais/anuais (2ª edição em 2026) | 1×/ano no 2º semestre: `fetch` e comparar o hash da URL conhecida; nova edição = nova URL a registrar | a URL é fixa por edição; os layouts mudam entre edições (o extrator aborta em layout novo) |
| ESTADIC | pesquisa periódica; só algumas edições trazem o bloco Segurança Pública (2014, 2019, 2023) | 1×/trimestre listar `https://ftp.ibge.gov.br/Perfil_Estados/` e procurar nova edição com aba "Segurança Pública"; 2024 **não** tem o bloco | exige conferir dicionário antes de publicar |
| MUNIC | idem (2019 e 2023 têm o bloco; 2018, 2020, 2021 e 2024 não) | idem para `Perfil_Municipios` | idem |
| SIAPE | mensal; arquivo do mês M disponível ~40 dias depois (202608 em 09/10/2026) | mensal, dia 15: coletar M−2 (`siape AAAAMM`) | só PF/PRF, só contagens; não há razão para backfill completo: os meses ausentes continuam ausentes |

## Retenção e privacidade

O zip do SIAPE (80 MB, com dados pessoais) é baixado para o staging, agregado em memória e **apagado**; o manifesto guarda URL, hash e tamanho (`state = 3`, original descartado). Fica no RAW apenas o agregado por órgão (`seguranca/efetivos/siape-agg/AAAAMM_*.agg.json.gz`), permitindo reprocessar sem baixar. O change log não teve retenção aplicada (decisão fora desta onda).
