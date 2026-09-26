# Agenda de comissões — semântica e apresentação

## Estado implementado

A agenda mantém a hierarquia dia → horário → reunião → pauta → matéria.

### Casa institucional

A origem da coleta (`source`) não é usada como evidência primária da Casa. O collector normaliza `legislative_bodies.house` com base no órgão oficial e identifica comissões mistas por sinais oficiais no nome, sigla e descrição, persistindo `CONGRESSO`. Bodies ordinários do Senado e da Câmara permanecem como `SENADO` e `CAMARA`.

A UI usa essa informação para o badge. O fallback por origem da coleta só ocorre quando não há body persistido; siglas `CM...` também funcionam como fallback conservador para comissões mistas ainda não reprocessadas.

### Nome e tipo da reunião

O nome humano vem dos campos oficiais do órgão:

- Senado: `colegiadoCriador.nome`;
- Câmara: `orgao.nome` ou `orgao.descricao`.

O tipo visual da reunião não usa mais `meeting_type_raw = "Pauta"`, pois esse valor pode vir do tipo do item (`tipoPauta`/`agendaType`). A página prioriza `commission_meetings.title` e `description`. Quando ambos estão ausentes, mostra `Tipo de reunião não informado`.

O local fica em linha própria. Não há prefixo artificial `Pauta`.

### Resultado dos itens

`result_raw` pertence ao item da pauta. Ele é mantido literalmente e aparece como **Situação publicada**. Não é convertido em status da reunião.

### Pauta e hierarquia visual

O bloco apresenta comissão, Casa, título/descrição da reunião, local e volume da pauta. Reuniões pequenas exibem os itens diretamente; reuniões maiores usam expansão para consultar a pauta completa. A ementa só aparece quando existe e não repete o identificador da matéria.

O contexto do período usa a forma `N reuniões de 1 a 25 de setembro`, com contagem separada por Câmara e Senado. Datas usam capitalização natural em português.

## Exemplos de validação

- CMA: nome oficial `Comissão de Meio Ambiente`, badge Senado Federal.
- Comissões de Esporte: nome obtido do body oficial quando publicado.
- Comissões mistas: sigla/nome `CM...` ou indicação textual de comissão mista, badge Congresso Nacional.
- Itens com `result_raw`: literal exibido como situação do item.
- Reuniões sem descrição: título oficial ou fallback neutro.
- Reuniões sem body: badge conservador baseado na origem, explicitamente como fallback.

## Limites conhecidos

A classificação institucional de registros antigos só é atualizada quando o meeting/body é reprocessado. Reuniões sem órgão retornado pela fonte continuam sem evidência primária de Casa até nova coleta.

## Mudanças na pauta

A agenda agora deriva mudanças somente de versões persistidas. A primeira versão não gera evento de alteração.

São suportados deterministicamente: alteração de horário, data, local, título/descrição, situação, resultado do item, ordem da pauta, item restaurado e item removido quando existe tombstone produzido por reconciliação de snapshot completo. Ausência em coleta parcial não é tratada como remoção.

A função `commissionMeetingChanges` compara versões consecutivas de reuniões e itens. O diff é calculado sob demanda a partir de `commission_meeting_versions` e `commission_agenda_item_versions`; não há texto editorial duplicado armazenado.

A interface mostra uma linha secundária “Pauta atualizada” e permite expandir as alterações cronologicamente. Itens novos não recebem selo indefinido; a primeira versão isolada permanece sem diff.

A base atual contém múltiplas versões de itens e meetings, mas a cobertura histórica de cada categoria deve ser considerada conforme a existência de versões/tombstones reais. Nenhum exemplo ausente é inventado pela UI.
