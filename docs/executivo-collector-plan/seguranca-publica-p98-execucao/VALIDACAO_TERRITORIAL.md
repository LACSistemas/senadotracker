# Validação territorial (P9.8)

Build de produção isolado (porta 3102), banco real. Fonte: `validacao_paginas.json` (rodada final), `scripts/security/validate-pages.mjs`.

Critérios por página: HTTP 200, 3–4 KPIs, sem overflow horizontal em 1440/1280/768/390/360, 0 erros de console, 0 ocorrências de `NaN/undefined/null` no texto.

| Território | HTTP | KPIs | Overflow (5 larguras) | Erros console | Observação de conteúdo |
|---|---|---|---|---|---|
| Vitória/ES | 200 | 4 | 0 | 0 | fonte estadual municipalizada (SESP-ES): taxa com faixa de porte 100–500 mil (8 municípios) |
| Serra/ES | 200 | 4 | 0 | 0 | idem; comparação Vitória × Serra na captura `comparar_vitoria_serra` |
| Alto Rio Novo/ES | 200 | **3** | 0 | 0 | < 20 mil hab.: sem taxa/benchmark; lacuna ≠ zero; "Não tem" guarda |
| São Paulo/SP | 200 | 4 | 0 | 0 | SSP-SP; supressão de estupro explicada |
| Rio de Janeiro/RJ | 200 | 4 | 0 | 0 | ISP-RJ; CVLI composto ("não é a soma") |
| Belo Horizonte/MG | 200 | 4 | 0 | 0 | faixa de porte sem 5 municípios → grupo ≥ 20 mil da UF |
| Recife/PE | 200 | 4 | 0 | 0 | SDS-PE reconcilia com Sinesp (582 em 2024; 537 em 2025) |
| Porto Alegre/RS | 200 | 4 | 0 | 0 | SSP-RS |
| Salvador/BA | 200 | 4 | 0 | 0 | sem fonte estadual municipalizada: herói sem "Roubos"; dado só-estadual identificado |
| Curitiba/PR | 200 | 4 | 0 | 0 | idem Salvador (sem P9.6) |
| UF ES, SP, RJ, MG, PE, CE, BA | 200 | 4 cada | 0 | 0 | comparação com mediana das UFs só onde há taxa padronizada; fontes estaduais não comparadas entre si |

## Casos de borda cobertos
- **UF sem P9.6** (BA): página completa, capítulo de criminalidade só com VDE/SIM nacionais; "só contexto estadual" explícito. Teste E2E "Salvador".
- **CE**: série municipal só em 2026 (limitação da fonte); sem variação anual.
- **Município sem unidade prisional**: texto "não prova que o município não tenha unidade".
- **Município sem guarda**: "Não tem" (declaração MUNIC), diferente de "sem dado".

## Ressalvas
- 10 UFs não têm fonte municipal de crimes; para seus municípios o capítulo mostra o que é nacional.
- A listagem de 17 territórios é amostra obrigatória do prompt, não os 5.570 municípios; a camada de dados é única, então o comportamento se repete, mas não se rodou varredura nacional.
