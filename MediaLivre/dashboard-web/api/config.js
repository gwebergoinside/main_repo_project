// Configuração por variáveis de ambiente. Nada de credenciais em ficheiro versionado.
// Ver .env.example. Carrega um .env local se existir (sem dependências externas).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;

export const config = {
  port: Number(env.PORT || 8080),

  databricks: {
    host: (env.DATABRICKS_HOST || '').replace(/\/+$/, ''),
    warehouseId: env.DATABRICKS_WAREHOUSE_ID || '',
    token: env.DATABRICKS_TOKEN || '',
    catalog: env.DATABRICKS_CATALOG || 'medialivre',
    schema: env.DATABRICKS_SCHEMA || 'pbi_out',
    timeoutMs: Number(env.DATABRICKS_TIMEOUT_MS || 60000)
  },

  // Token partilhado para a API. Placeholder — ver docs/05-fase1-backend.md.
  apiToken: env.API_TOKEN || '',

  cacheTtlMs: Number(env.CACHE_TTL_MS || 5 * 60 * 1000),

  // Sem credenciais completas, o servidor arranca em modo mock em vez de falhar.
  get offline() {
    const d = this.databricks;
    return !(d.host && d.warehouseId && d.token);
  }
};

export const qualify = name => `${config.databricks.catalog}.${config.databricks.schema}.${name}`;
