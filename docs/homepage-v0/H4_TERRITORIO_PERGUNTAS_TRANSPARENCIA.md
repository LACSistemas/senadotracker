# H4 — Território, Perguntas e Abrangência/Transparência

## Território
Busca por município/estado reaproveitando o resolvedor já existente `/executivo/buscar` (construído na fase Executivo desta mesma sessão) — nenhum resolvedor novo. Atalhos reais: "Atlas dos estados" (`/estados`), "Atlas dos municípios" (`/municipios`), e **"Comparar tribunais"** (`/judiciario/comparar`) no lugar do "Comparar territórios" genérico do mock — não existe um comparador genérico de Executivo/saúde/educação por território nesta base (ver H0 §8); usamos o comparador real mais próximo, com rótulo preciso.

## Perguntas
5 links investigativos, cada um para uma rota real confirmada por HTTP 200: "Como está minha cidade?" → `/estados`; "Quem me representa?" → `/legislativo`; "Como o dinheiro público é utilizado?" → `/executivo`; "Como funciona a Justiça?" → `/judiciario`; "Quais dados sustentam essas informações?" → `/metodologia`.

**Achado corrigido durante H5**: a primeira versão desta seção linkava "Como o dinheiro público é utilizado?" para `/obras`, que não existe como rota de listagem (só `/obras/[projectId]`, uma página de detalhe — retorna 404 sem um ID). Corrigido para `/executivo`, que cobre o mesmo tema com conteúdo real. Nota: esse mesmo link quebrado (`/obras`) já existia, antes desta sessão, dentro de `/executivo` (seção "Obras e contratos públicos") — fora do escopo deste mandato, não corrigido aqui, mas registrado no relatório final para o usuário decidir.

## Abrangência / transparência
Faixa final com números **auditados**, não copiados do mock: 5.571 municípios, 27 estados + DF, 594 parlamentares federais (513 deputados + 81 senadores — não "+1,8 mil parlamentares" do mock, que não existe nesta base: não há parlamentar estadual em `civica_people_poc.profiles`), e o total real de tribunais do catálogo CNJ consultado em runtime.

## Footer global (`app-footer.tsx`)
Achado do mandato §10: o rodapé global (renderizado em toda página do site, não só na home) descrevia o produto como "Dados públicos do **Legislativo** com contexto, período, cobertura e origem verificável", e só linkava Legislativo/Comparar/Metodologia e fontes do Senado/Câmara. Corrigido para citar os três poderes ("Dados públicos de Legislativo, Executivo e Judiciário..."), com links para `/executivo` e `/judiciario` adicionados à navegação, e CNJ — Justiça em Números + IBGE adicionados às fontes oficiais (fontes já citadas nas próprias páginas de Executivo/Judiciário, reaproveitadas aqui, não inventadas).

## Gate H4 — PASS
