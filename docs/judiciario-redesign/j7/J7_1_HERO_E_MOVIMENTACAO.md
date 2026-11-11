# J7.1 — Hero investigativo e "A Justiça em movimento"

## Hero
Reconstruído de "banner + ilustração decorativa + 4 KPIs separados" para uma composição única (mesmo princípio estrutural de H7, identidade visual própria do Judiciário):

- **Zona esquerda**: eyebrow, manchete (mantida exata: "A Justiça brasileira, além dos processos."), descrição, CTAs ("Explorar os dados" / "Encontrar tribunal"), atalhos secundários.
- **Zona direita**: painel único com um gráfico de linhas real (casos novos × processos baixados, últimos 6 anos — **não** duplica a série completa 2009-2025 da seção principal, é uma prévia, conforme mandato §6.1) e os 4 indicadores (casos novos, baixados, pendentes, magistrados) integrados no mesmo painel, não em cards separados abaixo.
- Despesa com magistrados, antes um parágrafo solto, virou uma tira anexada à base do próprio hero (mesmo padrão de "faixa de rodapé do hero" validado em H7).

Nenhum dado novo: mesmos valores já carregados por `loadJudiciaryOverview`/`loadJudiciaryNationalSeries`, só reorganizados numa composição integrada em vez de dispersos.

## "A Justiça em movimento"
Mantida a estrutura (já madura antes de J7: gráfico `MultiLineChart` real 2009-2025, grid assimétrico `minmax(0,1fr)_320px`, aside lateral). Reconstruída a aside:

**Antes**: lista de 6 links com contagens de tribunal **hardcoded** no código (`RAMOS`, ex. "27 tribunais", "6 tribunais regionais federais").

**Depois**: barras horizontais reais, usando `judOverview.data.branches[].institutions` — o mesmo dado já carregado pela chamada principal da página, nenhuma consulta nova. Contagens reais confirmadas: Justiça Eleitoral 28, Estadual 27, Trabalho 25, Federal 6, Militar Estadual 3, Tribunais Superiores 2, STF 1 (CNJ excluído por ser o órgão de controle, não um ramo julgador).

## Verificação
- `document.querySelectorAll('header').length` não se aplica aqui (não investigamos sticky nesta página — mandato não apontou esse problema para /judiciario).
- Responsividade: 0 overflow em 320-1920px, exceto os 11px já documentados do cabeçalho global em 1024px (pré-existente, confirmado também em `/estados` e na homepage).
- Console: 0 erros novos.
