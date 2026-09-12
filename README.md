# Cívica

Tracker de senadores e deputados federais com fontes oficiais e metodologia rastreável. [Intenção](intention.md), [plano](plan.md) e [tarefas](tasks.md).

## Estado

Blocos A–D concluídos: 594 perfis e despesas de CEAPS/CEAP de 2025 e 2026 estão em lotes locais auditáveis. Listagem, busca, perfil, origem, categorias, documentos e comparação entre meses equivalentes leem somente lotes publicados. Cota não é apresentada como custo total. Não existem indicadores legislativos publicados.

## Executar localmente

Requisitos usados: Node.js 22.15.0 e npm 10.9.2. Versões e justificativas em [ADR 001](docs/decisions/001-stack.md).

```sh
npm ci
npm run dev
```

Abrir http://127.0.0.1:3000. No PowerShell, se a política bloquear `npm.ps1`, usar `npm.cmd` nos mesmos comandos. As dependências são instaladas na raiz, com um único lockfile; cache local em `.npm-cache/`.

```sh
npm run collector -- --help
npm run collector -- collect --source all
npm run collector -- status
npm run typecheck
npm test
npm run build
npm start
```

`npm run check` executa tipos, 25 testes offline e build. Após o build, `npm run test:e2e` inicia o servidor e executa a jornada visual no Chrome instalado. `collect` consulta as APIs oficiais e grava `data/senadotracker.sqlite` e `data/raw/`; não requer credenciais nas rotas atuais. `status` é local. Consulte a [reconciliação](docs/reconciliation/cadastro-2026-09-08.md).

## Estrutura

- `apps/web`: frontend em App Router, Tailwind e componentes shadcn/ui locais, ligado ao SQLite publicado no servidor.
- `apps/collector`: CLI, HTTP restrito aos hosts oficiais, parsers e orquestração da coleta.
- `packages/domain`: contratos e validações de identidade/tempo.
- `packages/db`: migrações, staging, auditoria, publicação e consultas do lote ativo.
- `docs/sources`: contratos, referências e evidências das APIs.
- `docs/methodology`: identidade, temporalidade e regras para a implementação.
- `tests/fixtures/sources`: amostras mínimas com hash e proveniência.
- `data/`: arquivos brutos locais, fora do Git. Não necessários para instalar, testar ou iniciar a página.

O próximo passo é **T057**, votos e deliberações do Senado. Nenhum serviço foi contratado ou site publicado.

```bash
npm run collector -- collect-votes --source all --year 2026
npm run collector -- collect-activity --source all
npm run collector -- collect-presence --source all --year 2026
npm run collector -- collect-complement --source all
```

