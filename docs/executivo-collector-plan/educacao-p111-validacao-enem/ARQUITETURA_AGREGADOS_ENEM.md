# Arquitetura de agregados ENEM (proposta, sem implementação)

## Princípio

Manter ZIPs originais e qualquer staging somente em `D:\Civica`. O banco deve receber apenas revisões de agregados territoriais; nenhum participante ou identificador é necessário para responder às perguntas municipais.

## Chaves e dimensões

- `edition` (ano), `geo_level` (`NATIONAL`, `UF`, `MUNICIPALITY`), `municipality_code` e `uf`;
- `school_network` (`ALL`, `FEDERAL`, `STATE`, `MUNICIPAL`, `PRIVATE`);
- `subject` (`CN`, `CH`, `LC`, `MT`, `ESSAY`);
- `metric` (`rows`, `presence`, `valid_n`, `mean`, `median`, quantis, distribuição).

Naturalidade territorial é o código oficial `CO_MUNICIPIO_ESC` + edição. Não usar nome aproximado e não derivar residência.

## Pipeline seguro

1. baixar para D, registrar URL, `Content-Length`, `Last-Modified`, SHA-256 e hash inicial/final;
2. ler dicionário e cabeçalho antes do streaming;
3. processar em streaming, descartando a linha após atualizar contadores/histogramas;
4. validar os agregados nacionais contra as tabelas 1.1, 1.2, 7.4.1 e 7.5.1 da Sinopse;
5. publicar revisão somente quando a reconciliação e a cobertura passarem;
6. manter a última revisão boa se a fonte mudar ou falhar.

## Consultas de produto

O read model deve entregar município, UF da escola e Brasil lado a lado, com nota metodológica e denominadores. A camada de produto não deve calcular média, mediana ou status; deve consumir os agregados publicados. Para escolas pequenas, somente rede agregada e células aprovadas pela regra de supressão.

## Custo observado

Streaming dos três resultados: 3.933.955, 4.332.944 e 4.810.772 linhas; cerca de 64–85 s por edição nesta máquina, com RSS de dezenas de MB. O custo de armazenamento bruto é aproximadamente 2,11 GB (ZIPs 2023–2025) mais o staging temporário de 2025; o produto agregado é pequeno.
