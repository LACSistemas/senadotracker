# Auditoria de privacidade da equipe no frontend

Executada em 09/09/2026 sobre o contrato `publishedCabinetProfile` e o componente `CabinetBreakdown`.

## Campos enviados ao componente público

`key` sintética, nome funcional, vínculo, cargo, função, datas funcionais permitidas, data do snapshot e origem oficial. A busca no navegador concatena somente nome, vínculo, cargo e função.

## Campos retidos antes da serialização

`functionalId`, `staffKey`, `unitId`, texto integral da unidade, estado/evidências de correspondência e identificador do objeto bruto. CPF, contato, endereço, nascimento, dados bancários, descontos e salário líquido não fazem parte do contrato publicado.

O teste unitário serializa o retorno público e falha se identificadores ou evidências técnicas voltarem a aparecer. Os objetos brutos continuam no armazenamento local de auditoria e não são servidos por rota pública.
