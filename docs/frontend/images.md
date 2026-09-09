# Política de imagens da interface

## Imagens permitidas

| Imagem | Origem | Condição de uso | Entrega |
| --- | --- | --- | --- |
| `apps/web/public/congresso.svg` | Ilustração vetorial criada para este projeto; não deriva de fotografia externa | Ativo interno, sujeito aos termos do repositório | Fundo decorativo local, sem texto alternativo duplicado |
| Retrato de senador | URL devolvida pelo serviço oficial do Senado no cadastro publicado | Exibição referenciada à origem oficial; licença de redistribuição não foi presumida e o arquivo não é incorporado ao repositório | `next/image`, proporção reservada e fallback “Foto indisponível” |
| Retrato de deputado federal | URL devolvida pela API oficial da Câmara no cadastro publicado | Exibição referenciada à origem oficial; licença de redistribuição não foi presumida e o arquivo não é incorporado ao repositório | `next/image`, proporção reservada e fallback “Foto indisponível” |
| Logos de AVANTE, PCdoB, PDT, PODE, PP, PSB, PSD, PSDB, PSOL, PT, PV e REDE | Campo `urlLogo` de `/api/v2/partidos/{id}` da Câmara dos Deputados, coletado em 09/09/2026 | Identificação informativa da legenda; marcas permanecem pertencentes às respectivas agremiações | Cópia local do GIF fornecido pela Câmara |
| Logos de CIDADANIA, DC, MDB, MISSÃO, NOVO, PL, PRD, REPUBLICANOS, SOLIDARIEDADE e UNIÃO | Arquivo correspondente no Wikimedia Commons/Wikipedia, após o `urlLogo` informado pela Câmara retornar 404 em 09/09/2026 | Páginas de arquivo indicam logo simples/domínio público quando aplicável e possível proteção marcária; uso apenas para identificar a legenda | Cópia local em PNG/SVG, dimensões reservadas e sigla como fallback |

O mockup e `intention2.md` orientam composição visual, mas não são origem de imagens publicáveis. Uma imagem externa nova só pode entrar depois que origem, licença e atribuição forem registradas nesta tabela.

## Desempenho e estabilidade

- O fundo institucional local usa `fill`, `sizes` e prioridade por estar acima da dobra. Se falhar, a cor institucional mantém contraste e dimensões.
- A foto principal do perfil reserva uma caixa de 160 × 200 CSS pixels e recebe prioridade. Fotos nas tabelas reservam 40 × 40 pixels e carregam sob demanda pelo otimizador do Next.js.
- Todos os retratos usam `object-fit: cover`; falhas de rede trocam a imagem por um fallback textual dentro da mesma caixa, evitando mudança de layout.
- O SVG local tem `viewBox` 1600 × 900, permanece vetorial e não exige variantes bitmap por densidade.
- As logos partidárias são indexadas pela sigla literal publicada no cadastro. Sigla sem ativo catalogado recebe um bloco tipográfico, sem tentar adivinhar identidade visual.

Referências de catálogo: [partidos na API da Câmara](https://dadosabertos.camara.leg.br/swagger/api.html?tab=api), [partidos registrados no TSE](https://www.tse.jus.br/partidos/partidos-politicos/partidos-registrados-no-tse) e [categoria de logos partidárias no Commons](https://commons.wikimedia.org/wiki/Category:Logos_of_political_parties_in_Brazil).
