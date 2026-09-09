# Câmara — votos e deliberações

Validado em 08/09/2026 por OpenAPI, tutorial e requisições HTTPS reais, sem autenticação.

- Lista: `GET /api/v2/votacoes`, paginada.
- Detalhe: `GET /api/v2/votacoes/{id}`.
- Votos nominais e abertos: `GET /api/v2/votacoes/{id}/votos`; esta rota não aceita o parâmetro `itens` na versão observada.
- Relações: `GET /proposicoes/{id}/votacoes`; arquivos anuais `votacoes`, `votacoesVotos`, `votacoesObjetos` e `votacoesProposicoes`.

O identificador da votação é alfanumérico e exclusivo, como `2611313-31`. O detalhe separa descrição, aprovação, última abertura, possíveis objetos, proposições afetadas e efeitos. `aprovacao=1` descreve o resultado da deliberação; não equivale a sanção nem transformação em lei. O tutorial oficial alerta que o objeto efetivamente votado pode não estar identificado e que várias proposições podem aparecer como possíveis objetos.

Cada voto conserva `tipoVoto`, `dataRegistroVoto` e a identidade contextual do deputado. A amostra nominal `2611313-31`, de 03/09/2026, retornou 396 votos. [Fixture reduzida](../../tests/fixtures/sources/camara-votacao.json) e hashes das duas respostas em `camara-votacao.provenance.json`.

Votações simbólicas podem não ter votos individuais; lista vazia não permite inferir ausência parlamentar. O partido do voto é contextual ao evento e não deve ser substituído pelo partido atual. Textos com caracteres de substituição são preservados como publicados.
