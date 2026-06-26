---
name: pr-review
description: Review a pull request by analyzing code changes, identifying bugs, security issues, and style problems, and providing structured feedback. Use this skill whenever the user pastes a diff, shares a PR link, asks "can you review this PR", "review my code changes", or wants feedback on a pull request — even if they don't say "PR review" explicitly. Trigger on phrases like "review these changes", "what do you think of this diff", or "feedback on my PR".
---

# PR Review

Provide structured, actionable code review feedback from a diff or PR description.

## Review Dimensions

- **Bugs & Logic** — off-by-one errors, null handling, race conditions, wrong assumptions
- **Security** — injection risks, exposed secrets, missing auth/validation, insecure defaults
- **Performance** — unnecessary loops, missing indexes, N+1 queries, memory leaks
- **Readability** — naming, complexity, dead code, missing comments on non-obvious logic
- **Tests** — missing coverage, weak assertions, untested edge cases
- **Design** — single responsibility violations, tight coupling, better abstractions

## Output Format

```
## Summary
One paragraph overview of what the PR does and overall impression.

## Issues
🔴 Critical   — must fix before merge (bugs, security)
🟡 Major      — should fix (logic gaps, missing tests)
🟢 Minor      — nice to fix (style, naming, readability)

## Suggestions
Optional improvements that go beyond correctness.

## Verdict
✅ Approve / 🔄 Request Changes / 💬 Comment
```

## Steps

1. Understand the intent — what is this PR trying to do?
2. Scan for issues across all review dimensions
3. Group findings by severity
4. Give specific line-level feedback where possible
5. End with a clear verdict

If no diff is provided, ask the user to paste one (`git diff main...branch`) or share the PR link.