interface BrandLogoProps {
  compact?: boolean;
  size?: "default" | "lg";
}

export function BrandLogo({ compact = false, size = "default" }: BrandLogoProps) {
  const sizeClass = compact
    ? "h-9 w-9 object-contain"
    : size === "lg"
      ? "w-[210px] h-auto max-h-20 object-contain"
      : "w-[155px] h-auto max-h-14 object-contain";

  return (
    <div className="flex items-center select-none">
      <img src="/brandlogo.svg" alt="YFounder CRM" className={sizeClass} />
    </div>
  );
}