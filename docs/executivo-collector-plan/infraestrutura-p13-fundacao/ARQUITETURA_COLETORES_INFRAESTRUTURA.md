# Arquitetura de coletores P13

P13 reutiliza o motor de `civica_exec`: `exec_entity` para território; `exec_ind_def` para contrato de indicador; `exec_ind_value`/`exec_ind_latest` para fatos; `exec_ingestion_run`, `exec_raw_manifest` e `exec_publication` para proveniência e publicação.

Cada dataset terá `dataset_id` e revisão própria. O pipeline é: download atômico no D: → hash e manifesto → staging tabular → validação de dicionário → normalização de município/prestador → deduplicação → reconciliação → inserção de valores aprovados → publicação transacional → atualização de cobertura. Falha não substitui a publicação ativa anterior.

SINISA deve ser cinco famílias independentes. A chave factual mínima é `(dataset, indicador, entity_id, period_start, provider_key quando aplicável, revision)`. Prestador regional não pode ser achatado em município; quando o agregado municipal oficial existir, ele prevalece.

O coletor deve falhar fechado quando D: não estiver presente, quando o hash mudar durante a leitura ou quando o glossário não confirmar unidade/fórmula. Não usar C: como fallback silencioso.

Envelope P13.0+P13.1: 250.000.000 bytes persistentes no PostgreSQL. RAW/staging ficam fora desse envelope e exclusivamente em D:. Antes da carga nacional, projetar cardinalidade e bytes por indicador.
