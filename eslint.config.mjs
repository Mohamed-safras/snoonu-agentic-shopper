import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noHardcodedUiText from "./eslint-rules/no-hardcoded-ui-text.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Enforce that every component routes its UI text through translate()/
  // useTranslate(), so future hardcoded strings can't silently skip
  // language switching the way the ones fixed in this pass did.
  {
    files: ["components/**/*.tsx"],
    plugins: { local: { rules: { "no-hardcoded-ui-text": noHardcodedUiText } } },
    rules: { "local/no-hardcoded-ui-text": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
