"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FriendsSidebar } from "@/components/messages/FriendsSidebar";
import { ChatPanel, type Friend } from "@/components/messages/ChatPanel";
import { useSocket } from "@/hooks/useSocket";

function MessagesPageInner() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");
  const { on } = useSocket();

  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  // Mobile: true when the chat panel should be shown instead of the sidebar
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Page-level voice notification — fires when a message arrives from someone
  // OTHER than the currently open chat (ChatPanel handles the in-chat case).
  useEffect(() => {
    const unsub = on("voice_message_received", (msg) => {
      console.log("[MessagesPage] voice_message_received", msg);
      if (selectedFriend?.id === msg.senderId) return; // ChatPanel will handle it
      const name = msg.senderName ?? "A contact";
      toast.info(`🎙️ New voice message from ${name}`, {
        duration: 12_000,
        action: {
          label: "Open chat",
          onClick: () => router.push(`/messages?from=${msg.senderId}`),
        },
      });
    });
    return unsub;
  }, [on, selectedFriend?.id, router]);

  // Page-level text notification — fires when a text arrives from someone
  // OTHER than the currently open chat (ChatPanel + FriendsSidebar badge handle the in-chat case).
  useEffect(() => {
    const unsub = on("text_message_received", (msg) => {
      console.log("[MessagesPage] text_message_received", msg);
      if (selectedFriend?.id === msg.senderId) return; // already visible in ChatPanel
      const name = msg.senderName ?? "A contact";
      const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content;
      toast.info(`💬 ${name}: ${preview}`, {
        duration: 10_000,
        action: {
          label: "Open chat",
          onClick: () => router.push(`/messages?from=${msg.senderId}`),
        },
      });
    });
    return unsub;
  }, [on, selectedFriend?.id, router]);

  function handleSelectFriend(friend: Friend) {
    setSelectedFriend(friend);
    setMobileShowChat(true);
  }

  function handleBack() {
    setMobileShowChat(false);
  }

  if (!currentUserId) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      // Break out of the layout container's padding on mobile so the panel
      // fills exactly from below the Navbar (h-14 = 3.5rem) to above the
      // fixed BottomNav (h-16 = 4rem).  On desktop we stay inside the
      // container and let md:h-[calc(100vh-80px)] size us correctly.
      className="relative -mx-4 -mt-6 -mb-20 md:m-0 overflow-hidden overflow-x-hidden h-[calc(100dvh-7.5rem)] md:flex md:h-[calc(100vh-80px)] md:rounded-xl md:border md:border-border md:shadow-sm"
    >
      {/* ─── Desktop: always show both panels ──────────────────────── */}
      <div className="hidden md:flex w-full h-full">
        <div className="w-[340px] shrink-0 h-full">
          <FriendsSidebar
            activeFriendId={selectedFriend?.id ?? null}
            onSelectFriend={handleSelectFriend}
            autoOpenId={fromParam}
          />
        </div>

        <div className="flex-1 h-full overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedFriend ? (
              <motion.div
                key={selectedFriend.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="h-full"
              >
                <ChatPanel
                  friend={selectedFriend}
                  currentUserId={currentUserId}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex h-full items-center justify-center text-muted-foreground flex-col gap-3"
              >
                <p className="text-base font-medium">Select a conversation</p>
                <p className="text-sm opacity-60">
                  Choose a friend from the list to start chatting
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Mobile: stacked with slide transition ──────────────────── */}
      <div className="flex md:hidden w-full h-full relative overflow-hidden">
        <AnimatePresence initial={false}>
          {!mobileShowChat ? (
            <motion.div
              key="sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="absolute inset-0"
            >
              <FriendsSidebar
                activeFriendId={selectedFriend?.id ?? null}
                onSelectFriend={handleSelectFriend}
                autoOpenId={fromParam}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`chat-${selectedFriend?.id}`}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="absolute inset-0"
            >
              {selectedFriend && (
                <ChatPanel
                  friend={selectedFriend}
                  currentUserId={currentUserId}
                  onBack={handleBack}
                  showBackButton
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesPageInner />
    </Suspense>
  );
}
