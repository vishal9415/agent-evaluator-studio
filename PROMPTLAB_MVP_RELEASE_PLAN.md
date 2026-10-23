# PromptLab MVP — Release Plan

This plan extends the existing Agent Evaluator Studio / Prompt Playground. It does not replace its manual playground, AutoEval, PromptComparison, stages editor, PromptCoach, guardrails, call history, or voice-export workflows.

## Product objective

Help voice/chat agent teams save prompt versions, run repeatable scenario-based evaluations, inspect evidence and timing, compare versions, and understand usage. Reliability claims must be limited to events the configured adapter can observe.

## Existing foundation observed in the repository

- TanStack Start + React + TypeScript + Vite
- Supabase auth and database integration
- Existing Prompt Playground with manual chat and stage-aware prompts
- AutoEval scenario generation and evaluation
- Paired prompt/model comparison with persisted progress
- Guardrails suite, call history, audit report, and voice-platform handoff bundles
- Supabase migrations and owner-scoped auth middleware used by some functionality

## P0 — Safety and local reproducibility

- [ ] Confirm clean local install and document required environment variables without committing credentials.
- [ ] Check repository history and deployment configuration for leaked secrets. Rotate any credentials that were ever committed; removing a file in a later commit does not revoke a secret.
- [ ] Ensure `.env`, `.env.*` local files and secrets are ignored; commit only `.env.example` with placeholders.
- [ ] Audit all server functions for authentication and ownership checks. Any function using a Supabase service-role client must implement explicit identity authorization before reads/writes.
- [ ] Review database policies and migrations for prompts, evaluations, scenarios, comparisons, sessions, and usage records.
- [ ] Add tests proving anonymous requests are rejected and users cannot read or mutate another user's records.
- [ ] Preserve current app behavior with build/lint/tests before functional changes.

## P1 — Live voice adapter vertical slice

- [ ] Introduce a server-only adapter contract: capabilities, connection preflight, session setup, normalized events, timestamps, usage metadata, and documented unsupported capabilities.
- [ ] Add OpenAI Realtime over WebRTC as the first adapter. Use server-side ephemeral client secrets/session negotiation so a long-lived API key is never returned to browser code.
- [ ] Keep OpenAI credentials only in server environment secrets; never persist them in client-readable tables.
- [ ] Build session UX: microphone permission explanation, connecting/connected/listening/assistant-speaking/error states, explicit end-session, and text fallback.
- [ ] Capture provider events and client-monotonic timestamps where available. Each metric must show measured, estimated, or unavailable provenance.
- [ ] Add a fake adapter for deterministic tests; document the generic adapter contract for additional providers.
- [ ] Verify with a real provider account manually. Automated mocked tests are not evidence of provider connectivity.

## P2 — Reproducible evaluation and immutable versions

- [ ] Add immutable prompt/agent versions; runs reference exact version IDs or snapshots.
- [ ] Ensure scenario records and run settings are pinned at dispatch.
- [ ] Persist each test run and case result, progress, failure category, and observable telemetry.
- [ ] Provide repeat-run and baseline comparison only for compatible scenario sets/settings.
- [ ] Label text tests, real audio tests, and simulated-condition tests separately.
- [ ] Never use illustrative/demo metrics in production reports.

## P3 — Session history and usage safety

- [ ] Add session history/CDR detail with status, duration, agent/version, scenario/run, available events, failure reason, and usage provenance.
- [ ] Add append-only credit ledger entries and reservation lifecycle: hold, charge, release, reversal.
- [ ] Enforce maximum duration, case count, concurrent runs, and workspace caps server-side.
- [ ] Make session finish and charge operations idempotent; provide stale-reservation cleanup.
- [ ] Distinguish actual provider usage from estimated usage.

## P4 — Audio validation and pilot readiness

- [ ] Validate one controlled audio fixture/degradation path end to end.
- [ ] Add barge-in/backchannel scoring only where the audio integration exposes appropriate evidence.
- [ ] Do not claim carrier-buffer control, full RTP/SIP simulation, or PSTN support unless implemented and independently tested.
- [ ] Define transcript/audio retention and deletion behavior; raw audio off by default.
- [ ] Run clean local setup, build, lint, unit tests, authorization tests, failure recovery tests and manual live-session verification.
- [ ] Publish a known-limitations document before inviting design partners.

## Local development (initial)

The project README specifies Node.js, npm, and:

```sh
git clone https://github.com/vishal9415/agent-evaluator-studio.git
cd agent-evaluator-studio
npm i
npm run dev
```

The package manifest also provides `npm run build` and `npm run lint`. Confirm the environment setup against the current server/client configuration before launching. Do not copy private production credentials into a shared environment.

## Exit criteria

The MVP may be called a controlled beta only when:
1. The existing Prompt Playground workflows still pass regression checks.
2. A configured OpenAI Realtime session works end-to-end with credentials kept server-side.
3. Scenario runs persist against an immutable version and can be repeated.
4. Timing claims clearly disclose the source and missing events.
5. Auth/tenant isolation, credential hygiene, usage limits, and reservation reconciliation are tested.
6. Operators and users understand retention defaults and can control stored evidence.

## Known gaps at plan creation

This commit records the implementation plan and does not assert that the work items above are implemented. Provider validation, local builds, security tests, RLS verification, versioning, persisted live sessions, and the usage ledger remain to be completed or verified.
