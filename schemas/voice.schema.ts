import { z } from "zod";

/**
 * VoiceMessageSchema — validates voice message send payloads.
 * Used in POST /api/voice-messages and the send_voice_message socket event.
 */
export const VoiceMessageSchema = z.object({
  receiverId: z
    .string()
    .uuid({ message: "receiverId must be a valid UUID" }),
  audioUrl: z.string().url({ message: "audioUrl must be a valid URL" }),
  durationSeconds: z
    .number({ required_error: "durationSeconds is required" })
    .max(60, { message: "Voice message duration cannot exceed 60 seconds" }),
});

export type VoiceMessageInput = z.infer<typeof VoiceMessageSchema>;
