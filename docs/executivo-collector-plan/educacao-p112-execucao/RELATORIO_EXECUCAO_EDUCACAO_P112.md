# P11.2 — Relatório de execução do Censo da Educação Superior

Data da execução: 27/10/2026. Banco: `projetoeleitor_db`, schema `civica_exec`. RAW e staging: `D:\Civica`. Nenhum frontend foi alterado.

## Resultado executivo

Foram publicados integralmente os microdados oficiais do Censo Superior de 2022, 2023 e 2024. A carga final é a revisão operacional `run_id=4`, parser `p112-2026-10-27-v3`, com 1.964.978 ofertas, 2.792 IES estáveis, 50.577 códigos de curso e 10.439 linhas compactas territoriais (Brasil, UF e município).

| edição | IES-ano | linhas de curso/oferta | cursos distintos | colisões na chave antiga | municípios resolvidos |
|---:|---:|---:|---:|---:|---:|
| 2022 | 2.595 | 573.019 | 45.296 | 396 | 563.416 linhas |
| 2023 | 2.580 | 671.610 | 46.317 | 461 | 660.571 linhas |
| 2024 | 2.561 | 720.349 | 46.150 | 452 | 708.571 linhas |

Em 2024, o recorte nacional soma 317 IES públicas, 2.244 privadas, 3.551 municípios com oferta territorialmente resolvida, 10.227.266 matrículas, 5.010.613 ingressantes, 1.333.988 concluintes e 23.665.419 vagas. No acumulado dos três anos: 29.648.599 matrículas, 14.761.762 ingressantes e 3.996.412 concluintes.

## Semântica e limites

`CO_IES` e `CO_CURSO` são identidades source-native; fatos anuais não sobrescrevem a história. A chave de oferta é `ano + CO_IES + CO_CURSO + CO_MUNICIPIO + TP_MODALIDADE_ENSINO + TP_DIMENSAO`. As dimensões 3 e 4 do Censo são mantidas, mas não recebem município/UF inventado. EAD com dimensão somente Brasil/exterior entra no Brasil e fica fora das comparações municipais/estaduais.

## Prontidão

- `READY_FOR_P11_3_QUALITY = YES_WITH_CAVEATS`: infraestrutura e dados reais estão prontos; reconciliação Sinopse não foi executada porque o download oficial estava indisponível nesta execução.
- `READY_FOR_HIGHER_ED_FRONTEND = YES`: contratos de leitura e comparação descritiva estão implementados; não autoriza publicação automática.
- `READY_FOR_PUBLIC_PUBLICATION = NO`: falta fechar reconciliação metodológica e revisão jurídica/editorial.
- `HISTORICAL_COVERAGE_COMPLETE = NO`: primeira edição operacionalizada é 2022; a fonte possui edições anteriores ainda não carregadas.

Não iniciar P11.3 automaticamente.
