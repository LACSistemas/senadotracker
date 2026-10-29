# Roadmap de implementação P12.2+

## P12.2 — IBGE renda e moradia

**Dependências:** contrato territorial, amostra SIDRA, tabela/variáveis, cobertura municipal e geografia 2022.  
**Entrega:** primeiros fatos atômicos e read model de condições materiais.  
**Aceite:** source/layout/semantics/territory verified; reconciliação aditiva apenas onde válida; nenhum Censo amostral rotulado como universal.

## P12.3 — MDS/CGU proteção social

**Dependências:** recurso agregado legítimo, SIAFI→IBGE, política de privacidade e separação família/pessoa/benefício/parcela.  
**Aceite:** zero PII, cobertura por competência, pagamento distinto de concessão, replay idempotente.

## P12.4 — Censo SUAS

**Dependências:** questionário, códigos de CRAS/CREAS/equipamentos e taxa de resposta.  
**Aceite:** equipamento ativo/respondente distinguido de ausência.

## P12.5 — RAIS/Novo Caged

**Dependências:** estratégia D: para arquivos grandes, parser incremental, retificações e estabelecimento/residência.  
**Aceite:** saldo e fluxos reconciliados, estoque explicitado, nenhum “desemprego municipal” inventado.

## P12.6 — Reuso financeiro e cotidiano

**Dependências:** contratos Siconfi/PNCP/Infraestrutura e fontes TIC validadas.  
**Aceite:** não duplicar despesas/transferências nem publicar fonte sem licença/coverage.

## P12.7 — Reconciliação e serving

**Dependências:** pelo menos duas famílias publicadas.  
**Aceite:** read models materializados, EXPLAIN, p95/p99 reais, last-known-good e cobertura independente.

## P12.8 — Frontend

**Dependências:** contratos de leitura estáveis, copy editorial e estados de ausência.  
**Aceite:** integração nas páginas territoriais existentes, acessibilidade, SSR e sem fonte externa no browser.

P12.2 foi operacionalizada em `bem-estar-p12-2-ibge/` com dados reais SIDRA 2022. O aceite é `PASS_WITH_DOCUMENTED_SOURCE_LIMITATION`: Gini municipal permanece indisponível porque a tabela 10301 não publica nível N6. P12.3 continua não iniciada.

