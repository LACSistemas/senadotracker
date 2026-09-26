Quero que você IMPLEMENTE o P0 de dados de COMISSÕES do projeto Cívica.

Antes de alterar qualquer coisa, leia integralmente o relatório:

comissoes_info.md

Ele é a auditoria de referência desta tarefa.

OBJETIVO DO P0
===============

Ao final deste trabalho, Câmara e Senado devem possuir uma fundação canônica e consultável para:

ÓRGÃO/COMISSÃO
    ↓
REUNIÃO
    ↓
ITEM DE PAUTA
    ↓
MATÉRIA/PROPOSIÇÃO

incluindo:

- identificação confiável do órgão;
- reunião como entidade própria;
- reunião ↔ órgão;
- pauta ↔ reunião;
- pauta ↔ proposição;
- metadados de reunião;
- reuniões futuras;
- atualização de reuniões futuras;
- preservação de mudanças de pauta;
- cancelamentos;
- itens removidos da pauta;
- proveniência completa;
- reprocessamento/idempotência.

NÃO implemente UI.

NÃO implemente ainda:
- pipeline completo de tramitação na comissão;
- votos individuais censitários;
- parecer/documento canônico;
- participantes/convidados;
- análise com IA;
- score de produtividade;
- ranking de comissões;
- matter_commission_stage completo.

Esses são P1/P2.

O P0 é INFRAESTRUTURA DE DADOS.

==================================================
1. PRINCÍPIOS OBRIGATÓRIOS
==================================================

1. Não criar uma segunda cópia de:
   - proposições;
   - parlamentares;
   - partidos;
   - órgãos oficiais.

2. Reutilizar IDs oficiais de Câmara e Senado.

3. Toda entidade deve ter:
   - source;
   - external_id;
   - proveniência;
   - timestamps;
   - vínculo ao raw quando aplicável.

4. Não transformar ausência de coleta em ausência legislativa.

5. Não fazer parsing semântico agressivo de texto neste P0.

6. Preservar texto literal da fonte.

7. Toda normalização deve manter acesso ao payload/raw original.

8. Câmara e Senado podem possuir diferenças estruturais internamente,
   mas devem convergir para um modelo canônico consultável.

9. Rerodar collector não pode gerar duplicação.

10. Uma reunião conjunta deve poder estar associada a MAIS DE UM órgão.

==================================================
2. BASELINE DA AUDITORIA
==================================================

Use como sanity check, NÃO como números que devem ser hardcoded.

A auditoria encontrou aproximadamente:

SENADO 2026
- 2.348 agenda_items
- 233 reuniões
- 31 colegiados ligados
- 1.734 matérias distintas
- 2.154 itens com resultado textual

CÂMARA 2026
- 10.140 agenda_items totais ativos
- 10.028 originários do collector anual principal
- 651 eventos distintos no conjunto agregado
- 582 eventos classificados como comissão no snapshot principal
- 8.773 itens associados a eventos classificados como comissão
- praticamente toda a agenda anual principal sem body_id

A diferença central:

SENADO:
meetingId + bodyId + item + proposal já estão fortemente relacionados.

CÂMARA:
eventId + agenda item + proposal existem,
mas evento → órgão não foi persistido.

Recalcule tudo depois da implementação.

==================================================
3. PRIMEIRO: INSPECIONE O MODELO ATUAL
==================================================

Antes da migration:

- models
- schema
- migrations
- parsers
- collectors
- active_*_publications
- complement_batches
- legislative_complements
- legislative_appointments
- raw_objects
- proposals
- proposal_enrichment_items

Não assuma nomes.

Descubra se já existe alguma entidade reutilizável que possa substituir parte do modelo sugerido abaixo.

Evite duplicação.

Documente rapidamente no relatório final qual estrutura antiga foi reaproveitada.

==================================================
4. MODELO CANÔNICO DE ÓRGÃOS
==================================================

Precisamos parar de depender de bodyId/bodyLabel espalhados em JSON.

Crie OU adapte uma entidade canônica genérica de órgão legislativo.

Nome sugerido conceitualmente:

legislative_body

Não precisa usar esse nome se o projeto já tiver equivalente melhor.

Campos mínimos:

