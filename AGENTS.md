# AGENTS.md — Instructions for AI Coding Agents

Read `ARCHITECTURE.md` first. It is the source of truth for the driver pattern, AST flow, and module map. This file defines how to write code here.

## Commands

```bash
npm test        # must pass before any PR
npm run build   # tsc + esbuild production bundle, must pass before any PR
```

## Simplicity Rules (highest priority)

1. **Simplest fix wins.** Prefer deleting code over adding it. Prefer a 10-line special case over a 100-line framework.
2. **YAGNI.** Do not add config flags, registries, plugins, or abstractions for hypothetical future use. Solve the issue at hand only.
3. **One responsibility per file.** If a file exceeds ~300 lines, split by domain (e.g. `nodeMutations.ts` / `edgeMutations.ts`), never by arbitrary line count.
4. **No prop-threading.** If a hook/component needs 5+ props threaded through, that state belongs in the Zustand store, not props.
5. **No clever code.** Boring, explicit TypeScript beats clever generics, metaprogramming, or dynamic dispatch. A junior contributor must understand it on first read.
6. **No new dependencies** without asking. `react`, `zustand`, `mermaid` cover 99% of needs.

## Correctness Rules

1. **Mermaid source string is the single source of truth.** Never store layout coordinates. Never mutate SVG DOM to change diagram structure.
2. **All structural edits go through pure AST mutations** (`src/diagrams/<name>/mutations/`): clone → mutate → serialize → verify syntax. See `ARCHITECTURE.md §3.2`.
3. **Never corrupt user code.** Unknown statements (`click`, `accTitle`, `classDef`, `%% comments`, notes) must be preserved verbatim via `ast.rawLines` and re-emitted by the serializer. A visual edit must never drop hand-written Mermaid. This is tested by `*Preservation*.test.ts` and `realWorldDiagrams.test.ts`.
4. **Canvas never branches on diagram type.** Talk only to the `DiagramDriver` contract (`src/diagrams/types.ts`). New diagram support = new package under `src/diagrams/<name>/` + registration in `registry.ts`. If canvas code needs an `if (type === ...)` branch, fix the driver contract instead.
5. **Emit 100% standard Mermaid.** No synthetic comments, no `%% mv: x=...` lock-in.
6. **Pin camera on structural edits.** Call `pinNodeForCamera(activeNodeId)` when sprouting/splitting so the viewport doesn't jump.

## TypeScript & Style

- Strict TS. No `any`, no `// @ts-ignore`. Use `unknown` + narrowing.
- No `enum`; use string-literal unions.
- Prefer `const`/`let` over `var`, and `async`/`await` over `.then()` chains.
- Prefer `readonly` arrays and pure functions in `src/diagrams/`. Side effects live only in `src/canvas/hooks/` and `src/obsidian/`.
- Keep facade `index.ts` re-exports working when moving code.
- Follow existing file naming: `camelCase.ts`, `*.test.ts` next to nothing — all tests live in `tests/`.

## Testing

- Every bug fix needs a regression test in `tests/` proving parse → mutate → serialize round-trip.
- Every new mutation needs coverage in `tests/<name>.test.ts` (see `driverSurface.test.ts` for the contract pattern).
- Prefer small AST-level tests over DOM tests. Only add DOM/interactivity tests when hit-testing is the actual bug.
- Obsidian review rules that are statically checkable are enforced by `tests/obsidianCompliance.test.ts`. Extend that file — don't duplicate the rules elsewhere.

## Workflow

- One issue = one branch = one small PR. Branch names: `fix/<issue>-<slug>`.
- PR body must contain `Fixes #<N>` so the issue auto-closes on merge.
- Keep diffs small (<300 lines preferred). If larger, split into stacked PRs.
- Do not commit `main.js`, `*.png`, `*.svg`, or local vault files unless part of the fix.
