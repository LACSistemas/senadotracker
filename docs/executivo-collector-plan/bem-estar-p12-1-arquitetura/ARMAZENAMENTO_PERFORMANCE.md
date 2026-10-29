# Armazenamento e performance (estimativas)

## Observação atual

SELECTs de auditoria confirmaram banco de aproximadamente 32 GB. No schema `civica_exec`, `exec_ind_value` ocupa cerca de 2,73 GB; `exec_ind_latest` 198 MB; `exec_territory_population` 12 MB; manifestos 7 MB. O volume livre de D: não foi mensurado de forma confiável nesta execução (o volume está montado, mas o provider não retornou `SizeRemaining`); não se deve transformar isso em capacidade disponível.

## Orçamento por horizonte

| Horizonte | RAW comprimido | RAW expandido/staging pico | Fatos/índices adicionais | Margem | Confiança |
|---|---:|---:|---:|---:|---|
| 1 ano / MVP IBGE+MDS | 2–6 GB | 5–14 GB | 0,15–0,35 GB | 30% | média |
| 3 anos / +SUAS+SINISA+MTE parcial | 8–22 GB | 18–55 GB | 0,35–0,80 GB | 35% | baixa-média |
| 5 anos / RAIS+Caged completos | 15–35 GB | 40–100 GB | 0,60–1,20 GB | 40% | baixa |

As faixas são planejamento, não medição. RAIS/Caged dominam a incerteza; agregados oficiais devem ser preferidos a microdados detalhados.

## Estratégia

- arquivo original e intermediários grandes somente em D:;
- compactar por edição, manter manifestos e retenção declarada;
- remover staging intermediário somente após publicação e hash de reconciliação;
- PostgreSQL armazena fatos editoriais, dicionários mínimos, cobertura, runs e hashes;
- `exec_story`/rollups futuros servem overview sem joins pesados durante request.

## Metas propostas (não medidas)

- overview territorial SQL p95 < 80 ms em read model materializado;
- capítulo com série + comparadores p95 < 150 ms;
- API p95 < 300 ms e payload comprimido < 150 KB;
- SSR p95 < 800 ms sem fan-out por indicador;
- zero query de fonte externa no request.

Benchmark real só pode ser feito após P12.2 com dados publicados e `EXPLAIN (ANALYZE, BUFFERS)`.

