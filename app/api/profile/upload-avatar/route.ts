import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { successResponse, errorResponse } from "@/lib/api";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/** Maximum allowed avatar file size: 5 MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Accepted image MIME types */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * POST /api/profile/upload-avatar
 *
 * Accepts multipart/form-data with an "avatar" field containing the image file.
 * Validates MIME type and 5 MB size limit.
 * Saves to /public/avatars/<uuid>.<ext> and updates users.profile_image_url.
 *
 * Response 200: { profileImageUrl: "/avatars/<filename>" }
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Request must be multipart/form-data", 400);
  }

  const file = formData.get("avatar");
  if (!(file instanceof Blob)) {
    return errorResponse('Field "avatar" is required and must be a Blob or File', 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse("File exceeds the 5 MB size limit", 413);
  }

  // Strip codec / charset parameters before MIME check
  const mimeType = (file.type || "").split(";")[0].trim();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return errorResponse(
      `Unsupported image MIME type: "${mimeType}". Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}`,
      415
    );
  }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extMap[mimeType] ?? "jpg";
  const filename = `${randomUUID()}.${ext}`;

  const avatarsDir = join(process.cwd(), "public", "avatars");
  await mkdir(avatarsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(avatarsDir, filename), buffer);

  const profileImageUrl = `/avatars/${filename}`;

  // Persist URL in DB
  await db
    .update(users)
    .set({ profileImageUrl })
    .where(eq(users.id, session.user.id));

  return successResponse({ profileImageUrl });
}
