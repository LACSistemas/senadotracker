# Senado — votos e deliberações

Validado em 08/09/2026 por OpenAPI e requisição HTTPS real, sem autenticação.

## Vocabulário de voto

O valor literal de `SiglaDescricaoVoto` é preservado. `Sim`, `Não` e `Abstenção` têm leitura direta. Um relatório oficial de atendimento da LAI do Senado registra `NCom` como “não compareceu” e `P-NRV` como “presente, não registrou voto”: `https://www12.senado.leg.br/transparencia/lai/relatorios-lai-11/Relatorio%20Mensal%20SICLAI%2011%20NOV%202018.pdf`. Outros códigos, entre eles `AP` e `LP`, permanecem apresentados literalmente enquanto a expansão oficial não estiver publicada no contrato consultado; a interface não os converte em presença, ausência ou sentido de voto.

- OpenAPI: `https://legis.senado.leg.br/dadosabertos/v3/api-docs`.
- Votos por senador: `GET /senador/{codigo}/votacoes.json`.
- Votações nominais do Plenário: `GET /plenario/votacao/nominal/{ano}`.
- Votações de matéria: `GET /materia/votacoes/{codigo}`.
- Comissões: `/votacaoComissao/parlamentar/{codigo}`, `/materia/{sigla}/{numero}/{ano}` e `/comissao/{siglaComissao}`.

A resposta observada para o senador 5672 tinha 423 registros e 909.452 bytes. Cada item combina uma deliberação (`CodigoSessaoVotacao` e `Sequencial`), sessão, matéria, descrição do objeto votado, resultado e `SiglaDescricaoVoto`. A matéria não identifica sozinha a deliberação: uma mesma matéria pode receber várias votações, inclusive emendas, substitutivos, requerimentos e redação final.

Campos preservados: código/data/hora/tipo da sessão; código, identificação, ementa e processo da matéria; código e sequência da votação; indicador de sigilo; descrição da votação; resultado; voto literal; tramitação e URL da requisição. “Aprovado” é resultado daquela deliberação, não prova que a matéria virou lei.

Amostra: [senado-votacao.json](../../tests/fixtures/sources/senado-votacao.json), extraída da resposta integral com hash em `senado-votacao.provenance.json`. O JSON oficial observado contém caracteres de substituição em textos acentuados; preservar o literal e não reconstruir palavras por inferência.

Limites: a rota por parlamentar não é um universo de presença; falta de linha não significa ausência. Votações secretas não devem gerar voto individual público. A cobertura inicial será delimitada por ano e por tipo de rota, com contagem e lote próprios.
