// Tradução de jargão: `curto` é o que o leigo lê na superfície; `explicacao` e `termo` mantêm a precisão.
// Só texto visível — nomes de métricas/chaves de dados não mudam.
export type TermoChave=
  |'custoMensal'|'custoAno'|'participacao'|'presenca'|'propostas'|'relatorias'|'patrimonio'|'votos'
  |'subsidio'|'cota'|'gabinete';

export interface Termo{curto:string;termo:string;explicacao:string;nota?:string}

export const GLOSSARIO:Record<TermoChave,Termo>={
  custoMensal:{curto:'Quanto custa por mês',termo:'Custo médio mensal identificado',explicacao:'Média por mês de salário do cargo + cota parlamentar + gasto do gabinete, só nos meses em que as três parcelas foram publicadas.',nota:'Parcelas não publicadas ficam de fora; encargos patronais não entram.'},
  custoAno:{curto:'Custo identificado no ano',termo:'Acumulado identificado',explicacao:'Soma do que foi publicado no ano (cota, salário do cargo e gabinete). Se faltarem meses, o número é parcial e a cobertura aparece ao lado.'},
  participacao:{curto:'Participação nas votações',termo:'Participação em votações nominais',explicacao:'De todas as votações em que cada parlamentar tem o voto registrado nome a nome, em quantas ele votou.',nota:'Falta de voto não é tratada como ausência na sessão.'},
  presenca:{curto:'Presença no Plenário',termo:'Presença em dias de Plenário',explicacao:'Em quantos dias com sessão deliberativa a presença foi registrada. É um universo diferente do das votações.'},
  propostas:{curto:'Propostas que apresentou',termo:'Propostas de autoria',explicacao:'Projetos e outras proposições em que a pessoa consta como autora. Autoria, relatoria e lei são coisas distintas.'},
  relatorias:{curto:'Relatorias',termo:'Relatorias',explicacao:'Vezes em que foi designado para analisar uma proposta e dar o parecer.'},
  patrimonio:{curto:'Patrimônio declarado',termo:'Bens declarados ao TSE',explicacao:'Valor total dos bens que a pessoa declarou na última candidatura. Não é o patrimônio de hoje.',nota:'Comparar declarações de pleitos diferentes não mede enriquecimento.'},
  votos:{curto:'Votos na última eleição',termo:'Votos recebidos',explicacao:'Total de votos nominais da última candidatura registrada no TSE.'},
  subsidio:{curto:'Salário do cargo',termo:'Subsídio normativo bruto',explicacao:'Valor bruto definido em lei; não é o que cai na conta (há descontos).'},
  cota:{curto:'Cota para o mandato',termo:'Cota parlamentar (CEAP/CEAPS)',explicacao:'Verba para despesas do mandato, como transporte, alimentação e divulgação, reembolsada mediante nota.'},
  gabinete:{curto:'Equipe do gabinete',termo:'Verba/folha de gabinete',explicacao:'Dinheiro público para pagar a equipe de assessores. Na Câmara é verba gasta; no Senado, proventos brutos da folha.'},
};
