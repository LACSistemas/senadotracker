# Riscos, privacidade e licenciamento

| Risco | Evidência | Impacto | Mitigação | Estado |
|---|---|---|---|---|
| termo DataJud não comercial | v1.2, cláusulas 3.3/3.8/3.9 | republicação/comercial | parecer + contato CNJ; agregados mínimos | LEGAL_REVIEW_REQUIRED |
| dados de partes/sensíveis | DataJud público por desenho | LGPD/perfilamento | não ingerir; anonimizar; retenção curta | HIGH |
| nome sem ID | TSE/STJ/folhas | homonímia | source ID ou não ligar | MEDIUM |
| painel Qlik | CNJ remuneração/MPM | automação frágil | usar arquivos oficiais; sem scraping agressivo | MEDIUM |
| STF 403/robots | P1/P2 | cobertura | não contornar; fonte autorizada | BLOCKED_EXTERNAL |
| jurisdição ausente | cadastro nacional não comprovado | municipalização falsa | separar sede/competência/origem | HIGH |
| DataJud qualidade | sentinelas, sem movimentos, defasagem | métrica errada | qualidade e censura à direita | HIGH |
| retenção RAW | arquivos grandes | custo/disco | D:, hashes, política de retenção | MEDIUM |

Base legal, finalidade, minimização, necessidade, retenção, controle de acesso e termos devem ser documentados antes de qualquer dado nominal. P14.0 não publica nem persiste dados novos.
