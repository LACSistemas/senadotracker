# E6.6 — Auditoria final

## Matriz de evidências (mandato §28)

| Dimensão | Antes | Depois | Evidência |
|---|---|---|---|
| Hero | Mapa contextual neutro num card separado + 4 KPIs ao lado | Mapa analítico único, integrado, com seletor de indicador e painel de contexto no mesmo painel | `before/e6-before-1440-first.png`* × `after/e6-after-1440-first.png` |
| Descoberta territorial | Seção separada, abaixo da dobra, com 2º mapa | Fundida ao hero — é a primeira coisa que aparece | `after/e6-after-1440-full.png` |
| Repetição cartográfica | 2 mapas nacionais na mesma página | 1 mapa | Contagem de `dangerouslySetInnerHTML` com `paintStateMap` no código |
| Cinco áreas | 5 cards idênticos (ícone→número→nota→link) | Saúde com 2 estatísticas reais (leitos + hospitais); demais mantidos | `after/e6-after-1440-full.png` |
| Quem cuida de quê | 3 cards separados, bordas próprias | 1 faixa conectada, divisores internos, nota federativa explícita | `after/e6-after-1440-full.png` |
| Recursos e entregas | Puramente textual, 2 parágrafos | Gráfico real de 154.449 obras por situação (6 categorias reais) | `after/e6-after-1440-full.png` |
| Mobile | Hero → mapa pequeno → 4 KPIs → rolagem até o 2º mapa | Mapa real já na primeira viewport | `after/e6-after-390-first.png` |
| Integridade | Indicadores, mapa, busca, 5 temas, comparadores | Preservados integralmente | Testes e2e |

*Capturas "antes" referenciadas no texto de `E6_0_AUDITORIA_VISUAL.md`; os nomes de arquivo seguem o padrão `artifacts/e6-executivo/before/`.

## Preservação funcional (inventário, mandato §23)
Confirmados intactos: busca territorial (agora visível — bug de contraste corrigido), mapa, seleção de indicador (população/IDHM), seleção de UF, link para Atlas Vivo, tabela de 27 estados, os 5 temas (com suas rotas reais), explicação federativa (texto preservado), obras/contratos (agora com visualização, antes só 2 links — um deles quebrado, agora corrigido), perguntas investigativas, fontes/metodologia. Nenhuma funcionalidade removida.

## Testes
Suíte combinada (`executivo-portal.spec.ts` + `p14-territorio-executivo.spec.ts` + `p148-judiciario.spec.ts`, 44 testes): **43 passaram**. 1 falha (`p14-territorio-executivo.spec.ts`, "São Paulo município tem PIB per capita diferente do de São Paulo UF") — **confirmada flakiness de paralelismo**, não regressão: reexecutada isoladamente, passou (13,2s). Esse teste cobre `/municipios/{ibge}`, uma rota que nem J7 nem E6 tocaram.

2 testes de `executivo-portal.spec.ts` precisaram de atualização real (consequência direta e correta da reconstrução, não regressão escondida):
- "População: mapa e tabela mostram valores reais por UF" checava um título de seção (`"Explore o Brasil por indicador"`) que deixou de existir como heading próprio ao fundir hero+atlas — reescrita para verificar o conteúdo real (seletor de indicador presente, tabela com 27 linhas, valor de população formatado real).
- "header tem entrada Executivo" dava `strict mode violation` porque agora existem 2 links "Executivo" na home (nav principal + rodapé — o rodapé ganhou esse link na fase H4 da homepage, já nesta mesma sessão, para corrigir a descrição do Cívica como "exclusivamente legislativo"). Escopado ao nav principal.

## Acessibilidade (axe-core real)
`label-content-name-mismatch` (27 nós) e `nested-interactive` (1 nó) — mesmas 2 categorias pré-existentes do componente de mapa compartilhado, documentadas desde H5. Contagem de nós **caiu** em relação à versão anterior porque a página passou a ter 1 mapa em vez de 2. 0 violações novas.

Nota ambiental: o caminho configurado para `axe-core` (`D:\Civica\tools\a11y\...`) ficou indisponível durante esta fase (unidade D: não montada). Contornado baixando `axe-core@4.14.0` via `npm pack` para uma pasta temporária fora do repositório — mesma biblioteca real, mesmo motor de verificação, só origem diferente do arquivo.

## Achado operacional: servidor de dev caiu durante a fase
Entre a implementação de J7 e a verificação de E6, o servidor de desenvolvimento do usuário (porta 3000) parou de responder e a unidade D: ficou indisponível — sinal de um reinício de máquina/sessão, não algo causado por este trabalho. Reiniciado com as credenciais de banco corretas carregadas do `.env` da raiz do monorepo (a primeira tentativa, sem isso, gerou um erro real de autenticação Postgres — "SASL: client password must be a string" — confirmando que as variáveis não chegam ao `next dev` automaticamente nesta configuração; precisam ser exportadas antes). Um processo órfão da primeira tentativa ficou preso na porta 3000 e precisou ser encerrado (`taskkill`) antes do reinício limpo. Nenhum dado foi alterado por essa sequência — só processos de desenvolvimento.

## Typecheck
Isolado, limpo. Um erro à parte foi encontrado e corrigido durante a verificação: `.next/dev/types/validator.ts` (arquivo gerado, não código-fonte) ficou corrompido — provavelmente pela sequência de queda/reinício do servidor de dev. Apagado (artefato de build, seguro de regenerar) e o typecheck voltou a passar limpo.

## Performance
Nenhuma biblioteca nova. O mapa reaproveita exatamente o mesmo componente/CSS já usado em outras páginas — a fusão REDUZ o número de mapas renderizados por página (de 2 para 1), uma melhora, não uma regressão, de custo de renderização. O gráfico de obras é HTML/CSS puro (barras de largura percentual), sem SVG novo. Não medido LCP/CLS de campo — mesma ressalva de H7/J7.

## Segurança arquitetural
Nenhuma migration, backfill, alteração de schema ou interrupção de coletor. As 2 funções de leitura usadas para o gráfico de obras (`getInfrastructureWorksOverview`, `getInfrastructureWorksBySituation`) já existiam no pacote `@senadotracker/db`, só nunca tinham sido chamadas nesta página.

## Status: E6_READY_FOR_USER_VISUAL_REVIEW
