# H2 — Histórias de dados

Três histórias, cada uma com visualização própria e CTA para a análise completa.

## 1. Educação — "O aprendizado varia bastante entre os estados?"

Mapa coroplético por UF do **Ideb, anos iniciais, edição mais recente real (a mais recente publicada nesta base — o mock mostrava 2023; usamos a edição real disponível, documentada em H0 §6)**, calculado ao vivo por `getIdebTerritory({ufCode, stage:1})` para as 27 UFs. CTA para `/executivo`.

## 2. Justiça — "O que acontece quando entrada e baixa de processos seguem ritmos diferentes?"

Série real de casos novos × baixados, soma nacional anual, via `loadJudiciaryNationalSeries(['JN_CASES_NEW_G1','JN_CASES_NEW_G2','JN_DISPOSED'])` (mesma função já usada em `/judiciario`, sem alteração) — range completo disponível a partir de 2016, não recortado para bater com o mock. Renderizada como mini-gráfico de barras compacto em `<div>` (não `MultiLineChart`, que tem `min-width:620px` com rolagem interna e fica invisível num card estreito de 3 colunas — achado real documentado inline no código). CTA para `/judiciario`.

## 3. Gastos públicos — substituída

O mock mostrava um donut de categorias da despesa da União. **Não construível**: `financas-read.ts` só tem leituras escopadas a segurança pública (`getSecurityFinance*`); não existe no projeto uma leitura de "despesa da União por natureza" de propósito geral, e inventar essa categorização violaria §6.3/§12 do mandato (ver H0 §5). Substituída por uma comparação honesta entre dois números reais já publicados em domínios diferentes (despesa nacional com magistrados do STF, R$34,5bi, já publicada em `/judiciario`; e magistrados atuantes, consultado ao vivo), com texto explícito deixando claro que **não há um total único de despesa da União** nesta base. CTA para `/judiciario`.

## Verificado

- Nenhum número desta seção é copiado do mock; os três están auditados em H0 ou calculados em runtime.
- Nenhuma das 3 histórias duplica exatamente a visualização usada na seção "Três poderes" (H3): Educação aqui é mapa, lá é KPI numérico; Justiça aqui é série temporal, lá são 2 KPIs pontuais; Gastos aqui é comparação entre domínios, lá (Legislativo) é composição partidária — sem sobreposição de forma.

## Gate H2 — PASS_WITH_CAVEATS
Caveat: a história de "Gastos públicos" é uma substituição deliberada e documentada, não o donut do mock — decisão de integridade de dados, não lacuna de execução.
