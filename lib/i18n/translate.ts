/**
 * UI-copy translation primitive. Components call `transalte("English literal")` (see the
 * `useTranslate` hook in hooks); the literal IS the lookup key. The full set of
 * literals lives in `catalog.ts` and is batch-translated + cached on language
 * switch, so there's no per-string key to maintain and no flash of English.
 *
 * Parameterised copy keeps its `{placeholders}` OUT of the translation — the
 * template is translated with the tokens left verbatim, then interpolated here.
 * Product names are passed as vars, so they're injected AFTER translation and
 * always keep their original catalog spelling.
 */
export type Vars = Record<string, string | number>;

/** Replace `{name}` tokens in `template` with values from `vars` (unknown tokens
 *  are left untouched). */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
