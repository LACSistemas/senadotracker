# Investigação — Relatorias das comissões

## 1. Resumo executivo
A base contém relatorias associadas a matérias, pessoas e, na maioria dos casos, órgãos. O rótulo seguro para a UI é **Relatorias conhecidas** ou **Relatorias identificadas na cobertura atual**. Não é seguro usar “Relatorias atuais” como regra geral: a Câmara deriva o registro do `ultimoStatus`, enquanto o Senado mistura histórico, redistribuições, ad hoc e encerramentos.

## 2. Como relatorias são coletadas hoje
**Senado:** `GET /senador/{id}/relatorias.json`, executado para o cadastro ativo dos 81 senadores. O endpoint retorna matéria, comissão, datas de designação/destituição e situação conforme publicado no perfil do parlamentar.

**Câmara:** o collector lê `ultimoStatus` do arquivo oficial anual de proposições (`camara-proposicoes-2026.json`). Quando o status contém relator, materializa um appointment. Isso representa o relator associado ao último status conhecido, não um histórico completo de designações.

## 3. Schema real (`kind=rapporteurship`)
Campos observados: `source`, `externalId`, `personExternalId`, `bodyId`, `bodyLabel`, `role`, `start`, `end`, `status`, `proposalId`, `officialUrl`, `rawId`. Exemplo Senado: `bodyId=2023`, `bodyLabel=CMMPV 728/2016`, `role=Relator`, `start=1995-01-20`, `end=1995-01-20`, `status=Matéria com tramitação encerrada`. Exemplo Câmara: `bodyId=4`, `bodyLabel=MESA`, `role=Relator`, `start=2026-02-17`, `end=null`, `status=Transformado em Norma Jurídica`.

## 4. Baseline atual
| Casa | registros | pessoas distintas | bodies distintos | propostas distintas |
|---|---:|---:|---:|---:|
| Senado | 21.222 | 81 | 117 | 14.587 |
| Câmara | 29.414 | 348 | 39 | 4.202 |

## 5. Roles encontrados
A Câmara publica somente `Relator` (29.414). O Senado publica `Relator` (20.798), `Relator Ad hoc` (355), `Relator Revisor` (64) e cinco papéis setoriais individuais. Esses papéis devem ser preservados, não colapsados.

## 6. Relação com body
| Casa | total | com `bodyId` resolvido no catálogo | não resolvido | bodies distintos |
|---|---:|---:|---:|---:|
| Senado | 21.222 | 17.728 | 3.494 | 117 |
| Câmara | 29.414 | 28.707 | 707 | 39 |

No Senado, os principais não resolvidos são CDIR (1.572), CCDD (1.343), CMO (241), PLEN (113), CDD (61) e órgãos históricos/variações de código. Parte é comissão/subcomissão ou colegiado histórico; `PLEN` não pertence ao domínio de comissão. Não ampliar automaticamente o catálogo sem validar o órgão oficial.

## 7. Relação com proposta e pessoa
Todas as 21.222 relatorias do Senado têm `proposalId` resolvido; na Câmara, 29.414 têm proposta resolvida. Pessoas resolvidas: Senado 21.222/21.222; Câmara 29.302/29.414. Os 112 casos restantes da Câmara não devem ser ligados por nome.

## 8. Datas e status
Senado: `start` está preenchido em 21.222/21.222 (100%) e `end` em 18.004/21.222 (84,84%); 3.218 não têm fim. A cobertura de início é completa no lote, mas a semântica varia conforme o evento. Os status são ricos: `Redistribuição`, `Substituído por "ad hoc"`, `Parecer Oferecido`, `Fim de Legislatura`, `Matéria com tramitação encerrada`, `Matéria Arquivada`, `Vencido`, entre outros, mas 3.572 são nulos.

Câmara: `start` está preenchido em 29.414/29.414 (100%) e `end` em 0/29.414 (0%). O status descreve a situação da proposição, não necessariamente o fim da relatoria. Portanto `end IS NULL` não prova vigência.

## 9. Relatoria atual
Não autorizar o título “Relatorias atuais” globalmente. No Senado, um mesmo par proposta+body pode ter designação anterior, redistribuição e ad hoc; escolher o registro mais recente seria uma inferência e precisa de regra oficial adicional. Na Câmara, o último status pode ser atual, mas não preserva trocas anteriores e não oferece data de destituição confiável.

## 10. Histórico e trocas
O Senado permite reconstruir parcialmente trocas quando existem registros com mesma proposta+body e datas/status diferentes. A evidência pode ser explícita (`Redistribuição`, `Substituído por "ad hoc"`) ou apenas inferida pela sequência temporal. A Câmara não permite reconstruir histórico com segurança a partir apenas de `ultimoStatus`.

## 11. Múltiplos relatores
São legítimos: relator principal, revisor, ad hoc, relator setorial e relatores da mesma proposta em comissões diferentes. A chave editorial deve ser `proposal + body + person + role + período`; nunca sobrescrever registros.

## 12. Casos reais
| Casa/body | registros | matérias | relatores | com início | com fim | leitura de vigência |
|---|---:|---:|---:|---:|---:|---|
| Senado CMA 50 | 663 | 456 | 56 | 224 | 249 | parcial |
| Senado CCJ 34 | 2.508 | 2.186 | 66 | 793 | 549 | parcial |
| Senado CAE 38 | 1.819 | 1.500 | 69 | 609 | 487 | parcial |
| Senado CEsp 2615 | 98 | 86 | 16 | 43 | 45 | parcial |
| Câmara CAPADR 2001 | 343 | 49 | 25 | 21 | 0 | não segura |
| Câmara CCJC 2003 | 3.703 | 529 | 130 | 53 | 0 | não segura |
| Câmara CFT 2010 | 182 | 26 | 21 | 18 | 0 | não segura |
| Câmara CSAUDE 2014 | 448 | 64 | 31 | 28 | 0 | não segura |

