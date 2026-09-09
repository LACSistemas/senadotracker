# Senado: cadastro de parlamentares

Validado em 08/09/2026 por requisição HTTPS real, sem autenticação. Responsável: Senado Federal. Escopo: T010; histórico em [senado-historico.md](senado-historico.md).

## Serviços e evidências

- [Catálogo oficial](https://www12.senado.leg.br/dados-abertos/legislativo/parlamentares/senadores-em-exercicio).
- [OpenAPI](https://legis.senado.leg.br/dadosabertos/v3/api-docs); [extrato consultado](evidence/senado-docs.json).
- GET `https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json`: HTTP 200, `application/json`, UTF-8, 129.367 bytes, 81 registros na amostra de 08/09/2026 às 12:21:19 UTC.
- GET `https://legis.senado.leg.br/dadosabertos/senador/5672/historico.json`: HTTP 200; retornou identificação e links para outros serviços. Não continha mandatos embutidos nessa resposta; usar o serviço específico de mandatos.
- [Fixture reduzida](../../tests/fixtures/sources/senado-lista.json) e [proveniência com hash da resposta integral](../../tests/fixtures/sources/senado-lista.provenance.json).

81 é uma contagem observada, não uma constante de validação ou prova de completude histórica. A lista cobre exercício atual, não todos os eleitos, licenciados ou suplentes cadastrados.

## Contrato observado

Raiz: `ListaParlamentarEmExercicio`. A coleção está em `Parlamentares.Parlamentar`, um array na resposta observada. `Metadados.VersaoServico` = string `4`; `DataVersaoServico` = `2020-07-15`. `Metadados.Versao` contém data/hora textual sem fuso explícito: preservar literalmente, sem tratá-la como data de atualização de cada parlamentar.

| Campo relativo a um parlamentar | Tipo observado | Uso |
| --- | --- | --- |
| `IdentificacaoParlamentar.CodigoParlamentar` | string numérica | Identificador externo principal, com namespace `senado` |
| `NomeParlamentar`, `NomeCompletoParlamentar` | string | Exibição e nome completo; nunca chave de junção |
| `SiglaPartidoParlamentar`, `UfParlamentar` | string | Situação na consulta; não substituir histórico |
| `UrlFotoParlamentar`, `UrlPaginaParlamentar` | string URL | Referências oficiais; na amostra usam HTTP |
| `Mandato.CodigoMandato` | string numérica | Identificador do mandato, separado da pessoa |
| `Mandato.DescricaoParticipacao` | string | Condição titular/suplente, não estado de exercício |
| `Mandato.Exercicios.Exercicio` | array | Intervalos de exercício e causas de afastamento |

Os nomes de campo da identificação acima estão dentro de `IdentificacaoParlamentar`. Telefones e e-mail institucional existem na resposta bruta, mas foram omitidos das fixtures por não serem necessários a este contrato. Não publicar uma URL fornecida pela fonte sem validar esquema e destino permitido; preservar a URL original na auditoria.

Recorte real: `CodigoParlamentar="5936"`, `NomeParlamentar="Carlos Portinho"`, `Mandato.CodigoMandato="545"`, `DescricaoParticipacao="1º Suplente"`, exercício com `DataInicio="2020-11-03"`, sem `DataFim`. Estar na lista atual e ser suplente são fatos compatíveis.

## Parâmetros e formatos

O OpenAPI documenta `uf`, `participacao` (`T` ou `S`) e `v` (versão de serviço; exemplo 4). Não documenta paginação para esta rota. A consulta de amostra não aplicou filtros. A extensão `.json` foi testada; o OpenAPI também anuncia XML e CSV, não testados nesta rodada. O coletor deve pedir JSON explicitamente e validar tipo/conteúdo, não apenas status 200.

Para ingestão integral do cadastro atual, não aplicar filtro por UF ou participação. A versão futura poderá explicitar `v=4` após teste do parâmetro; nesta rodada foi validada a versão retornada pelo serviço padrão, não uma chamada com `v`.

## Operação e limitações

- Nenhum token exigido nas requisições executadas. Limites de taxa e SLA não foram identificados na especificação consultada; não presumir acesso ilimitado.
- Periodicidade proposta: diária, a confirmar por observação. A cadência da fonte não foi medida.
- Guardar bytes em UTF-8 antes de parsear. A decodificação automática do Windows PowerShell 5 mostrou acentos corrompidos quando o servidor não declarou charset; Node `fetch` com bytes UTF-8 preservou os caracteres.
- Array vazio, IDs repetidos, raiz diferente ou perda inesperada de cobertura exigem investigação; não substituir o lote válido automaticamente.
- Tipos objeto único versus array em outros filtros não foram comprovados. Não aceitar uma forma alternativa silenciosamente sem fixture e documentação.
- Dados foram obtidos do serviço público oficial; atribuição e link serão mantidos. A licença específica de redistribuição e limites operacionais devem ser reconfirmados antes de exportação pública em massa.
