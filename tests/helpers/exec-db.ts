import pg from 'pg';
import { applyExecMigrations, buildTerritory, seedTerritory, type IbgeEstado, type IbgeMunicipio, type IbgeRegiao } from '../../packages/db/src/exec/index.ts';

/** Banco de teste descartável: EXEC_TEST_ADMIN_URL aponta para um cluster de scratch (NUNCA o banco do Cívica). */
export const ADMIN_URL = process.env.EXEC_TEST_ADMIN_URL;
export const REGIOES: IbgeRegiao[] = [{ id: 1, sigla: 'N', nome: 'Norte' }, { id: 2, sigla: 'NE', nome: 'Nordeste' }, { id: 3, sigla: 'SE', nome: 'Sudeste' }, { id: 4, sigla: 'S', nome: 'Sul' }, { id: 5, sigla: 'CO', nome: 'Centro-Oeste' }];
const UF_ROWS: Array<[number, string, string, number]> = [[11, 'RO', 'Rondônia', 1], [12, 'AC', 'Acre', 1], [13, 'AM', 'Amazonas', 1], [14, 'RR', 'Roraima', 1], [15, 'PA', 'Pará', 1], [16, 'AP', 'Amapá', 1], [17, 'TO', 'Tocantins', 1],
  [21, 'MA', 'Maranhão', 2], [22, 'PI', 'Piauí', 2], [23, 'CE', 'Ceará', 2], [24, 'RN', 'Rio Grande do Norte', 2], [25, 'PB', 'Paraíba', 2], [26, 'PE', 'Pernambuco', 2], [27, 'AL', 'Alagoas', 2], [28, 'SE', 'Sergipe', 2], [29, 'BA', 'Bahia', 2],
  [31, 'MG', 'Minas Gerais', 3], [32, 'ES', 'Espírito Santo', 3], [33, 'RJ', 'Rio de Janeiro', 3], [35, 'SP', 'São Paulo', 3], [41, 'PR', 'Paraná', 4], [42, 'SC', 'Santa Catarina', 4], [43, 'RS', 'Rio Grande do Sul', 4],
  [50, 'MS', 'Mato Grosso do Sul', 5], [51, 'MT', 'Mato Grosso', 5], [52, 'GO', 'Goiás', 5], [53, 'DF', 'Distrito Federal', 5]];
export const ESTADOS: IbgeEstado[] = UF_ROWS.map(([id, sigla, nome, r]) => ({ id, sigla, nome, regiao: REGIOES[r - 1]! }));
const uf = (id: number) => ESTADOS.find(e => e.id === id)!;
const mun = (id: number, nome: string, ufId: number, semMicro = false): IbgeMunicipio => semMicro
  ? { id, nome, microrregiao: null, 'regiao-imediata': { 'regiao-intermediaria': { UF: uf(ufId) } } }
  : { id, nome, microrregiao: { mesorregiao: { UF: uf(ufId) } } };
/** Municípios do ES, RJ, SP, MT usados nos testes (inclui o município sem microrregião, Boa Esperança do Norte). */
export const MUNICIPIOS: IbgeMunicipio[] = [mun(3205309, 'Vitória', 32), mun(3200359, 'Alto Rio Novo', 32), mun(3205200, 'Vila Velha', 32), mun(3304557, 'Rio de Janeiro', 33), mun(3550308, 'São Paulo', 35), mun(5101837, 'Boa Esperança do Norte', 51, true), mun(5300108, 'Brasília', 53)];

export async function createTestDb(): Promise<{ pool: pg.Pool; drop: () => Promise<void>; name: string }> {
  if (!ADMIN_URL) throw new Error('EXEC_TEST_ADMIN_URL não definido');
  const name = `exec_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Pool({ connectionString: ADMIN_URL, max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(ADMIN_URL); url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 8 });
  await applyExecMigrations(pool);
  return { pool, name, drop: async () => { await pool.end(); await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`); await admin.end(); } };
}
export async function seedMiniTerritory(pool: pg.Pool) {
  const t = buildTerritory(MUNICIPIOS, ESTADOS, REGIOES);
  return seedTerritory(pool, t, 202610);
}
