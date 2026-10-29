# Privacidade P12.3

`PERSONAL_DATA_PERSISTED = 0` e `PII_PRIVACY_GATE = PASS`.

Foram consultadas somente páginas, dicionários e respostas HTTP de API. Não foram baixados arquivos de Bolsa Família/BPC contendo CPF, NIS, nome, número de benefício ou representante. As respostas 401 não foram contornadas e nenhum token foi solicitado ou armazenado.

O crosswalk salvo em `D:\Civica\raw\mec\tabmun.csv` contém código SIAFI, CNPJ institucional, nome de município, UF e código IBGE; não é cadastro de beneficiários. Ele fica fora do banco e do repositório.

Qualquer ingestão futura deve partir de recurso agregado oficial ou de transformação efêmera com descarte comprovado dos identificadores antes do staging.
