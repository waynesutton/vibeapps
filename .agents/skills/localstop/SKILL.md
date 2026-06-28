---
name: localstop
description: Use when the user says /localstop, localstop, stop localhost for this app, /localstopall, localstopall, or asks to stop local development servers for this Teleprompt app.
---

# Local Stop

Use this skill to stop local development servers for this app.

## Commands

| Intent | Scope | Default target |
| --- | --- | --- |
| `/localstop` | Current Teleprompt app only | `localhost:5173` / Vite |
| `/localstopall` | Local dev servers only | Common Node/Bun/Vite/Next dev listeners |

## Rules

- Do not modify files.
- Do not change git state.
- Do not deploy.
- Prefer graceful shutdown first.
- Never kill Docker, database, Convex cloud, system, browser, editor, VPN, or OS services.
- For `/localstopall`, inspect candidate processes before killing. Kill only obvious local dev servers.
- If a process is ambiguous, report it instead of killing it.

## `/localstop` Workflow

1. Check whether the current app port is listening:

   ```bash
   lsof -nP -iTCP:5173 -sTCP:LISTEN
   ```

2. If the running process belongs to this Teleprompt app or is clearly Vite on port `5173`, stop it:

   ```bash
   kill <pid>
   ```

3. Recheck:

   ```bash
   lsof -nP -iTCP:5173 -sTCP:LISTEN
   ```

4. If it still exists, use one stronger signal only for the same confirmed PID:

   ```bash
   kill -TERM <pid>
   ```

5. Report whether `localhost:5173` is stopped.

## `/localstopall` Workflow

1. List local listening processes:

   ```bash
   lsof -nP -iTCP -sTCP:LISTEN
   ```

2. Identify obvious dev-server candidates by command/name/port, such as:

   - `vite`
   - `next dev`
   - `astro dev`
   - `remix dev`
   - `webpack`
   - `turbo dev`
   - `npm run dev`
   - `pnpm dev`
   - `bun --hot`
   - `node` processes clearly serving app dev ports

3. Stop only confirmed dev-server PIDs:

   ```bash
   kill <pid> <pid>
   ```

4. Recheck local listeners and report what was stopped and what was left alone.

## Notes

- `localhost:5173` is the normal Vite dev server for this app.
- If the server is running from a tool session, sending `Ctrl-C` to that session is preferred when available.
- If permissions block `kill`, request the smallest required escalation for that kill command only.
