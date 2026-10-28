# Resiliência e publicação

Replay idêntico da coleta P11.2 retorna `no_change`. A carga de qualidade usa hash + parser como chave de idempotência. Cada execução é transacional; falha antes do commit não publica fatos e não substitui o último conjunto íntegro.
