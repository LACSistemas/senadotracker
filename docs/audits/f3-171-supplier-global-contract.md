# F3-171 — contrato global de fornecedores

**Auditoria executada em:** 23/09/2026  
**Banco auditado:** `data/senadotracker.sqlite`  
**Schema observado:** migration 28  
**Escopo:** estado atual, contrato alvo e plano de compatibilidade/rollback. Nenhuma migration foi aplicada nesta tarefa.

## Decisão

O Cívica terá uma única entidade global `suppliers`. Despesa parlamentar, licitação, contrato institucional e pagamento são papéis e fatos relacionados à entidade; não são tipos mutuamente exclusivos de fornecedor.

Não serão criadas entidades independentes `parliamentary_suppliers` e `institutional_suppliers`. Também não haverá `supplier.type = institutional`, porque a mesma entidade pode aparecer nos dois universos.

O match automático forte exige:

```text
identifier_type + normalized_value + country_code
```

Nome igual, nome semelhante e raiz de CNPJ não autorizam merge automático. Identificadores inválidos, mascarados, sentinela ou ausentes não recebem identidade compartilhada entre registros sem revisão/evidência adicional.

## Estado atual

### Persistência

Não existe tabela de fornecedor. O fornecedor está repetido em cada linha de `expenses`:

```text
expenses
  batch_id
  record_key
  source
  external_id
  year / month
  category_code / category
  supplier
  supplier_document
  net_cents / refund_cents
  raw_id
```

A PK é `(batch_id, record_key)`. `supplier` e `supplier_document` preservam o texto da fonte, o que deve continuar acontecendo.

Índices atuais de `expenses` cobrem pessoa/período/categoria, mas nenhum cobre documento de fornecedor. O radar normaliza o documento dentro da consulta e cria árvores temporárias para `GROUP BY`, dois `count(DISTINCT)` e ordenação.

### Consultas dependentes

| Área | Arquivo | Comportamento atual |
| --- | --- | --- |
| Radar | `packages/db/src/investigative.ts` | Agrupa lançamentos ativos por `replace()` de pontuação no documento; filtra depois em JavaScript por CNPJ numérico válido |
| Detalhe invertido | `packages/db/src/investigative.ts` | Busca todas as despesas do CNPJ, agrega pessoas, UFs, partidos, Casas, categorias e meses em memória |
| Inteligência individual | `packages/db/src/expense-intelligence.ts` | Usa `searchText(document + nome)` como identidade local do fornecedor |
| Cache web | `apps/web/lib/data.ts` | Cache de 60 segundos por query, sem revisão de fornecedor na chave |
| Listagem | `apps/web/app/legislativo/fornecedores/page.tsx` | URL e row key são o documento normalizado |
| Detalhe | `apps/web/app/legislativo/fornecedores/[documento]/page.tsx` | Só aceita documento que passe no validador atual |
| Gastos do parlamentar | `apps/web/app/parlamentares/[source]/[id]/gastos/page.tsx` | Só cria link para documento numérico reconhecido como CNPJ válido |

### Normalização atual

`validCnpj()` remove tudo que não for dígito e exige exatamente 14 dígitos. Isso tem quatro consequências:

1. CNPJ alfanumérico futuro é destruído/rejeitado.
2. CPF não participa do radar/detalhe.
3. fornecedores estrangeiros ou sem documento forte não ganham detalhe;
4. placeholders podem agregar entidades sem relação antes de serem descartados pelo filtro.

O agrupamento de `expense-intelligence.ts` também não é igual ao radar: ele combina documento e nome normalizados. Portanto a mesma despesa pode pertencer a grupos diferentes conforme a tela.

## Medição do banco ativo

O banco tinha 2.440.908.800 bytes e quatro publicações anuais ativas de despesas.

| Métrica | Resultado |
| --- | ---: |
| Lançamentos ativos | 259.977 |
| Valor líquido (`net_cents - refund_cents`) | R$ 314.328.767,78 |
| Linhas sem documento | 27.396 |
| Valor líquido sem documento | R$ 17.083.334,43 |
| Documentos normalizados não vazios | 26.140 |
| CNPJs numéricos distintos válidos | 25.907 |
| CPFs numéricos distintos por comprimento | 215 |
| CNPJs numéricos distintos inválidos | 5 |
| Outros comprimentos | 13 |
| Identificadores alfanuméricos observados | 0 |
| Documentos presentes nas duas Casas | 2.273 |
| Documentos presentes em mais de um ano | 9.887 |
| Documentos com mais de um nome publicado | 4.094 |
| Documentos com mais de uma grafia bruta | 2.273 |
| Nomes normalizados associados a mais de um documento | 1.088 |

