# Agents — Must-Follow Follow-Ups After Every Code Change

1. Type check after each change: run `pnpm exec tsc --noEmit` and resolve any type errors before committing.
2. Commit message format: use one of `docs: ...`, `update: ...`, or `fix: ...` depending on the change.
3. Push after commit: always push the changes to `origin` on the current branch.

Notes
- `pnpm exec tsc --noEmit` performs a fast, project-wide TypeScript type check without emitting files.
- Do not skip type checking; only proceed to commit/push when the type check passes.
