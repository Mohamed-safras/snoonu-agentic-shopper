/**
 * Custom local ESLint rule: every English literal rendered by a component
 * must go through translate()/useTranslate(), so the app has zero
 * hardcoded UI text and switching language always reflects everywhere,
 * automatically, without relying on a developer remembering to wrap it.
 *
 * Auto-fixes (wraps in translate("...")) when `translate` is already in
 * scope; otherwise reports without a fix, prompting the developer to add
 * `const translate = useTranslate();` first (fixing it blind would emit a
 * ReferenceError at runtime).
 */

const TARGET_ATTRS = new Set(["aria-label", "title", "placeholder", "alt"]);
const HAS_LETTER = /[a-zA-Z]/;

function hasTranslateInScope(context, node) {
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    if (scope.variables.some((variable) => variable.name === "translate")) {
      return true;
    }
    scope = scope.upper;
  }
  return false;
}

function wrap(text) {
  return `{translate(${JSON.stringify(text)})}`;
}

const noHardcodedUiText = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Disallow hardcoded UI text; require translate()/useTranslate().",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        const trimmed = node.value.trim();
        if (!trimmed || !HAS_LETTER.test(trimmed)) return;

        const inScope = hasTranslateInScope(context, node);
        context.report({
          node,
          message: inScope
            ? 'Hardcoded UI text "{{text}}" — wrap it in translate() so it follows the language toggle.'
            : 'Hardcoded UI text "{{text}}" must go through translate(). Add `const translate = useTranslate();` to this component, then re-run --fix.',
          data: { text: trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed },
          fix:
            inScope && !trimmed.includes("\n")
              ? (fixer) => {
                  const raw = node.value;
                  const leading = raw.match(/^\s*/)[0].length;
                  const trailing = raw.match(/\s*$/)[0].length;
                  const start = node.range[0] + leading;
                  const end = node.range[1] - trailing;
                  return fixer.replaceTextRange([start, end], wrap(trimmed));
                }
              : undefined,
        });
      },
      JSXAttribute(node) {
        const attrName = node.name && node.name.name;
        if (typeof attrName !== "string" || !TARGET_ATTRS.has(attrName)) {
          return;
        }
        const value = node.value;
        if (!value || value.type !== "Literal" || typeof value.value !== "string") {
          return;
        }
        const text = value.value;
        if (!text.trim() || !HAS_LETTER.test(text)) return;

        const inScope = hasTranslateInScope(context, node);
        context.report({
          node: value,
          message: inScope
            ? 'Hardcoded "{{attr}}" text "{{text}}" — wrap it in translate() so it follows the language toggle.'
            : 'Hardcoded "{{attr}}" text "{{text}}" must go through translate(). Add `const translate = useTranslate();` to this component, then re-run --fix.',
          data: {
            attr: attrName,
            text: text.length > 40 ? text.slice(0, 40) + "…" : text,
          },
          fix: inScope
            ? (fixer) => fixer.replaceText(value, wrap(text))
            : undefined,
        });
      },
    };
  },
};

export default noHardcodedUiText;
