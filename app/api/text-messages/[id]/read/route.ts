import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { textMessages } from "@/db/schema";
import { errorResponse } from "@/lib/api";

/**
 * PATCH /api/text-messages/[id]/read
 *
 * Marks a text message as "read". Only the receiver may call this.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  const userId = session.user.id;

  const [updated] = await db
    .update(textMessages)
    .set({ status: "read" })
    .where(
      and(
        eq(textMessages.id, params.id),
        eq(textMessages.receiverId, userId)
      )
    )
    .returning();

  if (!updated) {
    return errorResponse("Message not found or you are not the receiver", 404);
  }

  return NextResponse.json(updated);
}
