# Câmara — CEAP

Validado em 08/09/2026 no portal, tutorial oficial e arquivos anuais. A Câmara declara cobertura desde 2008 e atualização diária.

- Arquivo: `https://www.camara.leg.br/cotas/Ano-{ano}.json.zip`.
- 2026: HTTP 200, ZIP de 4.801.526 bytes, JSON de 110.935.538 bytes e 101.047 registros.
- Endpoint de detalhe: `/api/v2/deputados/{id}/despesas`, com até 100 itens e paginação; o arquivo foi escolhido para a reconciliação anual.

O tutorial define `valorDocumento` como face do comprovante, `valorGlosa` como parcela não coberta, `valorLiquido` como débito da cota e `restituicao` como devolução posterior. Documentos podem aparecer em várias linhas e categorias; por isso `idDocumento` agrupa documento, mas não identifica sozinho um registro. A chave do importador inclui o conteúdo integral e a ocorrência.

O JSON anual observado contém `idDeputado` e também `numeroDeputadoID`; o primeiro corresponde ao identificador de cadastro/API e tem prioridade no vínculo. O nome exato normalizado é apenas fallback quando o ID não aparece. Lideranças e pessoas fora do cadastro atual ficam excluídas e contabilizadas. O arquivo de 2026 contém caracteres de substituição em alguns textos; eles são preservados como publicados, sem adivinhar grafia.
