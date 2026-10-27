# Prompt Playground

Create a playground, this should help testing the conversational agent (could be voice or chat). user should be able to paste or update the prompt, select the model and conversational agent type.
platform need to give 2 options, either user can do manual testing or platform should able generate the scenarios (about 50)  and test the prompt and tell the user how effective the prompt is and what are the chances of it hallucinating and suggest the changes to reduce those errors.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://agent-evaluator-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/72c69b08-3e7a-48bf-9908-2e2d033af0fa).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Local development

Use a recent Node.js LTS release or Bun. The project is a TanStack Start + React + TypeScript app.

```sh
git clone https://github.com/vishal9415/agent-evaluator-studio.git
cd agent-evaluator-studio
cp .env.example .env
```

Fill in the values in `.env` from your own Supabase, Lovable AI Gateway, and OpenAI accounts. The template uses placeholders only. Keep `.env` local; do not commit it or paste server secrets into client-visible `VITE_*` variables.

- `PROMPTLAB_SUPABASE_URL` and `PROMPTLAB_SUPABASE_PUBLISHABLE_KEY`: server-side configuration for the same external Supabase project used by the browser. The browser is explicitly pinned to the same project with `VITE_PROMPTLAB_SUPABASE_URL` and `VITE_PROMPTLAB_SUPABASE_PUBLISHABLE_KEY` (falling back to the project's public values in `src/integrations/supabase/client.ts`, not Lovable's managed `VITE_SUPABASE_*` values).
- `PROMPTLAB_SUPABASE_SERVICE_ROLE_KEY`: server-only key required by admin data functions. Never expose it to browser code. In Lovable, use these `PROMPTLAB_*` names because the platform reserves `SUPABASE_*` variables for its own backend.
- `LOVABLE_API_KEY`: server-only key used by existing text evaluation/scenario-generation flows.
- `OPENAI_API_KEY`: server-only key used to negotiate OpenAI Realtime voice sessions.
- `PROMPTLAB_ADMIN_USER_IDS`: comma-separated Supabase Auth user UUIDs allowed to grant pilot test-seconds in the current single-user/admin allowlist model.

Install dependencies and start the app:

```sh
bun install
bun run dev
```

Or, with npm:

```sh
npm install
npm run dev
```

The authenticated app contains:
- `/playground` — existing prompt editing, manual chat, automated evaluations, comparisons, guardrails, and voice-platform export.
- `/voice-reliability` — first live OpenAI Realtime WebRTC test path, available after sign-in and server configuration.
- `/integrations` — Vapi completed-call webhook setup and recent imported call history.

The Voice Reliability Lab connects to OpenAI Realtime through server-side SDP negotiation. It persists session metadata and event timing only; raw audio and transcript text are not stored. A browser-observed speech-stop-to-response-created gap is not provider processing latency or time-to-audible response.


### Maya 2 Native speech output (optional)

