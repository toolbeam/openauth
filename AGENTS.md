# Repository Guidelines

## Project Structure & Module Organization
- Root uses Bun workspaces; core package lives in `packages/openauth`.
- Library source: `packages/openauth/src` (issuer, client, providers, storage, ui). Build output lands in `packages/openauth/dist`.
- Tests: `packages/openauth/test` with `.test.ts` files aligned to source areas.
- Examples: `examples/issuer/*` and `examples/client/*` show deployable issuers/clients.
- Site/docs: `www` (Astro), generally independent of the core package.
- Utility scripts: `scripts/format` for repo-wide formatting.

## Build, Test, and Development Commands
- Install deps: `bun install` (root; respects workspaces).
- Build library: `cd packages/openauth && bun run build` (runs `script/build.ts`).
- Run tests: `cd packages/openauth && bun test` (uses Bun’s test runner; `bunfig.toml` points to `test`).
- Format: `./scripts/format` (runs Prettier across the repo and will auto-commit/push; prefer `bun x prettier --write "**/*.{js,jsx,ts,tsx,json,md,yaml,yml}"` locally before invoking).

## Coding Style & Naming Conventions
- TypeScript + ESM everywhere; prefer named exports from modules.
- Prettier governs formatting (default settings; 2-space indent). Keep imports sorted by logical grouping.
- File names are kebab- or lowercase (e.g., `issuer.ts`, `storage/memory.ts`); match existing patterns when adding modules.
- Avoid introducing new dependencies without discussion; keep public exports under `src/` mirrored in `exports` map.

## Testing Guidelines
- Add unit tests beside related domains in `packages/openauth/test` (`<name>.test.ts`).
- Use Bun’s assertions; keep tests deterministic and avoid network calls.
- When adding providers/storage/ui flows, cover happy path plus failure/edge cases (invalid tokens, missing params, PKCE checks, etc.).
- Run `bun test` before pushing; include any new fixtures under `test` rather than `src`.

## Commit & Pull Request Guidelines
- Follow the existing conventional style: `type(scope): short summary` (e.g., `feat(provider): add POST callback...`). `auto: format code` is reserved for the formatter script.
- Reference PR/issue numbers in the subject or body when relevant (e.g., `(#245)`).
- PRs should include: what changed, why, how to verify (commands), and screenshots for UI-facing changes (`www` or `src/ui`).
- Keep commits focused; avoid mixing refactors with feature/bug fixes unless necessary.

## Security & Configuration Tips
- Do not commit secrets or tokens; examples rely on provider credentials set via environment variables.
- Validate new callbacks/handlers against OAuth/OIDC expectations and ensure JWT/PKCE flows remain compliant.
- If adding storage backends, ensure data keys and hashing remain consistent with existing implementations.
