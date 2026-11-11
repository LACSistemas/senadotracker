# Relatório de execução — P14.12 (Ampliação e frontend: fotos e remuneração dos Ministros do STF)

## Síntese executiva

O perfil público do STF (`/judiciario/tribunais/JUD:TRIBUNAL:STF`) tinha todo o dado real das fases anteriores (P14.9–P14.11), mas exibia a maior parte dele como texto corrido com link de saída — nenhuma cara de "quem são os Ministros", nenhuma foto, nenhum número de custo visível sem clicar para outra página. O pedido foi explícito: fotos dos Ministros, quanto custam, e um frontend à altura deles.

Não havia nenhuma foto de Ministro coletada em nenhuma fase anterior do projeto. Antes de desenhar qualquer card, foi preciso achar a fonte oficial real da foto — o portal atual do STF (`portal.stf.jus.br`) é uma SPA cujo menu principal carrega por AJAX; a página de composição por Ministro só aparece ao seguir a cadeia real `mega-menu-service.asp` → `ostf/ministros/ministro.asp` → `verMinistro.asp?periodo=STF&id=<id>`, cujo HTML (não gerado por JS) embute `<img src="../../util/imagem.asp?tamanho=miniatura&id=<fotoId>">`. Confirmado por download direto: JPEG real, tamanhos variando por pessoa (8–73 KB), nunca um placeholder.

Com a fonte confirmada, o trabalho foi: mapear as 20 pessoas que aparecem na divulgação de remuneração do STF (P14.10) para sua foto oficial, estender o serving para devolver essa foto junto com o resto do perfil, e reconstruir 3 rotas com um componente de card novo (foto + nome + situação + remuneração). Nenhum coletor novo, nenhuma tabela nova, nenhuma escrita no banco.

## O que foi construído

**Backend (`packages/db/src/`)**
- `judiciary-stf-ministro-fotos.ts` (novo): mapa estático `matrícula → {nomeDeGuerra, fotoUrl, perfilUrl}` para os 20 Ministros (8 em atividade + 12 aposentados) presentes em `jud_stf_rendimento_mensal`. Referência estática deliberada — não uma tabela com coletor — porque a composição do STF muda raramente (indicação presidencial + aprovação do Senado) e o dado já foi verificado manualmente contra a fonte oficial em 2026-11-06; criar um coletor completo (schema, migração, revisão de publicação) para 20 linhas fixas seria desproporcional ao tamanho real do problema.
- `portrait-mirror.ts`: `portal.stf.jus.br` adicionado à lista de hosts permitidos para espelhamento de retrato — mesmo mecanismo já usado para Câmara, Senado, Assembleias e TSE.
- `postgres-judiciary-serving.ts`: `getJudiciaryStfPayrollExplorer` e `getJudiciaryStfPayrollProfile` agora decoram cada registro de Ministro com `nomeDeGuerra`/`fotoUrl`/`perfilUrl` quando a matrícula está no mapa — aditivo, sem alterar os campos existentes; Assessores de Ministro (que não têm foto mapeada) continuam exatamente como antes.

**Frontend (`apps/web/`)**
- `components/judiciary/minister-card.tsx` (novo): card reutilizável — foto (via `OfficialPortrait`/`/api/portrait`, com fallback "Foto indisponível" já pronto no componente compartilhado), nome, selo de situação (maiúsculas por CSS) e remuneração bruta mensal.
- `app/judiciario/tribunais/[id]/page.tsx`: a seção "Remuneração" (texto + link) virou um capítulo "Ministros" — KPI de quantos estão em atividade e a soma bruta mensal, grade de cards dos Ministros em atividade, e os aposentados atrás de um `<details>` colapsável.
- `app/judiciario/stf/remuneracao/page.tsx`: a tabela única de Ministros+Assessores virou duas seções — Ministros em cards (ativos visíveis, aposentados colapsados) e Assessores de Ministro na tabela original (sem foto — são servidores, não figuras públicas).
- `app/judiciario/stf/remuneracao/[matricula]/page.tsx`: cabeçalho da página de detalhe ganhou a foto ao lado do nome quando a pessoa é Ministro.

## Achado real durante a implementação

A divulgação de remuneração do próprio STF (fonte do P14.10, `egesp-portal.stf.jus.br/transparencia/rendimento_folha`) não lista **Edson Fachin** (Presidente do STF) nem **Luiz Fux** entre os Ministros em atividade na referência atual (agosto/2026) — só 8 dos Ministros efetivamente em atividade aparecem com remuneração. Isso não é um bug desta fase: é uma lacuna da própria fonte/coletor de P14.10, herdada, não causada por este trabalho. Não foi corrigida aqui (exigiria revisitar o coletor de P14.10) — a interface apenas mostra o que a fonte realmente publica, consistente com a regra do produto de que ausência de dado nunca é mostrada como zero.

## O que não foi feito (fora de escopo)

- Nenhuma tabela nova nem coletor para as fotos — mapa estático documentado, por ser pequeno e raramente mutável (ver acima).
- Não foi investigada nem corrigida a ausência de Fachin/Fux na divulgação de remuneração (achado registrado, não resolvido).
- Nenhum commit — trabalho aguardando revisão, seguindo a convenção do projeto.

## Verificação

- `npm run typecheck` limpo em `@senadotracker/db` e em `@senadotracker/web` (dist isolado via `NEXT_DIST_DIR`, removido depois).
- Checagem manual contra o servidor de dev real: `/api/portrait?url=...` devolvendo os mesmos bytes/Content-Type (`image/jpeg`) da fonte oficial; as 3 rotas renderizando nomes, fotos e valores reais (ex. Alexandre de Moraes, R$ 60.276/mês bruto).
- `tests/e2e/p151-stf-remuneracao.spec.ts` reescrito para a nova interface (nome de exibição, fotos, novo rótulo do capítulo) — 2 asserções corrigidas durante a própria execução dos testes (uma esperava texto em minúsculas onde o CSS renderiza maiúsculas; outra assumia que "Assessores de Ministro" desapareceria do texto da página ao filtrar, quando na verdade é só o rótulo fixo do filtro que permanece).
- Suíte completa do Judiciário rodada após as correções: **52/52 testes passando** (`p148-judiciario`, `p150-stf-repercussao-geral`, `p151-stf-remuneracao`, `p152-stf-jurisprudencia`), sem regressão em nenhum outro domínio.
- Nenhuma escrita no banco em nenhum momento desta fase.
