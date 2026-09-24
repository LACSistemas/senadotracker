# Valores de contratações e execução

As grandezas são preservadas separadamente: estimado, proposto, adjudicado, contrato original, valor atual publicado, faturado/cobrado, empenhado, liquidado e pago. Nenhuma delas é somada à outra para produzir “gasto”.

Pagamento publicado deriva somente de movimentos oficiais da fase de pagamento, com anulações e estornos pelo sinal. Fontes paralelas não são somadas. Se pagamento superar liquidação, ou liquidação superar empenho no mesmo universo, o valor conflitante fica indisponível e a divergência é registrada.

No Senado, totais por NE podem incluir execução do exercício e restos a pagar posteriores. Datas e restos só são publicados quando documentos relacionados possuem vínculo reverso inequívoco e soma líquida idêntica ao total da NE. Documento fiscal, cobrança, contrato, aditivo ou empenho não provam pagamento.

Aditivo sem qualificador oficial permanece com semântica desconhecida; seu valor não é interpretado automaticamente como acréscimo, supressão ou novo total.
## Estado de cobertura por competência

Pagamentos institucionais só entram no total quando há movimento `phase=payment` ligado a um empenho/compromisso e a um fornecedor com identificador forte. A série mensal usa `occurred_at` do movimento; mês ausente significa ausência de movimento publicado ou data não disponível, nunca pagamento zero.

Categorias de pagamento não são inventadas a partir de objeto contratual, modalidade, PCA ou elemento de despesa. Enquanto a fonte não publicar uma classificação financeira comparável, o ranking de categorias permanece indisponível e a interface mostra a distribuição por Casa e a série mensal como dimensões verificáveis.
