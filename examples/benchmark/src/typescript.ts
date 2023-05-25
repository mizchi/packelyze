import ts from "typescript";

console.log(
  ts.createSourceFile("foo.ts", "const x = 1", ts.ScriptTarget.ES2015, true),
);

export const kind = ts.SyntaxKind;
