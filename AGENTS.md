# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Verification Loop

**Run the verify scripts. Finish only on exit 0.**

- During implementation, after relevant changes: `npm run verify:fast` (format + lint + typecheck + unit tests, ~5s, no Docker).
- Before concluding the task: `npm run verify` (verify:fast + knip + full test suite + build; requires the dev Postgres: `docker compose -f docker-compose.dev.yml up -d --wait`).

While there are errors: fix, run again. Only conclude when the command exits 0.

## 5. Commit Policy

**Conventional Commits everywhere: commits, branches, PR titles.**

- Commit messages: `tipo(escopo opcional): assunto` — types: `feat fix chore docs refactor test perf ci build revert`. Enforced by the commit-msg hook.
- Branches: `tipo/slug-kebab` (e.g. `feat/baixa-diaria`). Committing on main is blocked locally.
- PR titles follow the same format — the repo squash-merges, so the PR title becomes the commit on main (required `pr-title` check).

## 6. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 7. Self-learning

**Knowledge lives in `docs/knowledge/` — an OKF v0.1 bundle. Read `docs/knowledge/index.md` before starting work to discover available concepts.**

When the user corrects you, or you catch yourself making a mistake: before continuing, add the lesson as a one-line rule to `docs/knowledge/lessons.md`, so it never happens again. Other kinds of reusable knowledge (runbooks, references, schemas, etc.) may be added as new concept files in the same bundle.

Admission criteria — a lesson only enters if it:

- References something concrete of this project (a command, file, version, convention). Generic advice ("verify before assuming") is not a lesson.
- Would change future behavior. If an existing rule already covers it, update that rule instead of adding a duplicate.

Housekeeping: update the `timestamp` in the frontmatter when editing. The lesson rides the current branch/PR (context and lesson reviewed together); if there is no active branch, create `chore/lesson-<slug>`.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
