# ADR 003 — primeira experiência visual

Data: 08/09/2026. Estado: aceita.

## Decisão

Usar Tailwind CSS 4.3.3 pelo plugin PostCSS, componentes locais no padrão shadcn/ui e ícones Lucide. Os componentes ficam no repositório para permitir revisão e adaptação, sem uma dependência de runtime do CLI shadcn.

A identidade usa verde institucional neutro, fundo claro, títulos editoriais em serif e texto de interface em sans-serif. Cores partidárias não indicam mérito. Tokens semânticos vivem em `apps/web/app/globals.css`; a rota interna `/design-system` reúne cores, tipografia, controles, espaçamento e foco.

O frontend abre o SQLite publicado somente no servidor. A listagem usa paginação e filtros GET, de modo que Casa, UF, partido, busca e página permaneçam na URL. O perfil expõe origem, URL oficial, coleta, publicação, lote e hash. Histórico parcial recebe rótulo próprio; lacunas não são preenchidas por inferência.

## Acessibilidade e validação

O layout começa pelo viewport pequeno, oferece atalho para o conteúdo, regiões de navegação nomeadas, rótulos de formulário e foco visível. A jornada automatizada usa o Chrome instalado para testar busca, restauração dos filtros, perfil, fonte, 404, metodologia, teclado e largura de 390 px.

Referências consultadas: [Tailwind CSS com PostCSS](https://tailwindcss.com/docs/installation/using-postcss), [shadcn/ui para Next.js](https://ui.shadcn.com/docs/installation/next) e [Next.js App Router](https://nextjs.org/docs/app).

## Limites

O banco está local e a aplicação ainda não foi hospedada. O aviso experimental de `node:sqlite` permanece conforme o ADR 002. Gastos, atuação legislativa, presença e eleições continuam indisponíveis até as respectivas fontes e metodologias passarem pelos critérios de publicação.
