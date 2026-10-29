# P12.5 — Emprego formal nacional

## Resumo executivo

P12.5 foi executada no `projetoeleitor_db`, schema `civica_exec`, com os agregados oficiais do MTE. Foram publicados seis indicadores: dois da RAIS 2025 e quatro do Novo Caged, sem baixar microdados individuais e sem modificar o frontend.

`P12_5_STATUS=PASS_WITH_CAVEATS`.

## Resultado

- RAIS: estoque municipal 2023–2025 e remuneração média real de dezembro em Brasil/UF.
- Caged: estoque de referência, admissões, desligamentos e saldo para janeiro–agosto/2026.
- Território: 5.571 municípios, 27 UFs e Brasil.
- Paridade: RAIS Brasil exata; municipal exata após regra documentada para `999999`; Caged saldo exato em 44.792 linhas.
- Replay: 308 fatias sem mudança e crescimento zero.

## Orçamento

O banco passou de 33.890.299.027 para 33.950.739.603 bytes: `60.440.576` bytes atribuídos à onda. O crescimento acumulado de Bem-Estar desde o baseline original é `89.407.488` bytes, deixando `7.910.592.512` bytes até o limite rígido de 8 GB. Arquivos RAW e staging continuam exclusivamente no volume D:.

## Cobertura e limitações

Remuneração RAIS não é municipal; Caged agosto/2026 é a última competência efetivamente validada; setor econômico não foi publicado como indicador separado. Essas limitações estão nos contratos e não são convertidas em zeros.

## Auditoria P12.4-R

A auditoria somente-leitura confirmou os 237 municípios com média IDCRAS sem respondente CRAS correspondente e corrigiu apenas a interpretação documental do “5.334º IBGE7”; nenhum dado SUAS foi alterado.

## Gates

G0–G5, G7–G15: `PASS`; G1 e G6: `PASS_WITH_DOCUMENTED_LIMITATION`/`PASS_WITH_CAVEATS`. P12.2 e P12.4-R preservadas; P12.3 permanece inalterada. A próxima fase não foi iniciada automaticamente.
