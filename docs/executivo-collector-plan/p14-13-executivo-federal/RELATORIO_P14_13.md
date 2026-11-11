# P14.13 — Executivo Federal (presidente, IDH global, PISA)

## O que foi pedido
O usuário pediu 3 adições ao portal `/executivo`: (1) o presidente e sua foto, "igual temos pro governador"; (2) um comparador de IDH em linha do tempo, Brasil × América do Sul × Mundo; (3) dados do PISA como comparador internacional de educação. Restrição explícita: não deixar o banco crescer mais que 1 GB com isso.

Duas correções à premissa do usuário, confirmadas ao investigar o código real antes de construir:
- **Governador também não tinha foto** (`photo_url` sempre `null`) — não era "dar paridade com o governador", era construir a mesma funcionalidade pros dois ao mesmo tempo.
- **IDHM nacional (PNUD/IPEA/FJP) é decenal e só tem 1991/2000/2010** — o comparador internacional pedido precisa de uma fonte nova e paralela (HDI global, PNUD/ONU), nunca misturada com o IDHM existente.

## Presidente e foto
Schema ampliado (não uma tabela nova): `civica_exec.exec_executive_mandate` (já usada pro governador) ganhou os papéis `PRESIDENTE`/`VICE_PRESIDENTE` via `uf='BR'` (ddl-v45). Coletor novo (`apps/collector/src/federal-executive.ts`) — não havia um coletor persistido de governador pra estender — reaproveita o parser CSV do TSE já usado pro Congresso (`elections.ts`).

Dado real coletado:
- **2022** (mandato vigente): LULA (PT), eleito no 2º turno, mandato 2023–2027. Vice: GERALDO ALCKMIN (PSB).
- **2026** (mandato eleito, ainda não iniciado na data da coleta — posse em 2027-01-01): LULA (PT), reeleito no 2º turno, mandato 2027–2031. Vice: GERALDO ALCKMIN (PSB).

Fotos: confirmado ao vivo (`curl`, não suposição) que o ZIP de fotos de candidatos presidenciais existe no TSE sob `uf='BR'`, mesmo mecanismo de extração via HTTP Range já usado pros governadores — 4 fotos espelhadas com sucesso (2022 + 2026, presidente + vice), cada uma poucos KB, em `data/portraits/` (git-ignored, nunca no Postgres).

## IDH Global: Brasil, América do Sul e Mundo
Nova tabela pequena, `civica_exec.exec_hdi_global` (ddl-v46), populada a partir do CSV público da Our World in Data (fonte real: UNDP Human Development Report 2025) — confirmado ao vivo que a OWID já calcula "South America" e "World" como entidades próprias, sem precisar aproximar com "América Latina e Caribe" nem recalcular médias. 102 pontos (3 entidades × 34 anos, 1990–2023).

**Resultado real**: o IDH do Brasil acompanha de perto a média da América do Sul ao longo de todo o período, ambos bem acima da média mundial — um achado genuíno, não construído.

Apresentado **ao lado** do IDHM nacional (PNUD/IPEA/FJP, decenal, 1991/2000/2010) já existente na página, nunca substituindo nem misturado — são metodologias diferentes.

## PISA: Brasil comparado à OCDE e ao mundo
Nova tabela pequena, `civica_exec.exec_pisa_score` (ddl-v47), populada a partir dos 3 CSVs públicos da Our World in Data (fonte real: OCDE PISA Database 2023) — Brasil + "OECD average" + "PISA participants average", já prontos na fonte, nenhuma média recalculada aqui. 63 pontos (3 disciplinas × 3 entidades × 6-8 edições cada, 2000/2003–2022 conforme disciplina).

Apresentado como comparador internacional **separado**, nunca na mesma escala/gráfico do Ideb/Saeb (INEP) — PISA é internacional e só nível-país, sem recorte estadual/municipal.

## Achados reais corrigidos durante a implementação
1. **Mandato "atual" errado**: `getCurrentExecutive`/`getCurrentMayor` filtravam só `mandate_end >= current_date`. Como Lula foi reeleito em 2026 mas a posse só é em 2027-01-01, o mandato de 2026 (ainda não iniciado) também satisfazia esse filtro — e por `ORDER BY election_year DESC`, apareceria como "o atual" em vez do mandato de 2022 (o que realmente governa agora, até 2027-01-01). Corrigido adicionando `mandate_start <= current_date` nas duas funções. Confirmado por teste direto: a função agora devolve corretamente o mandato de 2022.
2. **Gráfico de IDH Global ilegível**: o `MultiLineChart` compartilhado desenha todos os rótulos do eixo X sem nenhum controle de densidade — com 34 anos de dado, os rótulos se sobrepunham numa mancha ilegível (confirmado em captura real). Substituído por um SVG próprio com espaçamento de rótulos, mesmo padrão já usado na E7 para os gráficos de Ideb e tráfico de drogas.
3. **Foto do presidente "indisponível"**: o coletor inicial apontou o diretório de fotos pro D:, mas o servidor web usa o diretório padrão (`data/portraits/`, git-ignored) sem essa variável configurada — a foto não aparecia. Corrigido usando o diretório padrão, mesmo lugar de todos os outros retratos do produto (deputados, senadores, governadores). Esses arquivos já são poucos KB e já são git-ignored — não havia necessidade real de desviar pro D: só pra este coletor.
4. **Regressão no header do site inteiro**: adicionar "Legislativo" à navbar (pedido separado do usuário nesta mesma conversa) fez o menu horizontal estourar de 11px (já documentado como pré-existente) para 108px de overflow em TODAS as páginas do site no breakpoint de 1024px — um 8º link não cabia mais no espaço disponível. Corrigido subindo o breakpoint de troca do menu horizontal de `lg` (1024px) para `xl` (1280px), eliminando o overflow novo e também o pré-existente.

