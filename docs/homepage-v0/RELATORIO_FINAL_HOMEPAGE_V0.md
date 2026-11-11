# Homepage V0 — Relatório final

Mandato: "CÍVICA — HOMEPAGE V0 — Implementação do primeiro mock aprovado". Fases H0-H5 completas, nesta ordem, com verificação real a cada etapa (nunca suposição). Documentos de fase: `H0_AUDITORIA.md`, `H1_HERO_HEADER.md`, `H2_HISTORIAS_DE_DADOS.md`, `H3_TRES_PODERES.md`, `H4_TERRITORIO_PERGUNTAS_TRANSPARENCIA.md`, `H5_QA_E_ACESSIBILIDADE.md`.

## O que foi entregue

- **Hero**: headline exata do mock, busca universal federada (pessoa/partido/estado/município/tribunal — extensão real de `searchAll`), mapa nacional por IDHM 2010 com legenda, 4 indicadores contextuais auditados (não copiados do mock), faixa dos três poderes.
- **Histórias de dados**: Educação (mapa de Ideb real por UF), Justiça (série real de entradas×baixas), Gastos públicos (substituída por comparação honesta entre domínios — o donut do mock não é construível com os dados reais desta base, decisão documentada em H0 §5).
- **Três poderes, três perspectivas**: 3 módulos editoriais distintos (composição partidária real / indicadores de saúde e educação / processos e magistrados), sem duplicar as visualizações das histórias.
- **Território**: busca + atalhos reais (Atlas dos estados, Atlas dos municípios, Comparar tribunais).
- **5 perguntas investigativas**, todas para rotas reais confirmadas por HTTP 200.
- **Faixa de abrangência/transparência** com números auditados (594 parlamentares federais, não "+1,8 mil"; 5.571 municípios; total real de tribunais do catálogo CNJ).
- **Rodapé global corrigido** (`app-footer.tsx`) para não descrever mais o Cívica como exclusivamente legislativo (mandato §10) — cita os três poderes e adiciona fontes reais (CNJ, IBGE).
- Busca global (`GlobalSearch`/`searchAll`) estendida de 2 para 5 tipos de resultado, refletida em todo o produto (cabeçalho de toda página), não só na home.

## Números do mock substituídos por reais (nenhum copiado sem auditoria)

| Mock | Real usado |
|---|---|
| IDH-M 2023, 0,761 | Mapa por IDHM 2010 (0,727 nacional — único ano recente real) |
| 203,1 milhões de habitantes | 214.211.951 (soma real das 27 UFs) |
| 91 tribunais | Total real do catálogo CNJ, consultado em runtime |
| "+1,8 mil parlamentares" | 594 parlamentares federais (513 deputados + 81 senadores) |
| R$5,7tri despesa da União / donut de categorias | Não existe nesta base — substituído por comparação real entre domínios já publicados |

## Achados corrigidos durante a execução (não eram bugs pré-existentes, foram introduzidos e corrigidos nesta fase)
- Gráfico de barras da história de Justiça renderizava sem altura visível (CSS: altura percentual sem ancestral com altura definida) — corrigido.
- Overflow horizontal de 37px em 320px no formulário de busca territorial — corrigido.
- Link "Como o dinheiro público é utilizado?" apontava para `/obras` (rota de listagem inexistente) — corrigido para `/executivo`.

## Achados pré-existentes, fora do escopo deste mandato (não corrigidos — para decisão do usuário)
- `/executivo` já tinha, antes desta fase, um link para `/obras` quebrado (mesma rota inexistente) na seção "Obras e contratos públicos".
- 2 violações de acessibilidade (axe-core) no componente de mapa compartilhado (`brazil-map-markup.ts`/`state-map-paint.ts`), replicadas também em `/estados` e `/executivo`.
- 3 testes e2e com asserções desatualizadas por reformas já mescladas antes desta sessão (heading renomeado em `/legislativo`; heading de histórico movido entre abas; rota `/parlamentares/senado/999999` não devolve mais 404).

## Verificação final
- Typecheck isolado: limpo.
- Responsividade 320-1920px: 0 overflow, 0 erro de console novo, 0 `NaN`/`undefined`.
- e2e: todos os testes afetados pela reescrita da home/busca passam (`cadastro.spec.ts`, `ux-busca.spec.ts`), após atualização para o conteúdo real novo.
- axe-core: 2 violações, ambas pré-existentes no componente de mapa compartilhado.
- Nenhuma migração, alteração de schema, backfill ou reinício de coletor — mudança 100% frontend, reaproveitando contratos de dados já existentes (mandato §13).

## Status: READY_FOR_USER_VISUAL_APPROVAL (G1)

Fidelidade ao mock foi a prioridade explícita do mandato; as únicas divergências do mock são as auditadas em H0 e listadas acima, todas por integridade de dados, nunca por simplificação ou conveniência de implementação.