Distribuição dos lançamentos ativos:

| Casa | Ano | Linhas | Documentos distintos | Linhas sem documento |
| --- | ---: | ---: | ---: | ---: |
| Câmara | 2025 | 149.120 | 17.026 | 27.076 |
| Senado | 2025 | 22.188 | 3.491 | 0 |
| Câmara | 2026 | 75.567 | 15.409 | 320 |
| Senado | 2026 | 13.102 | 2.660 | 0 |

Os cinco documentos de 14 dígitos inválidos são sentinelas. Os principais são:

| Documento | Linhas | Conteúdo observado |
| --- | ---: | --- |
| `00000000000001` | 3.640 | `CELULAR FUNCIONAL` |
| `00000000000006` | 3.230 | `RAMAL` |
| `00000000000010` | 806 | centenas de serviços/empresas diferentes, inclusive fornecedores estrangeiros |
| `00000000000002` | 16 | `LINHA DIRETA` |
| `00000000000000` | 1 | pessoa física nominal |

Esses valores nunca podem formar um `supplier` compartilhado. O texto bruto continua no lançamento e cada ocorrência permanece sem match forte, salvo resolução posterior baseada em outra evidência oficial.

### Custo da consulta atual

O radar de 2026 retornou 16.985 grupos em cinco execuções quentes entre **327,0 ms e 368,1 ms** apenas no banco. O plano usa o índice por lote/ano, mas cria B-trees temporárias para agrupamento, `DISTINCT` e ordenação. Uma tabela de identidade e agregados publicados será necessária para as futuras páginas; adicionar apenas outro `replace()` ou índice de expressão não resolve aliases, papéis e proveniência.

## Contrato global proposto

### `suppliers`

Representa a entidade canônica, sem papel institucional embutido.

| Campo | Regra |
| --- | --- |
| `id` | identificador interno estável, sem significado de negócio |
| `canonical_name` | melhor nome publicado disponível; pode mudar com histórico preservado |
| `entity_kind` | `company`, `individual`, `public_body`, `foreign_entity`, `other`, `unknown` |
| `identity_status` | `confirmed`, `provisional`, `ambiguous`, `rejected` |
| `created_at` / `updated_at` | auditoria local |

`canonical_name` não é chave e não prova identidade.

### `supplier_identifiers`

| Campo | Regra |
| --- | --- |
| `id` | chave interna do identificador |
| `supplier_id` | FK para `suppliers` |
| `identifier_type` | `cnpj`, `cpf`, `foreign_tax_id`, `other` |
| `raw_value` | valor exatamente como publicado |
| `normalized_value` | maiúsculas, sem pontuação permitida, preservando letras |
| `country_code` | ISO, `BR` quando comprovado |
| `is_masked` | booleano |
| `validation_status` | `valid`, `invalid`, `masked`, `not_validated`, `sentinel` |
| `normalization_version` | versão explícita da regra aplicada |
| `valid_from` / `valid_to` | vigência quando publicada |
| `source` / `source_record_id` | proveniência |
| `created_at` | auditoria local |

Índice único parcial forte: `(identifier_type, normalized_value, country_code)` somente para identificador não mascarado, não sentinela e validado/confirmável. Várias grafias brutas podem apontar para o mesmo fornecedor. CPF recebe regras de acesso/exposição próprias.

### `supplier_names`

| Campo | Regra |
| --- | --- |
| `id` | chave interna |
| `supplier_id` | FK |
| `name` | grafia publicada |
| `search_name` | forma de busca, nunca de merge automático |
| `is_canonical` | marca o nome preferido atual |
| `valid_from` / `valid_to` | vigência quando disponível |
| `source` / `source_record_id` | proveniência |
| `first_seen_at` / `last_seen_at` | observação local |

Não deduplicar estabelecimentos diferentes porque compartilham razão social ou raiz de CNPJ.

### `supplier_roles`

| Campo | Regra |
| --- | --- |
| `supplier_id` | FK |
| `role` | `PARLIAMENTARY_EXPENSE`, `INSTITUTIONAL_TENDER`, `INSTITUTIONAL_CONTRACT`, `INSTITUTIONAL_PAYMENT` |
| `institution` | `CAMARA`, `SENADO`; extensível sem alterar identidade |
| `first_seen_at` / `last_seen_at` | período observado |
| `source` | fonte que comprova o papel |
| `source_record_id` | registro/lote que comprova o papel |

