# Revisão de acessibilidade, qualidade e entrega

Data da revisão: 9 de setembro de 2026.

## Acessibilidade

- O skip link recebe o primeiro foco e envia o foco para `#conteudo`.
- Navegação, busca, filtros, CTAs, links de paginação e alternativas móveis das tabelas são operáveis por teclado.
- As abas históricas usam seleção com setas, `Home` e `End`, foco roving, `aria-controls` e painel identificado.
- Cada rota principal expõe um `main`, um único `h1`, navegação nomeada, idioma `pt-BR`, imagens com texto alternativo e controles com nome acessível.
- Gráficos usam `figure`/`figcaption` e incluem uma tabela textual para leitores de tela.
- Estados de cobertura anunciam disponibilidade e nota metodológica; o texto não depende somente do tooltip visual.
- O reflow foi verificado em 640 CSS px, equivalente a zoom de 200% sobre uma viewport de 1280 px, sem rolagem horizontal nas oito rotas principais.

## Contraste

Razões calculadas a partir dos tokens em `globals.css`:

| Uso | Cores | Razão |
| --- | --- | ---: |
| Texto principal / fundo | `#172c27` / `#f3f1eb` | 13,04:1 |
| Texto secundário / fundo | `#60706a` / `#f3f1eb` | 4,62:1 |
| Verde de ação / fundo | `#115b45` / `#f3f1eb` | 7,13:1 |
| Texto claro / verde primário | `#f9fcfa` / `#115b45` | 7,80:1 |
| Texto secundário / card | `#60706a` / `#faf9f5` | 4,95:1 |

Todos os pares essenciais atendem WCAG AA para texto normal. O foco visível usa contorno de 2 px e deslocamento de 4 px.

## Desempenho local

Medição em build de produção, Chrome local e banco SQLite publicado. Os limites automatizados são LCP de até 4 s, CLS de até 0,1 e até 2,5 MB transferidos por rota.

| Rota | LCP | CLS | Transferência |
| --- | ---: | ---: | ---: |
| `/` | 564 ms | 0 | 849 kB |
| `/legislativo` | 2.052 ms | 0 | 58 kB |
| `/legislativo/senadores` | 664 ms | 0 | 11 kB |
| `/legislativo/senadores/5672` | 420 ms | 0 | 71 kB |

Os valores são uma referência local de regressão e não substituem dados de usuários reais em rede móvel.

## Reconciliação e testes

- 51 testes de contrato, unidade e integração passaram.
- A reconciliação abre `data/senadotracker.sqlite` em modo somente leitura e compara cadastro, UFs, partidos, distribuições e totais de cota, agregados partidários e representação estadual com as consultas usadas pela interface.
- 16 cenários end-to-end cobrem busca, filtro, lista, perfil, partido, UF, comparação, redirecionamento, 404, indisponibilidade, teclado, semântica, reflow, desempenho e capturas.
- TypeScript e o build otimizado do Next.js passaram.

## Capturas

As 14 capturas em `docs/review/screenshots` cobrem home, landing legislativa, lista de senadores, perfil, partidos, estado e comparação em 1440 px e 390 px.

## Limitações conhecidas

- O lote eleitoral do TSE continua indisponível; a interface preserva esse estado em vez de publicar zeros.
- A folha de gabinete do Senado tem cobertura parcial e a Câmara ainda não possui lote equivalente publicado.
- A auditoria automatizada verifica a estrutura acessível e o teclado. Uma rodada manual com leitores de tela reais continua recomendada antes de publicação pública.
- As métricas de desempenho são locais; após deploy, devem ser acompanhadas por dados de campo.
