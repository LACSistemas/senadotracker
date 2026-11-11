# DataJud — contrato técnico e limites

**Documentação:** [https://datajud-wiki.cnj.jus.br/api-publica/](https://datajud-wiki.cnj.jus.br/api-publica/), [endpoints](https://datajud-wiki.cnj.jus.br/api-publica/endpoints/), [acesso](https://datajud-wiki.cnj.jus.br/api-publica/acesso/). O acesso usa `Authorization: APIKey`; a chave pública é rotativa e não deve ser gravada em código.

## Estado técnico

P1/P2 comprovaram consultas Elasticsearch leves em 64 aliases: capa do processo, `id`, `numeroProcesso`, `tribunal`, `grau`, `dataAjuizamento`, `classe`, `assuntos`, `orgaoJulgador`, `sistema`, `formato`, `nivelSigilo`, `movimentos`, `dataHoraUltimaAtualizacao` e `@timestamp`. Movimentos possuem data/hora, código TPU e complementos.

## Estado atual da documentação

A página atual de endpoints, consultada por busca oficial, lista 91 aliases: 4 superiores + 6 TRFs + 27 TJs/TJDFT + 24 TRTs + 27 TREs + 3 tribunais militares. Os 64 aliases de P1 correspondem ao inventário anterior sem os 27 TREs. A rede local não permitiu chamadas nos novos aliases; `91 listed / 64 historically queried`.

## Limites e qualidade

P1 observou 120 requisições/min, 429, 504 e `es_rejected_execution_exception`; latências de 3–50 s. TJES teve 18% de documentos sem movimentos, 14,4% com sistema inválido e datas sentinela; STJ teve 71,3% de ajuizamentos sentinela. DataJud é estoque, não coorte de ajuizamentos; processos sigilosos não aparecem nas amostras.

## Regra de uso

Não espelhar processos nem fazer varredura nacional. Se revisão jurídica autorizar um piloto, usar contagens/agregações, rate limit, custo, snapshot, hash, last-known-good e supressão de dados pessoais. Sem autorização, usar JN, TPU e STJ/licenças claras.
