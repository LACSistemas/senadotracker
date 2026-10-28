/** Nota de ProUni/FIES: a infraestrutura está pronta, mas as 20 fontes oficiais do MEC bloqueiam o download (erro de rede e, fora do ambiente de coleta, desafio Cloudflare 403). Nenhum dado é inventado. */
export function AccessProgramsNote() {
  return (
    <section className="rounded-xl border border-dashed bg-card p-5">
      <p className="eyebrow">Cobertura</p>
      <h3 className="mt-1 font-display text-lg text-[#14304f]">ProUni e Fies: ainda sem dados publicados</h3>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">Bolsas do ProUni e vagas/contratações do Fies estão mapeadas e o banco já tem o espaço reservado para elas, mas os arquivos oficiais do MEC (dadosabertos.mec.gov.br) estão bloqueando o download. Nenhum número é estimado ou preenchido com zero até que a fonte volte a responder.</p>
    </section>
  );
}
