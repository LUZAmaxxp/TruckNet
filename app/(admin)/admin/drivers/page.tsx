"use client";

import { useCallback, useEffect, useState } from "react";
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
      <div>
        <h1 className="text-2xl font-bold text-white">Drivers</h1>
        <p className="text-sm text-gray-400 mt-1">
          All registered drivers — {total} total
        </p>
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
