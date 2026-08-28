// Servidor da Fase 1: serve o front-end e a API na mesma origem (sem CORS).
//
//   node api/server.js
//
// Sem credenciais do Databricks arranca em MODO MOCK: a API responde com
// data/mock/dashboard.json para o front-end poder ser desenvolvido na mesma.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { query, ping } from './databricks.js';
import { buildQuery, buildDetailQuery } from './queries/sql.js';
import { MEASURES, measureIds } from './queries/measures.js';
import { FIELDS } from './queries/filters.js';
import * as cache from './cache.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

/* ---------------------------------------------------------------- helpers */

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  res.end(payload);
};

async function readBody(req, limit = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Corpo do pedido demasiado grande');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Autenticação: token partilhado. PLACEHOLDER — ver docs/05-fase1-backend.md.
// Um token no browser é visível a quem abrir o DevTools; isto só protege a API
// de acesso anónimo direto, não identifica o utilizador nem aplica RLS.
function authorized(req) {
  if (!config.apiToken) return true; // desativado em desenvolvimento
  const header = req.headers.authorization || '';
  const sent = header.startsWith('Bearer ') ? header.slice(7) : '';
  return sent.length === config.apiToken.length && timingSafeEqual(sent, config.apiToken);
}

function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------------------------------------------------------------- API */

const DEFAULT_MEASURES = [
  'total_billing', 'total_contracted_gross', 'pc_contracted_realised', 'nr_insertions',
  'pc_discount_avg', 'pc_first_position', 'nr_negotiations_total', 'avg_duration'
];

async function handleQuery(req, res) {
  const body = await readBody(req);
  const measures = Array.isArray(body.measures) && body.measures.length ? body.measures : DEFAULT_MEASURES;
  const filters = body.filters || {};
  const params = body.params || {};
  const wantDetail = body.detail !== false;

  if (config.offline) {
    return json(res, 200, await mockPayload('mock (sem credenciais Databricks)'));
  }

  const key = cache.cacheKey('query', measures, filters, params, wantDetail);
  const hit = cache.get(key);
  if (hit) return json(res, 200, { ...hit, meta: { ...hit.meta, cached: true } });

  const built = buildQuery(measures, filters, params);
  const jobs = [query(built.statement, built.parameters)];
  if (wantDetail) {
    const d = buildDetailQuery(filters, params);
    jobs.push(query(d.statement, d.parameters));
  }

  const [agg, detail] = await Promise.all(jobs);

  const payload = {
    meta: {
      source: 'databricks',
      periodo: describePeriod(filters),
      last_data_updated: null, // preenchido pela view pbi_last_data_updated (por fazer)
      cached: false
    },
    values: agg.rows[0] || {},
    rows: detail ? detail.rows : []
  };

  cache.set(key, payload);
  json(res, 200, payload);
}

function describePeriod(filters) {
  const ano = [].concat(filters.ano || []).filter(Boolean);
  return ano.length ? `Ano ${ano.join(', ')}` : 'Todo o histórico';
}

async function mockPayload(sourceLabel) {
  const raw = await readFile(join(ROOT, 'data', 'mock', 'dashboard.json'), 'utf8');
  const mock = JSON.parse(raw);
  mock.meta = { ...mock.meta, source: sourceLabel };
  return mock;
}

/* ---------------------------------------------------------------- estáticos */

async function serveStatic(req, res, url) {
  // Redirecionar em vez de servir o index na raiz: assim os caminhos relativos
  // do HTML (css/, js/, ../data/) resolvem a partir de /src/.
  if (url === '/' || url === '/src') {
    res.writeHead(302, { Location: '/src/' });
    return res.end();
  }

  let rel = url === '/src/' ? '/src/index.html' : url;

  const path = normalize(join(ROOT, rel));
  if (!path.startsWith(ROOT)) return json(res, 403, { error: 'Caminho inválido' });
  if (!existsSync(path)) return json(res, 404, { error: 'Não encontrado' });

  const data = await readFile(path);
  res.writeHead(200, {
    'Content-Type': MIME[extname(path)] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  res.end(data);
}

/* ---------------------------------------------------------------- router */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;

  try {
    if (url.startsWith('/api/')) {
      if (!authorized(req)) return json(res, 401, { error: 'Não autorizado' });

      if (url === '/api/health' && req.method === 'GET') {
        const out = {
          ok: true,
          mode: config.offline ? 'mock' : 'databricks',
          cache: cache.stats(),
          measures: measureIds().length,
          filters: Object.keys(FIELDS)
        };
        if (!config.offline) {
          try { out.databricks = await ping() ? 'ok' : 'falhou'; }
          catch (e) { out.databricks = `erro: ${e.message}`; }
        }
        return json(res, 200, out);
      }

      // Catálogo de medidas com o DAX original — usado para auditar a tradução.
      if (url === '/api/measures' && req.method === 'GET') {
        return json(res, 200, Object.fromEntries(Object.entries(MEASURES).map(([id, m]) =>
          [id, { folder: m.folder, source: m.source, status: m.status, dax: m.dax, todo: m.todo || null }])));
      }

      if (url === '/api/query' && req.method === 'POST') return await handleQuery(req, res);

      if (url === '/api/cache' && req.method === 'DELETE') {
        return json(res, 200, { cleared: cache.clear() });
      }

      return json(res, 404, { error: 'Endpoint desconhecido' });
    }

    if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido' });
    return await serveStatic(req, res, url);

  } catch (err) {
    // Detalhe fica no log do servidor; o cliente recebe só a mensagem.
    console.error('[erro]', err.message, err.detail || '');
    json(res, 500, { error: err.message });
  }
});

server.listen(config.port, () => {
  const mode = config.offline
    ? 'MOCK (defina DATABRICKS_HOST, DATABRICKS_WAREHOUSE_ID e DATABRICKS_TOKEN para ligar ao Databricks)'
    : `Databricks ${config.databricks.host}`;
  console.log(`MediaLivre dashboard-web
  front-end  http://localhost:${config.port}/
  API        http://localhost:${config.port}/api/health
  modo       ${mode}
  auth       ${config.apiToken ? 'token ativo' : 'desativada (desenvolvimento)'}
  medidas    ${measureIds().length} traduzidas`);
});