id interno
source
external_id
sigla
nome
nome_curto, se existir
tipo_raw
tipo_normalizado
house/casa
active, se determinável
parent_body_id, se aplicável
source_url, se disponível
raw_id / provenance
first_seen_at
last_seen_at
created_at
updated_at

Unique:

(source, external_id)

NÃO crie commission como uma cópia separada do órgão.

Comissão deve ser uma classificação de legislative_body.

==================================================
5. TAXONOMIA DE ÓRGÃOS
==================================================

Hoje temos:

Câmara: centenas de bodies misturando
- comissões
- Mesa
- secretarias
- bancadas
- outros órgãos

Senado também possui diferentes tipos de colegiados.

Precisamos classificar o suficiente para alimentar /comissoes.

Preferir SEMPRE tipo oficial publicado.

Criar uma normalização conservadora, por exemplo:

PERMANENT_COMMITTEE
TEMPORARY_COMMITTEE
CPI
JOINT_COMMITTEE
SUBCOMMITTEE
COUNCIL
BOARD
SECRETARIAT
CAUCUS
OTHER
UNKNOWN

Esses nomes são apenas sugestão.

Se a fonte oficial possuir taxonomia melhor, preserve:

type_raw
+
type_normalized

Não classifique apenas por regex da sigla se existir dado oficial melhor.

Se for necessária heurística:

- documente-a;
- marque provenance/method;
- deixe UNKNOWN quando houver dúvida.

==================================================
6. CATÁLOGO DE ÓRGÃOS — CÂMARA
==================================================

A auditoria identificou isto como quick win.

Investigue a melhor fonte oficial já adjacente aos collectors existentes.

Precisamos persistir pelo menos:

- id oficial;
- nome;
- sigla;
- tipo;
- situação/atividade se disponível;
- descrição/competência se vier gratuitamente da mesma fonte.

Não faça scraping HTML se houver endpoint/arquivo estruturado já usado pelo projeto.

O catálogo deve permitir distinguir CCJC, CSAUDE, CFT etc. de Mesa, secretaria, bancada etc.

==================================================
7. CATÁLOGO DE ÓRGÃOS — SENADO
==================================================

Use os códigos já encontrados em:

- agenda;
- appointments;
- processos;
- demais fontes existentes.

Se houver endpoint oficial de catálogo já acessível pelo projeto,
prefira criar uma fonte canônica.

Faça crosswalk com bodyIds já presentes no banco.

NÃO crie novos IDs independentes para a mesma comissão.

==================================================
8. ENTIDADE CANÔNICA DE REUNIÃO
==================================================

Criar/adaptar entidade equivalente a:

commission_meeting

Campos mínimos conceituais:

id
source
external_id

title
description

meeting_type_raw
meeting_type_normalized

status_raw
status_normalized

scheduled_start_at
scheduled_end_at
actual_start_at
actual_end_at

location
room

source_url
video_url, SOMENTE se já vier trivialmente no payload
raw_id

created_at
updated_at
first_seen_at
last_seen_at

Não force campos inexistentes.

NULL é válido.

Unique:

(source, external_id)

IMPORTANTE:

Persistir reunião MESMO que ela tenha zero itens de pauta.

Hoje reuniões sem pauta podem desaparecer do domínio.

Isso deve mudar.

==================================================
9. REUNIÃO ↔ ÓRGÃO
==================================================

Criar relação N:N equivalente a:

commission_meeting_body

Porque reuniões conjuntas podem envolver múltiplas comissões.

Campos:

meeting_id
body_id
relationship_type, se houver
is_primary, se a fonte permitir determinar
provenance/raw reference

Unique apropriado.

Nunca assuma que toda reunião pertence a exatamente uma comissão.

==================================================
10. SENADO — PERSISTIR O MEETING COMPLETO
==================================================

O collector atual:

apps/collector/src/senate-agenda.ts

já recebe o objeto meeting de:

/agendareuniao/mes/{AAAAMM}.json

mas hoje persiste principalmente dados do item.

Modificar o fluxo:

ANTES de iterar pelos agenda_items:

1. upsert da reunião;
2. upsert dos bodies envolvidos;
3. relação meeting ↔ body;
4. depois persistir itens.

Mapear, quando presentes:

