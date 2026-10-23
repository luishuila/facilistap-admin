/** Moneda que se usa cuando un registro no trae la suya. */
export const DEFAULT_CURRENCY = 'COP';

/** Símbolo corto de la moneda ("$" para COP, MXN, CLP y USD; "€" para EUR). */
export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value || '$';
  } catch {
    return '$';
  }
}

/**
 * Dinero para mostrar: 20000 -> "$ 20.000 COP". Siempre lleva el código al final, porque el "$"
 * solo no dice si son pesos colombianos, mexicanos, chilenos o dólares.
 */
export function formatMoney(value: number | string | null | undefined, currency?: string | null, decimals = 0): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const n = Number(value) || 0;
  const amount = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${n < 0 ? '-' : ''}${currencySymbol(code)} ${amount} ${code}`;
}
