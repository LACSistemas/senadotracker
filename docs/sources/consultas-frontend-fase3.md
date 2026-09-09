# Consultas do frontend — Fase 3

Implementado em 09/09/2026 sobre os lotes ativos do SQLite. As páginas acessam os dados apenas pelo adaptador `apps/web/lib/data.ts`.

## Eleições e patrimônio

- A consulta retorna exclusivamente candidaturas cujo vínculo com a pessoa está confirmado.
- Eleições são ordenadas por ano e expõem resultado, votos, bens, receitas e despesas com coberturas independentes.
- O total de bens é nominal e pertence à declaração daquele pleito. A variação entre eleições não é descrita como enriquecimento, ganho ou patrimônio atual.
- Um mesmo bem ou lançamento com mais de uma versão no lote não é somado duas vezes: versões conflitantes ficam fora do total e tornam a cobertura parcial.
- Ausência de contas de campanha não remove candidatura ou bens e não vira valor zero.

Os lotes locais ativos contêm dados oficiais de 2018 e 2022. O aviso antigo sobre bloqueio do TSE descrevia apenas a indisponibilidade de download naquele ambiente; ele não representa o estado atual do banco publicado.

## Gabinetes

- Composição usa um único snapshot ativo por Casa, preservando nome, vínculo, cargo, função e fonte.
- Câmara retorna limite e gasto por mês, percentual somente quando ambos existem e total apenas dos meses com valor publicado.
- Senado retorna a competência mais recente e mantém folha bruta, auxílios, diárias e indenizações separados. A soma é chamada de parcela identificada e não de custo completo.
- O panorama calcula distribuições somente dentro da mesma Casa e do mesmo período: verba anual da Câmara e folha identificada mensal do Senado não são comparadas entre si.

Consultas: `publishedPersonElectoralProfile`, `publishedCabinetProfile` e `publishedCabinetPanorama` em `packages/db/src/frontend-data.ts`.

## Perfil parlamentar

O componente compartilhado `CabinetBreakdown` apresenta a equipe e a métrica financeira própria de cada Casa. A busca nominal ocorre apenas sobre nome, vínculo, cargo e função já aprovados para exibição. Em telas largas há tabela; no celular, os mesmos campos aparecem como cartões rotulados. Cada pessoa mantém um link para a origem oficial arquivada.

A navegação do perfil ganhou a âncora “Gabinete”. Estados sem snapshot, sem vínculo financeiro ou sem resultado de busca aparecem como estados vazios explícitos. A Câmara exibe duas séries mensais, limite e gasto; o Senado exibe a decomposição por rubrica da competência ativa.
