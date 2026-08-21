import { AlertTriangle } from "lucide-react";

interface CaveatBannerProps {
  n?: number;
  extra?: string;
}

export function CaveatBanner({ n, extra }: CaveatBannerProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-800">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>
        {n !== undefined && `n=${n}. `}
        Alle Kennzahlen sind rein deskriptiv und explorativ. Bei kleinem N (Ziel: 30–60) sind
        Effektgrößen und Konfidenzintervalle stark verrauscht — keine kausalen Schlüsse
        ziehen.{extra ? ` ${extra}` : ""}
      </span>
    </div>
  );
}
