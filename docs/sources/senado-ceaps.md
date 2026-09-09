# Senado — CEAPS

Validado em 08/09/2026. O catálogo oficial identifica o conjunto “Cotas para Exercício da Atividade Parlamentar dos Senadores”, fonte Sistema Cotas, periodicidade diária e formatos CSV/serviço. O link intermediário do catálogo redirecionou indevidamente para autenticação; o arquivo público anual funcionou sem credencial.

- Arquivo: `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv`.
- 2026: HTTP 200, 3.325.762 bytes, 13.662 linhas de dados, atualização declarada `08/09/2026 02:03`.
- 2025: HTTP 200, 5.833.550 bytes.
- Formato observado: Windows-1252, `;`, campos entre aspas, primeira linha com atualização.

Campos: `ANO`, `MES`, `SENADOR`, `TIPO_DESPESA`, `CNPJ_CPF`, `FORNECEDOR`, `DOCUMENTO`, `DATA`, `DETALHAMENTO`, `VALOR_REEMBOLSADO`, `COD_DOCUMENTO`. O arquivo não traz o ID legislativo do senador; o importador só vincula igualdade normalizada com nome parlamentar/nome completo do cadastro publicado. Nomes não resolvidos ficam excluídos e contabilizados.

`VALOR_REEMBOLSADO` é publicado como débito identificado da CEAPS. Não equivale a custo total do mandato nem prova pagamento direto ao senador. Valores negativos reduzem a soma. O CSV não separa valor bruto e glosa; esses campos permanecem indisponíveis, sem reconstrução.
