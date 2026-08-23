// Prettier standing in for Biome's formatter. Every option below is the same setting the house
// `biome.jsonc` carries, under whatever name Prettier gives it, so a file formatted here matches a
// file formatted there.
//
//   formatter.lineWidth 130       -> printWidth
//   formatter.indentWidth 2       -> tabWidth
//   formatter.indentStyle space   -> useTabs false
//   javascript.formatter.semicolons always        -> semi
//   javascript.formatter.quoteStyle double        -> singleQuote false
//   javascript.formatter.trailingCommas es5       -> trailingComma
//   javascript.formatter.arrowParentheses always  -> arrowParens
//
// `bracketSpacing` and `endOfLine` are the default on both sides and are spelled out here only so
// the mapping above can be read as complete.

/** @type {import("prettier").Config} */
export default {
  printWidth: 130,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
  arrowParens: "always",
  bracketSpacing: true,
  endOfLine: "lf",
};
