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
    <div
      className="rounded-[12px] p-4"
      style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="h-12 w-12 overflow-hidden rounded-full flex items-center justify-center font-display text-[16px] font-bold"
            style={{ background: "var(--navy-lt)", color: "var(--navy)" }}
          >
            {driver.profileImageUrl ? (
              <img src={driver.profileImageUrl} alt={driver.name} className="h-full w-full object-cover" />
            ) : (
              driver.name[0]?.toUpperCase()
            )}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2"
            style={{
              background: driver.isOnline ? "var(--sage-md)" : "var(--subtle)",
              borderColor: "var(--surface)",
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-body font-semibold truncate" style={{ color: "var(--ink)" }}>{driver.name}</p>
          <p className="font-mono text-[11px]" style={{ color: "var(--subtle)" }}>@{driver.tag}</p>
          <div className="flex items-center gap-1 mt-1">
            {driver.isOnline ? (
              <Wifi className="h-3 w-3" style={{ color: "var(--sage)" }} />
            ) : (
              <WifiOff className="h-3 w-3" style={{ color: "var(--muted)" }} />
            )}
            <span className="font-body text-[11px]" style={{ color: driver.isOnline ? "var(--sage)" : "var(--muted)" }}>
              {driver.isOnline ? "Online" : `Last seen ${formatLastSeen(driver.lastSeenAt)}`}
            </span>
          </div>
          {driver.lastLatitude != null && (
            <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--slate)" }}>
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
          className="flex-1 flex items-center justify-center gap-1.5 rounded-[8px] py-2 font-body text-[12px] font-semibold transition-colors disabled:opacity-60"
          style={{ background: "var(--navy-lt)", color: "var(--navy)" }}
        >
          <Phone className="h-3.5 w-3.5" />
          {callingId === "voice" ? "…" : "Voice"}
        </button>
        <button
          disabled={!!callingId}
          onClick={() => void handleCall("video")}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-[8px] py-2 font-body text-[12px] font-semibold transition-colors disabled:opacity-60"
          style={{ background: "var(--slate-lt)", color: "var(--slate)" }}
        >
          <Video className="h-3.5 w-3.5" />
          Video
        </button>
        <button
          onClick={() => router.push(`/admin/messages/${driver.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-[8px] py-2 font-body text-[12px] font-semibold transition-colors"
          style={{ background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--ink)" }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message
        </button>
        {driver.lastLatitude != null && (
          <a
            href={`/map?focus=${driver.id}`}
            title="View on map"
            className="flex items-center justify-center rounded-[8px] px-2.5 py-2 transition-colors"
            style={{ background: "var(--base)", border: "1px solid var(--hairline)", color: "var(--slate)" }}
          >
            <MapPin className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
