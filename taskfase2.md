# Fase 2 — adaptação do frontend legislativo

Referências: [intention2.md](intention2.md), [intention.md](intention.md), [plan.md](plan.md) e [tasks.md](tasks.md).

## Estado atual e regra de execução

- Estado: **blocos A a J concluídos; Fase 2 pronta para revisão de entrega**.
- Escopo desta fase: somente Poder Legislativo federal.
- Rotas existentes: `/`, `/comparar`, `/metodologia`, `/design-system` e `/parlamentares/[source]/[id]`.
- Dados existentes no SQLite: cadastro, mandatos, partidos, cotas, votações, atividade legislativa, presença/participação parcial, complementos, estados eleitorais e folha de 79 gabinetes do Senado em agosto de 2026.
- O mockup orienta arquitetura visual e hierarquia. Não é fonte de números.
- Todo número deve vir do SQLite publicado. Dado ausente, parcial ou incompatível deve aparecer com estado de disponibilidade e não como zero.
- Não criar páginas, links, textos, fontes ou componentes do Judiciário nesta fase.
- Senadores e deputados compartilham componentes e estrutura; diferenças entram por configuração, labels e consultas.
- Não chamar custo parcial de “custo total do mandato”.

## A. Contratos de dados e auditoria da interface

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-001 | — | Inventariar todas as métricas pedidas pelo mockup legislativo | Matriz tela × métrica × tabela/query × cobertura × fallback registrada |
| [x] | F2-002 | F2-001 | Auditar textos e números hardcoded do frontend atual | Cada valor demonstrativo removido ou ligado ao SQLite; datas fixas justificadas |
| [x] | F2-003 | F2-001 | Definir contrato comum de disponibilidade | `available`, `partial`, `unavailable`, período, fonte, lote e nota disponíveis para cards, gráficos e tabelas |
| [x] | F2-004 | F2-003 | Criar consultas agregadas de panorama | Contagens, medianas, quartis e faixas calculadas apenas sobre observações compatíveis |
| [x] | F2-005 | F2-004 | Validar agregações por Casa | Amostra manual e teste automatizado conciliam contagem, mediana e universo elegível |
| [x] | F2-006 | F2-003 | Definir contratos de séries históricas | Ponto guarda período, cobertura e valor; lacuna não é interpolada nem convertida em zero |

## B. Design system e estrutura compartilhada

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-007 | F2-002 | Extrair tokens visuais do mockup para o tema existente | Cor, tipografia, espaço, raio, borda e elevação reutilizam CSS variables e preservam identidade atual |
| [x] | F2-008 | F2-007 | Refatorar `AppHeader` legislativo | Início, Legislativo, Estados, Assuntos, Sobre, busca e CTA responsivos; sem Judiciário |
| [x] | F2-009 | F2-007 | Refatorar `AppFooter` | Fontes e metodologia acessíveis; sem fontes judiciais |
| [x] | F2-010 | F2-007 | Criar `InstitutionHero` | Imagem, contexto, título, descrição, localização e slot de ação sem números internos |
| [x] | F2-011 | F2-010 | Criar `ProfileHero` | Foto, identidade, cargo, mandato, botões e fontes com dados recebidos por propriedades |
| [x] | F2-012 | F2-007 | Criar `SearchBar` e `FilterBar` | Labels, query string, teclado, loading e mobile consistentes |
| [x] | F2-013 | F2-003, F2-007 | Criar `KpiCard` e `KpiGrid` | Período, comparação e disponibilidade obrigatórios; tendência omitida sem base comparável |
| [x] | F2-014 | F2-007 | Criar `NavigationCard` e `ExplainerCard` | Ícone, texto e CTA reutilizáveis, com foco visível |
| [x] | F2-015 | F2-003, F2-007 | Criar `DataTable` responsiva | Cabeçalho, vazio, erro, fonte, paginação e alternativa mobile acessíveis |
| [x] | F2-016 | F2-003, F2-007 | Criar componentes de gráficos | Histograma, barras, barras empilhadas e linha usam dados reais, legenda, tabela alternativa e estado vazio |
| [x] | F2-017 | F2-007 | Criar `OfficialSourcesCard` e `OfficialSourcesStrip` | Fonte, atualização, lote e metodologia exibidos sem logos/fontes não utilizadas |
| [x] | F2-018 | F2-012 | Criar `ComparisonBar` | Seleções válidas persistem na URL e impedem comparação incompatível |
| [x] | F2-019 | F2-007 | Criar `SectionHeader` numerado e navegação por abas | Âncoras, foco, rolagem e estado ativo funcionam em desktop/mobile |
| [x] | F2-020 | F2-008, F2-009, F2-010, F2-013, F2-015 | Montar catálogo em `/design-system` | Todos os estados visuais e de disponibilidade podem ser revisados isoladamente |

