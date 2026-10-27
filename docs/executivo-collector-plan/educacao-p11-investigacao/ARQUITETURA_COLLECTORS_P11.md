# Arquitetura proposta para P11 (não implementada)

## Princípios

- somente arquivos oficiais e APIs documentadas;
- download e staging exclusivamente em D:\Civica;
- leitura em streaming de ZIP/CSV, whitelist de colunas e hash SHA-256;
- uma revisão coerente por fonte × edição;
- falha de refresh preserva último snapshot bom;
- nenhuma pessoa individual de ENEM, ProUni, FIES ou CAPES no produto.

## Coletores futuros

| Coletor | Entrada | Saída conceitual | Dependência |
|---|---|---|---|
| inep-enem | ZIP anual + dicionário | coortes municipais e cobertura | P11.1 validação de campos |
| inep-superior | IES/cursos/sinopse | identidade e ofertas | P10.8 contrato |
| inep-quality | CPC/IGC/Enade/IDD | indicadores por ciclo | crosswalk curso |
| mec-prouni | CSV anual | bolsas agregadas | sem CPF |
| mec-fies | CSV oferta/inscrição | processos seletivos | sem confundir contrato |
| capes-sucupira | CKAN/arquivos | programas/avaliação/bolsas | validação de licença |
| federal-finance | Portal/SIAFI/PNCP | execução por órgão | mapa CNPJ–IES |

## Contrato de execução

Cada coleta registra URL, status HTTP, content type, fetched_at, source_updated_at, tamanho, hash, edição, data-through e cobertura. A publicação usa o motor de revisão existente do P10; não criar scheduler nesta investigação.

## Bloqueadores

Download direto do INEP ficou indisponível na rede de investigação (timeout/502); isso é limitação operacional desta rodada, não prova de indisponibilidade da fonte. e-MEC não forneceu endpoint bulk comprovado. CAPES CKAN foi descoberto, mas não coletado.

