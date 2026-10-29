# Publicação e revisões P12.4

Estado: `HOLD_PILOT_GATE`.

Não houve INSERT/UPDATE/DDL em `projetoeleitor_db`. `exec_ind_def`, `exec_ind_value`, `exec_ind_latest`, `exec_publication`, `exec_ingestion_run` e `exec_raw_manifest` não receberam fatos P12.4.

O desenho de publicação aprovado permanece:

1. arquivo bruto e manifesto no volume D:;
2. staging especializado para unidades e relações sede–território;
3. revisão imutável por edição/fonte;
4. publicação transacional em `exec_ind_*` somente após reconciliação;
5. replay do mesmo hash produz `NO_CHANGE`;
6. falha de coleta preserva last-known-good.

Como a identidade da unidade ainda não foi comprovada, não foi criada revisão candidata nem indicador novo. P12.3 permanece inalterada.
