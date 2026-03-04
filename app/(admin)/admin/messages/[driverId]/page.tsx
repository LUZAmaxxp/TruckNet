"use client";

import { useState, useEffect } from "react";
import { AdminConversationList } from "@/components/admin/AdminConversationList";
import { AdminConversationThread } from "@/components/admin/AdminConversationThread";
import type { Conversation } from "@/components/admin/AdminConversationList";

interface AdminMessagesDriverPageProps {
  params: { driverId: string };
}

/**
 * /admin/messages/[driverId] — Deep-link route that pre-selects a specific thread.
 * Renders the same two-column layout as the messages index page.
 */
export default function AdminMessagesDriverPage({ params }: AdminMessagesDriverPageProps) {
  const { driverId } = params;
  const [selected, setSelected] = useState<Conversation | null>(null);

  // Hydrate the selected conversation from the conversations API
  useEffect(() => {
    fetch("/api/text-messages/conversations")
      .then((r) => r.json())
      .then((d: { conversations?: Conversation[] }) => {
        const match = d.conversations?.find((c) => c.partnerId === driverId);
        if (match) {
          setSelected(match);
        } else if (driverId) {
          // Driver has no prior conversation — build a minimal stub
          fetch(`/api/admin/drivers?search=${driverId}&limit=1`)
            .then((r) => r.json())
            .then((data: { drivers?: Array<{ id: string; name: string; profileImageUrl: string | null; tag: string }> }) => {
              const driver = data.drivers?.[0];
              if (driver) {
                setSelected({
                  partnerId: driver.id,
                  partnerName: driver.name,
                  partnerTag: driver.tag,
                  partnerAvatar: driver.profileImageUrl,
                  lastMessage: { content: "", createdAt: new Date(), isSelf: false },
                  unreadCount: 0,
                });
              }
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, [driverId]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
      {/* Left — conversation list */}
      <div className="w-72 shrink-0 border-r border-gray-800 overflow-hidden">
        <AdminConversationList
          selectedDriverId={driverId}
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
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}
