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

/**
 * @param {number} delta variação relativa (0.083 = +8,3%)
 * @param {boolean} invert true quando subir é mau (CPR, desconto) —
 *        a seta continua a apontar a direção real, só a cor inverte.
 */
export function formatDelta(delta, invert = false) {
  if (!delta) return { text: '—', cls: 'flat' };
  const good = invert ? delta < 0 : delta > 0;
  return {
    text: `${delta > 0 ? '▲' : '▼'} ${percent.format(Math.abs(delta))} vs. período anterior`,
    cls: good ? 'up' : 'down'
  };
}
