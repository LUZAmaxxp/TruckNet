import { describe, it, expect } from "vitest";
import { VoiceMessageSchema } from "@/schemas/voice.schema";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validUrl = "https://cdn.example.com/audio/message.webm";

describe("VoiceMessageSchema", () => {
  const valid = {
    receiverId: validUUID,
    audioUrl: validUrl,
    durationSeconds: 30,
  };

  it("accepts a valid voice message payload", () => {
    const result = VoiceMessageSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts duration exactly at max (60)", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, durationSeconds: 60 });
    expect(result.success).toBe(true);
  });

  it("rejects duration exceeding 60 seconds", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, durationSeconds: 61 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("durationSeconds");
  });

  it("rejects duration of 0 — valid (non-negative)", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, durationSeconds: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for receiverId", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, receiverId: "not-a-uuid" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("receiverId");
  });

  it("rejects empty string for receiverId", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, receiverId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-URL audio url", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, audioUrl: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("audioUrl");
  });

  it("rejects relative path as audio url", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, audioUrl: "/uploads/audio.webm" });
    expect(result.success).toBe(false);
  });

  it("rejects missing receiverId", () => {
    const { receiverId: _r, ...rest } = valid;
    expect(VoiceMessageSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing audioUrl", () => {
    const { audioUrl: _a, ...rest } = valid;
    expect(VoiceMessageSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing durationSeconds", () => {
    const { durationSeconds: _d, ...rest } = valid;
    expect(VoiceMessageSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects string durationSeconds", () => {
    const result = VoiceMessageSchema.safeParse({ ...valid, durationSeconds: "30" });
    expect(result.success).toBe(false);
  });
});
