# P13.1 — Execução SINISA 2025 (ano-base 2024)

## Status

`P13_1_STATUS=PASS_WITH_DOCUMENTED_SOURCE_LIMITATION`

## Atualização após conexão do D:

Os cinco recursos oficiais foram baixados integralmente, com MIME e assinatura ZIP/XLSX conferidos. Os arquivos foram mantidos exclusivamente em `D:\Civica\raw\infraestrutura\sinisa\2024` e `D:\Civica\staging\infraestrutura\sinisa\2024`; o banco recebeu apenas dados canônicos derivados e metadados de proveniência.

Foram publicados 98.636 valores em 20 indicadores, em cinco revisões independentes (runs 38069–38073). Nulos não foram convertidos em zero, nenhuma tabela paralela foi criada e o frontend não foi alterado. O banco passou de 33.960.234.131 para 33.995.369.619 bytes (crescimento 35.135.488 bytes).

## Registro histórico da tentativa bloqueada

Os cinco recursos oficiais foram alcançados inicialmente com requisição de faixa de um byte e devolveram `206 Partial Content`. Esse registro foi superado pela execução posterior no D:.

Na tentativa histórica não houve download integral nem escrita. A execução final, descrita acima, publicou os dados com crescimento controlado.

## Gates finais após retomada

| Gate | Resultado | Evidência |
|---|---|---|
| D storage | PASS | RAW/staging no D: |
| dicionário | PASS | 20 códigos reais |
| piloto | PASS | 0 duplicidades; 0 entidades não resolvidas |
| reconciliação | PASS | source rows = parsed rows |
| publicação | PASS | cinco revisões ativas, runs 38069–38073 |
| replay | PASS | cinco retornos `NO_CHANGE` |
| regressão | PASS | smoke read-only |

Limitação de fonte: água e esgoto possuem agregados oficiais UF/Brasil; resíduos, drenagem e gestão municipal permanecem no grão municipal porque os recursos coletados não trouxeram agregado equivalente.

## Gates históricos (antes da conexão do D; superseded)

| Gate | Resultado | Evidência |
|---|---|---|
| G0 fundação | PASS_WITH_DOCUMENTED_STORAGE_BLOCKER | baseline P13.0 |
| G1 fontes | PASS (resource metadata) | `FONTES_SINISA_VALIDADAS.md` |
| G2 dicionário | BLOCKED | arquivos não armazenados para leitura |
| G3 piloto | BLOCKED | sem staging |
| G4 reconciliação | BLOCKED | sem linhas processadas |
| G5 projeção | BLOCKED | sem cardinalidade real |
| G6 publicação (histórico) | NOT_STARTED | nenhuma revisão SINISA — superseded pelos runs 38069–38073 |
| G7 replay | NOT_STARTED | nenhuma carga |
| G8 revisões | READY_BY_DESIGN | contrato documentado |
| G9 não regressão | PASS (no writes) | contagem antes/depois inalterada |
| G10 performance | NOT_STARTED | sem read model SINISA |
| G11 independência | PASS | PNCP e outros domínios não tocados |

Famílias água, esgoto, resíduos, drenagem e gestão municipal permanecem independentes e bloqueadas pelo mesmo pré-requisito de armazenamento.
