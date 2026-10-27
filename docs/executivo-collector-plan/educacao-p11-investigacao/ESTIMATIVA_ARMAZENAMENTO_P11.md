# Estimativa de armazenamento P11

## Evidência medida/reutilizada

O P10 mediu os ZIPs do Censo Superior 1995–2024 em aproximadamente **750 MB**; o ZIP 2024 tem 456.807.449 bytes e o CSV de cursos 2024 cerca de 453 MB. O banco não deve receber ZIP/RAW.

## Cenários iniciais (estimativa, não medição de carga)

| Família | RAW D: conservador | RAW D: provável | Banco provável | Observação |
|---|---:|---:|---:|---|
| Censo Superior + sinopses | 0,8 GB | 1,5 GB | 0,8–2,0 GB | reuso P10; cursos largos |
| ENEM 3 edições | 2–4 GB | 5–10 GB | 0,5–2,0 GB | depende do formato anonimizado atual |
| Enade/qualidade | 0,2 GB | 0,8 GB | 0,1–0,5 GB | ciclos e planilhas |
| ProUni 2017–2026 | 0,1 GB | 0,5 GB | 0,1–0,4 GB | CSV agregado |
| FIES 2019–2022 | 0,05 GB | 0,2 GB | 0,05–0,2 GB | oferta/inscrição |
| CAPES/Sucupira | 0,5 GB | 2 GB | 0,2–1 GB | depende dos conjuntos escolhidos |
| staging pico | 0,5 GB | 1,5 GB | — | streaming + arquivos temporários |

**Reserva recomendada antes de P11.1:** 15 GB livres em D: para RAW/staging; não reservar C: para arquivos. O P10 já exige dump/backup em D: e leitura em fluxo.

## Regras

- assertVolume antes de cada download;
- preservar ZIP original e hash em D:;
- apagar staging somente após validação e publicação;
- estimativas devem ser substituídas por bytes reais na primeira coleta;
- WAL, dumps e rollback ficam fora do diretório de produto.

