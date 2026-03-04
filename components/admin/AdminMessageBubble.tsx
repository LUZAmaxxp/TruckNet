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
        <div className="flex-shrink-0 h-7 w-7 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
          {senderAvatar ? (
            <img src={senderAvatar} alt={senderName ?? ""} className="h-full w-full object-cover" />
          ) : (
            (senderName?.[0] ?? "?").toUpperCase()
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
          isSelf
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-700 text-gray-100 rounded-bl-sm"
        }`}
      >
        {!isSelf && senderName && (
          <p className="text-[10px] font-medium text-gray-400 mb-0.5">{senderName}</p>
        )}
        <p className="break-words whitespace-pre-wrap">{content}</p>
        <p className={`text-[10px] mt-1 ${isSelf ? "text-blue-200" : "text-gray-500"}`}>
          {formatTime(sentAt)}
        </p>
      </div>
    </div>
  );
}
