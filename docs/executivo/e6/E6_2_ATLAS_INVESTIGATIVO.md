# E6.2 — Uma descoberta territorial protagonista

## O que mudou de fato
A investigação por indicador (selecionar População ou IDHM, ver o mapa mudar, clicar um estado, ver o valor exato e a referência Brasil, abrir o perfil ou o Atlas Vivo) **já existia** antes de E6 — só não era a primeira coisa que o visitante via. Era uma seção abaixo de um hero decorativo. A mudança real de E6 é tornar essa investigação **o próprio hero** — não adicionar funcionalidade nova, mas dar a ela o protagonismo que o mandato pede ("o usuário não deve encontrar apenas um mapa com cores — deve descobrir algo ao explorá-lo").

## Contexto e interpretação (preservados, não recriados)
Ao selecionar um estado: nome, valor exato, ano/competência, e para IDHM a referência Brasil (0,727, 2010) lado a lado — mesma lógica de antes, reposicionada para dentro do painel do hero. Nenhuma classificação automática de qualidade foi introduzida ("acima da média" nunca vira "melhor"); o painel só mostra o valor e a referência, nunca uma nota.

## Reutilização, não duplicação de engine
Mesmo `paintStateMap`/`brazil-map-markup.ts`/`state-map-paint.ts` já usados em toda a plataforma (hero da homepage, história de Educação, agora também aqui) — nenhuma segunda implementação de cartografia criada. Mesma função `loadStates`/`loadHdiAllStates` já carregada; nenhuma série histórica de município foi carregada de uma vez (a tabela de 27 UFs é leve; municípios continuam exigindo entrar no perfil do estado, como antes).

## Link para o Atlas Vivo preservado
"Abrir Atlas Vivo" continua levando a `/estados/{uf}#atlas`, a experiência mais profunda de exploração municipal já existente — E6 não tentou recriar essa engine dentro do hero nacional, só preservou o caminho para ela.

## Verificação
`tests/e2e/executivo-portal.spec.ts`, suíte "Explorador por indicador": 3/3 testes passam, incluindo um fortalecido nesta fase (antes checava só a existência de um título de seção; agora verifica que a tabela tem 27 linhas com um valor de população real formatado, `/\d{1,3}\.\d{3}\.\d{3}/`).
