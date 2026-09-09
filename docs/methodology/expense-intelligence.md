# Detalhamento e inteligência da cota

O detalhamento usa um único lote anual ativo, uma Casa e um parlamentar. O valor líquido de cada lançamento é `net_cents - refund_cents`; estornos continuam negativos e nenhuma parcela é chamada de custo total do mandato.

Categorias são agrupadas pelo código oficial e reconciliam exatamente com o total do período. Categorias sem lançamento não são criadas com zero. Fornecedores usam documento e nome normalizados; a interface preserva o rótulo “Fornecedor não informado” quando ambos faltam.

Um mês fica nulo quando não existe no lote da Casa. Se o mês está coberto e não há lançamento individual, o gasto mensal do parlamentar é zero. Médias do partido e do estado incluem somente pessoas com observação financeira naquele mês, sem converter ausência de registro em zero.

Benchmarks usam a mesma Casa, ano, lote e último mês coberto. Partido é resolvido na data final do recorte; estado vem do cadastro ativo. Média, mediana, posição, universo, percentil e diferença para a mediana expõem a amostra.

“Principais destaques” segue regras determinísticas:

- categoria com pelo menos 25% do total;
- fornecedor com pelo menos 15% do total;
- mês com pelo menos 1,5 vez a média mensal observada;
- posição no universo comparável da Casa.

As frases carregam o período e o lote na própria seção. Nenhum texto é gerado por modelo e nenhum limiar altera os números mostrados nos gráficos e tabelas.
