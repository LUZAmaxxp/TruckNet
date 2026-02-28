import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api";
import { env } from "@/lib/env";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/** Maximum allowed file size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Accepted audio MIME types.
 * browser-generated audio/webm is the primary target; others for interop.
 */
const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
]);

/**
 * POST /api/upload/audio
 *
 * Accepts multipart/form-data with a field named "audio" containing the recorded Blob.
 * Stores the file under /public/uploads/<uuid>.<ext> and returns the public-facing URL.
 *
 * Validations:
 *   - "audio" field must be present and be a Blob/File
 *   - File size ≤ 10 MB (413 on violation)
 *   - MIME type must be in ALLOWED_MIME_TYPES (415 on violation)
 *
 * Response 201: { audioUrl: "/uploads/<filename>" }
 */
export async function POST(req: NextRequest) {
  await requireAuth();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Request must be multipart/form-data", 400);
  }

  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return errorResponse('Field "audio" is required and must be a Blob or File', 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse("File exceeds the 10 MB size limit", 413);
  }

  // Strip codec parameters (e.g. "audio/webm;codecs=opus" → "audio/webm")
  const mimeType = (file.type || "audio/webm").split(";")[0].trim();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return errorResponse(
      `Unsupported audio MIME type: "${mimeType}". Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}`,
      415
    );
  }

  // Derive a safe file extension from the MIME type
  const extMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  const ext = extMap[mimeType] ?? "webm";
  const filename = `${randomUUID()}.${ext}`;

  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadsDir, filename), buffer);

  // Build absolute URL — required so audioUrl passes z.string().url() validation
  const base = env.NEXTAUTH_URL.replace(/\/$/, "");
  const audioUrl = `${base}/uploads/${filename}`;

  return successResponse({ audioUrl }, 201);
}
