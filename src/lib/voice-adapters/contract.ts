/**
 * Provider-neutral contract for voice-agent integrations.
 *
 * Each adapter must declare what it can actually observe. Timing data must
 * carry provenance; do not synthesize missing provider/browser events.
 */
export type MeasurementStatus = "measured" | "estimated" | "unavailable";
export type VoiceEventSource = "browser" | "provider" | "adapter" | "simulator";

export interface VoiceAdapterCapabilities {
  id: string;
  label: string;
  transport: "webrtc" | "websocket" | "webhook" | "custom";
  modalities: Array<"text" | "audio">;
  events: string[];
  supportsLiveAudio: boolean;
  supportsTranscriptEvents: boolean;
  supportsProviderTimestamps: boolean;
}

export interface NormalizedVoiceEvent {
  id: string;
  type: string;
  source: VoiceEventSource;
  occurredAt: string;
  receivedAt: string;
  measurementStatus: MeasurementStatus;
  details?: Record<string, string | number | boolean | null>;
}

export interface VoiceAdapter {
  readonly capabilities: VoiceAdapterCapabilities;
}

export const OPENAI_REALTIME_CAPABILITIES: VoiceAdapterCapabilities = {
  id: "openai-realtime",
  label: "OpenAI Realtime",
  transport: "webrtc",
  modalities: ["text", "audio"],
  events: [
    "session.created",
    "input_audio_buffer.speech_started",
    "input_audio_buffer.speech_stopped",
    "conversation.item.input_audio_transcription.completed",
    "response.created",
    "response.output_audio_transcript.done",
    "response.done",
    "error",
  ],
  supportsLiveAudio: true,
  supportsTranscriptEvents: true,
  // The MVP records local browser receive times. It does not assume provider
  // timestamps are synchronized with the browser's monotonic clock.
  supportsProviderTimestamps: false,
};

/**
 * Future generic adapter contract: implement a server-side connector that
 * establishes the session and maps provider callbacks/webhooks into
 * NormalizedVoiceEvent. No arbitrary webhook is invoked by this MVP yet.
 */
export interface CustomAdapterRegistration {
  id: string;
  label: string;
  endpointReference: string;
  capabilities: VoiceAdapterCapabilities;
}
