# Recuperação e continuidade das investigações P1–P3

Arquivos encontrados na raiz do repositório em 2026-11-04: `investigacao_judiciario.md`, `investigacao_judiciario_p2.md`, `investigacao_judiciario_p3.md`. Eles permanecem intactos; este documento apenas consolida o estado atual.

## Matriz de continuidade

| ID | Fase | Fonte/recurso | Resultado anterior | Evidência | Estado atual | Próximo passo |
|---|---|---|---|---|---|---|
| P1-01 | P1 | DataJud API | 64 aliases; ~350,8M documentos; esquema comum | E01–E08 | SUPERSEDED_IN_SCOPE (página atual lista 91; 27 TREs novos) | validar TREs por amostra controlada |
| P1-02 | P1 | DataJud campos | sem partes, magistrado, valor, documentos | E02/E06 | CONFIRMED_AND_CURRENT | manter agregado |
| P1-03 | P1 | DataJud temporal | estoque em tramitação + baixados desde 2020 | E17 | CONFIRMED_AND_CURRENT | usar censura à direita |
| P1-04 | P1 | DataJud qualidade | 18% TJES sem movimentos; sentinelas; mojibake | E02/E04/E06 | CONFIRMED_HISTORICAL | medir somente em piloto |
| P1-05 | P1 | DataJud termo v1.2 | não comercial; sem redistribuição comercial; notificar CNJ | E01 | CONFIRMED_AND_CURRENT | parecer jurídico |
| P1-06 | P1 | JN/painéis | painéis Qlik; bulk não comprovado | E16 | SUPERSEDED | P2 comprovou base JN estruturada |
| P1-07 | P1 | STJ CKAN | 21 datasets, atas, espelhos, folha | E10 | CONFIRMED_AND_CURRENT | vertical STJ |
| P1-08 | P1 | TSE Processual | autor de decisão nominal sem ID | E11 | CONFIRMED_HISTORICAL | auditoria de papel do autor |
| P2-01 | P2 | JN base | 1.595 linhas tribunal×ano, 2009–2025, 1.314 colunas | relatório P2 | CONFIRMED_AND_CURRENT | P14.2 |
| P2-02 | P2 | MPM | cadastro nacional CPF-keyed; público agregado | relatório P2 | CONFIRMED_AND_CURRENT | sem ingestão nominal |
| P2-03 | P2 | produtividade | antes 2020 MPM; DataJud depois; nominal heterogêneo | relatório P2 | CONFIRMED_AND_CURRENT | não ranquear |
| P2-04 | P2 | TJRJ API | 1.976 órgãos ativos; codOrg não casa DataJud | relatório P2 | CONFIRMED_HISTORICAL | adapter tribunal-específico |
| P2-05 | P2 | STF | acesso programático bloqueado/403 | relatório P2 | BLOCKED_EXTERNAL | fonte manual autorizada |
| P2-06 | P2 | STJ | 29 ministros casados sem ambiguidade; 4.106 docs diários em amostra | relatório P2 | CONFIRMED_HISTORICAL | STJ piloto |
| P3-01 | P3 | JN × DataJud | 54 comparações; mediana 0,88; sem equivalência de contagem | R01–R10 | CONFIRMED_AND_CURRENT | JN para KPIs |
| P3-02 | P3 | TJSP produtividade | PDFs 2017–2022; URLs 2023–26 404 | R03 | CONFIRMED_HISTORICAL | histórico apenas |
| P3-03 | P3 | TJES execução | CSV com empenho/liquidação/pago e favorecido | R05 | CONFIRMED_HISTORICAL | fonte estadual específica |
| P3-04 | P3 | pagamentos nacionais | lacunas federais e execução desigual | R07–R10 | CONFIRMED_AND_CURRENT | não prometer cobertura |

## Divergência nova

A documentação atual de endpoints DataJud lista 91 aliases (incluindo 27 TREs) que não apareciam no inventário de 64 aliases de P1. O número atual vem da tabela oficial de endpoints; nenhuma chamada foi feita nos 27 novos aliases nesta fase.
