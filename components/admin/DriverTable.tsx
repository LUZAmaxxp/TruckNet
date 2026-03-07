"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Video, MessageSquare, MapPin, Search, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type DriverAdminEntry = {
  id: string;
  name: string;
  tag: string;
  profileImageUrl: string | null;
  role: "driver" | "admin";
  createdAt: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastSeenAt: string | null;
  isOnline: boolean;
};

interface DriverTableProps {
  drivers: DriverAdminEntry[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  status: "all" | "online" | "offline";
  searchValue: string;
  onPageChange: (page: number) => void;
  onSearch: (val: string) => void;
  onStatusChange: (val: "all" | "online" | "offline") => void;
}

function formatLastSeen(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * DriverTable — paginated, searchable, filterable table of all drivers.
 */
export function DriverTable({
  drivers,
  total,
  page,
  limit,
  loading,
  status,
  searchValue,
  onPageChange,
  onSearch,
  onStatusChange,
}: DriverTableProps) {
  const router = useRouter();
  const [callingId, setCallingId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchValue);
  const totalPages = Math.ceil(total / limit);

  // Debounce search
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    const t = setTimeout(() => onSearch(val), 400);
    setDebounceTimer(t);
  };

  const handleCall = async (driverId: string, type: "voice" | "video") => {
    try {
      setCallingId(driverId);
      const res = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calleeId: driverId, type }),
      });
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string };
        toast.error(error ?? "Failed to start call");
        return;
      }
      const { roomName, token, liveKitUrl } = (await res.json()) as {
        roomName: string;
        token: string;
        liveKitUrl: string;
      };
      sessionStorage.setItem(
        "trucknet_active_call",
        JSON.stringify({ roomName, type, token, liveKitUrl, role: "caller" })
      );
      router.push(`/admin/calls/${roomName}?type=${type}`);
    } catch {
      toast.error("Could not start call. Please try again.");
    } finally {
      setCallingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--muted)" }} />
          <input
            type="text"
            placeholder="Search by name or tag…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-[8px] pl-9 pr-3 py-2 font-body text-[13px] focus:outline-none focus:ring-2"
            style={{
              border: "1.5px solid var(--hairline)",
              background: "var(--base)",
              color: "var(--ink)",
            }}
          />
        </div>
        <div className="flex gap-1">
          {(["all", "online", "offline"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className="px-3 py-1.5 rounded-[8px] font-body text-[12px] font-semibold capitalize transition-colors"
              style={{
                background: status === s ? "var(--navy-lt)" : "var(--base)",
                color: status === s ? "var(--navy)" : "var(--muted)",
                border: status === s ? "1px solid var(--navy-pale)" : "1px solid var(--hairline)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[12px]" style={{ border: "1px solid var(--hairline)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--hairline)", background: "var(--base)" }}>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--subtle)" }}>Driver</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--subtle)" }}>Status</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide hidden md:table-cell" style={{ color: "var(--subtle)" }}>Last Location</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-wide hidden sm:table-cell" style={{ color: "var(--subtle)" }}>Last Seen</th>
              <th className="px-4 py-3 text-right font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--subtle)" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--hairline)" }}>
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-8 rounded-[8px] animate-pulse" style={{ background: "var(--hairline-2)" }} />
                    </td>
                  </tr>
                ))
              : drivers.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-body text-[13px]" style={{ color: "var(--muted)" }}>
                    No drivers found
                  </td>
                </tr>
              )
              : drivers.map((driver) => (
                  <tr
                    key={driver.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--hairline)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--base)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 shrink-0 overflow-hidden rounded-full flex items-center justify-center font-display text-[11px] font-bold"
                          style={{ background: "var(--navy-lt)", color: "var(--navy)" }}
                        >
                          {driver.profileImageUrl ? (
                            <img src={driver.profileImageUrl} alt={driver.name} className="h-full w-full object-cover" />
                          ) : (
                            driver.name[0]?.toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-body text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{driver.name}</p>
                          <p className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>@{driver.tag}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-[20px] px-[10px] py-[3px] font-body text-[11px] font-semibold"
                        style={{
                          background: driver.isOnline ? "var(--sage-lt)" : "var(--hairline-2)",
                          color: driver.isOnline ? "var(--sage)" : "var(--muted)",
                        }}
                      >
                        <span
                          className="h-[5px] w-[5px] rounded-full"
                          style={{ background: driver.isOnline ? "var(--sage-md)" : "var(--subtle)" }}
                        />
                        {driver.isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-[11px]" style={{ color: "var(--slate)" }}>
                      {driver.lastLatitude != null
                        ? `${driver.lastLatitude.toFixed(4)}, ${driver.lastLongitude!.toFixed(4)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell font-body text-[12px]" style={{ color: "var(--muted)" }}>
                      {formatLastSeen(driver.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => void handleCall(driver.id, "voice")}
                          disabled={callingId === driver.id}
                          title="Voice call"
                          className="rounded-[8px] p-1.5 transition-colors disabled:opacity-50"
                          style={{ color: "var(--slate)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--navy-lt)"; e.currentTarget.style.color = "var(--navy)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--slate)"; }}
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void handleCall(driver.id, "video")}
                          disabled={callingId === driver.id}
                          title="Video call"
                          className="rounded-[8px] p-1.5 transition-colors disabled:opacity-50"
                          style={{ color: "var(--slate)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--navy-lt)"; e.currentTarget.style.color = "var(--navy)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--slate)"; }}
                        >
                          <Video className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/messages/${driver.id}`)}
                          title="Send message"
                          className="rounded-[8px] p-1.5 transition-colors"
                          style={{ color: "var(--slate)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sage-lt)"; e.currentTarget.style.color = "var(--sage)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--slate)"; }}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        {driver.lastLatitude != null && (
                          <a
                            href={`/map?focus=${driver.id}`}
                            title="View on map"
                            className="rounded-[8px] p-1.5 transition-colors"
                            style={{ color: "var(--slate)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--honey-lt)"; e.currentTarget.style.color = "var(--honey)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--slate)"; }}
                          >
                            <MapPin className="h-4 w-4" />
                          </a>
                        )}
                        <Link
                          href={`/admin/drivers/${driver.id}`}
                          title="Driver detail & ESG"
                          className="rounded-[8px] p-1.5 transition-colors"
                          style={{ color: "var(--slate)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--navy-lt)"; e.currentTarget.style.color = "var(--navy)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--slate)"; }}
                        >
                          <ClipboardList className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between font-body text-[12px]" style={{ color: "var(--muted)" }}>
          <span>
            {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-[8px] p-1.5 disabled:opacity-30 transition-colors"
              style={{ color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hairline-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-[8px] p-1.5 disabled:opacity-30 transition-colors"
              style={{ color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hairline-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
