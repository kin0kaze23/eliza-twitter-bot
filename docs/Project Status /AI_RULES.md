# Antigravity AI Rules — ElizaDashboard 2

## Canonical Truth
- **NOW.md** is the daily source of truth for current tasks.
- **AI_RULES.md** (this file) is binding for all AI operations.
- **SPECIFICATIONS.md** is the source of truth for technical contracts and data shapes.

## Protocol
1. **Loop**: Read `NOW.md` → `AI_RULES.md` → `BACKLOG.md` → check `LOCK.md`.
2. **Locking**: Check `LOCK.md` before any tracking or code edits (Holder should be `NONE`).
3. **Response Format**: ALWAYS use the "Required response format" defined in the initial instruction.
4. **Context**: Open max 5 files. Prefer `rg` over browsing.
5. **Efficiency**: Bullets only. Diff over full code blocks.
6. **PR-Sized**: Small, verifiable milestones only.
7. **Verification**: Fast checks (build/lint) after every change. Full protocol before PM handoff.

## Data Shapes
- Current architecture: Express + React (Vite) + Drizzle ORM + PostgreSQL (Neon).
- Shared Schema: `shared/schema.ts` is the source of truth for DB/API contracts.

## Prohibitions
- No big rewrites without explicit request.
- No destructive commands (rm, reset --hard) without asking.
## Model + Reasoning Routing (Antigravity Protocol)
- **Heavy Lift**: `Claude Opus 4.5 (Thinking)` or `Gemini 3 Pro (High)`
- **Standard Loop**: `Claude Sonnet 4.5` or `Gemini 3 Pro (Low)`
- **Fast Triage/Small Edits**: `Gemini 3 Flash`
- **Reasoning/Thinking Tasks**: `Claude Sonnet 4.5 (Thinking)`

Escalation Rule: If a step fails twice, escalate to a Thinking model.