- meetingId;
- data/hora;
- data final;
- tipo;
- situação;
- título/descrição;
- local;
- links;
- colegiados;
- demais metadados úteis.

NÃO inventar campos que o payload não possua.

Salve provenance/raw.

==================================================
11. CÂMARA — PRESERVAR METADADOS DO EVENTO
==================================================

O collector atual:

apps/collector/src/camara-agenda.ts

lê eventos-{ano}.json.

Segundo a auditoria, o arquivo já oferece campos como:

- dataHoraInicio;
- dataHoraFim;
- local;
- situacao;
- descricaoTipo;
- URLs;
- descrição.

Hoje grande parte disso é descartada.

Passar a persistir o evento como commission_meeting/event meeting canônico.

Preservar:

external_id = eventId oficial.

NÃO depender da existência de item de pauta para criar reunião.

==================================================
12. CÂMARA — RESOLVER EVENTO → ÓRGÃO
==================================================

ESTE É UM DOS PRINCIPAIS BLOCKERS DO P0.

O arquivo anual não fornece adequadamente o órgão para nossa necessidade atual.

Para eventos relevantes de comissão:

buscar detalhe estruturado do evento usando a rota oficial equivalente a:

GET /eventos/{id}

Verifique a rota e formato REAL antes de implementar.

A partir do detalhe:

- identificar órgão(s);
- upsert no catálogo canônico;
- criar meeting ↔ body;
- persistir metadados adicionais úteis.

Não repetir a chamada desnecessariamente.

Usar cache/raw_objects conforme arquitetura existente.

Se raw/detail já existir localmente, reutilizar.

Adicionar rate limiting/retry seguindo os padrões existentes do projeto.

==================================================
13. NÃO CHAMAR DETALHE DE EVENTO À TOA
==================================================

O collector anual possui eventos de:

- comissão;
- plenário;
- outros tipos.

Este P0 é de comissões.

Use os campos existentes para identificar os candidatos a eventos de comissão ANTES de chamar detalhe.

Continue podendo armazenar meeting genérico se arquiteturalmente fizer sentido,
mas não transforme esta tarefa numa coleta censitária de qualquer evento da Câmara.

Documente exatamente quais tipos foram incluídos/excluídos.

==================================================
14. MODELO CANÔNICO DO ITEM DE PAUTA
==================================================

Hoje agenda_item vive em legislative_complements.

Decida, depois de estudar o schema, entre:

A) evoluir essa estrutura;
ou
B) criar entidade relacional específica.

Não duplique sem necessidade.

Conceitualmente precisamos de:

commission_agenda_item

Campos:

id
source
external_id quando a fonte possuir ID próprio

meeting_id
proposal_id

order_raw
order_normalized, se fizer sentido

item_type_raw
topic/title/description
regime

result_raw

source_url
raw_id

first_seen_at
last_seen_at

active/current

created_at
updated_at

IMPORTANTE:

proposal_id deve referenciar a identidade canônica de proposals existente.

Não criar matéria duplicada.

==================================================
15. IDENTIDADE DOS ITENS
==================================================

SENADO:

já existe itemId e a auditoria considera as chaves razoavelmente estáveis.

Use ID oficial quando disponível.

CÂMARA:

não invente estabilidade onde ela não existe.

A chave atual usa componentes incluindo índice/ordem.

Investigue o payload.

Se não houver itemId oficial estável, crie uma identidade derivada documentada com o menor risco possível.

A ordem NÃO deve ser a única identidade,
porque um item pode mudar de posição.

Preferir combinação do tipo:

meeting + proposal + identificadores oficiais adicionais

Se existirem múltiplos itens da mesma proposição na mesma reunião,
a identidade precisa distingui-los.

Documente a estratégia.

==================================================
16. AGENDA FUTURA
==================================================

REMOVER a limitação conceitual:

to = min(hoje, fim_do_ano)

Precisamos coletar futuro.

Implementar janela futura configurável.

Sugestão:

--future-days 45

com default razoável.

Também permitir:

--from
--to

quando isso combinar com a CLI atual.

Exemplos esperados conceitualmente:

collect-senate-agenda --year 2026 --future-days 45

collect-camara-agenda --year 2026 --future-days 45

