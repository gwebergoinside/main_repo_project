// Cliente do Databricks SQL Statement Execution API (REST, sem dependências).
// A credencial (PAT) vive só aqui, no servidor — nunca chega ao browser.

import { config } from './config.js';

const API = '/api/2.0/sql/statements';

async function call(path, init = {}) {
  const res = await fetch(config.databricks.host + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.databricks.token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Nunca ecoar o corpo cru para o cliente: pode conter detalhes do warehouse.
    const err = new Error(`Databricks respondeu ${res.status}`);
    err.detail = body.slice(0, 500);
    throw err;
  }
  return res.json();
}

/**
 * Executa uma query e devolve { columns, rows } com os valores já convertidos.
 * @param {string} statement SQL com parâmetros nomeados (:nome)
 * @param {Array<{name:string,value:any,type?:string}>} parameters
 */
export async function query(statement, parameters = []) {
  let out = await call(API, {
    method: 'POST',
    body: JSON.stringify({
      statement,
      warehouse_id: config.databricks.warehouseId,
      parameters: parameters.map(p => ({
        name: p.name,
        value: p.value == null ? null : String(p.value),
        type: p.type || 'STRING'
      })),
      wait_timeout: '30s',
      on_wait_timeout: 'CONTINUE',
      format: 'JSON_ARRAY',
      disposition: 'INLINE'
    })
  });

  // Statements longos passam a assíncronos: sondar até terminar.
  const started = Date.now();
  while (['PENDING', 'RUNNING'].includes(out.status?.state)) {
    if (Date.now() - started > config.databricks.timeoutMs) {
      throw new Error('Databricks: tempo limite excedido');
    }
    await new Promise(r => setTimeout(r, 1000));
    out = await call(`${API}/${out.statement_id}`);
  }

  if (out.status?.state !== 'SUCCEEDED') {
    const err = new Error(`Databricks: query terminou em ${out.status?.state}`);
    err.detail = out.status?.error?.message;
    throw err;
  }

  const columns = (out.manifest?.schema?.columns || []).map(c => ({ name: c.name, type: c.type_name }));
  const rows = (out.result?.data_array || []).map(r => {
    const obj = {};
    columns.forEach((c, i) => { obj[c.name] = cast(r[i], c.type); });
    return obj;
  });
  return { columns, rows };
}

const NUMERIC = new Set(['INT', 'LONG', 'SHORT', 'BYTE', 'FLOAT', 'DOUBLE', 'DECIMAL']);

function cast(v, type) {
  if (v == null) return null;
  if (NUMERIC.has(type)) return Number(v);
  if (type === 'BOOLEAN') return v === 'true' || v === true;
  return v;
}

export async function ping() {
  const { rows } = await query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