PromptLab's Local Voice mode can use **Maya 2 Native** as an alternative speech-output engine. Ollama still generates the assistant's text; Maya converts the completed reply to speech in one of 12 supported languages and 20 built-in voices. This is a TTS integration, not a transcription or prompt-evaluation model. The model is licensed under Apache-2.0; preserve the model and upstream-component notices if redistributing the serving stack. See the [Maya 2 Native model card](https://huggingface.co/maya-research/maya2-native) and [upstream inference code](https://github.com/MayaResearch/maya2-native).

**Deployment requirement:** Maya's documented serving stack expects Linux, Python 3.10–3.12, an NVIDIA GPU with CUDA 12.8 support, and approximately 9.2 GB peak GPU memory at one seat (12 GB GPU recommended for headroom). It is not a suitable local model to load directly into PromptLab's browser or the user's 8 GB Mac setup. Run it on a separate supported inference host.

Install and start the model on that host using the commands from the upstream model card:

```bash
python -m venv .venv
source .venv/bin/activate
pip install "maya3[server] @ git+https://github.com/MayaResearch/maya2-native" \
  --extra-index-url https://download.pytorch.org/whl/cu128
python -m maya3.server \
  --ckpt maya-research/maya2-native \
  --host 127.0.0.1 --port 8080 --max-seats 1
```

The server's default loopback binding is appropriate only when PromptLab runs on the same host. For a hosted PromptLab deployment, configure a **private network route or a secured reverse proxy** to the Maya server and set the URL reachable from the PromptLab server. The upstream reference server has no built-in authentication; do not expose it directly to the public internet. If a reverse proxy requires bearer authentication, set `MAYA_TTS_BEARER_TOKEN` as a server-only secret.

Required PromptLab server variable:

- `MAYA_TTS_BASE_URL`: base URL of the Maya server (the route appends `/health` or `/v1/audio/speech`).
- `MAYA_TTS_BEARER_TOKEN`: optional server-only bearer token used only when the configured reverse proxy expects it.

After configuring the endpoint, open **Voice Reliability Studio → Local Voice Mode → Speech output engine → Maya 2 Native**, choose a language and voice, use **Check server**, then **Preview voice** or start a voice conversation. Audio generation runs on the configured Maya host; audio is returned to the browser and is not persisted by PromptLab. Generated voice latency is end-to-end playback latency, not a real-time carrier metric.

### Existing recording review

The Voice Reliability Studio includes a client-side **Recording Review** section before the Design Partner workspace. Users can add up to 10 audio files per batch (maximum 25 MB per file and 100 MB total), play them back, and run local signal checks for possible clipping, low average level, and long low-level segments. Files are held in the current browser session and are not stored by PromptLab.

For optional transcription, **Transcribe & analyze** explicitly sends that selected recording to the ElevenLabs Speech-to-Text API (`scribe_v2`) with speaker diarization enabled. This can consume ElevenLabs usage. The resulting transcript remains in page memory and is checked for potential repeated questions/utterances, unclear-transcription markers and long turns. PromptLab does not persist the uploaded audio or transcript. Only use recordings you are authorized to process, and review the transcription provider's data-handling terms. Manual quick checks and audio signal metrics run locally without an AI inference request.

For prompt-aware review, users may choose one of their saved PromptLab prompts or paste the exact production prompt, then evaluate one transcript or a confirmed batch. The hosted evaluator checks instruction adherence, missed/changed details, contradictions, unsupported claims, repetition, qualification gaps, and grounded safety/privacy concerns. It returns short prompt and transcript excerpts for findings; the server verifies those excerpts against the supplied source text and downgrades unverified findings for manual review. Prompt and transcript content are sent to the Lovable AI gateway for this explicit action and may consume AI credits. The prompt, transcript, recording, and report are not persisted by this flow. Findings remain heuristic AI judgments, not a verified quality score, and the feature does not yet compare audio directly against a target prompt without a transcript or provide real-time intervention.

### Existing voice-agent integration (Vapi pilot)

The authenticated **Integrations** page can create a Vapi webhook secret and show the endpoint for the currently deployed environment. In Vapi, open the existing assistant, set **Advanced → Webhook Server → Server URL** to the endpoint, add the custom HTTP header `X-PromptLab-Secret` with the generated secret, enable `end-of-call-report` under Server Messages, and publish the assistant settings. Vapi supports server URLs and custom HTTP headers in its webhook configuration: https://docs.vapi.ai/server-url/setting-server-urls.

The public `POST /api/vapi-webhook` receiver hashes and checks the shared secret, then upserts completed-call metadata by integration and provider call ID so duplicate deliveries do not duplicate calls. Phone numbers, recording URLs, and raw webhook bodies are not stored. Transcript text, call summaries, and selected analysis fields are retained only when the integration owner explicitly enables content retention. Rotating the webhook secret invalidates the previous secret; update the Vapi header immediately after rotation.

This is a **post-call pilot integration**, not a real-time audio connector. It does not yet pull historical calls from Vapi, calculate PromptLab quality scores, run automated call scoring, or intervene while a call is in progress. Calls arrive after the webhook is configured and Vapi delivers an event. Apply `supabase/migrations/20261025135000_vapi_call_ingestion.sql` to the target PromptLab Supabase project (already applied to the current pilot project).

### Free local models with Ollama

PromptLab includes three optional local chat models that do not require a paid model API:

- `ollama/llama3.2:1b` — fastest local option; downloads roughly 1.3 GB, but is less reliable at complex reasoning and critical-detail preservation.
- `ollama/llama3.2:3b` — a balanced small model; downloads about 2 GB.
- `ollama/qwen3:4b` — another local option for quality comparisons; downloads about 2.5 GB.

These run on your own Mac using Ollama's local OpenAI-compatible API. They do not charge per-token API fees, though they use local memory, compute, electricity, and disk space. Model quality and speed depend on your hardware.

1. Install and open [Ollama for macOS](https://ollama.com/download).
2. In Terminal, download one or both models:

   ```sh
   ollama pull llama3.2:1b
   ollama pull llama3.2:3b
   ollama pull qwen3:4b
   ```

3. Leave Ollama running, then start PromptLab with `npm run dev`.
4. In the model selector, choose a model labelled **Local · … (Ollama, free)**.

PromptLab connects to `http://127.0.0.1:11434/v1` by default. Override this with the server-only `OLLAMA_BASE_URL` environment variable if your local Ollama endpoint differs. The app routes manual chat, Prompt Coach, scenario generation, evaluation judges/summaries, and comparison support calls to the selected local model when a local model is chosen. For prompt comparisons, choose local models for both variants to keep both sides of the comparison local. Existing hosted model choices remain on the Lovable AI gateway.

The initial local connection uses Ollama's OpenAI-compatible `/v1/chat/completions` endpoint. Tool-calling reliability varies by model; Qwen3 is the recommended first model for automated evaluations. Live audio in Voice Reliability Lab still uses OpenAI Realtime and is a separate, paid provider path.

Voice Reliability Lab includes a **Local Ollama** tab alongside the unchanged **OpenAI Realtime** tab. The local tab uses the selected Ollama model for text generation, the browser's SpeechRecognition API for microphone transcription when supported, and browser/system speech synthesis for spoken replies. Local replies stream from Ollama so text renders token-by-token and speech can start at completed phrase boundaries before the full reply is generated. The panel measures time to first model token separately from full generation time. It includes a voice selector and speaking-rate control; naturalness depends on the speech voices installed in the operating system and exposed by the browser. On macOS, installing an Enhanced or Premium English voice can improve quality at no API cost. Browser speech recognition may process audio online, so this mode should not be described as fully offline. It does not write the local conversation or event timeline to PromptLab voice-session history. Typed text input remains available if browser speech recognition is unsupported. The two modes use different pipelines and their latency figures are not directly comparable.

### Supabase migrations and local pilot allowance

For a fresh Supabase development project, apply **all migration files** in `supabase/migrations/` in timestamp order. The older migrations create the initial prompts/evaluations/scenarios and profile schema; the later migrations add ownership, prompt versions, voice session history, the usage ledger, and owner-scoped prompt comparisons. Applying only the four newest files to an empty project will fail because they depend on the earlier schema.

Recommended CLI workflow from the repository root:

```sh
supabase login
supabase link --project-ref YOUR_DEV_PROJECT_REF
supabase migration list
supabase db push --dry-run
# Confirm the linked ref is your development project and review the pending migrations.
supabase db push
```

Do not run `supabase db reset` against a remote project. Keep schema changes in versioned migration files and do not paste database passwords or server-only keys into chat or source control.

The authenticated user must have enough internal pilot test-seconds available before a call starts. Set `PROMPTLAB_ADMIN_USER_IDS` to a comma-separated allowlist of trusted Supabase Auth user UUIDs, restart the dev server, sign in with an allowlisted account, and use the Pilot usage allowance panel to grant a small test allowance to the intended user's Auth UUID. Keep this allowlist server-side only. New voice sessions reserve up to ten minutes before provider negotiation; the session is reconciled when it ends. If provider hangup cannot be confirmed, the full ten-minute allowance is conservatively consumed. These units are a hard operational cap in seconds, not dollars or provider cost. OpenAI usage is billed separately by OpenAI.

The authenticated user must have enough internal pilot test-seconds available before a call starts. Set `PROMPTLAB_ADMIN_USER_IDS` to a comma-separated allowlist of trusted Supabase Auth user UUIDs, restart the dev server, sign in with an allowlisted account, and use the Pilot usage allowance panel to grant a small test allowance to the intended user's Auth UUID. Keep this allowlist server-side only. New voice sessions reserve up to ten minutes before provider negotiation; the session is reconciled when it ends. If provider hangup cannot be confirmed, the full ten-minute allowance is conservatively consumed. These units are a hard operational cap in seconds, not dollars or provider cost. OpenAI usage is billed separately by OpenAI.

Legacy prompts and evaluations with no owner are deliberately not assigned to a user automatically. Audit and backfill any records that should be retained before enabling them for a user; new runs and saves are owner-scoped.

Still not implemented: workspace membership/role management, fully repeatable live-agent regression runs, a dedicated scenario-suite snapshot model for Realtime tests, an automatic retention-expiry job, a scheduled background watchdog for abandoned browser sessions, validated acoustic benchmark fixtures on the live Realtime path, and SIP/RTP/PSTN diagnostics. A usage refresh attempts on-demand recovery for sessions older than 12 minutes; it is not a scheduled watchdog. The anonymous homepage demo has a process-local rate limit; use a shared rate limiter and shared provider-budget control before a scaled multi-instance public rollout. The generic adapter types describe the extension contract; only OpenAI Realtime is wired end-to-end in this release.

## Validation

`bun run typecheck`, `bun run test`, targeted ESLint, and `bun run build` are the intended pull-request checks. The CI workflow uses placeholder environment values for build-only validation; it does not prove connectivity to Supabase or OpenAI. Run a manual live-session test with your own configuration before treating the voice adapter as provider-verified.

## Design-partner pilot

The Voice Reliability Studio includes a **Reliability casebook & feedback** section for a small design-partner pilot. Partners can run the same seven synthetic cases across sessions, mark each as passed / needs work / not tested, rate the experience, and submit categorized feedback. Reports are associated with the signed-in account. The stored report contains case IDs/statuses, rating, category, execution mode, optional notes, and optional consent to follow up; it does not accept raw audio, transcripts, prompt bodies, or provider event payloads. Ask pilot participants not to paste real customer data or secrets into feedback.

### Enable pilot feedback storage

Apply the new migration `supabase/migrations/20261025075016_design_partner_reports.sql` **after** the existing migrations. For a remote development database, verify the linked project is the intended pilot project and review the dry run before pushing:

```sh
supabase migration list
supabase db push --dry-run
# Confirm the project/ref and migration list, then:
supabase db push
```

The server-side `SUPABASE_SERVICE_ROLE_KEY` must be configured in the deployment's secret manager because existing server functions use it for owner-scoped writes. Never expose it through a `VITE_*` variable or ask a design partner to supply it. Row-level security limits reads/deletes to a user's own report; server submissions derive the owner from the verified sign-in token.

### Suggested pilot setup

- Invite only a few named participants and ask each to use their own account. Confirm sign-up/sign-in works on the deployed URL before sharing it.
- For hosted voice testing, configure a valid server-side `OPENAI_API_KEY` and check the OpenAI account has enabled billing/credits. OpenAI usage is billed separately from PromptLab's internal pilot test-seconds.
- Grant a small internal pilot allowance to each test account using the existing Usage panel and the configured admin-user allowlist. The allowance is a session cap in seconds, not a USD balance.
- Ask partners to run at least the critical-field, correction-wins, confirmation, and unsupported-claim cases. Their case outcomes are human-reviewed observations; they are not automated acoustic benchmarks or a safety certification.
- On a hosted deployment, the **Local Ollama** tab connects from the application server, not the partner's own Mac. Use it only when Ollama is intentionally running and reachable from that server. Do not expose a partner's local Ollama port to the public internet to work around this.

No new model training is required for this pilot. There is not yet a validated, consented dataset of representative failures to train or fine-tune a model responsibly; the casebook is a structured way to start collecting early product feedback without storing call recordings/transcripts.