Se a arquitetura existente sugerir flags melhores, use-a.

Precisamos conseguir alimentar:

HOJE
AMANHÃ
ESTA SEMANA
PRÓXIMOS 30 DIAS

==================================================
17. VIRADA DE ANO
==================================================

Não quebrar quando:

hoje = dezembro
e
future_days atravessa janeiro do ano seguinte.

Exemplo:

20/12/2026 + 45 dias

deve conseguir alcançar reuniões de 2027 quando a fonte permitir.

O collector não pode truncar simplesmente em 31/12 por causa do parâmetro --year.

Defina claramente a semântica de --year versus janela futura.

==================================================
18. REEXECUÇÃO DE AGENDA FUTURA
==================================================

Agenda futura MUDA.

Precisamos tratar isso como dado mutável.

Uma reunião pode:

- mudar horário;
- mudar local;
- mudar situação;
- ser cancelada;
- ganhar itens;
- perder itens;
- mudar ordem;
- alterar texto;
- ter resultado posteriormente.

Rerodar o collector deve atualizar o estado atual sem perder a capacidade de reconstruir mudanças importantes.

==================================================
19. VERSIONAMENTO DAS REUNIÕES
==================================================

Implementar estratégia de versionamento.

Não precisa necessariamente criar uma tabela gigantesca se o sistema de batches já resolver parte disso.

Mas precisamos conseguir saber:

meeting X:

snapshot A
→ horário 10h
→ status agendada

snapshot B
→ horário 14h
→ status agendada

snapshot C
→ status cancelada

A publicação ativa deve representar o estado atual.

O histórico deve continuar acessível.

Não duplicar versão se payload normalizado não mudou.

==================================================
20. VERSIONAMENTO DA PAUTA
==================================================

Precisamos resolver o problema identificado na auditoria:

hoje um refresh publica outro lote,
mas não existe tombstone semântico de item removido.

Implementar mecanismo para distinguir:

- item novo;
- item já existente;
- item alterado;
- item removido;
- item restaurado.

Um item removido da pauta NÃO deve simplesmente desaparecer do mundo.

Precisamos preservar algo equivalente a:

active=false
removed_at
last_seen_at

ou uma estratégia de versão equivalente.

Escolha a solução que melhor encaixe na arquitetura atual.

==================================================
21. DIFF DE PAUTA
==================================================

Não precisa construir UI nem notificações.

Mas deixe a infraestrutura capaz de responder:

"o que mudou desde o snapshot anterior?"

Tipos mínimos:

MEETING_CREATED
MEETING_UPDATED
MEETING_CANCELLED

AGENDA_ITEM_ADDED
AGENDA_ITEM_UPDATED
AGENDA_ITEM_REMOVED
AGENDA_ITEM_RESTORED

Se não quiser persistir eventos explícitos agora,
garanta que as versões/timestamps permitam derivá-los deterministicamente.

Explique a escolha no relatório.

==================================================
22. RESULTADOS
==================================================

SENADO:

preservar `result_raw` exatamente como publicado.

NÃO normalizar semanticamente neste P0 além do necessário para null/empty.

Exemplos como:

"Aprovado o projeto."
"Adiado"
"Retirado de pauta"

devem permanecer literais.

CÂMARA:

preservar o resultado disponível nas fontes atuais sem transformá-lo indevidamente em equivalentes semânticos ao Senado.

Não criar "taxa de aprovação".

==================================================
23. BACKFILL
==================================================

Depois da migration/schema:

criar forma explícita de backfill.

Prioridade:

1. reutilizar raw_objects já disponíveis;
2. reutilizar snapshots existentes;
3. somente depois buscar da API aquilo que realmente falta.

Criar comando claro, por exemplo conceitualmente:

backfill-commissions --source senado --year 2026
backfill-commissions --source camara --year 2026

O nome pode seguir convenção atual do projeto.

Para Senado, grande parte de reunião/body/pauta provavelmente pode ser reconstruída sem nova chamada.

Para Câmara, será necessário detalhe de eventos para recuperar body.

==================================================
24. NÃO PERDER COMPATIBILIDADE
==================================================

Antes de substituir qualquer leitura antiga de legislative_complements:

descubra quem consome esses dados.

Não quebrar:

