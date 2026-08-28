// Formatação alinhada às formatStrings do modelo (pt-PT).

const currency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const integer  = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
const decimal  = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent  = new Intl.NumberFormat('pt-PT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatValue(value, kind) {
  if (value === null || value === undefined) return '—';
  switch (kind) {
    case 'currency': return currency.format(value);
    case 'integer':  return integer.format(value);
    case 'percent':  return percent.format(value);
    default:         return decimal.format(value);
  }
}

export function formatDelta(delta) {
  if (!delta) return { text: '—', cls: 'flat' };
  const cls = delta > 0 ? 'up' : 'down';
  return { text: `${delta > 0 ? '▲' : '▼'} ${percent.format(Math.abs(delta))} vs. período anterior`, cls };
}
