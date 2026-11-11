# E6 — Reconstrução editorial do Executivo — Relatório final

Mandato: elevar `/executivo` ao mesmo nível de exigência visual de H7/J7, com identidade própria (território, geografia, serviços públicos) — "um Atlas Nacional Vivo", não uma lista de indicadores. Documentos de fase: `E6_0_AUDITORIA_VISUAL.md`, `E6_1_HERO_CARTOGRAFICO.md`, `E6_2_ATLAS_INVESTIGATIVO.md`, `E6_3_CINCO_TEMAS.md`, `E6_4_INSTITUICOES_E_RECURSOS.md`, `E6_5_MOBILE_E_UX.md`, `E6_6_AUDITORIA_FINAL.md`.

## Arquivos alterados
- `apps/web/app/executivo/page.tsx` — fusão de hero+atlas, faixa federativa, gráfico de obras, correções de bugs.
- `tests/e2e/executivo-portal.spec.ts` — 2 testes atualizados (consequência real da reconstrução, não regressão escondida).

## O que foi reconstruído

1. **Hero + descoberta territorial**: de "mapa contextual decorativo no hero + mapa analítico numa seção separada abaixo" para um único mapa investigativo integrado ao hero, com seletor de indicador, legenda e painel de contexto — a maior mudança estrutural desta fase, resolvendo de uma vez a repetição cartográfica, a falta de protagonismo do mapa, e a ausência de uma "descoberta" territorial genuína.
2. **Quem cuida de quê**: de 3 cartões soltos para 1 faixa federativa conectada.
3. **Cinco áreas**: Saúde ganhou uma 2ª estatística real (hospitais), demonstrando o princípio de diferenciação sem reescrever as 5 do zero nesta fase.
4. **Recursos e entregas**: de texto puro para um gráfico real de 154.449 obras do Obrasgov por situação, com estágios financeiros explicitamente não somados (regra do mandato respeitada).

## Achados reais corrigidos (bugs, não só design)
- 2 links para `/obras`, rota nacional inexistente (só existe `/obras/[projectId]`, detalhe) — corrigidos para destinos reais.
- Input de busca territorial com `background-color: transparent`, texto ilegível sobre o hero escuro — corrigido (`bg-white`).
- Ambiente de desenvolvimento: servidor de dev caído + unidade D: indisponível (reinício de máquina, não causado por este trabalho) — servidor reiniciado com credenciais corretas; arquivo de tipos gerado corrompido (`validator.ts`) apagado e regenerado; axe-core obtido por uma via alternativa (`npm pack`) já que o caminho configurado em D: não estava acessível.

## Dados e fontes citados
População: 214.211.951 (soma das 27 UFs, IBGE). IDHM Brasil: 0,727 (2010, PNUD/IPEA/FJP — sem edição mais recente nesta base). Obras: 154.449 registradas, por situação — Cadastrada 83.143, Concluída 44.577, Em execução 20.967, Cancelada 3.911, Inacabada 1.026, Paralisada 825 (Obrasgov).

## Testes
43/44 passaram na suíte combinada (`executivo-portal.spec.ts` + `p14-territorio-executivo.spec.ts` + `p148-judiciario.spec.ts`); a única falha é flakiness de paralelismo confirmada (passa isolada), numa rota (`/municipios`) que esta fase não tocou. Typecheck isolado limpo. axe-core real: 0 violações novas, mesmas 2 categorias pré-existentes do componente de mapa compartilhado, contagem de nós reduzida (menos mapas na página).

## Limitações
- As 4 áreas temáticas além de Saúde mantiveram sua composição de card único — diferenciação visual completa das 5 ficou fora do escopo coberto nesta fase (registrado, não escondido).
- Performance de campo não medida — sem RUM neste ambiente.

## Segurança arquitetural
Nenhuma migration, backfill, alteração de schema ou interrupção de coletor. As funções de leitura usadas já existiam no pacote `@senadotracker/db`.

## Status: E6_READY_FOR_USER_VISUAL_REVIEW

---

# J7 + E6 — Status combinado

Ambas as fases concluídas na ordem exigida pelo mandato (J7 primeiro, depois E6), cada uma com identidade visual própria — nenhuma é uma cópia do template da outra ou da homepage: J7 usa gráficos de linha/distribuição (movimento processual, tempo), E6 usa cartografia (território, geografia). Nenhuma migração de fase de fechamento conjunto (H7+E6+J7) foi iniciada, conforme instrução explícita do mandato (§33).

**J7: `J7_READY_FOR_USER_VISUAL_REVIEW`**
**E6: `E6_READY_FOR_USER_VISUAL_REVIEW`**

A aprovação visual final de ambas pertence ao usuário.
