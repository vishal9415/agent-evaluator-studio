import { z } from "zod";

export const realtimeRequestSchema = z.object({
  accessToken: z.string().min(20).max(5000),
  sdp: z.string().min(20).max(120_000),
  instructions: z.string().trim().min(1).max(5000),
  model: z.enum(["gpt-realtime-2.1", "gpt-realtime-2.1-mini"]),
  voice: z.enum(["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"]),
});

export type RealtimeRequest = z.infer<typeof realtimeRequestSchema>;
