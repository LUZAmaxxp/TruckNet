"use client";

interface AdminMessageBubbleProps {
  content: string;
  sentAt: Date | string;
  isSelf: boolean;
  senderAvatar?: string | null;
  senderName?: string;
}

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * AdminMessageBubble — a single message bubble in the admin conversation thread.
 */
export function AdminMessageBubble({
  content,
  sentAt,
  isSelf,
  senderAvatar,
  senderName,
}: AdminMessageBubbleProps) {
  return (
    <div className={`flex items-end gap-2 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isSelf && (
        <div className="flex-shrink-0 h-7 w-7 rounded-full overflow-hidden flex items-center justify-center font-display text-[11px] font-bold" style={{ background: "var(--navy-lt)", color: "var(--navy)" }}>
          {senderAvatar ? (
            <img src={senderAvatar} alt={senderName ?? ""} className="h-full w-full object-cover" />
          ) : (
            (senderName?.[0] ?? "?").toUpperCase()
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className="max-w-[70%] px-4 py-2"
        style={isSelf ? {
          background: "var(--navy)",
          color: "rgba(255,255,255,0.95)",
          borderRadius: "14px 14px 4px 14px",
          boxShadow: "0 2px 8px rgba(28,58,94,0.25)",
        } : {
          background: "var(--surface)",
          color: "var(--ink)",
          border: "1px solid var(--hairline)",
          borderRadius: "14px 14px 14px 4px",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        {!isSelf && senderName && (
          <p className="font-mono text-[10px] mb-0.5" style={{ color: "var(--subtle)" }}>{senderName}</p>
        )}
        <p className="break-words whitespace-pre-wrap font-body text-[13px]">{content}</p>
        <p className="font-mono text-[10px] mt-1" style={{ color: isSelf ? "rgba(255,255,255,0.55)" : "var(--subtle)" }}>
          {formatTime(sentAt)}
        </p>
      </div>
    </div>
  );
}
