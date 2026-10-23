import { describe, expect, it } from "vitest";
import { getVoiceSessionDeletionBlock } from "./voice-session-deletion";

describe("voice session deletion guard", () => {
  it("blocks deleting a session while it is active", () => {
    expect(
      getVoiceSessionDeletionBlock({ endedAt: null, reservationStatus: "held" }),
    ).toMatch(/End this voice session/i);
  });

  it("blocks deletion while test usage is still reserved", () => {
    expect(
      getVoiceSessionDeletionBlock({
        endedAt: "2026-10-23T09:00:00.000Z",
        reservationStatus: "held",
      }),
    ).toMatch(/reconciliation is pending/i);
  });

  it("allows deletion after the session ends and its reservation is reconciled", () => {
    expect(
      getVoiceSessionDeletionBlock({
        endedAt: "2026-10-23T09:00:00.000Z",
        reservationStatus: "reconciled",
      }),
    ).toBeNull();
  });

  it("allows old sessions that have no usage reservation", () => {
    expect(
      getVoiceSessionDeletionBlock({
        endedAt: "2026-10-23T09:00:00.000Z",
        reservationStatus: null,
      }),
    ).toBeNull();
  });
});
