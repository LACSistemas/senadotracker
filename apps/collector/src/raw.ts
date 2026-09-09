import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { DatabaseSync } from 'node:sqlite';

export interface RawResponse { url: string; fetchedAt: string; status: number; contentType: string; bytes: Uint8Array }
export async function saveRaw(db: DatabaseSync, runId: string, directory: string, response: RawResponse): Promise<string> {
  const hash = createHash('sha256').update(response.bytes).digest('hex');
  const path = resolve(directory, hash.slice(0, 2), `${hash}.bin`);
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, response.bytes, { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  // Detect truncated files left by an interrupted write; never silently overwrite evidence.
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== hash) throw new Error(`Objeto bruto corrompido: ${hash}`);
  const id = randomUUID();
  db.prepare('INSERT INTO raw_objects VALUES (?,?,?,?,?,?,?,?,?)').run(id, runId, response.url, response.fetchedAt, response.status, response.contentType, hash, path, response.bytes.length);
  return id;
}
export async function readRaw(db: DatabaseSync, id: string): Promise<Buffer> {
  const raw = db.prepare('SELECT path,sha256 FROM raw_objects WHERE id=?').get(id);
  if (!raw) throw new Error('Objeto bruto não encontrado');
  const bytes = await readFile(String(raw.path));
  if (createHash('sha256').update(bytes).digest('hex') !== raw.sha256) throw new Error('Integridade do objeto bruto inválida');
  return bytes;
}

export async function saveRawFile(db:DatabaseSync,runId:string,directory:string,file:string,meta:Omit<RawResponse,'bytes'>):Promise<string>{
  const temporary=resolve(directory,'.incoming',`${randomUUID()}.bin`);
  await mkdir(dirname(temporary),{recursive:true});
  const digest=createHash('sha256');let size=0;
  const input=createReadStream(file),output=createWriteStream(temporary,{flags:'wx'});
  try{
    for await(const chunk of input){const bytes=chunk as Buffer;digest.update(bytes);size+=bytes.length;if(!output.write(bytes))await once(output,'drain')}
    await new Promise<void>((resolve,reject)=>output.end((error?:Error|null)=>error?reject(error):resolve()));
    const hash=digest.digest('hex'),path=resolve(directory,hash.slice(0,2),`${hash}.bin`);
    await mkdir(dirname(path),{recursive:true});
    try{await rename(temporary,path)}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await rm(temporary,{force:true})}
    if((await stat(path)).size!==size)throw new Error(`Objeto bruto com tamanho divergente: ${hash}`);
    const id=randomUUID();db.prepare('INSERT INTO raw_objects VALUES (?,?,?,?,?,?,?,?,?)').run(id,runId,meta.url,meta.fetchedAt,meta.status,meta.contentType,hash,path,size);return id;
  }catch(error){output.destroy();await rm(temporary,{force:true});throw error}
}
