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
    <div className="flex h-full overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      {/* Left — conversation list */}
      <div className="w-72 shrink-0 border-r border-gray-800 overflow-hidden">
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
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
