import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { errorResponse } from "@/lib/api";
import { readFile } from "fs/promises";
import { join, basename } from "path";

/**
 * GET /api/uploads/[filename]
 *
 * Authenticated audio file serving.
 * Files are stored in private_uploads/ (outside public/) so they are never
 * served directly by Next.js. All access must go through this route.
 *
 * Only the authenticated user who belongs to the conversation (or any
 * authenticated user — voice messages are shared between two parties)
 * can retrieve the file. The UUID filename provides an unguessable path.
 *
 * Response: binary audio file with correct Content-Type
 */

const MIME_BY_EXT: Record<string, string> = {
  webm: "audio/webm",
  ogg:  "audio/ogg",
  mp3:  "audio/mpeg",
  m4a:  "audio/mp4",
  wav:  "audio/wav",
};

/** Sanitise the filename to a plain basename (prevents path traversal). */
function safeBasename(filename: string): string {
  return basename(filename);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  await requireAuth();

  // Prevent path traversal — only allow bare filename characters (UUID + ext)
  const filename = safeBasename(params.filename);
  if (!/^[0-9a-f-]+\.[a-z0-9]{2,4}$/.test(filename)) {
    return errorResponse("Invalid filename", 400);
  }

  const filePath = join(process.cwd(), "private_uploads", filename);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(filePath);
  } catch {
    return errorResponse("File not found", 404);
  }

  const ext = filename.split(".").pop() ?? "";
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

  return new Response(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.byteLength),
      // Prevent caching of private audio content
      "Cache-Control": "private, no-store",
      // Force download prevention — content-disposition inline
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
