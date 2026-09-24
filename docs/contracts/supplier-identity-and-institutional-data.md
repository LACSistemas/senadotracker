# Identidade global e dados institucionais de fornecedores

**Versão:** `supplier-id-v1`  
**Fontes normativas do identificador:** [Receita Federal — documentação técnica](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj) e [primeiro CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-gera-o-primeiro-cnpj-em-formato-alfanumerico).

## Resolução de identidade

1. O valor bruto é preservado.
2. A forma normalizada remove somente pontuação de apresentação e espaços, converte letras para maiúsculas e nunca remove letras.
3. CNPJ aceita 12 posições alfanuméricas e dois DVs numéricos; o DV usa módulo 11 e valor ASCII menos 48.
4. CPF permanece tipo próprio e segue seu DV numérico.
5. Máscara (`*`/`•`), sentinela, documento inválido ou não validado não gera match forte.
6. Match automático usa `identifier_type + normalized_value + country_code`.
7. Nome, similaridade e raiz de CNPJ servem para busca/revisão, nunca para merge automático.
8. Estabelecimentos com CNPJ completo diferente permanecem entidades diferentes.

O primeiro CNPJ alfanumérico oficial, `00.000.000/E08G-12`, integra os testes de contrato.

## Privacidade e exposição

- CPF pode resolver internamente uma identidade quando íntegro e válido, mas não autoriza página pública nem exposição integral.
- CPF mascarado não é completado ou cruzado.
- `supplier_names` preserva grafias oficiais; nome não é identificador.
- identificadores inválidos/sentinela continuam no fato financeiro bruto, sem fornecedor canônico compartilhado.

## Conflitos e revisão

- A unique key parcial impede dois fornecedores confirmados com o mesmo identificador forte.
- Se a fonte tentar associar um identificador forte a outro `supplier_id`, o resolver registra conflito e não altera o match existente.
- Registros fracos ficam pendentes; não há fuzzy merge automático.
- Cada decisão guarda método, status, versão, timestamp e evidência JSON.

## Modelo de identidade

- `suppliers`: entidade canônica, sem papel embutido.
- `supplier_identifiers`: identificador normalizado e status de validação.
- `supplier_identifier_observations`: grafias brutas e proveniência.
- `supplier_names`: aliases, forma de busca, vigência e fonte.
- `supplier_roles`: papel por instituição e período observado.
- `expense_supplier_links`: vínculo reversível do lançamento imutável à entidade.
- `supplier_identity_batches` e `active_supplier_identity_publication`: revisão publicada e reconciliação.

## Modelo institucional

As migrations preservam entidades independentes para processo, pedido, licitação, item, proposta, adjudicação, contrato, item contratual, aditivo, empenho, movimento financeiro, cobrança, documento fiscal, ata, acionamento, sanção e PCA.

### Chaves

- cada entidade tem `id` interno estável;
- `(source_system, source_*_id)` é único;
- FKs expressam a cadeia, sem inferência por texto;
- `institutional_source_records` liga chave externa, payload/hash, raw, fetch e atualização;
- `institutional_collection_batches` publica cada conjunto por instituição/sistema/dataset.

### Taxonomia financeira

| Fato | Campo persistido | Semântica |
| --- | --- | --- |
| Estimativa | `tenders.estimated_value_scaled` / item | orçamento antes do resultado |
| Proposta | `supplier_proposals.proposed_*` | oferta do licitante |
| Adjudicação | `item_awards.awarded_value_scaled` | resultado vencedor publicado |
| Contrato original | `institutional_contracts.original_value_scaled` | valor na assinatura inicial |
| Contrato atual publicado | `current_published_value_scaled` | valor que a fonte chama de vigente/atual, com semântica textual |
| Empenho | `commitments.committed_value_scaled` e movimentos | reserva e seus ajustes |
| Liquidação | `financial_movements.phase='liquidation'` | obrigação reconhecida |
| Pagamento | `financial_movements.phase='payment'` | movimento financeiro pago |
| Faturamento | `contract_billings.billed_value_scaled` | cobrança; não prova pagamento |
| Multa/glosa/retenção | campos próprios de cobrança | ajuste, nunca pagamento implícito |

Valores usam inteiro escalado e `value_scale` entre 0 e 6. Não existe coluna financeira genérica `value`/`total_value`. `amount_signed_scaled` preserva anulações e estornos negativos.

## Proveniência e publicação

Fluxo obrigatório:

```text
HTTP/arquivo → raw_objects → institutional_source_records
             → normalização → tabelas canônicas
             → reconciliação → active_institutional_publications
```

- payload bruto é escrito antes da normalização;
- hash idêntico permite skip;
- hash diferente gera nova observação/histórico;
- uma fonte vazia ou inválida não substitui o lote ativo;
- desaparecimento não apaga imediatamente o registro;
- cada conjunto pode publicar/falhar sem bloquear as outras fontes;
- PNCP é enriquecimento não bloqueante.

## Compatibilidade

`expenses.supplier` e `expenses.supplier_document` permanecem intactos. As páginas atuais podem continuar em leitura legada enquanto as novas usam `expense_supplier_links`. Totais financeiros incluem linhas não resolvidas; cruzamentos de entidade usam apenas links confirmados. A revisão de identidade deve integrar a chave de cache.

O schema operacional atual é SQLite/`DatabaseSync`. A migration para PostgreSQL deve traduzir `STRICT`, índices parciais e checks sem mudar a semântica antes de o collector institucional ser apontado ao PostgreSQL.

