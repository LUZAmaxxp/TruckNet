"use client";

import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  speeding:          "Excès de vitesse",
  harsh_braking:     "Freinage brusque",
  harsh_acceleration: "Accél. brusque",
  swerve:            "Embardée",
  drowsiness:        "Somnolence",
  phone_use:         "Téléphone",
  idle_excess:       "Ralenti excessif",
};

const SEVERITY_STYLES: Record<string, string> = {
  low:      "bg-blue-100  text-blue-800  border-blue-200",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  high:     "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100   text-red-800   border-red-200",
};

const EVENT_COLORS: Record<string, string> = {
  speeding:           "bg-orange-100 text-orange-800 border-orange-200",
  harsh_braking:      "bg-red-100    text-red-800   border-red-200",
  harsh_acceleration: "bg-amber-100  text-amber-800 border-amber-200",
  swerve:             "bg-purple-100 text-purple-800 border-purple-200",
  drowsiness:         "bg-indigo-100 text-indigo-800 border-indigo-200",
  phone_use:          "bg-pink-100   text-pink-800  border-pink-200",
  idle_excess:        "bg-gray-100   text-gray-700  border-gray-200",
};

interface EventTypeBadgeProps {
  type:     string;
  severity?: string;
  /** If true, let the colour derive from type rather than severity */
  colorByType?: boolean;
  className?: string;
}

export function EventTypeBadge({
  type,
  severity,
  colorByType = false,
  className,
}: EventTypeBadgeProps) {
  const label  = EVENT_LABELS[type] ?? type.replace(/_/g, " ");
  const styles = colorByType
    ? (EVENT_COLORS[type] ?? "bg-gray-100 text-gray-700 border-gray-200")
    : severity
    ? (SEVERITY_STYLES[severity] ?? "bg-gray-100 text-gray-700 border-gray-200")
    : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight",
        styles,
        className
      )}
    >
      {label}
    </span>
  );
}
