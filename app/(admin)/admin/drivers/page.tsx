"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileBarChart, Calendar } from "lucide-react";
import { DriverTable } from "@/components/admin/DriverTable";
import type { DriverAdminEntry } from "@/components/admin/DriverTable";

/**
 * /admin/drivers — Paginated table of all registered drivers.
 */
export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverAdminEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "online" | "offline">("all");
  const [loading, setLoading] = useState(true);

  const limit = 20;

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/admin/drivers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void fetchDrivers();
  }, [fetchDrivers]);

  // Reset to page 1 when search/status changes
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };
  const handleStatusChange = (val: "all" | "online" | "offline") => {
    setStatus(val);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.03em]" style={{ color: "var(--ink)" }}>Drivers</h1>
          <p className="font-body text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            All registered drivers — {total} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/drivers/schedule"
            className="flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
            <Calendar className="h-4 w-4" />
            Schedules
          </Link>
          <Link href="/admin/drivers/esg-reports"
            className="flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-[13px] font-medium"
            style={{ borderColor: "var(--hairline)", color: "var(--muted)" }}>
            <FileBarChart className="h-4 w-4" />
            ESG Reports
          </Link>
        </div>
      </div>

      <DriverTable
        drivers={drivers}
        total={total}
        page={page}
        limit={limit}
        loading={loading}
        onPageChange={setPage}
        onSearch={handleSearch}
        onStatusChange={handleStatusChange}
        status={status}
        searchValue={search}
      />
    </div>
  );
}
