/**
 * Utility functions for calculating fiscal quarters based on a configurable fiscal year start month.
 *
 * @example
 * // Calendar year (fiscal year starts in January)
 * getQuarterFromDate(new Date('2025-03-15'), 1) // => "Q1 2025"
 *
 * @example
 * // Fiscal year starting in April
 * getQuarterFromDate(new Date('2025-03-15'), 4) // => "Q4 2024"
 * getQuarterFromDate(new Date('2025-04-15'), 4) // => "Q1 2025"
 */

/**
 * Parse an ISO date string (YYYY-MM-DD) to a Date object in local timezone.
 * This prevents timezone shifts that occur when using `new Date("YYYY-MM-DD")`.
 *
 * @param isoString - ISO date string in format YYYY-MM-DD
 * @returns Date object in local timezone representing the date
 */
export function parseISODateSafe(isoString: string): Date {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate the quarter string from a date based on fiscal year start month.
 *
 * @param date - The date to calculate quarter for
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns Quarter string in format "Q1 2025"
 */
export function getQuarterFromDate(
  date: Date,
  fiscalYearStartMonth: number = 1
): string {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();

  // Calculate months from fiscal year start
  // Adjust month to be relative to fiscal year start
  let monthsFromFiscalStart = month - (fiscalYearStartMonth - 1);

  // Handle wrap-around for months before fiscal year start
  if (monthsFromFiscalStart < 0) {
    monthsFromFiscalStart += 12;
  }

  // Calculate quarter (1-4)
  const quarter = Math.floor(monthsFromFiscalStart / 3) + 1;

  // Calculate fiscal year
  // If we're before the fiscal year start month, we're in the previous fiscal year
  let fiscalYear = year;
  if (month < fiscalYearStartMonth - 1) {
    fiscalYear = year - 1;
  }

  return `Q${quarter} ${fiscalYear}`;
}

/**
 * Get the start and end dates for a given quarter string.
 *
 * @param quarterString - Quarter string like "Q1 2025"
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns Object with start and end dates for the quarter
 */
export function getQuarterDateRange(
  quarterString: string,
  fiscalYearStartMonth: number = 1
): { start: Date; end: Date } {
  // Parse quarter string like "Q1 2025"
  const match = quarterString.match(/Q(\d)\s+(\d{4})/);
  if (!match) {
    throw new Error(`Invalid quarter string format: ${quarterString}. Expected format: "Q1 2025"`);
  }

  const quarter = parseInt(match[1], 10);
  const fiscalYear = parseInt(match[2], 10);

  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter: ${quarter}. Must be between 1 and 4.`);
  }

  // Calculate the starting month of the quarter
  const quarterStartMonth = fiscalYearStartMonth + (quarter - 1) * 3;

  // Handle month wrap-around
  let startMonth = quarterStartMonth - 1; // Convert to 0-indexed
  let startYear = fiscalYear;

  if (quarterStartMonth > 12) {
    startMonth = (quarterStartMonth - 1) % 12;
    startYear = fiscalYear + Math.floor((quarterStartMonth - 1) / 12);
  }

  // Start date is the first day of the first month in the quarter
  const start = new Date(startYear, startMonth, 1);

  // End date is the last day of the third month in the quarter
  const endMonth = (startMonth + 3) % 12;
  const endYear = startMonth + 3 >= 12 ? startYear + 1 : startYear;
  const end = new Date(endYear, endMonth, 0); // Day 0 gives us the last day of the previous month

  return { start, end };
}

/**
 * Format a quarter number and year into a standard quarter string.
 *
 * @param quarter - Quarter number (1-4)
 * @param year - Fiscal year
 * @returns Formatted quarter string like "Q1 2025"
 */
export function formatQuarter(quarter: number, year: number): string {
  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter: ${quarter}. Must be between 1 and 4.`);
  }
  return `Q${quarter} ${year}`;
}

/**
 * Get the fiscal year start month name.
 *
 * @param fiscalYearStartMonth - Month number (1-12)
 * @returns Month name
 */
export function getFiscalYearStartMonthName(fiscalYearStartMonth: number): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return monthNames[fiscalYearStartMonth - 1] || "January";
}

/**
 * Get all month options for fiscal year start.
 */
export const FISCAL_YEAR_MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