## 13. Relatoria não é estágio da matéria
Uma relatoria registrada prova que houve associação de uma pessoa à matéria naquele órgão. Não prova que a matéria ainda esteja tramitando ali. Também não substitui `matter_commission_stage`.

## 14. Agenda/pauta × relatoria
A comparação deve usar `proposalId` exato. Ausência de relatoria em uma matéria de pauta não prova ausência real de relator, pois a cobertura da Câmara é derivada de último status e a do Senado é centrada nos senadores atuais.

## 15. Ouro escondido — relatorias
Os raws preservam, além dos campos materializados, o payload oficial que originou cada registro (`rawId`). No Senado há descrição de comissão, motivo de destituição, data de designação e data de destituição; na Câmara há sequência do status, URI do relator e data do último status. Isso permite investigação futura, mas não autoriza afirmar histórico completo.

## 16. Gaps e nova coleta
**Senado:** dados bastam para “Relatorias conhecidas”; não bastam para “atuais” sem regra de vigência e cobertura de ex-senadores. Não implementar nova fonte nesta tarefa.

**Câmara:** `ultimoStatus` não basta para histórico nem para “atuais” com segurança. Seria necessário coletar tramitações/eventos de designação e destituição por proposição, com alto custo e possível N+1.

## 17. Contrato recomendado
```ts
commissionRapporteurships(bodyId, referenceDate?) => {
  coverage: 'complete' | 'partial' | 'unavailable',
  current: [],       // somente quando evidência de vigência for explícita
  historical: [],
  source,
  provenance
}
```
Cada item preserva proposta, pessoa, papel, início, fim, status, body, `rawId` e URL oficial. Múltiplos relatores devem ser uma lista por `proposal + body`.

## 18. O que pode aparecer em `/comissoes/[id]`
Usar **Relatorias conhecidas** ou **Relatorias identificadas na cobertura atual**. Exibir matéria + comissão + relator/papel + data quando disponível. Não chamar de atuais, não inferir produtividade e não dizer que a matéria está atualmente na comissão.

## 19. Matriz final
| Informação | Senado | Câmara | Observação |
|---|---|---|---|
| relator identificado | ✅ | ✅ | pessoa e matéria resolvidas |
| comissão da relatoria | 🟡 | 🟡 | bodies não resolvidos |
| matéria | ✅ | ✅ | `proposalId` oficial |
| data de designação | 🟡 | 🟡 | cobertura parcial |
| fim da relatoria | 🟡 | 🔴 | Câmara não publica no fluxo atual |
| relatoria atual | 🟡 | 🔴 | não afirmar sem evidência adicional |
| histórico | 🟡 | 🔴 | Senado parcial; Câmara último status |
| troca de relator | 🟡 | 🔴 | Senado explicita alguns motivos |
| múltiplos relatores | ✅ | 🟡 | preservar papéis e bodies |

## 20. Respostas obrigatórias
**SENADO:** “Podemos mostrar Relatorias conhecidas? SIM.” “Podemos mostrar Relatorias atuais? NÃO.” Blocker: endpoint centrado nos senadores atuais, registros históricos misturados e vigência não determinística em todos os casos.

**CÂMARA:** “Podemos mostrar Relatorias conhecidas? SIM.” “Podemos mostrar Relatorias atuais? NÃO.” Blocker: dados derivados de `ultimoStatus`, sem histórico completo de designações/destituições e sem `end` confiável.

Não foi implementada UI, migration, schema ou collector nesta investigação.



## Correção da métrica “com início”

A tabela física `legislative_appointments` não possui colunas `start` ou `end`; esses valores existem apenas no JSON armazenado em `payload`. A métrica global e a auditoria por body devem usar exclusivamente `json_extract(payload, '$.start')` e `json_extract(payload, '$.end')`.

Query canônica: `kind='rapporteurship'`, `source` correspondente e `json_extract(payload,'$.bodyId') = body externo`.

Resultados reconciliados:

| Comissão | registros | matérias distintas | start preenchido | end preenchido |
|---|---:|---:|---:|---:|
| CMA Senado 50 | 663 | 456 | 663 | 530 |
| CCJ Senado 34 | 2.508 | 2.186 | 2.508 | 2.319 |
| CAPADR Câmara 2001 | 343 | 49 | 343 | 0 |
| CCJC Câmara 2003 | 3.703 | 529 | 3.703 | 0 |

A inconsistência anterior era erro de consulta/relatório: “com início” havia sido calculado com uma leitura diferente dos dados de caso, enquanto a métrica global usava o campo `start` dentro do payload. Não existem duas colunas físicas concorrentes. A métrica correta agora é sempre `start preenchido` e os números acima fecham com os totais globais: Senado 21.222/21.222 e Câmara 29.414/29.414.

O contrato `commissionRapporteurships(bodyId, 12)` primeiro agrupa por matéria, ordena grupos pelo maior `start` oficial disponível e só então limita a 12 matérias. O total exibido usa `COUNT(DISTINCT proposalId)` dentro do body. Portanto: limite por matérias **SIM**, ordenação por data oficial **SIM**, total por matérias distintas **SIM**.
