---
name: update-project-docs
description: Use when the user says /update, @update, update project docs, or asks to sync task.md, changelog.md, and files.md after completing work.
---

# Update project docs

Sync project tracking files after completing work, then provide the commit message as plain copyable text (no git command).

Activate with: `/update`, `@update`, `update project docs`, or `sync project docs`.

## Step 1: Get real dates and see what changed

Run these together:

```bash
git log --date=short -n 10
```

```bash
git diff --stat
```

Use actual commit dates. Never use placeholder dates or future months. The diff stat tells you which files changed so the changelog and commit message are accurate.

## Step 2: Update task.md

Move completed items from `## To Do` or `## In Progress` into `## Recently Completed` with a timestamp:

```markdown
- YYYY-MM-DD HH:mm UTC - Short description of what was done. PRD: prds/slug.md (if one exists).
```

If new work is queued, add it under `## To Do`.

## Step 3: Update changelog.md

Follow https://keepachangelog.com/en/1.0.0/ format. Add the new entry under `## [Unreleased]`:

```markdown
### Added
- What was added with key details (YYYY-MM-DD).

### Changed
- What changed and why (YYYY-MM-DD).

### Fixed
- Bug description and resolution (YYYY-MM-DD).
```

Use real dates from git log. Add timestamps in parentheses when it helps distinguish same day entries.

## Step 4: Update files.md

Only update if new files were added, files were renamed, or existing descriptions are outdated.

- Add new files to the correct section
- Update descriptions for renamed or changed files
- Keep descriptions to one sentence, no emoji

## Step 5: Generate a git commit message

After syncing all docs, output the commit message as plain text only. No `git add`, no `git commit`, no `cat <<'EOF'` wrapper, no shell at all. Just the message in a plain code block so it is easy to copy. Format:

```
<type>: <short summary of the main change>

<optional body: 1-3 bullets covering what changed>
```

Type must be one of: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Rules for the commit message:
- Output only the message text, never a git command
- Present tense ("add feature" not "added feature")
- Subject line under 50 characters
- No period at the end of the subject
- Body bullets only when the change touches more than two concerns
- If the session was purely a docs sync with no code changes, use `docs: sync task, changelog, and files`

## Checklist

Before calling this done:

- [ ] `git log` and `git diff --stat` run to get real dates and changed files
- [ ] `task.md` updated with completed items and timestamps
- [ ] `changelog.md` new entry added with real dates
- [ ] `files.md` updated if files were added, renamed, or changed
- [ ] Commit message printed as plain text for the user to copy

## Notes

- This skill applies to this project. If the project does not have these exact files, adapt the steps to whatever tracking files exist.
- Do not create `README.md`, `CONTRIBUTING.md`, or other documentation files unless explicitly requested.
- Do not run `git commit` yourself, and do not output any git command. Print only the plain commit message text and let the user copy it.
