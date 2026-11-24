/** O Next só carrega .env* de dentro de apps/web, e esse diretório não tem nenhum — o .env real do
 * projeto mora na raiz do monorepo. Sem isso, variáveis novas no .env só "funcionam" por acidente,
 * se já estiverem numa env var de sessão do shell de quem rodou `npm run dev` antes. A lógica fica
 * num arquivo separado (padrão documentado do Next) porque este arquivo é analisado também pro
 * runtime Edge, que não tem node:path/process.cwd — o require condicional evita isso. */
export function register() {
  if (process.env.NEXT_RUNTIME !== 'edge') {
    require('./instrumentation.node').registerNode();
  }
}
