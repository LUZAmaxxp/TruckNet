"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Props {
  driverId?: string;
  days?: number;
}

export function CertificationAlertBadge({ driverId, days = 90 }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!driverId) return;
    fetch(`/api/drivers/${driverId}/training/expiring?days=${days}`)
      .then((r) => r.json())
      .then((d: { records?: unknown[] }) => setCount(d.records?.length ?? 0))
      .catch(() => undefined);
  }, [driverId, days]);

  if (!count) return null;

  const href = driverId
    ? `/admin/drivers/${driverId}?tab=training`
    : "/admin/drivers";

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: "var(--terra-lt)", color: "var(--terra)" }}
    >
      <AlertTriangle className="h-3 w-3" />
      {count} cert{count > 1 ? "s" : ""} expiring
    </Link>
  );
}
