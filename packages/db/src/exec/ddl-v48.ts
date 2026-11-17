// Dívida pública — Dívida Bruta do Governo Geral (DBGG, % do PIB), Banco Central (SGS série 13762,
// metodologia vigente desde dez/2006), mensal. É a métrica de "dívida pública" mais citada
// publicamente no Brasil — soma as dívidas de responsabilidade do Governo Federal, dos estados e dos
// municípios com o setor privado, o setor público financeiro e o resto do mundo. `metric` permite
// adicionar outra métrica de dívida no futuro (ex. Dívida Líquida do Setor Público) sem nova tabela.
export const EXEC_DDL_V48 = `
CREATE TABLE civica_exec.exec_public_debt (
  metric text NOT NULL CHECK (metric IN ('DBGG_PCT_GDP')),
  period_start date NOT NULL,
  value numeric(6,2) NOT NULL,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric, period_start)
);
`;