/**
 * Get the current quarter based on today's date and fiscal year start month.
 *
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns Object containing quarter number, fiscal year, and formatted quarter string
 *
 * @example
 * // If today is October 13, 2025 and fiscal year starts in January
 * getCurrentQuarter(1) // => { quarter: 4, fiscalYear: 2025, quarterString: "Q4 2025" }
 */
export function getCurrentQuarter(fiscalYearStartMonth: number = 1): {
  quarter: number;
  fiscalYear: number;
  quarterString: string;
} {
  const now = new Date();
  return getQuarterDetailsFromDate(now, fiscalYearStartMonth);
}

/**
 * Get quarter details from a specific date.
 *
 * @param date - The date to get quarter details for
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns Object containing quarter number, fiscal year, and formatted quarter string
 */
export function getQuarterDetailsFromDate(
  date: Date,
  fiscalYearStartMonth: number = 1
): {
  quarter: number;
  fiscalYear: number;
  quarterString: string;
} {
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();

  // Calculate months from fiscal year start
  let monthsFromFiscalStart = month - (fiscalYearStartMonth - 1);
  if (monthsFromFiscalStart < 0) {
    monthsFromFiscalStart += 12;
  }

  // Calculate quarter (1-4)
  const quarter = Math.floor(monthsFromFiscalStart / 3) + 1;

  // Calculate fiscal year
  let fiscalYear = year;
  if (month < fiscalYearStartMonth - 1) {
    fiscalYear = year - 1;
  }

  const quarterString = `Q${quarter} ${fiscalYear}`;

  return { quarter, fiscalYear, quarterString };
}

/**
 * Get the next N quarters starting from the current quarter.
 *
 * @param count - Number of quarters to return (including current quarter)
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns Array of quarter strings in chronological order
 *
 * @example
 * // If current quarter is Q3 2025 and fiscal year starts in January
 * getNextQuarters(4, 1) // => ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"]
 */
export function getNextQuarters(
  count: number,
  fiscalYearStartMonth: number = 1
): string[] {
  const current = getCurrentQuarter(fiscalYearStartMonth);
  const quarters: string[] = [current.quarterString];

  let q = current.quarter;
  let y = current.fiscalYear;

  for (let i = 1; i < count; i++) {
    q++;
    if (q > 4) {
      q = 1;
      y++;
    }
    quarters.push(`Q${q} ${y}`);
  }

  return quarters;
}

/**
 * Format the month range for a quarter (e.g., "Jan - Mar").
 *
 * @param quarterString - Quarter string like "Q1 2025"
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns Formatted month range (e.g., "Jan - Mar")
 */
export function getQuarterMonthRange(
  quarterString: string,
  fiscalYearStartMonth: number = 1
): string {
  const { start, end } = getQuarterDateRange(quarterString, fiscalYearStartMonth);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const startMonth = monthNames[start.getMonth()];
  const endMonth = monthNames[end.getMonth()];

  return `${startMonth} - ${endMonth}`;
}

/**
 * Determine the status of a quarter relative to the current date.
 *
 * @param quarterString - Quarter string like "Q1 2025"
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns "past" | "current" | "future"
 */
export function getQuarterStatus(
  quarterString: string,
  fiscalYearStartMonth: number = 1
): "past" | "current" | "future" {
  const { start, end } = getQuarterDateRange(quarterString, fiscalYearStartMonth);
  const now = new Date();

  // If today is before the quarter starts, it's future
  if (now < start) {
    return "future";
  }

  // If today is after the quarter ends, it's past
  if (now > end) {
    return "past";
  }

  // Otherwise, it's current
  return "current";
}

/**
 * Get previous N quarters starting from the current quarter (going backwards).
 *
 * @param count - Number of quarters to return (not including current quarter)
 * @param fiscalYearStartMonth - Month when fiscal year starts (1=January, 2=February, etc.)
 * @returns Array of quarter strings in chronological order (oldest to newest)
 *
 * @example
 * // If current quarter is Q3 2025 and fiscal year starts in January
 * getPreviousQuarters(2, 1) // => ["Q1 2025", "Q2 2025"]
 */
export function getPreviousQuarters(
  count: number,
  fiscalYearStartMonth: number = 1
): string[] {
  const current = getCurrentQuarter(fiscalYearStartMonth);
  const quarters: string[] = [];

  let q = current.quarter;
  let y = current.fiscalYear;

  for (let i = 0; i < count; i++) {
    q--;
    if (q < 1) {
      q = 4;
      y--;
    }
    quarters.unshift(`Q${q} ${y}`);
  }

  return quarters;
}
