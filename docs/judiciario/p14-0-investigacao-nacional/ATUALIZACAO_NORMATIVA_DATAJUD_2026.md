# Atualização normativa DataJud em 2026

## Portaria Presidência CNJ nº 374, de 14/08/2026

Fonte oficial: [https://atos.cnj.jus.br/atos/detalhar/6972](https://atos.cnj.jus.br/atos/detalhar/6972). A norma está vigente e altera a Portaria 160/2020. O texto publicado informa que os dados do DataJud devem ser encaminhados diariamente e disciplina saneamento e acesso público por API. P1 registrou ainda carga corretiva abrangendo processos em tramitação e baixados desde 01/01/2020.

## Portaria Conjunta nº 2, de 28/10/2026

Fonte: [https://atos.cnj.jus.br/atos/detalhar/7166](https://atos.cnj.jus.br/atos/detalhar/7166). A publicação aprova especificações técnicas, glossário, fluxo e dicionário de movimentos/complementos/situações TPU e revoga a Portaria Conjunta nº 1/2026. Isso afeta interpretação semântica; códigos de movimentos históricos não devem ser reinterpretados retroativamente sem versão.

## Separação obrigatória

- **Norma:** envio diário, saneamento e especificações.
- **API:** campos/aliases/latência efetivamente observados.
- **Reuso:** depende do termo v1.2 e parecer jurídico.
- **Operação:** tribunais podem ter defasagens ou erros mesmo sob obrigação diária.

Conclusão: a norma melhora expectativa de atualização, não garante qualidade uniforme nem autoriza cópia nacional. O futuro collector precisa registrar `sourceUpdatedAt`, `observedAt`, versão TPU e status de saneamento.
