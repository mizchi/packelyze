import ts from "typescript";
// import { cloneNode } from "ts-clone-node";
import { expect, test } from "vitest";

function isExpressionAlwaysFalsy(node: ts.Expression) {
  // primitive falsy
  if (node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword || node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return true;
  }
  if (ts.isIdentifier(node)) {
    if (node.text === "FALSE") {
      return true;
    }
  }
  return false;
}

test("static replacer", async () => {
  const transformer: ts.TransformerFactory<any> = (context) => {
    return (sourceFile) => {
      const visitor: ts.Visitor = (node) => {
        if (ts.isIfStatement(node)) {
          if (isExpressionAlwaysFalsy(node.expression)) {
            return [];
          }
          return node;
        }
        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitEachChild(sourceFile, visitor, context);
    };
  };
  const code = `if(false) { 'ng'; }
if (true) { 'ok'; }
if (FALSE) { 'ng'; }
if (TRUE) { 'ok'; }
`;
  const source = ts.createSourceFile("test.tsx", code, ts.ScriptTarget.ESNext, true);
  const transpiled = ts.transform(source, [transformer]);
  const printer = ts.createPrinter();
  const output = printer.printFile(transpiled.transformed[0] as ts.SourceFile);
  console.log(output);
  expect(output).not.includes("'ng'");
});