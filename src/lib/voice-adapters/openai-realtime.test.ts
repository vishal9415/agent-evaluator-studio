import { describe, expect, it } from "vitest";
import { realtimeRequestSchema } from "./openai-realtime.schema";

const validRequest = {
  accessToken: "x".repeat(32),
  sdp: `v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n`,
  instructions: "You are a helpful voice assistant.",
  model: "gpt-realtime-2.1",
  voice: "marin",
};

describe("OpenAI Realtime input validation", () => {
  it("accepts a bounded supported configuration", () => {
    expect(realtimeRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects unsupported models and voices", () => {
    expect(realtimeRequestSchema.safeParse({ ...validRequest, model: "unknown-model" }).success).toBe(false);
    expect(realtimeRequestSchema.safeParse({ ...validRequest, voice: "unknown-voice" }).success).toBe(false);
  });

  it("rejects missing/short auth tokens and blank instructions", () => {
    expect(realtimeRequestSchema.safeParse({ ...validRequest, accessToken: "" }).success).toBe(false);
    expect(realtimeRequestSchema.safeParse({ ...validRequest, instructions: "   " }).success).toBe(false);
  });

  it("bounds SDP and instruction payloads", () => {
    expect(realtimeRequestSchema.safeParse({ ...validRequest, sdp: "x".repeat(120_001) }).success).toBe(false);
    expect(realtimeRequestSchema.safeParse({ ...validRequest, instructions: "x".repeat(5001) }).success).toBe(false);
  });
});
