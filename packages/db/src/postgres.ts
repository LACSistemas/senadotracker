import pg from 'pg';

export function postgresConfigFromEnv(env:NodeJS.ProcessEnv=process.env):pg.PoolConfig{
  const required=['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD'] as const;for(const key of required)if(!env[key])throw new Error(`${key} não configurado`);
  return{host:env.DB_HOST,port:Number(env.DB_PORT),database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD,max:Number(env.DB_POOL_MAX??10),idleTimeoutMillis:30_000,connectionTimeoutMillis:5_000,options:`-c search_path=${(env.DB_SCHEMA??'civica').replace(/[^a-zA-Z0-9_]/g,'')}`};
}

export function openPostgres(env:NodeJS.ProcessEnv=process.env){return new pg.Pool(postgresConfigFromEnv(env))}
