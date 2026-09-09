# ADR 004 — modelo de eleições, pessoal e verba de gabinete

Data: 09/09/2026. Estado: aceito e implementado no bloco B da Fase 3.

## Decisão

Manter o modelo eleitoral existente e ampliá-lo com campos opcionais auditados de eleição, nome social, situação e complemento. Criar lotes próprios para snapshots de pessoal e verba mensal de gabinete. `expanded_costs` continua como camada agregada compatível e não recebe o detalhe nominal.

## Entidades

- `Candidacy` aceita código/data da eleição, nome social e `CandidacyDetails`. A chave publicada continua dentro de uma eleição já recortada por turno. Vínculo confirmado exige pessoa e ao menos duas evidências; estados não confirmados não podem carregar `personId`.
- `ElectoralAsset` preserva ordem/chave, valor em centavos, versão e data de atualização quando disponível.
- `FunctionalStaffAssignment` representa uma ocorrência funcional em um snapshot: Casa, chave do lote, identificador técnico opcional, nome, vínculo, cargo, função, unidade, datas, parlamentar associado e estado/evidências da associação.
- `CabinetMonthlyBudget` representa limite e gasto de um deputado em um mês. Ambos são anuláveis; percentual é derivado apenas quando o limite é positivo e o gasto existe.

## Lotes e ponteiros ativos

`staff_snapshot_batches` e `cabinet_budget_batches` possuem origem por `ingestion_runs`, instante/período, disponibilidade, nota e contagem. Os ponteiros `active_staff_snapshot_publications` e `active_cabinet_budget_publications` são trocados dentro da mesma transação que grava os registros e finaliza a execução. O lote anterior permanece consultável e uma falha faz rollback completo.

O snapshot ativo é por Casa. A verba ativa é por Câmara e ano. Essa granularidade impede misturar datas de equipe ou anos financeiros.

## Validade

O banco preserva o estado publicado (`available`, `partial` ou `unavailable`). `stale` é derivado na leitura ao comparar `observedAt` com a data de referência e o limite configurado para a fonte. A função `snapshotAvailability` rejeita datas e limites inválidos. O padrão inicial é dois dias, adequado a fontes declaradas como diárias; a política pode ser configurada na consulta.

## Invariantes

- chaves de pessoa funcional e deputado/mês não se repetem no lote;
- origem bruta pertence à mesma execução;
- vínculo funcional `confirmed` exige parlamentar publicado da mesma Casa;
- estados pendente, ambíguo ou rejeitado não podem atribuir parlamentar;
- fim funcional não antecede início;
- mês pertence a 1–12 e ano a 2008–2100;
- valores monetários são inteiros seguros, não negativos quando representam limite/gasto/bem;
- candidatura pertence exatamente à eleição, ano e turno publicados;
- bem e transação pertencem a candidatura do lote e têm chave única;
- vínculo eleitoral não confirmado não carrega pessoa;
- publicação inválida não altera o ponteiro ativo.

## Migração e compatibilidade

A migração 10 é somente aditiva. Foi aplicada ao SQLite local com 1.188 perfis e 484.664 despesas antes/depois, sem alteração dessas contagens. Quatro tabelas principais novas foram criadas. Os testes em memória verificam migrações repetíveis, chaves, rollback, validade, nulos e consulta do lote ativo.

