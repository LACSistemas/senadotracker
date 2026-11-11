# P14.0 — Investigação nacional do Poder Judiciário

**Data de fechamento:** 2026-11-04  
**Escopo:** investigação e arquitetura; nenhum collector, migration, backfill, carga de processo ou mudança de frontend foi executado.

## Resumo executivo

O Cívica já tem evidência suficiente para um primeiro produto nacional **institucional e por tribunal** usando a base oficial Justiça em Números (JN). A JN oferece série anual, indicadores oficiais e denominadores; o DataJud é adequado para estrutura processual, movimentos, qualidade e atualizações controladas, mas não deve ser espelhado nem usado antes de revisão jurídica. A melhor ordem é JN → identidade institucional → estrutura territorial validada → piloto STJ/tribunais com licença clara → DataJud agregado somente após autorização.

As investigações anteriores foram recuperadas dos arquivos [investigacao_judiciario.md], [investigacao_judiciario_p2.md] e [investigacao_judiciario_p3.md]. P1–P3 permanecem a evidência primária de contagens e amostras; esta fase atualiza o estado documental. O DataJud continua tecnicamente acessível por API, porém o termo v1.2 impõe finalidade não comercial, proíbe exploração/redistribuição comercial de dados ou derivados e exige comunicação de estudos públicos ao CNJ. Portanto `DATAJUD_NATIONAL_INGESTION_AUTHORIZED=NO` e `DATAJUD_LEGAL_REVIEW_REQUIRED=YES`.

## Fatos comprovados

- Banco oficial: `projetoeleitor_db`, leitura read-only confirmada; tamanho observado 34.621.951.123 bytes (~34,6 GB).
- Não há schema, tabela, migration ou índice específico do Judiciário no banco nem código de collector judicial no repositório.
- P1 comprovou 64 aliases DataJud, ~350,8 milhões de documentos e esquema consistente em 13 amostras; a página atual de endpoints lista 91 aliases, acrescentando 27 TREs. Os 27 aliases novos ainda não foram consultados.
- P2 comprovou a base JN estruturada: 1.595 linhas tribunal×ano, 2009–2025, 1.314 colunas/dicionário; 613 linhas de seção judiciária federal 2012–2025. Fórmulas de congestionamento reproduzem o indicador oficial.
- P1/P2/P3 comprovaram STJ CKAN aberto, atas diárias, espelhos, pautas, precedentes e folha nominal; esse é o piloto individual mais sólido, sem extrapolar para produtividade nacional.
- DataJud não fornece partes, valor da causa, magistrado ou inteiro teor. `orgaoJulgador` é unidade, não pessoa; relações gabinete→magistrado são específicas por tribunal.
- Territorialidade é parcial: município IBGE em algumas unidades indica localização física, não comarca atendida ou origem do processo.

## Decisão de arquitetura

Reutilizar PostgreSQL e contratos de revisão já existentes. Um futuro `civica_jud` é aceitável como namespace aditivo, desde que compartilhe dimensões territoriais e identidade existentes e mantenha RAW no `D:\Civica\judiciario`. O primeiro serving deve ser agregado, versionado e auditável; processos individuais ficam fora do MVP.

## Gates e resultado

| Gate | Estado | Evidência |
|---|---|---|
| G0–G5 repositório/banco/P1–P3 | PASS | consultas read-only; arquivos P1–P3 |
| G6–G8 institucional/identidade/território | PASS_WITH_CAVEATS | mapa e matriz territorial; cadastro nacional de jurisdição não comprovado |
| G9–G10 JN 2026/série | PASS_WITH_CAVEATS | portal JN 2026 ano-base 2025; base baixável validada em P2 |
| G11–G14 DataJud | LEGAL_REVIEW_REQUIRED | Wiki/termo; limites e cobertura P1/P2 |
| G15 norma 2026 | PASS_WITH_CAVEATS | Portaria 374/2026 vigente; Portaria Conjunta 2/2026 muda dicionários |
| G16–G18 TPU/painéis/pessoal | PARTIAL | WebService documentado; painéis Qlik e MPM públicos agregados |
| G19–G23 STJ/finanças/temas/comparabilidade | PARTIAL | STJ aberto; pagamentos e temas são fragmentados |
| G24–G28 privacidade/licença/armazenamento/arquitetura/produto | PASS_WITH_CAVEATS | riscos e contratos deste pacote |
| G29–G31 roadmap/MVPs | PASS | documentos 21–22 |
| G32–G34 proteção P13/PNCP/no-write | PASS | nenhum processo PNCP interrompido; transação read-only |

**P14_0_STATUS=PASS_WITH_CAVEATS**. A P14.1 não foi iniciada. O bloqueador material é jurídico/licenciamento do DataJud, não falta de capacidade técnica.

## Próximas decisões

1. Obter parecer sobre o termo DataJud e política de derivados.
2. Implementar JN e cadastro institucional em P14.1–P14.2.
3. Tratar STJ como vertical licenciada e independente.
4. Só então desenhar piloto DataJud agregado, com limites e last-known-good.
