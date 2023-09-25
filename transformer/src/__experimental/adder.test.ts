import ts from "typescript";
import { cloneNode } from "ts-clone-node";
import { expect, test } from "vitest";

test("jsx pure adder", async (t) => {
  const transformer: ts.TransformerFactory<any> = (context) => {
    return (sourceFile) => {
      const visitor: ts.Visitor = (node) => {
        if (ts.isCallExpression(node)) {
          if (ts.isIdentifier(node.expression) && (node.expression.text === "_jsx" || node.expression.text === "_jsxs")) {
            const replaced = ts.addSyntheticLeadingComment(
              cloneNode(node),
              ts.SyntaxKind.MultiLineCommentTrivia,
              "#__PURE__",
            );
            return ts.visitEachChild(replaced, visitor, context);
          }
        }
        return ts.visitEachChild(node, visitor, context);
      };
      return ts.visitEachChild(sourceFile, visitor, context);
    };
  };

  const code = `const el = <><div>hello world</div></>`;
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      jsx: ts.JsxEmit.ReactJSX,  
    },
    transformers: {
      after: [transformer],
    }
  });

  // console.log(transpiled.outputText);
  expect(transpiled.outputText).toBe(`import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
const el = /*#__PURE__*/ _jsx(_Fragment, { children: /*#__PURE__*/ _jsx("div", { children: "hello world" }) });
`)

});