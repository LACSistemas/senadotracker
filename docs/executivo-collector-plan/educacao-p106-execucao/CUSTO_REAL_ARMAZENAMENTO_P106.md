# Custo e localização de armazenamento

| Medida | Valor |
|---|---:|
| Banco antes | 30.908.124.307 bytes |
| Banco depois | 31.497.890.963 bytes |
| Delta | 589.766.656 bytes (~0,55 GiB) |
| Limite P10.6 | 5 GiB |
| RAW | somente `D:\Civica\raw` |

O banco não contém ZIP/XLSX bruto. Guarda apenas fatos, hashes, manifestos e metadados. O limite de alerta de 4 GiB e parada de 4,5 GiB não foi atingido. A tentativa de restore isolado do dump pré-P10.5 foi bloqueada pela permissão `CREATEDB` da role; o TOC do dump foi lido com sucesso e nenhum banco oficial foi alterado.
