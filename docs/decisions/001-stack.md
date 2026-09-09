# ADR 001 — Workspace e stack inicial

Data: 08/09/2026. Estado: adotado para o bloco A. Requisito: frontend Next.js e coletor independente, compartilhando TypeScript e futuramente contratos/banco. Sem deploy nesta decisão.

## Versões escolhidas

| Componente | Versão fixa | Motivo |
| --- | --- | --- |
| Node.js de desenvolvimento | 22.15.0 | Já instalado; compatível com Next e tsx; não alterar instalação global |
| npm | 10.9.2 | Já instalado; workspaces e lockfile sem gerenciador adicional |
| Next.js | 16.3.4 | Versão estável retornada pelo registro npm na consulta |
| React / React DOM | 19.2.8 | Mesma versão; satisfaz peer dependencies do Next |
| TypeScript | 5.9.3 | Linha conservadora para iniciar; não adotar automaticamente a major 7 retornada em `latest` |
| tsx | 4.23.13 | Execução de CLI e testes TypeScript no Node instalado |
| `@types/node` | 22.20.1 | Tipos da major do runtime; evitar tipos da major 26 retornados por `latest` |
| `@types/react` / `@types/react-dom` | 19.2.18 / 19.2.7 | Compatíveis com React 19 |

Dependências diretas sem `^`/`~`; transitivas fixadas por `package-lock.json`. Runtime mínimo do projeto: Node 22.15; manter major 22 neste início. Novos patches de runtime/dependências requerem verificação, especialmente antes de publicação. `.nvmrc` registra o runtime usado, sem afirmar que seja o patch mais recente.

## Evidência consultada

- [Instalação oficial do Next](https://nextjs.org/docs/app/getting-started/installation): instalação manual, App Router, TypeScript e suporte a Windows; mínimo Node 20.9. O ambiente atual atende.
- [Workspaces do npm](https://docs.npmjs.com/cli/v10/using-npm/workspaces): pacotes locais e execução por workspace.
- Metadados reais de [Next](https://registry.npmjs.org/next/16.3.4), [React DOM](https://registry.npmjs.org/react-dom/19.2.8), [TypeScript](https://registry.npmjs.org/typescript/5.9.3) e [tsx](https://registry.npmjs.org/tsx/4.23.13), consultados por HTTPS. Next exige Node >=20.9 e aceita React 19; React DOM exige React ^19.2.8; tsx exige Node >=18.
- Runner escolhido: `node:test` e `node:assert/strict`, nativos do Node; tsx faz a transformação de TS. A execução local dos testes verificará compatibilidade, sem adicionar Vitest/Jest ao esqueleto.

## Organização e limites

No bloco A, `apps/web` recebeu a página inicial do App Router e `apps/collector` continha somente ajuda. O bloco B adicionou jobs de rede e gravação, `packages/domain` e `packages/db`; suas decisões de persistência estão no ADR 002. `tests/` cobre contratos das fixtures, CLI, HTTP, banco e publicação.

Configuração TS estrita compartilhada; cada aplicação tem seu `tsconfig`. Os testes também passam por verificação de tipos, separada do runner. Build do frontend sem download de fontes externas e sem acesso às APIs oficiais.

O comando de tipos do frontend executa `next typegen` antes de `tsc`, conforme o comando disponível no pacote instalado. Assim, um checkout limpo não depende de `.next/` ou `next-env.d.ts` pré-existentes; ambos são gerados e ficam fora do Git.

Tailwind e shadcn/ui permanecem em T037, conforme o plano. A página mínima deste bloco usa CSS local e não pretende antecipar o design final. SQLite permanece em T022; não instalar banco/ORM vazio agora. Sem autenticação de usuário, microsserviços ou serviços pagos.

## Verificação exigida

Executar instalação limpa pelo lockfile, `npm run typecheck`, `npm test`, `npm run build`, ajuda/entrada inválida da CLI e consulta HTTP da página local. Registrar resultados reais em `tasks.md`; a escolha de versão só é aceita como funcional depois desses checks.
