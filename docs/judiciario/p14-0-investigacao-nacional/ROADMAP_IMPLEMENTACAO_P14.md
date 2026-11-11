# Roadmap P14.1–P14.8

| Fase | Objetivo | Dependências | Entrega | Prioridade |
|---|---|---|---|---|
| P14.1 | fundação institucional | identidade/território | tribunais, graus, unidades e vigência | P0_CRITICAL |
| P14.2 | Justiça em Números | P14.1 | revisões JN 2009–2025, indicadores e dicionário | P0_CRITICAL |
| P14.3 | DataJud controlado | parecer jurídico + TPU | agregações limitadas/qualidade, sem espelho | P1_HIGH |
| P14.4 | jurisprudência | licença STJ | atas, acervo, espelhos, precedentes | P1_HIGH |
| P14.5 | finanças/pessoal | fontes elegíveis | despesa, remuneração e contratos agregados | P1_HIGH |
| P14.6 | temas | taxonomias comprovadas | saúde/previdência/família sem imputação | P2_EXPANSION |
| P14.7 | serving | revisões e cobertura | read models nacionais/tribunais | P1_HIGH |
| P14.8 | frontend | serving estável | panorama e perfis institucionais | P2_EXPANSION |

## Ordem recomendada

P14.1→P14.2 primeiro. P14.4 STJ pode correr em paralelo após licença. P14.5 usa fontes sem dependência de DataJud. P14.3 só depois do parecer. P14.7/P14.8 publicam apenas domínios com cobertura e denominador.

## Gates de cada fase

Fonte oficial, schema, grain, temporalidade, licença, privacidade, parity, idempotência, last-known-good, performance e regressão de P13/PNCP. Nenhuma fase inicia automaticamente ao fechar P14.0.
