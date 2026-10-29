# Crosswalk SIAFI → IBGE

Fonte: Tesouro Transparente, recurso oficial `tabmun.csv`, sem cabeçalho, delimitado por ponto e vírgula.

- URL: `https://www.tesourotransparente.gov.br/ckan/dataset/abb968cb-3710-4f85-89cf-875c91b9c7f6/resource/eebb3bc6-9eea-4496-8bcf-304f33155282/download/tabmun.csv`
- Caminho validado: `D:\Civica\raw\mec\tabmun.csv`
- SHA-256: `3651C930CA1DDFDE0BB7B47130795F332330D4C66B3DB70F49F3CA3494E4242D`
- Tamanho: 435.942 bytes
- Linhas: 5.589; largura: 5 em 5.589/5.589
- Chaves SIAFI distintas: 5.589; chaves IBGE distintas: 5.571
- UFs: 27; códigos IBGE repetidos: 19, preservados como relação source-native e não colapsados por nome.

Layout observado: `codigo_siafi;cnpj;nome_municipio;uf;codigo_ibge7`. O crosswalk é determinístico por código e não usa fuzzy matching. A duplicidade de código IBGE exige validação de vigência/source context antes de impor unicidade bidirecional.
