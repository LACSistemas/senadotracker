# TSE — eleições, candidaturas e resultado

Validado em 08/09/2026 para o recorte inicial das Eleições Gerais de 2022, primeiro turno. O catálogo oficial publica `consulta_cand_2022.zip`, `bem_candidato_2022.zip`, `votacao_candidato_munzona_2022.zip` e a prestação de contas de candidatos. O resultado simplificado também é publicado em JSON no domínio `resultados.tse.jus.br`.

Fontes oficiais: [Candidatos 2022](https://dadosabertos.tse.jus.br/dataset/candidatos-2022), [Prestação de contas 2022](https://dadosabertos.tse.jus.br/dataset/dadosabertos-tse-jus-br-dataset-prestacao-de-contas-eleitorais-2022) e [Candidatos 2018](https://dadosabertos.tse.jus.br/dataset/candidatos-2018). Licença informada pelo catálogo: Creative Commons Attribution.

## Recorte e chaves

- Eleição: ano + turno + abrangência; candidatura: `SQ_CANDIDATO`.
- Resultado: cargo, UF, situação totalizada e votos nominais. A contagem municipal/zonal deve ser somada por candidatura sem misturar turnos.
- Arquivos CSV do TSE usam `;`, cabeçalho, aspas e historicamente `latin-1`/Windows-1252; o coletor deve detectar BOM e validar cabeçalhos antes de processar.
- A coleta é por arquivo e ano, com bruto imutável, hash, lote substituível e retomada por recurso. Resultado literal oficial é preservado.

Em 08/09/2026 o CDN `cdn.tse.jus.br`, o serviço DivulgaCandContas e o host de resultados responderam 403 ou falha de conexão neste ambiente. Uma falha de obtenção publica `unavailable`, com zero registros e motivo, e não equivale a ausência de candidatura.

## Identidade

Uma candidatura permanece separada da pessoa. O vínculo automático exige candidato único com nome completo ou nome de urna normalizado, UF e partido compatível no ano. Nome sozinho nunca confirma; zero correspondências fica `pending` e mais de uma fica `ambiguous`.

## Segunda eleição

O catálogo de 2018 confirma os mesmos conjuntos conceituais. Antes de importar, o leitor compara os cabeçalhos reais com o contrato de 2022; campos novos são preservados no bruto e diferenças obrigatórias interrompem a publicação. A validação de conteúdo de 2018 permanece indisponível enquanto o arquivo oficial não puder ser obtido neste ambiente.
