// Esqueleto do perfil durante a navegação: mesma silhueta do crachá (nome, pílulas, 8 tiles) para dar sensação de velocidade.
export function ProfileSkeleton(){
  return <main id="conteudo" tabIndex={-1} aria-busy="true"><span className="sr-only" role="status">Carregando o perfil…</span>
    <div aria-hidden="true" className="border-b bg-primary/90"><div className="page-shell flex items-end gap-5 py-8"><div className="h-36 w-28 animate-pulse motion-reduce:animate-none rounded-2xl bg-white/15 sm:w-40"/><div className="flex-1 space-y-3"><div className="h-4 w-28 animate-pulse motion-reduce:animate-none rounded-full bg-white/15"/><div className="h-10 w-3/4 animate-pulse motion-reduce:animate-none rounded-lg bg-white/15"/><div className="h-8 w-2/3 animate-pulse motion-reduce:animate-none rounded-full bg-white/10"/></div></div></div>
    <div aria-hidden="true" className="page-shell py-8"><ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({length:8},(_,i)=><li key={i} className="h-32 animate-pulse motion-reduce:animate-none rounded-2xl border bg-muted/60 motion-reduce:animate-none"/>)}</ul></div>
  </main>;
}
