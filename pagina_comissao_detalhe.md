# Página de detalhe de comissão — composição

## Classificação canônica dos bodies
A regra estrutural deixou de considerar todos os nomes contendo “Comissão”. A elegibilidade operacional exige: (1) órgão da Câmara cujo catálogo canônico identifica “Comissão”; e (2) appointment de comissão vigente, sem data final anterior ao dia da coleta. O tipo/situação específicos não estão presentes no catálogo/arquivo `orgaosDeputados-L57` disponível: os registros expõem URI, sigla, nome e vínculo, mas não um campo confiável de tipo ou situação. Portanto o nome é apenas fallback de identificação e a vigência vem do appointment oficial. Bodies históricos continuam no banco.

### Auditoria dos 164 bodies
Dos 164 nomes com “Comissão”, 85 são comissões especiais (predominantemente históricas), 1 é comissão mista e 1 é temporária; os demais são comissões permanentes ou sem subtipo textual explícito. O catálogo local não publica datas formais de criação/fim para esses órgãos, por isso não foram inventadas.

### Auditoria dos 85 sem membros
Os 85 retornaram HTTP 200, mas não produziram membros publicáveis. Sem status/tipo oficial no payload, a classificação segura é: **85 sem informação suficiente para afirmar encerramento**. Não foram tratados como zero membros; o snapshot anterior foi preservado e eles ficaram fora do denominador corrente quando não possuem appointment vigente.

## Comissões atuais elegíveis
A regra aplicada pelo collector é `nome compatível + appointment de comissão vigente`. Na base atual isso resulta em **105 comissões atuais elegíveis**, das quais **79 possuem `complete_current`** e **26 permanecem sem snapshot completo**. A cobertura real da composição atual é, portanto, **75,24% (79/105)**. Não há erro HTTP persistido nos snapshots coletados; os casos restantes são respostas sem membros publicáveis ou sem evidência suficiente de composição atual.

## Cobertura real de composição atual
`complete_current` continua sendo determinado exclusivamente por snapshot paginado com membros persistidos. Histórico não entra no denominador. A UI mantém exatamente os estados já definidos: completo, parcial e indisponível.

## Senado
O Senado não possui snapshot por colegiado equivalente. A página usa appointments como “Membros identificados na cobertura atual” e nunca afirma “Composição atual”.

## Arquivos alterados
- `apps/collector/src/activity.ts`: elegibilidade operacional por appointment vigente.
- `packages/db/src/commissions.ts`: contrato `commissionComposition` e reconciliação.
- `apps/web/app/comissoes/[id]/page.tsx` e `apps/web/components/commission-composition.tsx`: integração já existente, sem mudança nesta auditoria.

### Dependência de `name.includes("Comissão")`
Ainda existe uma dependência **fallback** no nome porque a fonte disponível não fornece tipo/situação confiáveis. Ela não é usada sozinha: a composição atual exige também appointment vigente. Quando a Câmara publicar tipo/status oficiais, essa condição deve ser promovida a regra primária sem alterar o contrato da UI.

## Relatorias conhecidas

### Contrato
A página usa `commissionRapporteurships(bodyId, limit)` com resolução obrigatória do body canônico. A consulta filtra por `source + body.external_id`, resolve propostas e perfis por identificadores, evita N+1 e agrupa por `proposal + body`, preservando todos os relatores e papéis.

### Semântica
O contrato descreve relatorias identificadas na cobertura. Não infere relator atual, estágio atual da matéria ou permanência na comissão. `end=null` não é apresentado como vigência.

### Senado e Câmara
O Senado preserva `Relator`, `Relator Ad hoc`, `Relator Revisor` e papéis setoriais, além de datas e status oficiais. A Câmara exibe o relator materializado a partir de `ultimoStatus`, explicitamente como registro conhecido, sem afirmar histórico completo.

### Apresentação
O bloco agora se chama **Relatorias conhecidas**, informa a ressalva metodológica, mostra até 12 matérias mais recentes, links por ID para a proposição e o parlamentar e mantém múltiplos relatores na mesma matéria.

### Cobertura
A contagem exibida é de matérias distintas no body. Não é apresentada como percentual de matérias que deveriam possuir relator.

### Limitações
Relatorias sem body canônico não aparecem no detalhe da comissão. Não há nova coleta nem migração nesta etapa. `legislative_appointments` não possui colunas físicas `start`/`end`; os valores estão em `payload` e a query correta usa `json_extract(payload,'$.start')` e `json_extract(payload,'$.end')`. Os números reconciliados estão documentados na seção específica da investigação.

### Arquivos alterados
- `packages/db/src/commissions.ts`: contrato `commissionRapporteurships` e integração no detalhe.
- `packages/db/src/index.ts`: exportação do contrato.
- `apps/web/components/commission-rapporteurships.tsx`: bloco editorial.
- `apps/web/app/comissoes/[id]/page.tsx`: inclusão do bloco.

### Métrica de datas reconciliada

`legislative_appointments` armazena `start` e `end` dentro de `payload`; não há colunas físicas com esses nomes. A query canônica usa `json_extract`. Os casos reais são: CMA 663/663 start e 530 end; CCJ 2.508/2.508 start e 2.319 end; CAPADR 343/343 start e 0 end; CCJC 3.703/3.703 start e 0 end. A lista do contrato é agrupada por matéria antes do limite e ordenada pelo maior `start` oficial do grupo.

## Matérias pautadas nesta comissão

O bloco agora usa a unidade `proposal + body` e o contrato `commissionMatters`. A lista é limitada, ordenada pela última aparição oficial e não afirma discussão, votação, aprovação ou permanência atual. Os 10.028 tombstones da Câmara permanecem auditáveis, mas não são tratados automaticamente como remoções oficiais sem evidência de snapshot completo.

