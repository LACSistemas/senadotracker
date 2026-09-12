export const help = `Cívica — coletor

Uso:
  npm run collector -- --help
  npm run collector -- collect --source senado|camara|all
  npm run collector -- collect-expenses --source senado|camara|all --year YYYY
  npm run collector -- collect-votes --source senado|camara|all --year YYYY
  npm run collector -- collect-activity --source senado|camara|all
  npm run collector -- collect-presence --source senado|camara|all --year YYYY
  npm run collector -- collect-complement --source senado|camara|all
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