- páginas existentes;
- collectors;
- exports;
- queries;
- testes;
- APIs internas.

Se necessário:

- mantenha a estrutura antiga;
- passe a popular também a canônica;
- faça migração gradual.

Mas evite perpetuar duas fontes concorrentes indefinidamente.

Documente a estratégia de transição.

==================================================
25. ÍNDICES
==================================================

Adicionar índices apropriados para consultas futuras como:

reuniões por comissão
reuniões por período
reuniões futuras
itens por reunião
itens por proposição
histórico de item
órgãos por tipo
reuniões por status

Exemplos conceituais:

(source, external_id)
(body_id, scheduled_start_at)
(meeting_id, active)
(proposal_id)
(scheduled_start_at)
(status_normalized)

Escolha conforme o banco/schema real.

==================================================
26. QUERIES QUE DEVEM FUNCIONAR AO FINAL
==================================================

Quero conseguir responder de forma limpa, sem JSON gymnastics:

A)

Quais comissões existem?

B)

Quais reuniões da CCJ aconteceram em 2026?

C)

Qual é a próxima reunião da CCJ?

D)

Quais reuniões de comissão existem amanhã?

E)

Quais itens estão na pauta da reunião X?

F)

Quais matérias distintas estão na pauta?

G)

Qual foi o resultado literal de cada item?

H)

Quais itens foram removidos entre duas coletas?

I)

Qual horário/local/status atual da reunião?

J)

Quais órgãos participam de uma reunião conjunta?

==================================================
27. TESTES OBRIGATÓRIOS
==================================================

Adicionar testes automatizados.

No mínimo:

1. rerun do mesmo payload não duplica body;
2. rerun não duplica meeting;
3. rerun não duplica agenda_item;
4. mudança de horário atualiza meeting;
5. versão anterior permanece recuperável;
6. cancelamento é preservado;
7. novo item aparece como ativo;
8. item removido deixa de ser ativo mas continua histórico;
9. item restaurado funciona;
10. mudança de ordem não cria matéria duplicada;
11. mesma matéria em reuniões diferentes funciona;
12. reunião sem pauta continua existindo;
13. reunião futura é persistida;
14. reunião conjunta aceita múltiplos bodies;
15. Câmara event → body funciona;
16. Senado meeting → body continua funcionando;
17. agenda item continua ligado à proposal existente;
18. collector atravessa virada de ano;
19. dados de Plenário não contaminam consultas de comissão;
20. migration/backfill é idempotente.

==================================================
28. VALIDAÇÃO QUANTITATIVA
==================================================

Depois de implementar, rode o backfill/collector necessário em 2026.

Produza BEFORE × AFTER.

SENADO:

- bodies
- reuniões
- reuniões com body
- reuniões com data
- reuniões com horário
- reuniões com local
- reuniões com status
- agenda_items
- agenda_items com meeting
- agenda_items com body derivável
- agenda_items com proposal
- items com result_raw
- reuniões futuras

CÂMARA:

mesmas métricas.

Especial atenção:

Câmara atualmente possui ~10.028 itens do snapshot principal praticamente sem body_id.

Quero saber quantos conseguimos ligar depois.

Calcule:

body_link_coverage =
itens de comissão ligados a body /
itens classificados como comissão

Também:

meeting_metadata_coverage
proposal_link_coverage
future_meeting_count

Não force 100%.

Se houver registros que não podem ser ligados,
liste as causas reais.

==================================================
29. SANITY CHECK MANUAL
==================================================

Selecione:

3 comissões da Câmara
3 comissões do Senado

Exemplos conhecidos que podem ser usados se continuarem válidos:

Câmara:
CCJC
CSAUDE
CFT

Senado:
CCJ
CCT
CAE

Para cada uma mostrar:

body
↓
últimas 3 reuniões
↓
itens
↓
proposal
↓
result_raw

E mostrar também:

próxima reunião, se existir.

Isso deve ser obtido do NOVO modelo canônico,
não diretamente dos JSONs antigos.

==================================================
30. PERFORMANCE
==================================================

Avalie custo do detalhe de eventos da Câmara.

Não quero:

N eventos
→ N requests toda vez que rodar o collector

Implementar cache/reuso.