## C. Home e entrada legislativa

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-021 | F2-008, F2-010, F2-014, F2-017 | Redesenhar `/` como entrada pública legislativa | Hero do Congresso, proposta do produto, caminhos legislativos e fontes; nenhum bloco judicial |
| [x] | F2-022 | F2-021 | Criar faixa “O que você encontra” | Cadastro, gastos, participação, atividade, eleições e gabinete refletem módulos reais |
| [x] | F2-023 | F2-004, F2-010, F2-012, F2-013 | Criar `/legislativo` | Busca, atalhos, panorama Senado/Câmara, exploração e comparação usam SQLite |
| [x] | F2-024 | F2-023 | Implementar tabela mista do Congresso | Senado e Câmara identificados; métricas sem cobertura mostram indisponibilidade |
| [x] | F2-025 | F2-023 | Implementar busca global legislativa | Busca parlamentar por nome, Casa, partido e UF; assuntos só entram após índice oficial |

## D. Listagens de senadores e deputados

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-026 | F2-004, F2-012, F2-013, F2-015, F2-016 | Criar estrutura configurável `ParliamentaryHousePage` | Uma base atende Senado e Câmara sem duplicar layout ou lógica agregadora |
| [x] | F2-027 | F2-026 | Criar `/legislativo/senadores` | Busca, filtros, KPIs, distribuição, participação, atividade, gabinete e tabela respeitam cobertura do Senado |
| [x] | F2-028 | F2-026 | Criar `/legislativo/deputados` | Mesma hierarquia com labels, fontes e métricas próprias da Câmara |
| [x] | F2-029 | F2-027, F2-028 | Implementar ordenação segura | Somente métricas comparáveis aparecem; nulos ficam separados e não assumem posição zero |
| [x] | F2-030 | F2-027 | Exibir panorama de gabinetes do Senado | Folha de agosto/2026 mostra competência, 79 vínculos seguros e cobertura parcial |
| [x] | F2-031 | F2-028 | Definir estado de gabinete da Câmara | Sem lote, cards e coluna mostram indisponibilidade e link metodológico |
| [x] | F2-032 | F2-027, F2-028 | Criar subnavegação legislativa | Senadores, deputados, partidos e estados com rota ativa e navegação por teclado |

## E. Perfil parlamentar unificado

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-033 | F2-011, F2-013, F2-015, F2-016, F2-017, F2-019 | Criar estrutura `ParliamentarianProfilePage` | Senado e Câmara compartilham hero, tabs, seções e estados |
| [x] | F2-034 | F2-033 | Migrar `/parlamentares/[source]/[id]` para rotas legislativas | Redirecionamento preserva links; canônicas são `/legislativo/senadores/:id` e `/legislativo/deputados/:id` |
| [x] | F2-035 | F2-033 | Criar seção 1 — custos identificados | Cota, subsídio e gabinete separados; comparação anual só com períodos equivalentes |
| [x] | F2-036 | F2-033 | Criar seção 2 — presença e votações | Numerador, denominador, cobertura e série anual aparecem sem equiparar falta de voto a ausência |
| [x] | F2-037 | F2-033 | Criar seção 3 — produção legislativa | Propostas, relatorias e leis usam conceitos distintos e status oficiais |
| [x] | F2-038 | F2-033 | Criar seção 4 — comissões, cargos e gabinete | Função, período, folha, equipe e escritórios mostram fonte e disponibilidade |
| [x] | F2-039 | F2-033 | Criar seção 5 — votações recentes | Data, proposição, tema disponível, voto literal, resultado e fonte em tabela acessível |
| [x] | F2-040 | F2-033 | Criar seção 6 — eleições e patrimônio | Resultado, votos, campanha e bens só aparecem quando lote TSE estiver disponível |
| [x] | F2-041 | F2-006, F2-033 | Criar seção 7 — evolução histórica | Tabs por métrica; lacunas e mudanças de cobertura visíveis |
| [x] | F2-042 | F2-034 | Preservar SEO e metadados dos perfis | Título, descrição, canonical e 404 usam identidade publicada |

## F. Partidos

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-043 | F2-004, F2-013, F2-015, F2-016 | Criar consultas agregadas por partido | Filiação é avaliada no período; Senado e Câmara permanecem distinguíveis |
| [x] | F2-044 | F2-043 | Criar `/legislativo/partidos` | Filtros, KPIs e tabela usam partidos representados no lote ativo |
| [x] | F2-045 | F2-043 | Criar comportamento partidário em votação | Barras somam universo explicitado; ausência de voto não vira orientação ou “não participou” sem evidência |
| [x] | F2-046 | F2-043 | Criar produção legislativa por partido | Autoria, relatoria, aprovação e lei permanecem métricas separadas |
| [x] | F2-047 | F2-043 | Criar assuntos em destaque | Publicar somente temas oficiais disponíveis; sem classificação editorial inventada |

