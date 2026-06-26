---
name: clean-code
description: Review or refactor code for cleanliness — readability, modularity, naming, dead code, and project conventions. Trigger when the user says "clean this up", "refactor", "make this cleaner/more readable", "tidy", "apply clean code", or wants a quality pass after writing a feature. Quality only — it does not hunt for behavioural bugs.
---

# Clean Code

Make code easier to read, change, and trust — **without changing behaviour**. This is a quality pass, not a bug hunt or a feature change. If you spot a real bug, note it separately; don't silently "fix" it inside a cleanup.

## Golden rules

1. **Behaviour-preserving.** Refactors must not change what the code does. If you're unsure, don't.
2. **Small, reviewable changes.** Prefer many focused edits over one sweeping rewrite. Keep diffs readable.
3. **Match the surrounding code.** Mirror existing naming, structure, comment density, and idioms. Consistency beats personal preference.
4. **Verify after.** Run `pnpm exec tsc --noEmit` (and ESLint if configured) after changes. Leave the build green.

## Project conventions (this repo)

- **Modular: one concern per file.** Types, interfaces, schemas, and agents/tools each live in their own file. Don't pile unrelated exports into one module.
- **Nothing hardcoded.** Never hardcode prices, currency conversions, product/suggestion content, categories, or occasions. Pull from the live Snoonu MCP / LLM at runtime; a no-LLM *fallback* may **order or format** real data but must not invent it.
- **Strict TypeScript.** No `any` where a real type fits. Share domain types from `lib/types.ts`; keep them importable on both client and server.
- **Server-only code stays server-only** (`import "server-only"`); client components keep the `"use client"` directive.
- **next/image** for remote/raster images (with `fill`+`sizes` or explicit `width`/`height`); plain `<img>` is correct for local **SVG** logos and **data-URL** images.
- **React Compiler is on** (`reactCompiler: true`): avoid `set-state-in-effect`, reading/writing refs during render, and impure calls (`Date.now()`, `Math.random()`) in render or `useMemo`. Use lazy `useState` initializers, derive during render, or move work into event handlers / async callbacks. Only suppress with a justified `// eslint-disable-next-line` for genuinely-correct hydration / external-sync effects.

## What to look for

**Naming**
- when give variable naming it should be meaning full not single char or short abrivation
- Names reveal intent: `relatedProducts` not `arr`, `isInStock` not `flag`.
- Booleans read as predicates (`hasImage`, `canCheckout`).
- No abbreviations that aren't already idiomatic in the repo.

**Structure**
- Extract a well-named function/component when a block needs a comment to explain *what* it does.
- Replace deep nesting with early returns / guard clauses.
- Collapse duplicated logic into one helper — but only when it's genuinely the same concept (don't over-abstract coincidental similarity).
- Keep functions doing one thing; split mixed responsibilities.

**Dead weight**
- Remove unused imports, variables, props, exports, and commented-out code.
- Delete comments that restate the code; keep comments that explain *why*.
- Pull repeated magic numbers/strings into named constants.

**Types**
- Tighten loose types; prefer unions / string-literals over broad `string`.
- Co-locate shared types in their dedicated file rather than re-declaring.

**Consistency**
- One way to do a thing across the file (prop naming, fetch/error handling, formatting helpers like `fmtPrice`).

## Workflow

1. Read the target file(s) and a couple of neighbours to learn the local style.
2. Make focused edits in place. Don't reorganize files or rename public APIs unless asked.
3. Run `pnpm exec tsc --noEmit`; fix anything you introduced.
4. Summarize the changes as a short bulleted list (what + why), grouped by file.

## Don't

- Don't change behaviour, public signatures, or file layout for "tidiness" unless requested.
- Don't add a dependency or a new abstraction just to remove a few lines.
- Don't reformat a whole file to impose your own style — respect the existing formatter.
- Don't suppress lint errors to "clean" them; fix the cause, or justify the suppression in a comment.
