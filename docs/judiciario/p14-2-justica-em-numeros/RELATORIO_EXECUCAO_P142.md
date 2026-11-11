# Relatório de execução P14.2 — Justiça em Números

## Resultado

**P14.2 = PASS_WITH_CAVEATS.** A edição oficial do CNJ foi adquirida no diretório RAW autorizado, processada no banco oficial projetoeleitor_db e publicada em uma revisão estatística independente da P14.1.

- Base: 2009–2025; edição publicada em 2026, ano-base 2025.
- Fonte: 1.595 linhas, 1.314 colunas e dicionário oficial com 1.314 variáveis.
- Crosswalk: 99 identificadores, 91 correspondências determinísticas, 7 agregados não aplicáveis e 1 não resolvido.
- Indicadores publicados: 12; observações: 17664; valores não nulos: 16550.
- Paridade: 130 verificações, 0 falhas.

## Correções e limites

TJMA, TJMG, TJMS e TJMT foram corrigidos para a Justiça Estadual; TJMMG, TJMRS e TJMSP permanecem na Justiça Militar Estadual. A linha sem valores da Justiça Militar da União para STM foi excluída quando havia a linha Superior do mesmo órgão/ano. Indicadores municipais, por unidade e por magistrado não fazem parte desta publicação.

O replay final foi NO_CHANGE, sem crescimento adicional do banco. Nenhuma chamada DataJud foi executada, nenhum frontend foi alterado e P14.3 permaneceu bloqueada até revisão jurídica própria.
