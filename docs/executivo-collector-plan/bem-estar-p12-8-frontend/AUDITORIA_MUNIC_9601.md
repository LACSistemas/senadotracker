# P12.8 — Auditoria obrigatória: indicador MUNIC 9601 (atendimento digital)

## O gatilho

A missão exigiu investigar uma divergência entre dois números para o mesmo indicador (9601 — prefeitura declara oferecer atendimento digital, MUNIC 2024):

- `docs/executivo-collector-plan/bem-estar-p12-6-criminalidade-estadual/.../RECONCILIACAO_P126.md` cita **627/5.563** válidas (≈ 0,112706).
- O read model da P12.7, e o comparador Brasil ativo hoje, usam **627/5.554** (≈ 0,112892).

A missão pedia para determinar se isso é um erro de documentação ou um bug de código, e corrigir o lado errado sem mascarar a divergência com arredondamento.

## O que foi apurado

Categorias reais do indicador 9601 no MUNIC 2024, conforme o JSON de estágio produzido por `scripts/exec/p126_prepare.py` e persistido por `scripts/exec/p126_publish.ts`:

| Categoria | Contagem |
|---|---|
| Não | 4.927 |
| Sim | 627 |
| Recusa | 7 |
| Não informou | 9 |
| **Total de municípios** | **5.570** |

O código de publicação (`p126_publish.ts`) trata **só** Sim/Não como respostas válidas para o denominador do comparador — Recusa e Não informou entram como `NULL` (ausência), nunca como zero. Isso dá:

```
válidas  = Sim + Não = 627 + 4.927 = 5.554
inválidas (NULL) = Recusa + Não informou = 7 + 9 = 16
total = 5.554 + 16 = 5.570 ✓ (bate com o universo de municípios do MUNIC 2024)
```

Esse número — **627/5.554 ≈ 0,112892** — é exatamente o valor que `COBERTURA_E_AUSENCIAS.json` (P12.7) registra (`valid: 5554, null: 16`) e exatamente o que o comparador Brasil ativo devolve hoje. Reproduzido de forma independente nesta fase, via consulta direta à tabela `civica_exec.exec_ind_value` (sem reaproveitar nenhum número já calculado por outra etapa): **627 positivos sobre 5.554 válidos**, idêntico.

O número "5.563" em `RECONCILIACAO_P126.md` é uma conta que exclui só os 7 "Recusa" do total de 5.570 (5.570 − 7 = 5.563), esquecendo de também excluir os 9 "Não informou" — um erro de redação pontual, não uma regra diferente aplicada de propósito. A própria frase anterior no mesmo documento já descreve corretamente as quatro categorias (Não=4.927, Sim=627, Recusa=7, Não informou=9); o erro está isolado na conta final de "válidas", não na extração dos dados.

## Conclusão

**O código está correto; a divergência é documental, isolada em `RECONCILIACAO_P126.md`.** Não há bug para corrigir no read model, em `wellbeing-read.ts` ou nos comparadores — eles já implementam a regra certa (válido = Sim ou Não; Recusa e Não informou são ausência, nunca zero nem "não"). Nenhuma correção automática foi feita no banco: isso seria alterar fatos sem necessidade, já que o dado publicado já está certo.

**Par canônico fixado por esta auditoria: 627/5.554 (≈ 0,112892), não 627/5.563.** O frontend desta fase (P12.8) usa e exibe exclusivamente esse par — tanto na visão de município quanto na distribuição agregada por UF (`getWellbeingMunicDistribution`) — e a narrativa do capítulo "Cotidiano digital" (`lib/wellbeing/narrative.ts`) nunca arredonda esse número para esconder a diferença da P126.

**Ação de documentação**: esta auditoria registra oficialmente 627/5.554 como o valor correto e explica a origem do "5.563" como erro de redação em `RECONCILIACAO_P126.md`. Esse documento de P12.6 não foi editado retroativamente por esta fase (fora do escopo de P12.8 alterar artefatos de uma fase já publicada); esta auditoria serve como a correção de registro, citando o código vivo como fonte canônica.

## Verificação empírica usada

Consulta direta (read-only, sem alterar nenhuma linha) contra `civica_exec.exec_ind_value`/`exec_entity`, agregando por indicador 9601 em todos os municípios: `sum(numerator) filter (where denominator is not null)` e `sum(denominator)` sobre as linhas ativas (`exec_active_value`), resultando em `numerator=627`, `denominator=5554`, `total_rows=5570`, `null=16` — confirmando os números acima sem depender de nenhum cálculo intermediário de fases anteriores.
