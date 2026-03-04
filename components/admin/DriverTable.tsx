"use client";

import { useState } from "react";
import { Phone, Video, MessageSquare, MapPin, Search, ChevronLeft, ChevronRight } from "lucide-react";
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or tag…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "online", "offline"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                status === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900">
              <th className="px-4 py-3 text-left font-medium text-gray-400">Driver</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400 hidden md:table-cell">Last Location</th>
              <th className="px-4 py-3 text-left font-medium text-gray-400 hidden sm:table-cell">Last Seen</th>
              <th className="px-4 py-3 text-right font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-8 rounded-lg bg-gray-800 animate-pulse" />
                    </td>
                  </tr>
                ))
              : drivers.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No drivers found
                  </td>
                </tr>
              )
              : drivers.map((driver) => (
                  <tr key={driver.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                          {driver.profileImageUrl ? (
                            <img src={driver.profileImageUrl} alt={driver.name} className="h-full w-full object-cover" />
                          ) : (
                            driver.name[0]?.toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{driver.name}</p>
                          <p className="text-xs text-gray-500">@{driver.tag}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          driver.isOnline
                            ? "bg-green-600/20 text-green-400"
                            : "bg-gray-700/50 text-gray-400"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${driver.isOnline ? "bg-green-400" : "bg-gray-500"}`} />
                        {driver.isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-400 text-xs font-mono">
                      {driver.lastLatitude != null
                        ? `${driver.lastLatitude.toFixed(4)}, ${driver.lastLongitude!.toFixed(4)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">
                      {formatLastSeen(driver.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => void handleCall(driver.id, "voice")}
                          disabled={callingId === driver.id}
                          title="Voice call"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-600/20 hover:text-blue-400 transition-colors disabled:opacity-50"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void handleCall(driver.id, "video")}
                          disabled={callingId === driver.id}
                          title="Video call"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-purple-600/20 hover:text-purple-400 transition-colors disabled:opacity-50"
                        >
                          <Video className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/messages/${driver.id}`)}
                          title="Send message"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-green-600/20 hover:text-green-400 transition-colors"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        {driver.lastLatitude != null && (
                          <a
                            href={`/map?focus=${driver.id}`}
                            title="View on map"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-yellow-600/20 hover:text-yellow-400 transition-colors"
                          >
                            <MapPin className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg p-1.5 hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg p-1.5 hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