A chave deve impedir repetição da mesma evidência, mas permitir períodos/fontes distintos. `has_parliamentary_activity` e `has_institutional_activity` serão derivados/materializados, nunca verdade primária.

### Vínculo com despesas existentes

Para preservar o fato bruto e permitir rollback, a primeira migration deve preferir uma relação lateral:

```text
expense_supplier_links
  batch_id
  record_key
  supplier_id
  supplier_identifier_id nullable
  match_method
  match_status
  matched_at
  resolver_version
  evidence_json
  primary key (batch_id, record_key)
  foreign key (batch_id, record_key) -> expenses
```

`expenses.supplier` e `expenses.supplier_document` não são removidos nem reescritos. Um link `confirmed` exige identificador forte; registros sem documento, CPF mascarado, sentinelas e documentos inválidos ficam `unresolved`/fora da tabela conforme o contrato final da F3-172.

Esse desenho evita alterar centenas de milhares de linhas imutáveis e permite que consultas antigas funcionem enquanto as novas migram gradualmente.

## Compatibilidade por etapa

1. **Migration aditiva:** criar as quatro tabelas e índices sem mudar `expenses` nem rotas.
2. **Backfill dry-run:** gerar candidatos, métricas e conflitos sem persistir links.
3. **Backfill canário:** uma Casa/ano, publicar somente após reconciliação de contagem e valores.
4. **Dual read:** novas consultas usam links confirmados; cobertura e valores sem identidade continuam calculados das despesas brutas quando necessário.
5. **Comparação:** executar consultas antiga e nova, comparando totais, documentos, aliases e fornecedores rejeitados.
6. **Ativação por revisão:** trocar cache/consulta por uma versão publicada da identidade.
7. **Institucional:** collectors reutilizam `suppliers` e acrescentam papéis; não criam identidade paralela.
8. **Depreciação posterior:** remover normalizações ad hoc somente após todas as rotas e testes usarem o contrato global.

### Compatibilidade obrigatória das páginas atuais

- `/legislativo/fornecedores` continua acessível durante a transição.
- URLs antigas por CNPJ resolvem para o `supplier_id` canônico ou redirecionam sem perder filtros.
- detalhe de gastos continua exibindo o nome/documento publicado no lançamento;
- totais líquidos continuam incluindo registros sem fornecedor resolvido;
- somente cruzamentos entre entidades exigem identidade forte;
- caches incluem a revisão/publicação da identidade para não servir aliases antigos após backfill.

## Rollback

O rollback funcional não exige reescrever `expenses`:

1. desativar a revisão publicada de identidade;
2. voltar os adaptadores para as consultas legadas;
3. invalidar caches de fornecedor;
4. manter tabelas novas para auditoria ou removê-las em migration reversa posterior;
5. nunca apagar `supplier`/`supplier_document` originais;
6. nunca publicar lote institucional se a migration/normalização falhar.

O rollback da migration deve remover primeiro links/roles/names/identifiers e por último `suppliers`, sempre depois de verificar que nenhuma publicação ativa depende deles. Não haverá `DROP` automático durante deploy.

## Invariantes para F3-172 e F3-175

1. CNPJ é texto e pode ser alfanumérico.
2. Normalização nunca usa `replace(/\D/g, '')` para CNPJ.
3. Um identificador sentinela não cria entidade compartilhada.
4. Nome e raiz de CNPJ não fazem merge automático.
5. O lançamento bruto continua auditável e imutável.
6. Match e papel guardam fonte, evidência, versão e timestamp.
7. Valor sem identidade forte continua nos totais financeiros, mas não em cruzamentos de fornecedores.
8. CPF mascarado não recebe página pública individual.
9. A mesma entidade pode ter múltiplos papéis e Casas.
10. Reexecutar o backfill não cria fornecedor, alias, papel ou link duplicado.

## Critério de saída da F3-171

- estado atual, consultas e rotas dependentes inventariados;
- impacto medido no banco ativo;
- entidade global, identificadores, nomes, papéis e vínculo de despesas especificados;
- compatibilidade incremental e rollback definidos;
- riscos que pertencem à normalização detalhada da F3-172 isolados;
- nenhuma migration ou alteração de comportamento aplicada prematuramente.

