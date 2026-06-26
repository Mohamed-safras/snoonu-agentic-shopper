---
name: commit-message
description: Generate a conventional, well-structured Git commit message from provided code changes (diffs, file summaries, or change descriptions). Use this skill whenever the user pastes a diff, mentions staged changes, asks "what should my commit say", or wants help writing a commit message — even if they don't say "commit message" explicitly. Trigger on phrases like "write a commit for this", "summarize these changes", or "what should I commit?".
---

# Commit Message Generator

Generate clear, conventional Git commit messages from code changes following the **Conventional Commits** spec.

## Format

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `style`, `ci`, `revert`

**Rules:** Subject ≤72 chars · imperative mood ("add" not "added") · no trailing period · scope is lowercase and optional · body only when the *why* isn't obvious · footer for `BREAKING CHANGE:` or issue refs like `Closes #42`

## Steps

1. Analyze the diff — what was changed, added, or removed?
2. Infer intent — feature, fix, refactor, etc.?
3. Derive scope from file paths or module names
4. Write the subject line; add body/footer only if needed

## Output

Always wrap in a code block for easy copying. If changes span unrelated concerns, suggest splitting into separate commits. If no diff is provided, ask the user to run `git diff --staged`.