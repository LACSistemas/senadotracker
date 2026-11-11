# Estimativa de armazenamento P14

As faixas abaixo são **estimativas**, não medições. Foram baseadas nas contagens P1–P3, no tamanho observado de arquivos STJ e no schema JN. A P14.0 não altera o banco: `POSTGRES_PERSISTENT_GROWTH_ALLOWED=0`.

| Cenário | Linhas/objetos | RAW | Staging | Heap + índices | Crescimento | Incerteza |
|---|---:|---:|---:|---:|---:|---|
| A JN agregado | 1,6–3 mil linhas × dicionário | 20–200 MB | 20–150 MB | 50–400 MB | 10–80 MB/ano | baixa |
| B estrutura territorial | 10–30 mil unidades/alias | 50–500 MB | 50–400 MB | 100 MB–1 GB | 20–200 MB/ano | média |
| C DataJud agregado | milhares de agregados/snapshot | 0,2–5 GB | 0,2–3 GB | 0,2–3 GB | 0,1–2 GB/ano | alta; licença |
| D metadado processual | milhões–350M documentos | 0,1–2 TB | 0,1–2 TB | 0,2–4 TB | variável | muito alta; proibido sem parecer |
| E STJ jurisprudência | diário, acórdãos/ementas | 5–80 GB | 2–40 GB | 5–100 GB | 1–20 GB/ano | média |
| F financeiro/pessoal | milhões de linhas heterogêneas | 2–30 GB | 1–20 GB | 2–50 GB | 0,5–10 GB/ano | alta |

## Política

MVP usa A+B e, opcionalmente, E. RAW fica em D:, com retenção por edição e hashes; banco recebe apenas staging validado e serving. WAL, temporários e backup devem ser orçados como 1,5–3× o heap durante carga. Não escolher cenário D sem autorização, custo e licença.
