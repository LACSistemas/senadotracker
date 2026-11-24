import { loadEnvConfig } from '@next/env';
import { join } from 'node:path';

export function registerNode() {
  loadEnvConfig(join(process.cwd(), '..', '..'), process.env.NODE_ENV !== 'production', console, true);
}
