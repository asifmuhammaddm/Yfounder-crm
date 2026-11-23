"use client";

import { CURRENCY_OPTIONS, type CurrencyCode } from "@/lib/currency";

interface CurrencySelectProps {
  value: CurrencyCode;
  onChange: (next: CurrencyCode) => void;
  className?: string;
}

export function CurrencySelect({
  value,
  onChange,
  className = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#084154] focus:border-[#4b8f9a] focus:outline-none",
}: CurrencySelectProps) {
  return (
    <select
      aria-label="Select currency"
      value={value}
      onChange={(e) => onChange(e.target.value as CurrencyCode)}
      className={className}
    >
      <optgroup label="GCC Currencies">
        {CURRENCY_OPTIONS.filter((c) => c.region === "GCC").map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code} · {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="India & Global">
        {CURRENCY_OPTIONS.filter((c) => c.region !== "GCC").map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code} · {c.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}