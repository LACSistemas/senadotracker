# Fontes MDS, CGU e Tesouro — validação P12.3

## MDS / CadÚnico

- Dados abertos MDS: `https://www.gov.br/mds/pt-br/acesso-a-informacao/dados-abertos` — HTTP 200.
- SAGICAD: `https://www.gov.br/mds/pt-br/orgaos/SAGICAD/dados-e-ferramentas-informacionais` — HTTP 200; documenta Dados agregados, CECAD, VIS DATA, Portal Analítico e Cadastro Único.
- CECAD `https://cecad.cidadania.gov.br/painel03.php`, PBF RI `https://aplicacoes.cidadania.gov.br/ri/pbfcad/` e VIS DATA `https://aplicacoes.cidadania.gov.br/vis/data3/data-explorer.php` — retornaram HTTP 200, mas redirecionaram para `gov.br/mds/pt-br/avisos` no cliente de diagnóstico.
- Portal Analítico: FAQ oficial informa que planilhas são geradas manualmente no portal; isso não prova API/bulk programático.
- `cadunico.dataprev.gov.br/portal/` — aplicação JavaScript, sem contrato de dados público comprovado.

**Status CadÚnico:** BLOCKED para publicação automatizada; documentação oficial é evidência de capacidade, não de acesso programático.

## CGU / Portal da Transparência

- `https://portaldatransparencia.gov.br/download-de-dados/novo-bolsa-familia` — HTTP 200.
- `https://portaldatransparencia.gov.br/dicionario-de-dados/novo-bolsa-familia` — HTTP 200.
- `https://portaldatransparencia.gov.br/download-de-dados/bpc` — HTTP 200.
- `https://portaldatransparencia.gov.br/dicionario-de-dados/bpc` — HTTP 200.
- `GET https://api.portaldatransparencia.gov.br/api-de-dados/novo-bolsa-familia-por-municipio` — HTTP 401.
- `GET https://api.portaldatransparencia.gov.br/api-de-dados/bpc-por-municipio` — HTTP 401.

Os dicionários expõem CPF/NIS/nome, identificadores de benefício e valores de parcela. Esses arquivos não foram baixados. Os links HTML não revelaram um recurso agregado seguro que pudesse substituir a API autenticada.

**Status Bolsa Família/BPC:** BLOCKED; qualquer acesso futuro precisa de credencial institucional e agregação antes da persistência.

## Tesouro Nacional

Dataset oficial: `https://www.tesourotransparente.gov.br/ckan/dataset/lista-de-municipios-do-siafi`, recurso `eebb3bc6-9eea-4496-8bcf-304f33155282`, `tabmun.csv`. HTTP 200; 435.942 bytes; SHA-256 `3651C930CA1DDFDE0BB7B47130795F332330D4C66B3DB70F49F3CA3494E4242D`. Atualização informada: 06/01/2022; frequência anual.