## Armazenamento (mandato§: ≤1 GB)
`pg_database_size` antes: 35.835.645.075 bytes. Depois: 35.835.767.955 bytes. **Crescimento real: 122.880 bytes (~120 KB)** — `exec_hdi_global` 64 KB, `exec_pisa_score` 32 KB, mais 4 linhas em `exec_executive_mandate` e 4 linhas de metadado em `civica_media.portraits` (as fotos em si ficam em disco, nunca no banco). Bem abaixo do orçamento de 1 GB — não foi necessário usar o D: para nada além do cache de CSVs/ZIPs brutos baixados (prática já estabelecida no projeto, não uma mudança de política).

## Testes, acessibilidade, build
44/44 testes passaram na suíte combinada (`executivo-portal.spec.ts` + `p14-territorio-executivo.spec.ts` + `p148-judiciario.spec.ts`). axe-core real: 0 violações novas em `/executivo` e `/` (mesmas 2 categorias pré-existentes desde H5). Typecheck e build isolados: limpos. 0px de overflow horizontal em 320–1920px em `/executivo`, `/`, `/judiciario`, `/estados`, `/legislativo` (incluindo a faixa 1024–1280px, antes problemática).

## Segurança arquitetural
Nenhuma migration destrutiva — `ddl-v45` só amplia um CHECK existente, `ddl-v46`/`ddl-v47` só criam tabelas novas. Nenhum coletor existente (PNCP, etc.) foi tocado ou interrompido. Nenhum dado bruto (CSVs do TSE, CSVs da OWID) foi commitado ou copiado pro Postgres — só os agregados pequenos descritos acima.

## Revisão pós-entrega: página própria (feedback real do usuário)
A primeira versão desta fase colocava presidente, IDH Global e PISA direto na landing de `/executivo`. O usuário pediu uma reorganização: `/executivo/federal` deveria ser **sua própria página**, funcionando como uma extensão (mais rica que) `/estados/{uf}` — e a landing de `/executivo` deveria voltar a ser como era antes, com só um link de entrada pra quem quiser o perfil federal completo.

**O que mudou:**
- Novo arquivo `apps/web/app/executivo/federal/page.tsx` — reusa `TerritoryHero` (mesmo componente da hero de `/estados/{uf}`, com `executiveSlot={<PresidentCard/>}`), uma faixa de 4 KPIs (PIB per capita, IDHM nacional, população, municípios/UFs) no mesmo estilo visual de `TerritoryKpiStrip`, e os dois comparadores internacionais (IDH Global, PISA) que nenhum estado tem.
- `/executivo/page.tsx` voltou ao estado anterior a esta fase — sem `PresidentCard`, sem a seção de comparadores — com um único link novo no hero ("Ver o perfil do Governo Federal →") apontando pra `/executivo/federal`.
- `TerritoryFrame` (usado por `/estados/{uf}`) **não** foi reusado — ele inclui `ThemeTabs`, que assume 5 sub-rotas temáticas próprias do território (`/estados/{uf}/saude` etc.); `/executivo/federal` não tem essas sub-rotas (as visões nacionais por tema já vivem em `/executivo`), então usar `TerritoryFrame` geraria links para rotas inexistentes. Construída uma trilha simples (`Executivo / Governo Federal`) em vez disso.

**Achado real adicional, encontrado ao construir a faixa de KPIs federal:**
- `loadHdiComparison({level:'BRASIL'})` devolve o próprio Brasil no campo `.territory`, não em `.brasil` (esse campo fica `null` de propósito quando o território pedido já é o Brasil — evita uma consulta redundante). `/executivo/page.tsx` já lia o campo errado (`.brasil`) desde antes desta sessão — a referência nacional de IDHM ("— Brasil: 0,727") nunca aparecia quando o indicador IDHM estava selecionado, um bug real e pré-existente, não introduzido agora. Corrigido nos dois arquivos (`/executivo` e `/executivo/federal`); confirmado por teste real que "Brasil: 0.727 (2010, último ano desta base)" agora aparece.
- PIB per capita nacional ficou honestamente "—" / "sem dado publicado": `exec_gdp_territory` tem 22 linhas reais de PIB do Brasil (2002–2023, R$ 10,94 tri em 2023), mas `exec_territory_population` (a tabela de população que este módulo específico junta pra calcular per capita) não tem nenhuma linha para `entity_id=76` (Brasil) — uma lacuna real de dado upstream, não um bug de leitura. Não foi feito nenhum backfill: escrever nessa tabela persistida está fora da autorização deste plano (só leitura), e a ausência honesta é o comportamento correto aqui, não algo a "consertar" inventando um valor.

**Verificação após a reorganização:** 44/44 testes e2e, axe-core 0 violações novas em `/executivo` (mesmas 2 pré-existentes) e **0 violações em `/executivo/federal`** (página nova não usa o componente de mapa compartilhado, de onde vêm as 2 categorias pré-existentes do resto do site), 0px de overflow em `/executivo` e `/executivo/federal` nas 9 larguras do mandato, typecheck e build isolados limpos.
