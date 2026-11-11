# Auditoria do termo de uso DataJud

Fonte: [https://datajud-wiki.cnj.jus.br/api-publica/termo-uso/](https://datajud-wiki.cnj.jus.br/api-publica/termo-uso/); versão observada em P1/P2: v1.2.

| Cenário | Leitura | Decisão P14.0 |
|---|---|---|
| Pesquisa interna não comercial | finalidade legal e autorizada, responsabilidade do usuário | possível após revisão de escopo |
| Produto público não comercial | cláusulas exigem cautela; derivados e redistribuição não são automaticamente livres | `LEGAL_REVIEW_REQUIRED` |
| Produto comercial | termo proíbe exploração comercial da API/informação derivada | não autorizado |
| Republicação de registros | proibição de distribuir/modificar/vender e ausência de licença aberta | não autorizado |
| Agregados estatísticos derivados | pode continuar sujeito a derivação e finalidade; não presumir exceção | parecer específico |

O termo também declara ausência de garantia de precisão/integridade/atualidade e exige ciência ao CNJ sobre estudos/relatórios públicos. A API pública não equivale a licença de dados. Até obter parecer e eventual autorização institucional, `DATAJUD_NATIONAL_INGESTION_AUTHORIZED=NO`.

## Privacidade

Mesmo dado público deve passar por minimização, base legal, finalidade, retenção e controle de acesso. Não indexar partes, menores, vítimas, dados sensíveis ou perfis de litigância. A opção segura inicial é JN agregado e DataJud apenas em contagens autorizadas.
