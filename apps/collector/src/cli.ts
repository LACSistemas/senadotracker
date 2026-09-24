export const help = `Cívica — coletor

Uso:
  npm run collector -- --help
  npm run collector -- collect --source senado|camara|all
  npm run collector -- collect-expenses --source senado|camara|all --year YYYY
  npm run collector -- collect-votes --source senado|camara|all --year YYYY
  npm run collector -- collect-activity --source senado|camara|all
  npm run collector -- collect-presence --source senado|camara|all --year YYYY
  npm run collector -- collect-complement --source senado|camara|all
  npm run collector -- collect-price-index --index ipca [--dry-run]
  npm run collector -- collect-themes --year YYYY [--file ARQUIVO] [--dry-run]
  npm run collector -- collect-camara-propositions --ids ID,ID
  npm run collector -- collect-camara-tramitacoes --year YYYY [--types REQ,RIC,INC,DOC,EMC,PL] [--ids ID,ID] [--limit N]
  npm run collector -- collect-senate-processes --year YYYY [--ids ID,ID] [--dry-run]
  npm run collector -- collect-senate-agenda --year YYYY [--dry-run]
  npm run collector -- collect-camara-agenda --year YYYY [--dry-run]
  npm run collector -- collect-house-operations --source senado|camara|all --year YYYY [--dry-run]
  npm run collector -- collect-house-operations senado|camara|all YYYY [--dry-run]
  npm run collector -- collect-institutional-suppliers --year YYYY [--from YYYY-MM-DD --to YYYY-MM-DD] [--dry-run]
  npm run collector -- collect-chamber-procurement --year YYYY [--limit N] [--resume] [--dry-run]
  npm run collector -- collect-chamber-contract-details --year YYYY [--ids ID,ID] [--limit N] [--dry-run]
  npm run collector -- collect-chamber-financial-execution --year YYYY [--limit N] [--dry-run]
  npm run collector -- collect-senate-procurement --year YYYY [--limit N] [--resume] [--dry-run]
  npm run collector -- collect-senate-contract-details --year YYYY [--ids ID,ID] [--limit N] [--dry-run]
  npm run collector -- collect-senate-financial-execution --year YYYY [--ids ID,ID] [--limit N] [--dry-run]
  npm run collector -- collect-pncp-enrichment --year YYYY [--limit N] [--dry-run]
  npm run collector -- rebuild-supplier-aggregates --year YYYY
  npm run collector -- import-elections --year 2018|2022 --candidates ARQUIVO --assets ARQUIVO [--complement ARQUIVO] [--dry-run] [--report ARQUIVO]
  npm run collector -- collect-camara-staff [--file ARQUIVO] [--dry-run] [--report ARQUIVO]
  npm run collector -- collect-camara-budget --year YYYY [--ids ID,ID] [--dry-run] [--report ARQUIVO]
  npm run collector -- collect-senate-staff --year YYYY [--ids ID,ID] [--consolidated ARQUIVO] [--dry-run] [--report ARQUIVO]
  npm run collector -- import-cabinet --source senado --competence YYYY-MM --file ARQUIVO [--dry-run] [--report ARQUIVO]
  npm run collector -- status

Opções:
  -h, --help  Exibe esta ajuda.
  --source   Fonte obrigatória para collect.

collect consulta e publica cadastro; collect-expenses importa um arquivo anual de cota.
collect-price-index importa a série do número-índice do IBGE, usada para comparar valores de meses diferentes.
collect-themes importa a classificação temática anual oficial da Câmara e a vincula às proposições ativas.
collect-camara-propositions importa detalhe, temas, tramitação e relações oficiais de proposições específicas.
collect-camara-tramitacoes importa o histórico paginado das proposições da Câmara com situação terminal, usando cache local e lotes concorrentes.
collect-senate-processes importa assuntos, situações e tramitação dos processos oficiais do Senado.
collect-senate-agenda importa itens das pautas mensais de comissões do Senado e deduplica matérias no período.
collect-camara-agenda importa pautas de reuniões e sessões deliberativas da Câmara.
collect-house-operations publica backlog institucional e duração até desfecho terminal como agregado pronto para leitura.
collect-institutional-suppliers e os comandos derivados coletam contratos, execução financeira e fornecedores institucionais; cada etapa é retomável e preserva cobertura parcial.
import-elections lê CSVs locais do TSE em Windows-1252; 2022 exige --complement. --dry-run não altera o banco.
SENADOTRACKER_DATA_DIR pode definir o diretório de dados.
`;

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runCli(args: readonly string[]): CliResult {
  if (args.length === 0 || (args.length === 1 && (args[0] === '--help' || args[0] === '-h'))) {
    return { exitCode: 0, stdout: help, stderr: '' };
  }

  return {
    exitCode: 2,
    stdout: '',
    stderr: 'Entrada inválida. Use --help para consultar as opções disponíveis.\n',
  };
}
