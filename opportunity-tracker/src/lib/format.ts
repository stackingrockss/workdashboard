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


