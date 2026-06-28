---
name: sync-agent-skills
description: Use when the user says /syncskills, sync agent skills, update .agents skills from .codex, .cursor, or .claude, or asks to make .agents/skills include skills from other agent folders.
---

# Sync Agent Skills

Use this skill to keep `.agents/skills` as the shared skill folder for this project.

## Source folders

Import skills from these folders when they exist:

- `.codex/skills`
- `.cursor/skills`
- `.claude/skills`

Destination:

- `.agents/skills`

## Rules

- Do not delete skills from `.agents/skills`.
- Do not overwrite existing `.agents/skills` entries unless the user explicitly asks to replace them.
- Prefer `.agents/skills` as the shared, tool-neutral folder.
- Keep tool-specific skills in their original folder only if their instructions do not apply to other tools.
- Report when a source folder does not exist.

## Workflow

1. List current skills:

   ```bash
   find .agents/skills .codex/skills .cursor/skills .claude/skills -maxdepth 2 -name SKILL.md -print 2>/dev/null | sort
   ```

2. Import missing skills without overwriting existing `.agents` skills:

   ```bash
   rsync -a --ignore-existing .codex/skills/ .agents/skills/
   rsync -a --ignore-existing .cursor/skills/ .agents/skills/
   rsync -a --ignore-existing .claude/skills/ .agents/skills/
   ```

3. Verify the aggregate list:

   ```bash
   find .agents/skills -maxdepth 2 -name SKILL.md -print | sort
   ```

4. Report:

   - how many `.agents` skills are now available
   - which source folders were imported
   - whether any source folder was missing

## Optional Mirror

Only if the user explicitly asks to mirror `.agents/skills` back out to other tools:

```bash
rsync -a --ignore-existing .agents/skills/ .codex/skills/
rsync -a --ignore-existing .agents/skills/ .cursor/skills/
rsync -a --ignore-existing .agents/skills/ .claude/skills/
```
