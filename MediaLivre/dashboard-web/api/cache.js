// Cache em memória com TTL. As views do modelo são `import` no Power BI —
// o volume é conhecido e a mesma combinação de filtros repete-se muito.

import { config } from './config.js';

const store = new Map();

export function cacheKey(...parts) {
  return JSON.stringify(parts);
}

export function get(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { store.delete(key); return null; }
  return hit.value;
}

export function set(key, value, ttl = config.cacheTtlMs) {
  store.set(key, { value, expires: Date.now() + ttl });
  return value;
}

export function stats() {
  const now = Date.now();
  let live = 0;
  for (const v of store.values()) if (v.expires > now) live++;
  return { entries: store.size, live, ttlMs: config.cacheTtlMs };
}

export function clear() {
  const n = store.size;
  store.clear();
  return n;
}
