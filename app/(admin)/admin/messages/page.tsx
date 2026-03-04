"use client";

import { useState } from "react";
import { AdminConversationList } from "@/components/admin/AdminConversationList";
import { AdminConversationThread } from "@/components/admin/AdminConversationThread";
import type { Conversation } from "@/components/admin/AdminConversationList";

/**
 * /admin/messages — Two-column admin messaging page.
 * Left: conversation list, Right: selected conversation thread.
 */
export default function AdminMessagesPage() {
  const [selected, setSelected] = useState<Conversation | null>(null);

  return (
    <div
      className="flex h-full overflow-hidden rounded-[12px]"
      style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
    >
      {/* Left — conversation list */}
      <div className="w-72 shrink-0 overflow-hidden" style={{ borderRight: "1px solid var(--hairline)" }}>
        <AdminConversationList
          selectedDriverId={selected?.partnerId}
          onSelect={setSelected}
        />
      </div>

      {/* Right — conversation thread */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <AdminConversationThread
            driverId={selected.partnerId}
            driverName={selected.partnerName}
            driverAvatar={selected.partnerAvatar}
          />
        ) : (
          <div className="flex h-full items-center justify-center font-body text-[13px]" style={{ color: "var(--muted)" }}>
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
