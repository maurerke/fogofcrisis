import * as React from "react";

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (val: string) => void;
}

export function RadioGroup({ name, options, value, onChange }: RadioGroupProps) {
  return (
    <div className="flex flex-wrap gap-4 my-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-1.5 cursor-pointer text-sm text-[var(--color-study-text-muted)]"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-[var(--color-brand-500)]"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
