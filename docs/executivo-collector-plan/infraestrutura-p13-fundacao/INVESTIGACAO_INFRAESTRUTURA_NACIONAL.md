# P13.0 — Investigação nacional de infraestrutura

Data da execução: 2026-10-29. Banco consultado: `projetoeleitor_db`; schema: `civica_exec`. Esta entrega não alterou frontend, coletores de outras áreas ou dados de produção.

## Resultado executivo

O motor nacional de indicadores já existe e está publicado em `civica_exec`. Há 5.571 entidades municipais atuais, 27 UFs, Brasil e agregados; o banco mede 33.960.234.131 bytes no início da P13. Não há indicadores ou tabelas próprias de SINISA/infraestrutura nacional. Existem dados de infraestrutura escolar (propriedade Educação) e frota/infrações (propriedade Transporte), que não devem ser reaproveitados como saneamento.

Os cinco recursos SINISA 2025 (ano-base 2024) responderam com HTTP 206, MIME correto, assinatura `PK\x03\x04` e tamanho total informado pelo servidor. A aquisição integral ficou bloqueada porque o volume `D:` exigido pelo contrato não está montado neste ambiente. Nenhum arquivo grande foi salvo em `C:` e nenhum valor foi publicado sem RAW e staging íntegros.

## Auditoria do banco

| Evidência | Resultado |
|---|---:|
| Banco atual | `projetoeleitor_db` |
| Tamanho inicial | 33.960.234.131 bytes |
| Entidades municipais atuais | 5.571 |
| UFs atuais | 27 |
| Indicadores por domínio | Saúde 40; Educação 29; Segurança 462; Bem-estar 27 |
| Indicadores de infraestrutura P13 | 0 |
| Publicações ativas | 36.389 |
| Manifestos RAW | 21.227 |
| Datasets SINISA no banco | 0 |

Tabelas com nome relacionado a infraestrutura são específicas de outros domínios: `exec_edu_infra_year` (3.597.617 linhas), `exec_edu_infra_agg` (3.963), `exec_edu_infra_cov` (513), `exec_tra_frota_mun_mes` (919.256), `exec_tra_infr_uf_mes` (425.724) e `exec_tra_cov` (9.099). A auditoria de colunas confirma que as primeiras descrevem escolas e as segundas frota/infrações; não são fatos SINISA.

## Armazenamento e segurança

`Get-PSDrive -PSProvider FileSystem` retornou somente `C:`. `Test-Path D:\Civica\raw\infraestrutura` e `Test-Path D:\Civica\staging\infraestrutura` não podem ser satisfeitos porque a unidade D: não existe neste ambiente. O espaço livre de C: era aproximadamente 32,5 GB, mas o mandato proíbe usar C: para RAW/staging. Não houve download integral, alteração global de segurança, exclusão de dados ou interrupção de PNCP.

## Propriedade e reuso

- `exec_entity`, `exec_ind_def`, `exec_ind_value`, `exec_ind_latest`, `exec_ingestion_run`, `exec_raw_manifest` e `exec_publication` são o contrato canônico comum.
- SINISA deve ganhar indicadores novos em `exec_ind_def`, com códigos source-native versionados; não criar tabela municipal paralela.
- A tabela de população/território existente pode fornecer denominadores, mas não deve preencher ausência de resposta SINISA.
- Educação, Saúde, Segurança, Bem-estar e Executivo mantêm propriedade e revisão independentes.

## Gate P13.0

`P13_0_STATUS=PASS_WITH_DOCUMENTED_STORAGE_BLOCKER`. Fundação, ownership, fontes, orçamento e desenho estão documentados; a carga SINISA não pode ser iniciada até existir D: (ou outro volume explicitamente autorizado no mesmo contrato).
