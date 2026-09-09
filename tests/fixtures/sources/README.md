# Amostras oficiais reduzidas

Coletadas em 08/09/2026 via HTTPS, sem autenticação. São fixtures para testes offline de contrato, **não um cadastro completo nem dados para a interface**.

Cada JSON tem um arquivo `.provenance.json` contendo URL exata, instante UTC, status, tipo de conteúdo, tamanho e SHA-256 da resposta bruta, SHA-256 da fixture e seleção aplicada. O hash bruto não coincide com o da fixture porque o recorte e a formatação são diferentes. Respostas integrais ficam em `data/research/`, fora do Git.

Transformação: parse UTF-8; selecionar do cadastro do Senado somente IDs 5672, 5936 e 6336; remover recursivamente `email`, `EmailParlamentar`, `Telefones`, `SexoParlamentar`, `FormaTratamento`, `nomeEleitoral`, `CodigoPublicoNaLegAtual`, `Bloco`, `MembroMesa`, `MembroLideranca`; serializar com indentação de dois espaços e newline final. Demais valores, ausências, nulos e ordem de arrays foram preservados. Nas demais fixtures todos os registros da resposta solicitada foram mantidos, mas nenhuma representa um domínio completo.

| Fixture | Caso demonstrado |
| --- | --- |
| `senado-lista.json` | IDs string, três contextos de mandato, exercícios encerrados e fim ausente |
| `senado-mandatos.json` | Mandato do parlamentar 5672 e filiações por mandato |
| `senado-suplente-mandatos.json` | Suplente 5936, titular distinto e exercício posterior ao início institucional |
| `senado-filiacoes.json` | Filiações explícitas, fim ausente e lacuna de datas |
| `camara-lista.json`, `camara-page2.json` | Duas páginas reais ligadas por `next`, IDs distintos |
| `camara-historico.json` | Mudanças de partido, licença, retorno, fim e evento com situação nula |

Atualizar fixtures exige nova consulta, revisão do recorte, atualização da proveniência e das fichas de fonte. Os testes não usam rede e não detectam sozinhos mudanças futuras da API; os testes reais de integração serão implementados nos blocos seguintes.
