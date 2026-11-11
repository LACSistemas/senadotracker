# Fontes financeiras do Judiciário

## Fontes nacionais

JN oferece despesa total, pessoal e estrutura em série anual. O Painel CNJ de remuneração publica planilhas via Qlik quando órgãos enviam dados padronizados; cobertura por mês/órgão é desigual. DadosJusBr é terceiro, útil para pesquisa comparativa, mas não substitui fonte oficial.

## Fontes institucionais

Portais de transparência dos tribunais publicam remuneração, contratos, diárias e execução em formatos distintos. PNCP oferece contratos/fornecedores desde 2023, porém cobertura judicial é baixa e não inclui toda execução/pagamento.

## P3 e limites

P3 comprovou execução detalhada no TJES (empenho, liquidação, pagamento, favorecido, processo) em CSV estadual. Não há cobertura nacional homogênea. Não somar remuneração, contratos e pagamentos sem chave, período e semântica compatíveis.

## Contrato futuro

Separar `budget`, `commitment`, `liquidation`, `payment`, `payroll`, `contract` e `daily`. Guardar órgão, exercício, mês, fonte, status, valor, documento, CNPJ e hash. Dados nominais exigem minimização e revisão LGPD; o MVP usa agregados JN.
