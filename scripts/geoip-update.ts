// Baixa (ou atualiza) o banco GeoLite2-City da MaxMind para geolocalização de visitantes por UF no
// painel /admin. Autenticação é HTTP Basic (Account ID como usuário, License Key como senha) — a
// MaxMind não aceita download anônimo. Rodar periodicamente (ela reemite a base semanalmente):
//   npm run geoip:update
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const accountId = process.env.MAXMIND_ACCOUNT_ID;
const licenseKey = process.env.MAXMIND_LICENSE_KEY;
if (!accountId || !licenseKey) {
  console.error('MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY ausentes no ambiente (.env). Nada baixado.');
  process.exit(1);
}

const EDITION = 'GeoLite2-City';
const DEST_DIR = join(process.cwd(), 'geoip');
const DEST_FILE = join(DEST_DIR, `${EDITION}.mmdb`);

async function main() {
  const url = `https://download.maxmind.com/geoip/databases/${EDITION}/download?suffix=tar.gz`;
  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString('base64');
  console.log(`Baixando ${EDITION} da MaxMind...`);
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const workDir = mkdtempSync(join(tmpdir(), 'geolite2-'));
  const archivePath = join(workDir, 'db.tar.gz');
  await import('node:fs/promises').then(fs => fs.writeFile(archivePath, buffer));
  // --force-local evita que o GNU tar do Git for Windows interprete "C:\..." como host remoto (host:path).
  execFileSync('tar', ['--force-local', '-xzf', archivePath, '-C', workDir]);

  const extractedDir = readdirSync(workDir).find(name => name !== 'db.tar.gz' && statSync(join(workDir, name)).isDirectory());
  if (!extractedDir) throw new Error('Pasta extraída do .tar.gz não encontrada.');
  const mmdbName = readdirSync(join(workDir, extractedDir)).find(name => name.endsWith('.mmdb'));
  if (!mmdbName) throw new Error('.mmdb não encontrado dentro do arquivo baixado.');

  mkdirSync(DEST_DIR, { recursive: true });
  renameSync(join(workDir, extractedDir, mmdbName), DEST_FILE);
  rmSync(workDir, { recursive: true, force: true });
  console.log(`OK: ${DEST_FILE} atualizado (${(statSync(DEST_FILE).size / 1_000_000).toFixed(1)} MB).`);
}

main().catch(err => { console.error(err); process.exit(1); });