Se evento já possui detalhe bruto atual e suficiente,
não refetch sem necessidade.

Use hash/last fetched/TTL ou mecanismo já existente no projeto.

Explique a estratégia.

==================================================
31. FRESCOR
==================================================

Não existe scheduler comprovado segundo a auditoria.

NÃO precisa montar scheduler se isso extrapolar a arquitetura atual.

Mas documente o comando recomendado para atualização frequente.

A infraestrutura deve suportar tranquilamente execução diária ou várias vezes ao dia sem duplicação.

==================================================
32. MIGRATIONS
==================================================

Migrations devem:

- ser reversíveis quando possível;
- não destruir legislative_complements antigos;
- preservar snapshots;
- não apagar raw_objects;
- não recriar proposições;
- não recriar parlamentares;
- não mudar IDs oficiais.

Faça backup da base antes de migration/backfill local relevante.

==================================================
33. NÃO IMPLEMENTAR AINDA
==================================================

Explicitamente fora de escopo:

matter_commission_stage completo

Recebida
→ aguardando relator
→ com relator
→ parecer
→ pronta para pauta
→ deliberada
→ saiu

Ainda não.

Também fora:

- classificação automática de "produtividade";
- ranking;
- score;
- "comissão mais eficiente";
- interpretação política;
- inferência de intenção;
- batalha legislativa;
- normalização de parecer por IA;
- votes censitários de comissão;
- participantes/convidados.

==================================================
34. RELATÓRIO FINAL
==================================================

Ao terminar, escreva:

C:\Projetos\civicadocs\p0_comissoes_implementacao.md

Quero:

# P0 Comissões — Relatório de implementação

## 1. O que foi implementado

## 2. Arquitetura antes

## 3. Arquitetura depois

Inclua diagrama ASCII:

fonte
→ raw
→ body
→ meeting
→ agenda_item
→ proposal

## 4. Migrations criadas

## 5. Models/tabelas

## 6. Alterações no collector Câmara

## 7. Alterações no collector Senado

## 8. Estratégia evento → órgão da Câmara

## 9. Agenda futura

## 10. Versionamento

## 11. Tombstones/itens removidos

## 12. Estratégia de identidade dos itens

## 13. Backfill

## 14. Before × After

## 15. Cobertura Câmara

## 16. Cobertura Senado

## 17. Casos reais reconstruídos

## 18. Testes

## 19. Performance/API calls

## 20. Gaps restantes

## 21. Comandos para operação diária

## 22. Queries de validação

## 23. Arquivos modificados

Para cada arquivo:

path
o que mudou
por quê

==================================================
35. CRITÉRIO DE ACEITAÇÃO DO P0
==================================================

Considero este P0 concluído quando:

1. Existe catálogo canônico de bodies.

2. Conseguimos identificar quais bodies são comissões/colegiados relevantes com uma taxonomia conservadora.

3. Reunião existe como entidade independente de possuir pauta.

4. Senado possui:
   meeting → body → agenda_item → proposal.

5. Câmara possui:
   event/meeting → body → agenda_item → proposal
   para a grande maioria dos itens de comissão recuperáveis da fonte.

6. Horário/local/tipo/situação deixam de ser descartados quando publicados.

7. Reuniões futuras podem ser coletadas.

8. Uma reunião futura pode mudar sem gerar duplicata.

9. Cancelamentos são preservados.

10. Itens removidos da pauta são detectáveis.

11. Snapshots/versionamento permitem reconstruir mudanças.

12. Rerun é idempotente.

13. Virada de ano funciona.

14. Não quebramos consumidores existentes.

15. Todas as métricas BEFORE × AFTER foram recalculadas na base real.

16. Existe o relatório p0_comissoes_implementacao.md com evidências e queries.

==================================================
36. MODO DE EXECUÇÃO
==================================================

Não quero apenas um plano.

Faça:

1. investigação curta do código;
2. escolha da arquitetura mínima;
3. migrations;
4. implementação;
5. testes;
6. backfill;
7. validação;
8. relatório.

Se encontrar uma decisão arquitetural realmente perigosa ou incompatível com o restante do sistema, pare apenas naquele ponto e documente objetivamente o blocker.

Caso contrário, prossiga até concluir o P0.