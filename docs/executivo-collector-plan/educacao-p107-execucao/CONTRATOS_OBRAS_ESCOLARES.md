# Contratos, fornecedores, contratações e obras (G3 e G4)

## G3_CONTRACTS_SUPPLIERS: PASS_WITH_CAVEATS
- 428.192 contratos educacionais em 27 UFs, 3.890 municípios, 5.585 órgãos, 75.578 fornecedores PJ (reutilizam `exec_fin_supplier`). 47.282 contratos sem fornecedor PJ (pessoa física ou ausente): **pessoa física nunca é persistida** e o nome dela é mascarado no objeto.
- Valores separados por construção: `valor_global` (contratado, em `exec_edu_contract`), `valor_estimado` e `valor_homologado` (contratação, `exec_edu_procurement`), valor de termos (`exec_edu_contract_term`). **Não existe valor pago** em nenhuma tabela. Sigilo → NULL; negativo na origem → NULL.
- Contratações publicadas: **2.030** (de ~175 mil esperadas); termos: **21** em 6 contratos (de ~273 mil contratos sem empenho). O PNCP limita a ~0,3 requisição/s, então a coleta foi priorizada por valor e o pendente está declarado (`exec_edu_ctr_cov.pending`, `COBERTURA_CONTRATACOES_EDUCACAO.csv`). Não use esses números como cobertura nacional de compras ou aditivos.
- Termos aditivos: ~32% dos contratos amostrados têm termos; `valorAcumulado`/`numeroRetificacao` **não** predizem se há termo (testado), então a fila não pôde ser reduzida.

## G4_EDUCATION_WORKS: PARTIAL
- Fonte: Obrasgov (projetos por UF × situação, execução física e financeira nacionais). É lento e instável; paginação enganosa (lê até página vazia).
- **Coletadas só 9 UFs** (AC, AM, AP, AL, BA, CE, ES, GO, DF; algumas situações ainda faltando) e **nenhum** arquivo nacional de execução física/financeira concluído. Publicadas **6.637 obras** educacionais (de 24.855 projetos lidos nessas UFs; 5.516 duplicados). **Nenhuma tem percentual físico nem empenho publicado**; isso é "não coletado" (`pending` na cobertura), não "zero". As 18 UFs restantes são NOT_COLLECTED.
- Situação das obras: Concluída 3.475, Cadastrada 1.957, Em execução 779, Cancelada 287, Paralisada 135. Valor previsto ≤ R$ 0,01 é placeholder (NULL + marca): 3.666 de 6.637. Datas ficam em `exec_edu_work`.
- Educação da obra por evidência: órgão de educação (executor/tomador/repassador), nome com marcador escolar ou contrato educacional do PNCP apontando a obra pelo CIPI.
- Vínculo obra↔contrato **só por CIPI**: 17.838 contratos informam CIPI, mas só 2 batem com uma obra já coletada (a cobertura de obras é parcial; os demais não são provados nem descartados).
- Contratos "de construção" **não** foram tomados como obras: a categoria 1/2 de contrato é contratação; obra é registro do Obrasgov.
- Cobertura nacional de obras: **não declarada**. FNDE/SIMEC/Transferegov exigem login ou não foram operacionalizados: NOT_EVALUATED.
