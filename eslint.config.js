// ESLint standing in for Biome's linter, carrying across the rules from the house `biome.jsonc`
// that still mean something here.
//
// Most of that config is about a stack this demo does not have: the React domain, the a11y and
// security rules for JSX, the Tailwind class sorter, the `noRestrictedImports` entries pointing at
// `tailwind-merge`, `sanity:client` and `react`, and the per-folder overrides for `.astro` and
// `sanity/`. None of those have anything to lint against in five files of vanilla JavaScript, so
// they are left out rather than translated into rules that could never fire.
//
// The `../` import ban is left out for a different reason: there it works because `~/` exists as
// the way across folders. This demo has no alias and a two-level tree, so banning `../` would
// forbid something without offering the alternative that makes the rule fair.
//
// What is left is the part that is about JavaScript itself:
//
//   assist.actions.source.organizeImports -> simple-import-sort/imports, /exports
//   correctness.noUnusedImports           -> no-unused-vars
//   correctness.noUnusedVariables         -> no-unused-vars
//   correctness.noUndeclaredVariables     -> no-undef
//   style.useBlockStatements              -> curly
//   style.useSingleVarDeclarator          -> one-var
//   style.useNumberNamespace              -> no-restricted-globals
//   style.noParameterAssign               -> no-param-reassign
//   style.useDefaultParameterLast         -> default-param-last
//   style.noUselessElse                   -> no-else-return

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },

  js.configs.recommended,

  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: globals.browser,
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // Remove all unused variables and imports.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",

      // Enforce braces for `if`/`else` and other control statements.
      curly: ["error", "all"],
      // Prevent comma-separated variable declarations for clarity.
      "one-var": ["error", "never"],
      // Reassigning parameters is usually not a good idea.
      "no-param-reassign": "error",
      // Default parameters come last for better function signatures.
      "default-param-last": "error",
      // Early returns reduce nesting.
      "no-else-return": ["error", { allowElseIf: false }],

      // Enforce Number namespace methods for clarity, e.g. `Number.parseInt()` over `parseInt()`.
      "no-restricted-globals": [
        "error",
        { name: "parseInt", message: "Use Number.parseInt() instead." },
        { name: "parseFloat", message: "Use Number.parseFloat() instead." },
        { name: "isNaN", message: "Use Number.isNaN() instead." },
        { name: "isFinite", message: "Use Number.isFinite() instead." },
        { name: "NaN", message: "Use Number.NaN instead." },
        { name: "Infinity", message: "Use Number.POSITIVE_INFINITY instead." },
      ],
    },
  },

  // Last, so nothing here fights the formatter.
  prettier,
];
