"use client";

import { useCallback, useEffect, useState } from "react";

export type CurrencyCode =
  | "AED"
  | "SAR"
  | "QAR"
  | "KWD"
  | "BHD"
  | "OMR"
  | "INR"
  | "USD";

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  region: "GCC" | "India" | "Global";
  flag: string;
  decimals: number;
  locale: string;
}

export const CURRENCY_OPTIONS: CurrencyMeta[] = [
  { code: "AED", name: "UAE Dirham", region: "GCC", flag: "🇦🇪", decimals: 2, locale: "en-US" },
  { code: "SAR", name: "Saudi Riyal", region: "GCC", flag: "🇸🇦", decimals: 2, locale: "en-US" },
  { code: "QAR", name: "Qatari Riyal", region: "GCC", flag: "🇶🇦", decimals: 2, locale: "en-US" },
  { code: "KWD", name: "Kuwaiti Dinar", region: "GCC", flag: "🇰🇼", decimals: 3, locale: "en-US" },
  { code: "BHD", name: "Bahraini Dinar", region: "GCC", flag: "🇧🇭", decimals: 3, locale: "en-US" },
  { code: "OMR", name: "Omani Rial", region: "GCC", flag: "🇴🇲", decimals: 3, locale: "en-US" },
  { code: "INR", name: "Indian Rupee", region: "India", flag: "🇮🇳", decimals: 2, locale: "en-IN" },
  { code: "USD", name: "US Dollar", region: "Global", flag: "🇺🇸", decimals: 2, locale: "en-US" },
];

const STORAGE_KEY = "yfounder_crm_currency";
const CURRENCY_EVENT = "yfounder:currency-change";

function isValidCurrency(value: string | null): value is CurrencyCode {
  return CURRENCY_OPTIONS.some((c) => c.code === value);
}

export function getCurrencyMeta(code: CurrencyCode): CurrencyMeta {
  return (
    CURRENCY_OPTIONS.find((item) => item.code === code) ?? CURRENCY_OPTIONS[0]
  );
}

export function formatCurrencyAmount(
  amount: number | string | null | undefined,
  currency: CurrencyCode
): string {
  const numeric = Number(amount ?? 0);
  const safeValue = Number.isNaN(numeric) ? 0 : numeric;
  const meta = getCurrencyMeta(currency);
  const hasDecimals = Math.abs(safeValue % 1) > 0.0001;

  const formattedNumber = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: hasDecimals ? meta.decimals : 0,
    maximumFractionDigits: hasDecimals ? meta.decimals : 0,
  }).format(safeValue);

  return `${meta.code} ${formattedNumber}`;
}

export function useWorkspaceCurrency(
  defaultCurrency: CurrencyCode = "AED"
): [CurrencyCode, (next: CurrencyCode) => void] {
  const [currency, setCurrencyState] = useState<CurrencyCode>(defaultCurrency);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isValidCurrency(saved)) {
      setCurrencyState(saved);
    }

    function handleSync(event: Event) {
      const customEvent = event as CustomEvent<CurrencyCode>;
      if (isValidCurrency(customEvent.detail)) {
        setCurrencyState(customEvent.detail);
      }
    }

    window.addEventListener(CURRENCY_EVENT, handleSync);
    return () => window.removeEventListener(CURRENCY_EVENT, handleSync);
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(
      new CustomEvent<CurrencyCode>(CURRENCY_EVENT, { detail: next })
    );
  }, []);

  return [currency, setCurrency];
}