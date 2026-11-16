import pg from 'pg';

let singleton: pg.Pool | undefined;
export function webPostgresPool(): pg.Pool {
  return singleton ??= new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Achado real (medido direto, não suposição): uma conexão nova custa ~75-270ms só de handshake
    // TCP+SCRAM, mesmo pra uma query de 1ms. O `pg.Pool` fecha conexões ociosas depois de 10s por padrão
    // (`idleTimeoutMillis`, não configurado antes) — como páginas como /estados/[uf] e /municipios/[ibge]
    // disparam 20-40 consultas em paralelo, isso significa reabrir dezenas de conexões do zero a cada
    // visita que não vem imediatamente depois de outra (o caso comum de um usuário real navegando) — essa
    // era a causa de boa parte do "quase tudo é lento", não o SQL em si. `idleTimeoutMillis: 0` desativa
    // esse descarte (seguro aqui: Postgres local/privado, processo único de servidor sempre ativo) — é o
    // ganho real; testei max=10 vs 30 e não mudou nada no tempo (não é fila do pool, é reconexão). 20 em
    // vez de 10 só dá uma margem a mais sem chegar perto do limite (`max_connections=100`) quando há mais
    // de um processo ligado ao mesmo tempo (servidor de dev + um servidor isolado de teste, por exemplo —
    // 30 em cada já esgotou as conexões disponíveis numa verificação real desta sessão).
    max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: 0,
  });
}
