import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * CurrencyInput component
 *
 * Automatically formats numbers with commas as the user types.
 * Stores the actual numeric value internally.
 *
 * @example
 * const [amount, setAmount] = useState(0);
 * <CurrencyInput value={amount} onChange={setAmount} placeholder="0" />
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    // Track the display value (with commas) separately from the numeric value
    const [displayValue, setDisplayValue] = React.useState(() =>
      value > 0 ? formatCurrencyInput(value) : ""
    );

    // Update display value when prop value changes (e.g., form reset or external update)
    React.useEffect(() => {
      setDisplayValue(value > 0 ? formatCurrencyInput(value) : "");
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty string
      if (inputValue === "") {
        setDisplayValue("");
        onChange(0);
        return;
      }

      // Parse the input to get numeric value
      const numericValue = parseCurrencyInput(inputValue);

      // Update the display value with formatted number
      const formatted = formatCurrencyInput(numericValue);
      setDisplayValue(formatted);

      // Call onChange with the numeric value
      onChange(numericValue);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        className={className}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
