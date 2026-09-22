# Lessons

Short notes on mistakes that cost real time, so they do not come back.

## Under legacy-peer-deps, a dropped peer entry is a missing runtime dep

Created: 2026-09-22 03:31 UTC

With `.npmrc` `legacy-peer-deps=true`, npm stops auto-installing peer
dependencies. Any package that was only in `node_modules` because a
dependency listed it as a peer disappears the next time the lockfile is
regenerated.

What happened: merging PR #17 regenerated `package-lock.json`. The diff dropped
a `"peer": true` entry for `zod`. It looked like normalization noise next to a
few hundred `"dev": true` flags. The frontend build passed because nothing in
`src/` imports zod. `npx convex deploy` then failed with
`Could not resolve "zod/v4"` because the `ai` SDK and `@ai-sdk/*` packages
import it inside Convex functions.

Rule: when reviewing a lockfile diff on this repo, treat any removed
`"peer": true` block as a runtime dependency going missing. Either add it to
`dependencies` in `package.json` or confirm nothing imports it. Verify a
lockfile change with `npx convex dev --once` as well as `npm run build`, since
the two bundlers cover different code.
