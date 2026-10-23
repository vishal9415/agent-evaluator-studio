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

- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: Supabase project configuration.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase key required by existing admin data functions. Never expose it to browser code.
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

The Voice Reliability Lab connects to OpenAI Realtime through server-side SDP negotiation. It persists session metadata and event timing only; raw audio and transcript text are not stored. A browser-observed speech-stop-to-response-created gap is not provider processing latency or time-to-audible response.

### Free local models with Ollama

PromptLab includes two optional local chat models that do not require a paid model API:

- `ollama/qwen3:4b` — recommended first try; downloads about 2.5 GB.
- `ollama/llama3.2:3b` — smaller alternative; downloads about 2 GB.

These run on your own Mac using Ollama's local OpenAI-compatible API. They do not charge per-token API fees, though they use local memory, compute, electricity, and disk space. Model quality and speed depend on your hardware.

1. Install and open [Ollama for macOS](https://ollama.com/download).
2. In Terminal, download one or both models:

   ```sh
   ollama pull qwen3:4b
   ollama pull llama3.2:3b
   ```

3. Leave Ollama running, then start PromptLab with `npm run dev`.
4. In the model selector, choose a model labelled **Local · … (Ollama, free)**.

PromptLab connects to `http://127.0.0.1:11434/v1` by default. Override this with the server-only `OLLAMA_BASE_URL` environment variable if your local Ollama endpoint differs. The app routes manual chat, Prompt Coach, scenario generation, evaluation judges/summaries, and comparison support calls to the selected local model when a local model is chosen. For prompt comparisons, choose local models for both variants to keep both sides of the comparison local. Existing hosted model choices remain on the Lovable AI gateway.

The initial local connection uses Ollama's OpenAI-compatible `/v1/chat/completions` endpoint. Tool-calling reliability varies by model; Qwen3 is the recommended first model for automated evaluations. Live audio in Voice Reliability Lab still uses OpenAI Realtime and is a separate, paid provider path.

Voice Reliability Lab includes a **Local Ollama** tab alongside the unchanged **OpenAI Realtime** tab. The local tab uses the selected Ollama model for text generation, the browser's SpeechRecognition API for microphone transcription when supported, and browser/system speech synthesis for spoken replies. Browser speech recognition may process audio online, so this mode should not be described as fully offline. It does not write the local conversation or event timeline to PromptLab voice-session history. Typed text input remains available if browser speech recognition is unsupported. The two modes use different pipelines and their latency figures are not directly comparable.

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
