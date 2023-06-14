import prettier from "prettier";
import parser from "prettier/parser-typescript";

export function format(code: string, options: prettier.Options) {
  return prettier.format(code, {
    ...options,
    parser: "typescript",
    plugins: [parser],
  });
}

const findUnusedEol = (code: string) => {
  const hasCrLf = code.includes("\r\n");
  const hasLf = code.includes("\n");
  const hasCr = code.includes("\r");
  if (!hasCrLf) {
    return "crlf";
  }
  if (!hasLf) {
    return "lf";
  }
  if (!hasCr) {
    return "cr";
  }
  return undefined;
};

// simple formatter that removes indent spaces and end of line by prettier
// I will replace it later with a better formatter
export function stripWhitespaces(code: string, fileName?: string) {
  // find unused eol and use it to strip later
  const eol = findUnusedEol(code);
  const out = format(code, {
    semi: true,
    filepath: fileName,
    singleQuote: true,
    trailingComma: "none",
    bracketSpacing: true,
    bracketSameLine: true,
    endOfLine: eol,
    tabWidth: 0,
    useTabs: false,
    printWidth: Infinity,
  });
  if (eol === "lf") {
    return out.replace(/\n/g, "");
  }
  if (eol === "cr") {
    return out.replace(/\r/g, "");
  }
  if (eol === "crlf") {
    return out.replace(/\r\n/g, "");
  }
  return out;
}
