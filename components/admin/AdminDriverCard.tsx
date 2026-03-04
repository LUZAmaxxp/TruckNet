"use client";

import { useState } from "react";
import { Phone, Video, MessageSquare, MapPin, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DriverAdminEntry } from "@/components/admin/DriverTable";

interface AdminDriverCardProps {
  driver: DriverAdminEntry;
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
 * AdminDriverCard — driver detail card used in admin views.
 * Shows avatar, name, tag, online status, last seen, GPS, and contact actions.
 */
export function AdminDriverCard({ driver }: AdminDriverCardProps) {
  const router = useRouter();
  const [callingId, setCallingId] = useState<string | null>(null);

  const handleCall = async (type: "voice" | "video") => {
    try {
      setCallingId(type);
      const res = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calleeId: driver.id, type }),
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
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-700 flex items-center justify-center text-base font-bold text-gray-300">
            {driver.profileImageUrl ? (
              <img src={driver.profileImageUrl} alt={driver.name} className="h-full w-full object-cover" />
            ) : (
              driver.name[0]?.toUpperCase()
            )}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-gray-800 ${
              driver.isOnline ? "bg-green-500" : "bg-gray-500"
            }`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{driver.name}</p>
          <p className="text-xs text-gray-400">@{driver.tag}</p>
          <div className="flex items-center gap-1 mt-1">
            {driver.isOnline ? (
              <Wifi className="h-3 w-3 text-green-400" />
            ) : (
              <WifiOff className="h-3 w-3 text-gray-500" />
            )}
            <span className={`text-[11px] ${driver.isOnline ? "text-green-400" : "text-gray-500"}`}>
              {driver.isOnline ? "Online" : `Last seen ${formatLastSeen(driver.lastSeenAt)}`}
            </span>
          </div>
          {driver.lastLatitude != null && (
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              {driver.lastLatitude.toFixed(5)}, {driver.lastLongitude!.toFixed(5)}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          disabled={!!callingId}
          onClick={() => void handleCall("voice")}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          <Phone className="h-3.5 w-3.5" />
          {callingId === "voice" ? "…" : "Voice"}
        </button>
        <button
          disabled={!!callingId}
          onClick={() => void handleCall("video")}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2 text-xs font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-60"
        >
          <Video className="h-3.5 w-3.5" />
          Video
        </button>
        <button
          onClick={() => router.push(`/admin/messages/${driver.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-gray-700 py-2 text-xs font-medium text-white hover:bg-gray-600 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message
        </button>
        {driver.lastLatitude != null && (
          <a
            href={`/map?focus=${driver.id}`}
            title="View on map"
            className="flex items-center justify-center rounded-lg bg-gray-700 px-2.5 py-2 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            <MapPin className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
