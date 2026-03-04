import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { textMessages, users } from "@/db/schema";
import { errorResponse } from "@/lib/api";

/**
 * GET /api/text-messages/conversations
 *
 * Returns all unique conversation partners for the current user,
 * ordered by the most recent message.
 * Used by AdminConversationList and the driver messages sidebar.
 */
export async function GET(_req: NextRequest) {
  const session = await requireAuth();
  const userId = session.user.id;

  // Fetch all messages involving this user, newest first
  const msgs = await db
    .select({
      id: textMessages.id,
      senderId: textMessages.senderId,
      receiverId: textMessages.receiverId,
      content: textMessages.content,
      status: textMessages.status,
      createdAt: textMessages.createdAt,
    })
    .from(textMessages)
    .where(
      or(eq(textMessages.senderId, userId), eq(textMessages.receiverId, userId))
    )
    .orderBy(desc(textMessages.createdAt));

  // Group by conversation partner — first occurrence = most recent message
  const partnerMap = new Map<
    string,
    {
      lastContent: string;
      lastCreatedAt: Date;
      lastSenderId: string;
      unread: number;
    }
  >();

  for (const msg of msgs) {
    const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        lastContent: msg.content,
        lastCreatedAt: msg.createdAt,
        lastSenderId: msg.senderId,
        unread: 0,
      });
    }
    // Count unread: messages FROM the partner TO us that are still "delivered"
    if (msg.senderId === partnerId && msg.status === "delivered") {
      partnerMap.get(partnerId)!.unread++;
    }
  }

  if (partnerMap.size === 0) {
    return NextResponse.json({ conversations: [] });
  }

  // Fetch user details for all partners in one query
  const partnerIds = Array.from(partnerMap.keys());
  const partnerUsers = await db
    .select({
      id: users.id,
      name: users.name,
      tag: users.tag,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(inArray(users.id, partnerIds));

  const partnerUserMap = new Map(partnerUsers.map((u) => [u.id, u]));

  const conversations = partnerIds
    .map((partnerId) => {
      const conv = partnerMap.get(partnerId)!;
      const user = partnerUserMap.get(partnerId);
      if (!user) return null;
      return {
        partnerId,
        partnerName: user.name,
        partnerTag: user.tag,
        partnerAvatar: user.profileImageUrl,
        lastMessage: {
          content: conv.lastContent,
          createdAt: conv.lastCreatedAt,
          isSelf: conv.lastSenderId === userId,
        },
        unreadCount: conv.unread,
      };
    })
    .filter(Boolean)
    // Sort by last message time descending
    .sort(
      (a, b) =>
        new Date(b!.lastMessage.createdAt).getTime() -
        new Date(a!.lastMessage.createdAt).getTime()
    );

  return NextResponse.json({ conversations }, { status: 200 });
}
