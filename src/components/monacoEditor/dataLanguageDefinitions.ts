import type * as monaco from "monaco-editor";
import { Json5LanguageDef } from "./MonacoLanguageDef";

const json: monaco.languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [/"/, "string", "@string"],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
      [/\b(?:true|false|null)\b/, "keyword"],
      [/[{}\[\]]/, "delimiter.bracket"],
      [/[,:]/, "delimiter"],
    ],
    string: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, "string", "@pop"],
    ],
    comment: [
      [/[^*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/\*/, "comment"],
    ],
  },
};
const toml: monaco.languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      [/#.*$/, "comment"],
      [/^\s*\[\[?[^\]]+\]\]?/, "type.identifier"],
      [/"""/, "string", "@multiline"],
      [/'''/, "string", "@literalMultiline"],
      [/"/, "string", "@string"],
      [/'[^']*'/, "string"],
      [/[A-Za-z0-9_.-]+(?=\s*=)/, "key"],
      [
        /\b\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})?)?/,
        "number",
      ],
      [/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?/, "number"],
      [
        /[+-]?(?:0[xob][\da-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?[\d_]+)?|inf|nan)/,
        "number",
      ],
      [/\b(?:true|false)\b/, "keyword"],
      [/[=,{}\[\]]/, "delimiter"],
    ],
    string: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, "string", "@pop"],
    ],
    multiline: [
      [/"""/, "string", "@pop"],
      [/\\./, "string.escape"],
      [/[^\\"]+/, "string"],
      [/"/, "string"],
    ],
    literalMultiline: [
      [/'''/, "string", "@pop"],
      [/[^']+/, "string"],
      [/'/, "string"],
    ],
  },
};
function separated(delimiter: RegExp): monaco.languages.IMonarchLanguage {
  return {
    tokenizer: {
      root: [
        [/^"|(?<=[,\t])"/, "string", "@quoted"],
        [delimiter, "delimiter"],
        [/[^,"\t]+/, "string"],
        [/./, "string"],
      ],
      quoted: [
        [/""/, "string.escape"],
        [/"/, "string", "@pop"],
        [/[^"]+/, "string"],
      ],
    },
  };
}
export const dataLanguageDefinitions = {
  json5: Json5LanguageDef,
  jsonc: json,
  toml,
  csv: separated(/,/),
  tsv: separated(/\t/),
};