## G. Quem me representa e estados

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-048 | F2-004, F2-012, F2-013, F2-015 | Definir consulta por UF | Retorna senadores e deputados do lote ativo, com métricas compatíveis e cobertura |
| [x] | F2-049 | F2-048 | Criar `/quem-me-representa` | Estado obrigatório, panorama e listas por Casa; cidade não é prometida sem base eleitoral adequada |
| [x] | F2-050 | F2-049 | Criar comparação entre estados | Universo, Casa, período e métrica iguais; medianas sem cobertura são omitidas |
| [x] | F2-051 | F2-047, F2-049 | Criar exploração por assunto | Só habilitar após temas oficiais indexados; caso contrário explicar indisponibilidade |

## H. Comparação entre parlamentares

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-052 | F2-004, F2-006, F2-018 | Evoluir `/comparar` para seleção de pessoas | Duas ou três pessoas da mesma Casa e período; incompatibilidades bloqueadas |
| [x] | F2-053 | F2-052 | Criar comparação por dimensão | Gastos, presença, votação, produção e gabinete separados; nenhuma nota geral |
| [x] | F2-054 | F2-052 | Adicionar contexto de média/mediana | Estatística informa universo elegível, tamanho da amostra e cobertura |
| [x] | F2-055 | F2-052 | Criar URL compartilhável | Pessoas, período e métrica ficam na query string, com validação de IDs |

## I. Imagens, conteúdo e responsividade

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-056 | F2-010, F2-011 | Definir imagens institucionais permitidas | Origem/licença registradas; fallback local não quebra layout |
| [x] | F2-057 | F2-021, F2-023, F2-027, F2-028, F2-033 | Revisar conteúdo editorial | Linguagem direta, sem promessas de cobertura inexistente ou juízo de desempenho |
| [x] | F2-058 | F2-057 | Revisar mobile em 390 px | Sem rolagem horizontal; filtros, tabs, tabelas e gráficos continuam utilizáveis |
| [x] | F2-059 | F2-057 | Revisar desktop largo | Conteúdo não perde hierarquia; linhas e cards mantêm limites legíveis |
| [x] | F2-060 | F2-056 | Otimizar imagens | Dimensões, formatos, prioridade e lazy loading definidos; CLS controlado |

## J. Acessibilidade, qualidade e entrega

| Estado | ID | Depende de | Tarefa | Critério de conclusão |
| --- | --- | --- | --- | --- |
| [x] | F2-061 | F2-058, F2-059 | Auditar teclado e foco | Skip link, navegação, filtros, tabs, tabelas e CTAs operáveis sem mouse |
| [x] | F2-062 | F2-061 | Auditar semântica e leitores de tela | Headings, landmarks, labels, descrições de gráficos e estados dinâmicos corretos |
| [x] | F2-063 | F2-061 | Auditar contraste e zoom | WCAG AA nos estados essenciais e interface utilizável a 200% |
| [x] | F2-064 | F2-060 | Medir desempenho das rotas principais | Home, landing, listagens e perfil sem regressão material de bundle, LCP e CLS |
| [x] | F2-065 | F2-025, F2-029, F2-042, F2-044, F2-049, F2-055 | Criar testes end-to-end da arquitetura | Busca, filtro, lista, perfil, partido, UF, comparação, 404 e indisponibilidade cobertos |
| [x] | F2-066 | F2-005, F2-065 | Executar reconciliação final com SQLite | Nenhum KPI/tabela/gráfico diverge das queries auditadas |
| [x] | F2-067 | F2-062, F2-063, F2-064, F2-066 | Preparar revisão visual final | Capturas desktop/mobile das rotas, checklist e limitações prontos para revisão |

## Ordem de execução

1. F2-001 a F2-006 — contratos e auditoria.
2. F2-007 a F2-020 — sistema compartilhado.
3. F2-021 a F2-025 — entrada e landing.
4. F2-026 a F2-032 — listagens por Casa.
5. F2-033 a F2-042 — perfil parlamentar.
6. F2-043 a F2-051 — partidos e representação por UF.
7. F2-052 a F2-055 — comparação.
8. F2-056 a F2-067 — conteúdo, acessibilidade, desempenho e entrega.

Fase 2 concluída. Ao retomar: revisar as capturas em `docs/review/screenshots` e definir o ambiente de publicação.
