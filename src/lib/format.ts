export function formatCurrency(amountInDollars: number, locale = "en-US") {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amountInDollars);
}

export function formatCurrencyCompact(amountInDollars: number, locale = "en-US") {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return formatter.format(amountInDollars);
}

export function formatDateShort(isoDate?: string, locale = "en-US") {
  if (!isoDate) return "TBD";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Format a number as currency input with commas (no currency symbol)
 * Used for displaying currency in input fields
 * @example formatCurrencyInput(1234567) // "1,234,567"
 */
export function formatCurrencyInput(value: number | string): string {
  const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

/**
 * Parse a currency input string (with commas) back to a number
 * @example parseCurrencyInput("1,234,567") // 1234567
 * @example parseCurrencyInput("$1,234") // 1234
 */
export function parseCurrencyInput(value: string): number {
  // Remove all non-digit characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.floor(parsed);
}

/**
 * Format next call date source for display
 * @param source - The source of the next call date
 * @returns Human-readable label
 */
export function formatNextCallDateSource(
  source: 'auto_calendar' | 'auto_gong' | 'auto_granola' | 'manual' | null | undefined
): string {
  if (!source) return '';

  const labels = {
    auto_calendar: 'From Calendar',
    auto_gong: 'From Gong',
    auto_granola: 'From Granola',
    manual: 'Manual'
  };

  return labels[source] || '';
}


