import { useState, useEffect } from "react";

/**
 * Debounces a value by the specified delay.
 * Returns the debounced value that only updates after the delay has passed
 * without any new values being set.
 *
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 500)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
