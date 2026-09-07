import { useCallback, useEffect, useRef, useState } from "react";

export type CallEventKind = "user" | "agent" | "stage" | "system";

export type CallEvent = {
  at: number;
  kind: CallEventKind;
  text: string;
};

export type CallRecord = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  mode: "voice" | "chat";
  model: string;
  events: CallEvent[];
};

const KEY = "playground.callHistory.v1";
const MAX_CALLS = 25;

function load(): CallRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CallRecord[]) : [];
  } catch {
    return [];
  }
}

function persist(calls: CallRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(calls.slice(0, MAX_CALLS)));
  } catch {
    /* storage full or unavailable */
  }
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useCallHistory() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    setCalls(load());
    hydrated.current = true;
  }, []);

  const update = useCallback((fn: (prev: CallRecord[]) => CallRecord[]) => {
    setCalls((prev) => {
      const next = fn(prev).slice(0, MAX_CALLS);
      if (hydrated.current) persist(next);
      return next;
    });
  }, []);

  const startCall = useCallback(
    (mode: "voice" | "chat", model: string) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `call-${Date.now()}`;
      const record: CallRecord = {
        id,
        startedAt: Date.now(),
        endedAt: null,
        mode,
        model,
        events: [],
      };
      update((prev) => [record, ...prev.map((c) => (c.endedAt ? c : { ...c, endedAt: Date.now() }))]);
      setActiveId(id);
      return id;
    },
    [update],
  );

  const addEvent = useCallback(
    (callId: string | null, kind: CallEventKind, text: string) => {
      if (!callId || !text.trim()) return;
      update((prev) =>
        prev.map((c) =>
          c.id === callId ? { ...c, events: [...c.events, { at: Date.now(), kind, text }] } : c,
        ),
      );
    },
    [update],
  );

  const endCall = useCallback(
    (callId: string | null) => {
      if (!callId) return;
      update((prev) => prev.map((c) => (c.id === callId ? { ...c, endedAt: Date.now() } : c)));
      setActiveId((cur) => (cur === callId ? null : cur));
    },
    [update],
  );

  const clearHistory = useCallback(() => {
    setActiveId(null);
    update(() => []);
  }, [update]);

  return { calls, activeId, startCall, addEvent, endCall, clearHistory };
}
