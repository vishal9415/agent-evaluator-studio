/**
 * Shared deletion guard for voice-session metadata. A reservation must remain
 * attached to the session until it has been reconciled; deleting an active
 * row could also leave an external provider call running.
 */
export type VoiceSessionDeletionState = {
  endedAt: string | null;
  reservationStatus?: string | null;
};

export function getVoiceSessionDeletionBlock(
  state: VoiceSessionDeletionState,
): string | null {
  if (!state.endedAt) {
    return "End this voice session before deleting its history.";
  }
  if (state.reservationStatus === "held") {
    return "Usage reconciliation is pending. Refresh the Pilot usage allowance before deleting session history.";
  }
  return null;
}
