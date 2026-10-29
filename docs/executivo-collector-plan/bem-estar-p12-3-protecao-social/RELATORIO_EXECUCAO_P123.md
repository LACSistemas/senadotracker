# P12.3 — Proteção social nacional

## Resultado

`P12_3_STATUS = PARTIAL_WITH_DOCUMENTED_SOURCE_LIMITATION`.

A execução confirmou a disponibilidade documental das fontes, mas não encontrou uma superfície pública, agregada e programática que permita publicar CadÚnico, Bolsa Família ou BPC sem autenticação, interação manual ou exposição de PII. Nenhum fato social foi fabricado e nenhuma carga incompleta foi ativada.

| Família | Status | Motivo verificável |
|---|---|---|
| CadÚnico | BLOCKED | Portal Analítico/CECAD documentados, porém redirecionam para aviso/login e a FAQ exige geração manual diária; API agregada não comprovada. |
| Bolsa Família | BLOCKED | Download/dicionário oficiais acessíveis, mas o arquivo contém CPF/NIS/nome; API municipal retorna HTTP 401 sem token. |
| BPC | BLOCKED | Mesmo limite: download/dicionário com identificadores pessoais; API municipal retorna HTTP 401 sem token. |
| SIAFI→IBGE | PASS | CSV oficial do Tesouro baixado em D:, 5.589 linhas válidas, 27 UFs. |

`SOCIAL_INDICATORS_PUBLISHED = 0`; `PERSONAL_DATA_PERSISTED = 0`; `P12_4_READY = NO`.

## Regra de encerramento

As famílias são independentes. A ausência de credencial/autorização nas APIs do Portal não foi tratada como falha local nem contornada. A publicação poderá ser retomada quando houver arquivo agregado oficial, token institucional ou exportação autorizada sem PII.

P12.2 permanece preservada; a auditoria e a correção estrutural do catálogo estão nos artefatos desta pasta.
