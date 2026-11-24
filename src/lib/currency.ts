"use client";

import { useCallback, useEffect, useState } from "react";
import { isValidCurrency, type CurrencyCode } from "./currency-core";

export * from "./currency-core";

const STORAGE_KEY = "yfounder_crm_currency";
const CURRENCY_EVENT = "yfounder:currency-change";

export function useWorkspaceCurrency(
  defaultCurrency: CurrencyCode = "INR"
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