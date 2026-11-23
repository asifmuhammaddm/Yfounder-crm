"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export interface CountryDialCode {
  code: string;
  iso: string;
  name: string;
  flag: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { code: "+971", iso: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "+91", iso: "IN", name: "India", flag: "🇮🇳" },
  { code: "+966", iso: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+974", iso: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "+968", iso: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "+973", iso: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "+965", iso: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "+44", iso: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+1", iso: "US", name: "US / Canada", flag: "🇺🇸" },
  { code: "+65", iso: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "+61", iso: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "+49", iso: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "+33", iso: "FR", name: "France", flag: "🇫🇷" },
  { code: "+31", iso: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "+41", iso: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "+962", iso: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "+961", iso: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "+20", iso: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "+92", iso: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "+880", iso: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "+94", iso: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "+60", iso: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "+62", iso: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "+63", iso: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "+81", iso: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "+86", iso: "CN", name: "China", flag: "🇨🇳" },
  { code: "+27", iso: "ZA", name: "South Africa", flag: "🇿🇦" },
];

const SORTED_BY_LENGTH = [...COUNTRY_DIAL_CODES].sort(
  (a, b) => b.code.length - a.code.length
);

function parsePhoneValue(raw: string, fallbackCode: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { dialCode: fallbackCode, localNumber: "" };
  }

  for (const entry of SORTED_BY_LENGTH) {
    if (trimmed.startsWith(entry.code)) {
      return {
        dialCode: entry.code,
        localNumber: trimmed.slice(entry.code.length).trim(),
      };
    }
  }

  return { dialCode: fallbackCode, localNumber: trimmed };
}

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (fullPhone: string) => void;
  defaultDialCode?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PhoneInput({
  id,
  value,
  onChange,
  defaultDialCode = "+971",
  placeholder = "50 123 4567",
  disabled = false,
}: PhoneInputProps) {
  const parsed = parsePhoneValue(value, defaultDialCode);
  const [selectedCode, setSelectedCode] = useState<string>(parsed.dialCode);

  useEffect(() => {
    if (value.trim()) {
      const updated = parsePhoneValue(value, selectedCode);
      setSelectedCode(updated.dialCode);
    }
  }, [value]);

  const activeCode = value.trim() ? parsed.dialCode : selectedCode;
  const localNumber = parsed.localNumber;

  function handleCodeChange(newCode: string) {
    setSelectedCode(newCode);
    if (localNumber.trim()) {
      onChange(`${newCode} ${localNumber.trim()}`);
    }
  }

  function handleNumberChange(nextLocal: string) {
    const cleaned = nextLocal.replace(/^\+\d+\s*/, "");
    if (!cleaned.trim()) {
      onChange("");
    } else {
      onChange(`${activeCode} ${cleaned}`);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Country dial code"
        value={activeCode}
        disabled={disabled}
        onChange={(e) => handleCodeChange(e.target.value)}
        className="h-9 w-[108px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-[#084154] focus:border-[#4b8f9a] focus:outline-none"
      >
        {COUNTRY_DIAL_CODES.map((country) => (
          <option key={`${country.iso}-${country.code}`} value={country.code}>
            {country.flag} {country.code} ({country.iso})
          </option>
        ))}
      </select>

      <Input
        id={id}
        type="tel"
        inputMode="tel"
        disabled={disabled}
        placeholder={placeholder}
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        className="min-w-0 flex-1"
      />
    </div>
  );
}