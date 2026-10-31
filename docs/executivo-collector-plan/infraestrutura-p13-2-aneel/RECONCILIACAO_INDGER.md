# Reconciliação INDGER

| métrica | resultado |
|---|---:|
| linhas fonte selecionadas (2025 + 2026-08) | 80.947 |
| linhas após deduplicação | 80.937 |
| linhas municipais elegíveis (um agente) | 65.471 |
| linhas excluídas por múltiplos agentes | 15.466 |
| linhas com identidade inválida | 10 |
| chaves duplicadas conflitantes | 0 |
| linhas de indicador canônicas | 458.290 |
| entidades não resolvidas | 1 (código 1403205 em 2026-08) |

Os 10 registros de identidade inválida não entraram no staging canônico. Os 10 registros removidos na deduplicação são duplicatas de linha sem uma chave canônica adicional; a seleção publicada não soma versões. A diferença entre o staging e o banco é explicada pelo único código IBGE sem entidade oficial.

Paridade dos totais publicados (staging elegível após excluir 1403205):

- `QtdUCAtiva`: `1.121.892.648`;
- `QtdUCAtivaFat`: `1.034.440.393`;
- `QtdFatura`: `1.047.902.662`;
- `QtdFaturaSemLeitura`: `59.159.841`;
- `QtdUCSuspInadimplemento`: `17.191.691`;
- `QtdSolicRessarcimentoDano`: `281.898`;
- `VlrPagoRessarcDano`: `R$ 100.129.664,3432`.

Os mesmos totais foram obtidos em `exec_ind_value`; delta = 0 para o universo publicado.
