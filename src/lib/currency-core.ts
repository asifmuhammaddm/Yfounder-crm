export type CurrencyCode =
  | "INR"
  | "AED"
  | "USD"
  | "SAR"
  | "QAR"
  | "KWD"
  | "BHD"
  | "OMR";

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  region: "India" | "GCC" | "Global";
  flag: string;
  decimals: number;
  locale: string;
}

export const CURRENCY_OPTIONS: CurrencyMeta[] = [
  { code: "INR", name: "Indian Rupee", region: "India", flag: "🇮🇳", decimals: 2, locale: "en-IN" },
  { code: "AED", name: "UAE Dirham", region: "GCC", flag: "🇦🇪", decimals: 2, locale: "en-US" },
  { code: "USD", name: "US Dollar", region: "Global", flag: "🇺🇸", decimals: 2, locale: "en-US" },
  { code: "SAR", name: "Saudi Riyal", region: "GCC", flag: "🇸🇦", decimals: 2, locale: "en-US" },
  { code: "QAR", name: "Qatari Riyal", region: "GCC", flag: "🇶🇦", decimals: 2, locale: "en-US" },
  { code: "KWD", name: "Kuwaiti Dinar", region: "GCC", flag: "🇰🇼", decimals: 3, locale: "en-US" },
  { code: "BHD", name: "Bahraini Dinar", region: "GCC", flag: "🇧🇭", decimals: 3, locale: "en-US" },
  { code: "OMR", name: "Omani Rial", region: "GCC", flag: "🇴🇲", decimals: 3, locale: "en-US" },
];

export const DEFAULT_FX_RATES_TO_INR: Record<CurrencyCode, number> = {
  INR: 1,
  AED: 23.5,
  USD: 86.5,
  SAR: 23.05,
  QAR: 23.75,
  KWD: 281.0,
  BHD: 229.4,
  OMR: 224.65,
};

export function isValidCurrency(
  value: string | null | undefined
): value is CurrencyCode {
  return CURRENCY_OPTIONS.some((c) => c.code === value);
}

export function normalizeCurrency(
  value: string | null | undefined
): CurrencyCode {
  return isValidCurrency(value) ? value : "INR";
}

export function getCurrencyMeta(code: CurrencyCode): CurrencyMeta {
  return (
    CURRENCY_OPTIONS.find((item) => item.code === code) ?? CURRENCY_OPTIONS[0]
  );
}

export function formatCurrencyAmount(
  amount: number | string | null | undefined,
  currency: CurrencyCode | string | null | undefined
): string {
  const numeric = Number(amount ?? 0);
  const safeValue = Number.isNaN(numeric) ? 0 : numeric;
  const meta = getCurrencyMeta(normalizeCurrency(currency));
  const hasDecimals = Math.abs(safeValue % 1) > 0.0001;

  const formattedNumber = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: hasDecimals ? meta.decimals : 0,
    maximumFractionDigits: hasDecimals ? meta.decimals : 0,
  }).format(safeValue);

  return `${meta.code} ${formattedNumber}`;
}

export function convertCurrencyAmount(
  amount: number | string | null | undefined,
  fromCurrency: CurrencyCode | string | null | undefined,
  toCurrency: CurrencyCode | string | null | undefined,
  fxRatesToInr?: Partial<Record<CurrencyCode, number>> | null
): number {
  const numeric = Number(amount ?? 0);
  if (Number.isNaN(numeric) || numeric === 0) return 0;

  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return numeric;

  const rates: Record<CurrencyCode, number> = {
    ...DEFAULT_FX_RATES_TO_INR,
    ...(fxRatesToInr ?? {}),
  };

  const fromRateInInr =
    Number(rates[from]) > 0 ? Number(rates[from]) : DEFAULT_FX_RATES_TO_INR[from];
  const toRateInInr =
    Number(rates[to]) > 0 ? Number(rates[to]) : DEFAULT_FX_RATES_TO_INR[to];

  const amountInInr = numeric * fromRateInInr;
  return amountInInr / toRateInInr;
}

export function sumConvertedAmounts(
  items: Array<{
    amount: number | string | null | undefined;
    currency?: CurrencyCode | string | null;
  }>,
  toCurrency: CurrencyCode | string | null | undefined,
  fxRatesToInr?: Partial<Record<CurrencyCode, number>> | null
): number {
  return items.reduce((total, item) => {
    return (
      total +
      convertCurrencyAmount(
        item.amount,
        item.currency ?? "INR",
        toCurrency,
        fxRatesToInr
      )
    );
  }, 0);
}